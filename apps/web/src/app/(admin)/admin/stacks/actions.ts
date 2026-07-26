"use server";

import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";

import { buildDiff, resolveAuditUserId, writeAudit } from "@/lib/admin/audit";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { prisma } from "@/lib/db";
import { requireAdmin, UnauthorizedError } from "@/lib/require-admin";
import {
  stackFormDataToInput,
  stackSchema,
  type StackInput,
} from "@/lib/schemas/stack";

// Story 5.15 — MUTATIONS des technologies (AC1, AC2, AC3).
//
// ⚠️ Même pattern que 5.8 / 5.14, sans dévier :
//
//   requireAdmin()  →  stackSchema.parse()  →  prisma.write()  →  revalidateTag()
//
// ⚠️ Le tag invalidé est `projects`, PAS un tag « stacks » : la lecture publique
// des technologies (`getPublicStacks`, 5.15) est cachée sous ce tag, comme les
// projets. Un tag dédié obligerait à invalider les deux à chaque écriture de
// projet (les technologies s'affichent sur les cartes) — pour aucun gain.
//
// ⚠️ AuditLog : story 5.19. Ne pas l'anticiper ici.

/** Retour des actions de sauvegarde, consommé par `useActionState`. */
export type StackFormState = {
  status: "idle" | "error";
  /** Message global (nom déjà pris, session expirée, panne). */
  message: string | null;
  /** Erreurs par champ, mêmes messages que côté client (schéma partagé). */
  fieldErrors: Partial<Record<keyof StackInput, string>>;
};

// ⚠️ Dans un module `"use server"`, TOUT export runtime doit être une fonction
// async : l'état initial vit côté client. Les `export type` sont effacés à la
// compilation — ils restent autorisés.

const SESSION_EXPIRED =
  "Session expirée. Reconnectez-vous pour enregistrer vos modifications.";
const GENERIC_ERROR = "L'enregistrement a échoué. Réessayez dans un instant.";

/** Message de conflit d'unicité : nomme la CAUSE et l'ACTION à mener (AC1). */
function nameConflictMessage(name: string): string {
  return `La technologie « ${name} » existe déjà. Modifiez celle qui existe plutôt que d'en créer une seconde.`;
}

/**
 * Détecte le conflit d'unicité Prisma sur `name` (P2002) — AC1.
 *
 * ⚠️ Aucune pré-vérification par `findUnique` avant l'écriture : entre la
 * lecture et l'écriture, un doublon peut s'insérer (course critique). La
 * contrainte `name @unique` du schéma 4.1 est la SEULE garantie réelle ; on la
 * laisse parler et on TRADUIT son erreur au lieu de laisser remonter une 500.
 *
 * Code lu de façon structurelle (`code === "P2002"`) sans importer la classe
 * d'erreur générée : en Prisma 7 un `instanceof` dessus est fragile au rebuild.
 */
function isNameConflict(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ((error as { code?: unknown }).code !== "P2002") return false;
  const target = (error as { meta?: { target?: unknown } }).meta?.target;
  if (Array.isArray(target)) return target.includes("name");
  if (typeof target === "string") return target.includes("name");
  // `target` absent : `name` est la seule contrainte unique du modèle `Stack`.
  return true;
}

/** Détecte P2025 — la technologie a disparu (autre onglet, autre session). */
function isMissingRecord(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2025"
  );
}

const MISSING_STACK_ERROR =
  "Cette technologie n'existe plus. Rafraîchissez la liste.";

/**
 * Garde + validation communes à la création et à la modification.
 *
 * Factorisé pour que create et update ne puissent PAS diverger dans leurs
 * règles — exactement le risque que la validation partagée vise à écarter.
 */
async function guardAndValidate(
  formData: FormData,
): Promise<
  | { ok: true; data: StackInput; email: string | null | undefined }
  | { ok: false; state: StackFormState }
