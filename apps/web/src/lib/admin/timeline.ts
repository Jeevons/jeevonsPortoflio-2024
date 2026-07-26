import "server-only";

import { prisma } from "@/lib/db";

// Story 5.14 — Lectures ADMIN du parcours (AC1, AC2).
//
// ⚠️ PIÈGE n°5 — NE PAS réutiliser `lib/timeline.ts` ici.
// La lecture publique est `unstable_cache` + `readWithFallback` + filtre
// `published: true`. Trois raisons de ne pas la réutiliser côté admin, les
// mêmes qu'en 5.8 pour les projets :
//  - CACHE : l'admin doit voir l'état RÉEL. Une liste cachée une heure
//    n'afficherait pas l'entrée qui vient d'être créée ;
//  - FILTRE : l'admin gère AUSSI ses brouillons — c'est précisément ce que
//    l'AC3 suppose (une entrée non publiée existe, mais reste invisible côté
//    public) ;
//  - REPLI : le fallback statique (4.5) MENTIRAIT sur un écran de gestion — on
//    éditerait un contenu figé sans écrire nulle part. Ici, une base
//    injoignable doit se VOIR.
//
// En revanche, les deux côtés PARTAGENT le tag `CACHE_TAGS.timeline` : les
// mutations invalident la lecture publique (AC2, AC4). C'est le seul point de
// contact, et il est volontaire.

/** Une ligne de la liste admin — seulement ce que le tableau affiche. */
export type AdminTimelineRow = {
  id: string;
  slug: string;
  title: string;
  place: string;
  startYear: number;
  endYear: number | null;
  published: boolean;
};

/** Résultat de la liste. `available: false` = base injoignable, PAS « 0 entrée ». */
export type AdminTimelineList =
  { available: true; rows: AdminTimelineRow[] } | { available: false };

/**
 * Liste TOUTES les entrées du parcours, publiées ou non (AC1, AC3).
 *
 * Triée dans l'ORDRE D'AFFICHAGE PUBLIC (`sortOrder`), et non par année : c'est
 * l'ordre que Jeevons manipule à l'écran de réordonnancement, donc celui qu'il
 * doit retrouver dans la liste. Trier par année ici donnerait deux vérités
 * différentes sur « quel est l'ordre de mon parcours ».
 *
 * Tri secondaire par `startYear` puis `title` : plusieurs entrées peuvent
 * partager le même `sortOrder` (notamment `0` avant tout réordonnancement).
 * Sans ce départage, Postgres renverrait ces lignes dans un ordre non garanti
 * et la liste « sauterait » d'un rendu à l'autre.
 */
export async function listAdminTimeline(): Promise<AdminTimelineList> {
  try {
    const rows = await prisma.timelineEntry.findMany({
      orderBy: [{ sortOrder: "asc" }, { startYear: "asc" }, { title: "asc" }],
      select: {
        id: true,
        slug: true,
        title: true,
        place: true,
        startYear: true,
        endYear: true,
        published: true,
      },
    });

    return { available: true, rows };
  } catch (error) {
    // Même discipline de log qu'en 5.7/5.8 : cause aplatie sur une ligne,
    // jamais de secret.
    const raw = error instanceof Error ? error.message : String(error);
    console.error(
      `[admin] Liste du parcours indisponible. Cause : ${raw.replace(/\s+/g, " ").trim()}`,
    );
    return { available: false };
  }
}

/** Une entrée complète, telle que l'éditeur la charge (AC1). */
export type AdminTimelineEntry = {
  id: string;
  slug: string;
  title: string;
  place: string;
  body: string;
  startYear: number;
  /** `null` = entrée toujours en cours (AC1). */
  endYear: number | null;
  /** Illustration, `null` si l'entrée n'en a pas. */
  avatarId: string | null;
  published: boolean;
};

/**
 * Charge UNE entrée pour l'éditeur (AC1). `null` si l'identifiant n'existe pas
 * — la page rend alors un 404.
 */
export async function getAdminTimelineEntry(
  id: string,
): Promise<AdminTimelineEntry | null> {
  return prisma.timelineEntry.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      title: true,
      place: true,
      body: true,
      startYear: true,
      endYear: true,
      avatarId: true,
      published: true,
    },
  });
}

// ---------------------------------------------------------------------------
// Lecture dédiée à l'ÉCRAN DE RÉORDONNANCEMENT (AC2).
// ---------------------------------------------------------------------------

/** Une ligne déplaçable de l'écran de tri. Volontairement minimale. */
export type ReorderableTimelineEntry = {
  id: string;
  title: string;
  place: string;
  startYear: number;
  endYear: number | null;
  published: boolean;
};

/** Résultat du chargement. `available: false` = base injoignable, PAS « 0 entrée ». */
export type TimelineOrder =
  | { available: true; entries: ReorderableTimelineEntry[] }
  | { available: false };

/**
 * Charge les entrées dans leur ordre d'affichage public actuel (AC2).
 *
 * ⚠️ Contrairement aux projets (5.10), il n'y a PAS de groupement : le parcours
 * est une séquence unique, sans catégories. Une seule séquence `sortOrder`
 * 0..n-1 pour tout le parcours, ce que reflète l'index
 * `@@index([published, sortOrder])` et la lecture publique de `lib/timeline.ts`.
 *
 * Les brouillons sont inclus : Jeevons place une entrée avant de la publier.
 *
 * Même tri secondaire que `listAdminTimeline`, et pour la même raison
 * (`sortOrder` non unique avant tout réordonnancement).
 */
export async function listTimelineForReorder(): Promise<TimelineOrder> {
  try {
    const entries = await prisma.timelineEntry.findMany({
      orderBy: [{ sortOrder: "asc" }, { startYear: "asc" }, { title: "asc" }],
      select: {
        id: true,
        title: true,
        place: true,
        startYear: true,
        endYear: true,
        published: true,
      },
    });

    return { available: true, entries };
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    console.error(
      `[admin] Ordre du parcours indisponible. Cause : ${raw.replace(/\s+/g, " ").trim()}`,
    );
    return { available: false };
  }
}
