import "server-only";

import { prisma } from "@/lib/db";

// Story 5.7 — Lectures du tableau de bord admin (AC1).
//
// ⚠️ AUCUN `unstable_cache` ici, contrairement aux lectures publiques
// (`lib/projects.ts`, `lib/timeline.ts`). L'admin doit voir l'état RÉEL de sa
// base : un compteur mis en cache une heure afficherait « 3 projets » juste
// après en avoir publié un quatrième. Le back-office n'a pas de contrainte de
// charge (utilisateur unique), le coût de deux `count()` est négligeable.
//
// ⚠️ Pas de `readWithFallback` non plus : le repli statique de la story 4.5
// existe pour que le SITE PUBLIC ne tombe jamais en erreur. Sur l'admin, un
// repli mentirait — afficher les compteurs du fallback laisserait croire que la
// base répond. Ici l'échec est traité localement (voir `getProjectCounts`) et
// signalé honnêtement à l'écran.

/** Compteurs de projets. `available: false` = base injoignable, pas « 0 projet ». */
export type ProjectCounts = {
  published: number;
  drafts: number;
  /**
   * `false` si la lecture a échoué. Distingue un portfolio VIDE (AC3, état
   * d'accueil légitime) d'une base INJOIGNABLE (incident à signaler) — sans
   * cette distinction, les deux afficheraient « 0 » et AC3 serait faussement
   * satisfait pendant une panne.
   */
  available: boolean;
};

/**
 * Compte les projets publiés et les brouillons (AC1).
 *
 * Un seul aller-retour : `groupBy` sur `published` plutôt que deux `count()`.
 * Les catégories ne sont pas distinguées — l'AC demande un total.
 */
export async function getProjectCounts(): Promise<ProjectCounts> {
  try {
    const grouped = await prisma.project.groupBy({
      by: ["published"],
      _count: { _all: true },
    });

    // `groupBy` n'émet une ligne que pour les valeurs PRÉSENTES : sur une base
    // sans aucun brouillon, la ligne `published: false` est absente. On part
    // donc de 0 et on additionne, au lieu de lire `grouped[0]`/`grouped[1]`.
    let published = 0;
    let drafts = 0;
    for (const row of grouped) {
      if (row.published) {
        published = row._count._all;
      } else {
        drafts = row._count._all;
      }
    }

    return { published, drafts, available: true };
  } catch (error) {
    // Même discipline de log que `readWithFallback` (story 4.5) : cause aplatie
    // sur une ligne, jamais de secret (le message Prisma cite hôte:port, pas
    // les identifiants).
    const raw = error instanceof Error ? error.message : String(error);
    console.error(
      `[admin] Compteurs de projets indisponibles. Cause : ${raw.replace(/\s+/g, " ").trim()}`,
    );
    return { published: 0, drafts: 0, available: false };
  }
}

/** Un message reçu, réduit à ce que la carte du dashboard affiche. */
export type RecentMessage = {
  id: string;
  name: string;
  email: string;
  excerpt: string;
  receivedAt: Date;
};

/**
 * Compte les messages NON LUS (piège n°6, 5.18 — carte « messages » du
 * dashboard, référencée par 5.7 en état gracieux avant que `ContactMessage`
 * n'existe). `null` si la lecture échoue : même discipline que
 * `ProjectCounts.available`, un 0 muet mentirait pendant une panne.
 */
export async function getUnreadMessageCount(): Promise<number | null> {
  try {
    return await prisma.contactMessage.count({ where: { read: false } });
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    console.error(
      `[admin] Compte de messages non lus indisponible. Cause : ${raw.replace(/\s+/g, " ").trim()}`,
    );
    return null;
  }
}

const EXCERPT_LENGTH = 100;

function excerpt(body: string): string {
  if (body.length <= EXCERPT_LENGTH) return body;
  return `${body.slice(0, EXCERPT_LENGTH).trimEnd()}…`;
}

/**
 * Les cinq derniers messages reçus (AC1).
 *
 * Story 5.18 — le point de branchement annoncé par 5.7 : `ContactMessage`
 * existe désormais. Même discipline que le reste du dashboard (pas de cache,
 * échec traité localement) — voir l'en-tête du fichier.
 */
export async function getRecentMessages(): Promise<RecentMessage[]> {
  try {
    const rows = await prisma.contactMessage.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        body: true,
        createdAt: true,
      },
    });

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      excerpt: excerpt(row.body),
      receivedAt: row.createdAt,
    }));
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    console.error(
      `[admin] Derniers messages indisponibles. Cause : ${raw.replace(/\s+/g, " ").trim()}`,
    );
    return [];
  }
}

/** Fréquentation des 7 derniers jours, ou l'absence de mesure. */
export type TrafficSummary =
  { available: true; views: number; visitors: number } | { available: false };

/**
 * Fréquentation des sept derniers jours (AC1).
 *
 * ⚠️ Renvoie TOUJOURS `{ available: false }` : la mesure d'audience (Umami)
 * appartient à l'Epic 7 (PLAN §10) et n'est pas déployée. L'AC autorise
 * explicitement « une mention si la mesure n'est pas encore disponible » — c'est
 * ce que l'interface affiche, plutôt qu'un « 0 vue » trompeur.
 *
 * Point de branchement unique pour l'Epic 7, au même titre que
 * `getRecentMessages` pour la 5.18.
 */
export async function getTrafficSummary(): Promise<TrafficSummary> {
  return { available: false };
}