> {
  let email: string | null | undefined;
  try {
    const session = await requireAdmin();
    email = session.user?.email;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return {
        ok: false,
        state: { status: "error", message: SESSION_EXPIRED, fieldErrors: {} },
      };
    }
    throw error;
  }

  const parsed = stackSchema.safeParse(stackFormDataToInput(formData));

  if (!parsed.success) {
    // Une saisie invalide est REFUSÉE côté serveur même si le client l'a laissée
    // passer. Les messages viennent du schéma partagé : rigoureusement les mêmes
    // qu'affiche le navigateur.
    const fieldErrors: StackFormState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === "string" && !(field in fieldErrors)) {
        fieldErrors[field as keyof StackInput] = issue.message;
      }
    }
    return {
      ok: false,
      state: {
        status: "error",
        message: "Certains champs sont invalides. Corrigez-les puis réessayez.",
        fieldErrors,
      },
    };
  }

  return { ok: true, data: parsed.data, email };
}

/**
 * Crée une technologie (AC1, AC3).
 *
 * ⚠️ `redirect()` fonctionne en LEVANT une exception spéciale : il doit rester
 * HORS de tout `try/catch` qui l'avalerait. D'où l'appel en fin de fonction.
 */
export async function createStackAction(
  _prevState: StackFormState,
  formData: FormData,
): Promise<StackFormState> {
  const guard = await guardAndValidate(formData);
  if (!guard.ok) return guard.state;

  let createdId: string;
  try {
    const created = await prisma.stack.create({
      data: guard.data,
      select: { id: true },
    });
    createdId = created.id;

    const userId = await resolveAuditUserId(guard.email);
    if (userId) {
      await writeAudit({
        userId,
        action: "CREATE",
        entity: "Stack",
        entityId: createdId,
        diff: buildDiff("Stack", undefined, guard.data),
      });
    }
  } catch (error) {
    if (isNameConflict(error)) {
      return {
        status: "error",
        message: nameConflictMessage(guard.data.name),
        fieldErrors: { name: "Ce nom est déjà pris." },
      };
    }
    const raw = error instanceof Error ? error.message : String(error);
    console.error(
      `[admin] Création de technologie échouée. Cause : ${raw.replace(/\s+/g, " ").trim()}`,
    );
    return { status: "error", message: GENERIC_ERROR, fieldErrors: {} };
  }

  // AC3 — Sans cette invalidation, la nouvelle technologie n'apparaîtrait dans
  // la toolbox publique qu'à l'expiration de l'ISR (1 h).
  revalidateTag(CACHE_TAGS.projects, { expire: 0 });

  redirect(`/admin/stacks/${createdId}`);
}

/**
 * Modifie une technologie existante (AC1, AC3).
 *
 * L'identifiant vient d'un champ caché : entrée non fiable elle aussi. On ne le
 * valide pas par un schéma (c'est un cuid opaque), mais `prisma.update` échoue
 * proprement sur un identifiant inconnu (P2025).
 *
 * Pas de transaction : une seule écriture, donc déjà atomique. Les associations
 * `ProjectStacks` ne sont PAS touchées ici — renommer une technologie ou changer
 * son niveau ne modifie aucun projet.
 */
