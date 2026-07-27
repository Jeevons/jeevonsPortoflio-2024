import "server-only";

import { prisma } from "@/lib/db";

// Story 5.18 — Lectures ADMIN de la boîte de réception (AC2, AC5).
//
// ⚠️ Aucun `unstable_cache`, même discipline que `lib/admin/dashboard.ts` et
// `lib/admin/timeline.ts` : l'admin doit voir l'état RÉEL de sa boîte de
// réception, pas un instantané mis en cache. Il n'y a d'ailleurs AUCUNE lecture
// publique équivalente à réutiliser — ces messages sont des données
// personnelles de tiers (AGENTS.md §6), jamais exposées au rendu public.

/** Une ligne de la boîte de réception (AC2). */
export type AdminMessageRow = {
  id: string;
  name: string;
  email: string;
  /** Aperçu tronqué du corps — la liste ne rend jamais le message complet. */
  excerpt: string;
  read: boolean;
  createdAt: Date;
};

/** Résultat de la liste. `available: false` = base injoignable, PAS « 0 message ». */
export type AdminMessageList =
  { available: true; rows: AdminMessageRow[] } | { available: false };

const EXCERPT_LENGTH = 140;

function excerpt(body: string): string {
  if (body.length <= EXCERPT_LENGTH) return body;
  return `${body.slice(0, EXCERPT_LENGTH).trimEnd()}…`;
}

/**
 * Liste tous les messages, du plus récent au plus ancien (AC2).
 *
 * Pas de filtre lu/non lu ici : l'AC2 demande que les non lus soient
 * DISTINGUÉS visuellement dans une liste unique, pas isolés dans un onglet.
 */
export async function listAdminMessages(): Promise<AdminMessageList> {
  try {
    const rows = await prisma.contactMessage.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        body: true,
        read: true,
        createdAt: true,
      },
    });

    return {
      available: true,
      rows: rows.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        excerpt: excerpt(row.body),
        read: row.read,
        createdAt: row.createdAt,
      })),
    };
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    console.error(
      `[admin] Liste des messages indisponible. Cause : ${raw.replace(/\s+/g, " ").trim()}`,
    );
    return { available: false };
  }
}

/** Un message complet, tel que l'écran de lecture l'affiche (AC3). */
export type AdminMessage = {
  id: string;
  name: string;
  email: string;
  body: string;
  ip: string | null;
  read: boolean;
  createdAt: Date;
};

/**
 * Charge UN message pour l'écran de lecture (AC3). `null` si l'identifiant
 * n'existe pas — la page rend alors un 404.
 *
 * ⚠️ Ne marque PAS le message comme lu : c'est le rôle explicite d'une mutation
 * séparée (`markMessageReadAction`, piège n°3 — un simple chargement/prefetch
 * ne doit jamais avoir cet effet de bord).
 */
export async function getAdminMessage(
  id: string,
): Promise<AdminMessage | null> {
  return prisma.contactMessage.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      body: true,
      ip: true,
      read: true,
      createdAt: true,
    },
  });
}
