import "server-only";

import { unstable_cache } from "next/cache";

import {
  fallbackProjects,
  fallbackStacks,
  fallbackTimeline,
} from "@/content/fallbacks";
import { CACHE_TAGS, REVALIDATE_SECONDS } from "@/lib/cache-tags";
import { prisma } from "@/lib/db";
import { readWithFallback } from "@/lib/read-with-fallback";

// Story 6.14 — CHIFFRES CLÉS, calculés depuis les données réelles (AC1).
//
// 🛑 POURQUOI UNE LECTURE NEUVE plutôt que réutiliser les lectures existantes.
//
// `getPublishedProjects(category)` prend une catégorie OBLIGATOIRE et charge les
// projets AVEC leurs relations (highlights, cover). L'appeler deux fois pour n'en
// garder que le nombre chargerait toute la base pour afficher un entier. Ici, on
// COMPTE — `prisma.*.count()` — et rien de plus.
//
// 🛑 DEUX TAGS DE CACHE, ET C'EST LA SUBTILITÉ DE CETTE LECTURE. Elle croise deux
// domaines : les projets/technologies (`projects`) et le parcours (`timeline`).
// ❌ Sans le tag `timeline`, modifier une étape de parcours ne rafraîchirait
// JAMAIS le chiffre des années d'expérience — il resterait figé jusqu'à
// l'expiration de l'ISR.
//
// ⚠️ `readWithFallback` n'accepte qu'UN domaine (c'est son paramètre de
// journalisation, pas d'invalidation). On déclare `projects` : deux des trois
// chiffres en viennent, c'est le domaine dominant. ❌ Ne pas modifier la
// signature de ce module, partagé par toutes les lectures publiques.
//
// ❌ AUCUN CHIFFRE CODÉ EN DUR. AC1 l'exclut explicitement, et un chiffre faux
// sur un portfolio de recrutement est un risque en soi. Les chiffres retenus sont
// exactement ceux que la base permet de calculer.

/** Agrégats bruts. `experienceYears` est `null` quand il n'est pas dérivable. */
export type PortfolioStats = {
  /** Projets publiés, TOUTES CATÉGORIES (« les chiffres clés du portfolio »). */
  publishedProjects: number;
  /** Technologies. `Stack` n'a pas de colonne `published` (schéma 4.1). */
  stacks: number;
  /**
   * Années d'expérience — une DÉRIVATION, pas une donnée stockée :
   * `année courante − min(startYear des entrées publiées)`.
   *
   * 🛑 `null` quand aucune entrée de parcours n'est publiée. ❌ Surtout pas `0`,
   * `NaN` ni `-Infinity` : `Math.min()` sur un tableau vide renvoie `Infinity`,
   * et la soustraction produirait `-Infinity` à l'écran.
   */
  experienceYears: number | null;
};

/**
 * Comptages en base.
 *
 * 🛑 `published: true` EST DANS LA REQUÊTE, jamais un filtre appliqué en JS après
 * coup — même invariant que les autres lectures publiques : un brouillon ne doit
 * pas seulement être masqué, il ne doit pas sortir de la base.
 *
 * ⚠️ La lecture des `startYear` est volontairement MINIMALE (`select` d'une seule
 * colonne) : on ne charge pas des entrées complètes pour en tirer un minimum.
 */
async function queryPortfolioStats(): Promise<PortfolioStats> {
  const [publishedProjects, stacks, startYears] = await Promise.all([
    prisma.project.count({ where: { published: true } }),
    prisma.stack.count(),
    prisma.timelineEntry.findMany({
      where: { published: true },
      select: { startYear: true },
    }),
  ]);

  return {
    publishedProjects,
    stacks,
    experienceYears: deriveExperienceYears(
      startYears.map((entry) => entry.startYear),
    ),
  };
}

/**
 * Années d'expérience depuis les années de début du parcours.
 *
 * ⚠️ `new Date()` dans le rendu d'une page statique fige l'année au moment du
 * build. Avec `revalidate = 3600`, la page se régénère au moins toutes les heures
 * et le chiffre se corrige donc de lui-même au premier jour de l'an suivant.
 * ✅ Acceptable ; ❌ ne pas rendre la page dynamique pour cela.
 *
 * ⚠️ Un `startYear` dans le futur (saisie erronée) donnerait un nombre négatif :
 * on borne à `null` plutôt que d'afficher « −2 ans d'expérience ».
 */
function deriveExperienceYears(startYears: number[]): number | null {
  if (startYears.length === 0) return null;

  const years = new Date().getFullYear() - Math.min(...startYears);
  return years > 0 ? years : null;
}

const cachedPortfolioStats = unstable_cache(
  queryPortfolioStats,
  ["portfolio-stats"],
  {
    // 🛑 LES DEUX TAGS. Voir l'avertissement en tête de module.
    tags: [CACHE_TAGS.projects, CACHE_TAGS.timeline],
    revalidate: REVALIDATE_SECONDS,
  },
);

/**
 * Agrégats de repli, calculés depuis le contenu statique (story 4.5).
 *
 * ⚠️ CES CHIFFRES NE SONT PAS CEUX DE LA BASE, et c'est assumé : ils décrivent le
 * contenu statique servi quand la base est injoignable. Le site reste debout avec
 * des chiffres cohérents avec ce qu'il affiche à ce moment-là (NFR17) — mieux
 * qu'une section absente ou une page d'erreur.
 */
function fallbackPortfolioStats(): PortfolioStats {
  // `fallbackProjects` est indexée PAR CATÉGORIE : il n'existe pas de liste
  // « tous projets » côté repli non plus.
  const projects = [
    ...fallbackProjects("FLAGSHIP"),
    ...fallbackProjects("PERSONAL"),
  ];

  return {
    publishedProjects: projects.length,
    stacks: fallbackStacks().length,
    experienceYears: deriveExperienceYears(
      fallbackTimeline().map((entry) => entry.startYear),
    ),
  };
}

export async function getPortfolioStats(): Promise<PortfolioStats> {
  return readWithFallback(
    CACHE_TAGS.projects,
    () => cachedPortfolioStats(),
    () => fallbackPortfolioStats(),
  );
}