export async function updateStackAction(
  _prevState: StackFormState,
  formData: FormData,
): Promise<StackFormState> {
  const guard = await guardAndValidate(formData);
  if (!guard.ok) return guard.state;

  const rawId = formData.get("id");
  const id = typeof rawId === "string" ? rawId : "";
  if (!id) {
    return { status: "error", message: GENERIC_ERROR, fieldErrors: {} };
  }

  try {
    const before = await prisma.stack.findUnique({
      where: { id },
      select: { name: true, iconKey: true, level: true },
    });

    await prisma.stack.update({
      where: { id },
      data: guard.data,
      select: { id: true },
    });

    const userId = await resolveAuditUserId(guard.email);
    if (userId) {
      await writeAudit({
        userId,
        action: "UPDATE",
        entity: "Stack",
        entityId: id,
        diff: buildDiff("Stack", before ?? undefined, guard.data),
      });
    }
  } catch (error) {
    if (isNameConflict(error)) {
      return {
        status: "error",
        message: nameConflictMessage(guard.data.name),
        fieldErrors: { name: "Ce nom est déjà pris." },
      };
    }
    if (isMissingRecord(error)) {
      return {
        status: "error",
        message: MISSING_STACK_ERROR,
        fieldErrors: {},
      };
    }
    const raw = error instanceof Error ? error.message : String(error);
    console.error(
      `[admin] Modification de technologie échouée. Cause : ${raw.replace(/\s+/g, " ").trim()}`,
    );
    return { status: "error", message: GENERIC_ERROR, fieldErrors: {} };
  }

  // AC3 — Un changement de niveau doit réordonner la toolbox publique, ce qui
  // n'arrive que si le cache est invalidé.
  revalidateTag(CACHE_TAGS.projects, { expire: 0 });

  redirect("/admin/stacks?saved=1");
}

/** Retour de la suppression — seul un échec a besoin d'être communiqué (AC2). */
export type DeleteStackState = {
  status: "idle" | "error";
  message: string | null;
};

/**
 * Supprime une technologie (AC2).
 *
 * ⚠️ LES PROJETS NE SONT PAS SUPPRIMÉS, et il n'y a rien à écrire pour cela :
 * `ProjectStacks` est une relation many-to-many IMPLICITE (schéma 4.1). Prisma
 * gère lui-même la table de jonction, dont les lignes disparaissent avec la
 * `Stack` — les `Project` de l'autre côté ne sont jamais touchés. Ajouter ici un
 * `update` de dissociation avant le `delete` serait redondant, et une
 * transaction ne protégerait rien de plus qu'une écriture unique.
 *
 * ⚠️ L'AVERTISSEMENT exigé par l'AC2 (nombre de projets concernés) vit dans
 * l'interface (`delete-stack-dialog`, alimenté par `findStackUsage`), pas ici :
 * une Server Action n'a pas de dialogue. Le comptage n'est PAS refait ici pour
 * bloquer quoi que ce soit — contrairement à la garde média de 5.13, la
 * suppression est AUTORISÉE : on avertit, on ne refuse pas.
 */
export async function deleteStackAction(
  _prevState: DeleteStackState,
  formData: FormData,
): Promise<DeleteStackState> {
  let email: string | null | undefined;
  try {
    const session = await requireAdmin();
    email = session.user?.email;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { status: "error", message: SESSION_EXPIRED };
    }
    throw error;
  }

  const rawId = formData.get("id");
  const id = typeof rawId === "string" ? rawId : "";
  if (!id) {
    return { status: "error", message: MISSING_STACK_ERROR };
  }

  try {
    await prisma.stack.delete({ where: { id }, select: { id: true } });

    const userId = await resolveAuditUserId(email);
    if (userId) {
      await writeAudit({
        userId,
        action: "DELETE",
        entity: "Stack",
        entityId: id,
      });
    }
  } catch (error) {
    // P2025 : déjà supprimée ailleurs. Ce n'est pas une panne — on le dit sans
    // alarmer.
    if (isMissingRecord(error)) {
      return { status: "error", message: MISSING_STACK_ERROR };
    }
    const raw = error instanceof Error ? error.message : String(error);
    console.error(
      `[admin] Suppression de technologie échouée. Cause : ${raw.replace(/\s+/g, " ").trim()}`,
    );
    return {
      status: "error",
      message: "La suppression a échoué. Réessayez dans un instant.",
    };
  }

  // AC3 — La technologie doit disparaître de la toolbox publique ET des cartes
  // de projet, toutes deux cachées sous le tag `projects`.
  revalidateTag(CACHE_TAGS.projects, { expire: 0 });

  redirect("/admin/stacks?deleted=1");
}
