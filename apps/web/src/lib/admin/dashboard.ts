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
 * Les cinq derniers messages reçus (AC1).
 *
 * ⚠️ Renvoie TOUJOURS un tableau vide aujourd'hui : le modèle `ContactMessage`
 * appartient à la story 5.18 et n'existe pas encore au schéma. Le créer ici
 * serait du scope-creep (périmètre verrouillé de la story).
 *
 * L'AC dit « les cinq derniers messages reçus, S'IL EN EXISTE » : l'état vide
 * est donc conforme. Cette fonction est le POINT DE BRANCHEMENT unique de 5.18 —
 * son corps sera remplacé par un `prisma.contactMessage.findMany({ take: 5,
 * orderBy: { createdAt: "desc" } })`, et la carte se remplira sans qu'une seule
 * ligne d'interface change (`RecentMessage` est déjà le contrat attendu).
 */
export async function getRecentMessages(): Promise<RecentMessage[]> {
  return [];
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
