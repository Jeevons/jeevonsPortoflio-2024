import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

// Story 5.19 — Journalisation des mutations admin (AC1-4).
//
// ⚠️ PIÈGE n°1 (CENTRAL) — `writeAudit` ne doit être appelé qu'APRÈS le succès
// confirmé de la mutation qu'il journalise, dans le même `try` (jamais un
// `catch`/`finally`) : AUCUNE entrée ne doit exister pour une opération qui n'a
// pas abouti (AC3). Ne JAMAIS appeler ce helper de façon optimiste avant
// confirmation serveur.
//
// ⚠️ PIÈGE n°2 (CENTRAL) — `diff` ne doit contenir QUE des champs listés dans
// une ALLOW-LIST explicite par entité (`ENTITY_FIELDS` ci-dessous), jamais un
// dump de l'objet entier. Les champs sensibles (`passwordHash`, `totpSecret`,
// `totpLastCounter`, `recoveryCodes`) ne figurent dans AUCUNE allow-list — un
// oubli d'exclusion serait un défaut de sécurité, pas une simple maladresse.
// Pour `User`/2FA, les actions n'appellent d'ailleurs jamais `buildDiff` : elles
// passent un `diff` fixe, sans valeur (ex. `{ totpEnabled: true }`).
//
// ⚠️ PIÈGE n°3 — Pour les champs de texte long (`description`, `body`), l'allow-
// list ne capture PAS la valeur avant/après mais un simple indicateur de
// changement (`{ changed: true }`) : un diff exploitable, jamais un blob opaque.

/** Champs journalisables par entité — ALLOW-LIST, jamais une deny-list. */
const LONG_TEXT_FIELDS = new Set(["description", "body"]);

const ENTITY_FIELDS: Record<string, readonly string[]> = {
  Project: [
    "slug",
    "title",
    "company",
    "category",
    "description",
    "period",
    "outcome",
    "published",
    "link",
    "repoUrl",
    "coverId",
  ],
  TimelineEntry: [
    "slug",
    "title",
    "place",
    "body",
    "avatarId",
    "startYear",
    "endYear",
    "published",
  ],
  Stack: ["name", "iconKey", "level"],
  SiteSetting: ["key"],
  ContactMessage: ["read"],
  Media: ["path", "alt"],
};

type Entity = keyof typeof ENTITY_FIELDS;

/**
 * Construit un diff lisible `{ champ: { before, after } }` à partir de
 * l'ALLOW-LIST de l'entité — jamais un diff naïf de l'objet entier (piège
 * n°2). Les champs absents de l'allow-list sont silencieusement ignorés, y
 * compris s'ils diffèrent : c'est la protection, pas un oubli.
 *
 * `before`/`after` peuvent être `undefined` (ex. création : pas de `before`).
 */
export function buildDiff(
  entity: Entity,
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const fields = ENTITY_FIELDS[entity] ?? [];
  const diff: Record<string, unknown> = {};

  for (const field of fields) {
    const beforeValue = before?.[field];
    const afterValue = after?.[field];
    if (beforeValue === afterValue) continue;

    if (LONG_TEXT_FIELDS.has(field)) {
      diff[field] = { changed: true };
      continue;
    }

    diff[field] = { before: beforeValue ?? null, after: afterValue ?? null };
  }

  return diff;
}

export type WriteAuditInput = {
  userId: string;
  action: "CREATE" | "UPDATE" | "DELETE";
  entity: string;
  entityId?: string;
  diff?: Record<string, unknown>;
};

/**
 * Écrit UNE entrée de journal (AC2). Appeler uniquement après succès confirmé
 * de la mutation (piège n°1) — voir l'en-tête du fichier.
 *
 * Une panne d'écriture du journal est signalée mais n'interrompt PAS le flux
 * appelant : la mutation métier de l'admin a déjà réussi, et son propre
 * `redirect()`/retour ne doit pas être bloqué par un incident de traçabilité.
 * C'est un compromis délibéré, pas un oubli — la même discipline que les
 * lectures admin (`getProjectCounts` etc.) : on logue, on n'alarme pas l'UI.
 */
export async function writeAudit(input: WriteAuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        diff: (input.diff as Prisma.InputJsonValue | undefined) ?? undefined,
      },
      select: { id: true },
    });
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    console.error(
      `[admin] Écriture du journal d'audit échouée (${input.entity}/${input.action}). Cause : ${raw.replace(/\s+/g, " ").trim()}`,
    );
  }
}

/**
 * Résout l'`id` du `User` admin courant à partir de son e-mail de session
 * (`requireAdmin`/`requireAdminApi` ne renvoient qu'une `Session`, pas le
 * `User` Prisma). Utilisé par chaque point de branchement pour obtenir le
 * `userId` requis par `AuditLog` (piège n°4).
 *
 * Renvoie `null` si l'e-mail est absent de la session ou le compte introuvable
 * — cas déjà exclu en pratique par `requireAdmin` (compte unique), mais géré
 * sans lever pour ne jamais faire échouer la mutation appelante à cause du
 * seul journal.
 */
export async function resolveAuditUserId(
  email: string | null | undefined,
): Promise<string | null> {
  if (!email) return null;
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  return user?.id ?? null;
}

/** Une entrée du journal, pour l'écran de consultation `/admin/audit`. */
export type AuditLogRow = {
  id: string;
  userEmail: string;
  action: string;
  entity: string;
  entityId: string | null;
  diff: unknown;
  createdAt: Date;
};

export type AuditLogList =
  { available: true; rows: AuditLogRow[] } | { available: false };

/**
 * Liste anti-chronologique du journal (piège n°6). Lecture ADMIN non mise en
 * cache — même discipline que `lib/admin/dashboard.ts`/`lib/admin/messages.ts` :
 * le journal doit refléter l'état réel, jamais un instantané figé.
 */
export async function listAuditLog(): Promise<AuditLogList> {
  try {
    const rows = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        diff: true,
        createdAt: true,
        user: { select: { email: true } },
      },
    });
    return {
      available: true,
      rows: rows.map((row) => ({
        id: row.id,
        userEmail: row.user.email,
        action: row.action,
        entity: row.entity,
        entityId: row.entityId,
        diff: row.diff,
        createdAt: row.createdAt,
      })),
    };
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    console.error(
      `[admin] Lecture du journal d'audit indisponible. Cause : ${raw.replace(/\s+/g, " ").trim()}`,
    );
    return { available: false };
  }
}
