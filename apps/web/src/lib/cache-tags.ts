// Story 4.4 — Contrat de tags de cache par domaine.
//
// ⚠️ CONTRAT INTER-STORIES : ces trois noms sont repris TELS QUELS en Epic 5.
// Chaque mutation admin appellera `revalidateTag(CACHE_TAGS.projects | .timeline
// | .settings)` (PLAN §3.3). Centralisé ici pour éviter toute faute de frappe
// silencieuse entre la pose du tag (lecture) et son invalidation.
//
// Décision Jeevons (4.4) : `timeline` couvre le parcours (TimelineEntry) ET les
// centres d'intérêt (Hobby) — même section conceptuelle « parcours/about ».
// Éditer une étape OU un hobby en Epic 5 invalide le même tag `timeline`.
export const CACHE_TAGS = {
  projects: "projects",
  timeline: "timeline",
  settings: "settings",
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];

// Ensemble des tags valides — utilisé pour valider l'entrée de la route de
// revalidation (refuser un tag inconnu).
export const CACHE_TAG_VALUES = Object.values(CACHE_TAGS) as CacheTag[];

export function isCacheTag(value: string): value is CacheTag {
  return (CACHE_TAG_VALUES as string[]).includes(value);
}

// Durée de revalidation périodique (ISR) : 1 heure (AC1).
export const REVALIDATE_SECONDS = 3600;
