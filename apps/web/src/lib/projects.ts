import "server-only";

import { unstable_cache } from "next/cache";

import { fallbackProjects, fallbackStacks } from "@/content/fallbacks";
import { CACHE_TAGS, REVALIDATE_SECONDS } from "@/lib/cache-tags";
import { prisma } from "@/lib/db";
import { readWithFallback } from "@/lib/read-with-fallback";
import {
  isKnownStackDomain,
  STACK_DOMAIN_FALLBACK_LABEL,
  STACK_DOMAIN_LABELS,
  STACK_DOMAINS,
} from "@/lib/schemas/stack";
import type { ProjectCategory, SkillLevel } from "@/generated/prisma/enums";

// Lecture serveur des projets publiés d'une catégorie (Story 4.1, AC3/AC4).
// Le filtre `published: true` (AC4) se fait DANS la requête, pas en JS après
// coup. Tri par `sortOrder` (ordre d'affichage), highlights ordonnés aussi.
//
// Story 4.4 : la lecture Prisma (hors `fetch`) est enrobée dans `unstable_cache`
// et étiquetée `projects`. La catégorie fait partie de la clé de cache → une
// entrée par catégorie, toutes invalidées par `revalidateTag('projects')`.
function queryPublishedProjects(category: ProjectCategory) {
  return prisma.project.findMany({
    where: { category, published: true },
    orderBy: { sortOrder: "asc" },
    include: {
      highlights: { orderBy: { sortOrder: "asc" } },
      // Story 5.12 — Couverture téléversée (AC5). `cover` est nullable : un
      // projet sans illustration reste parfaitement valide.
      cover: true,
    },
  });
}

const cachedPublishedProjects = unstable_cache(
  queryPublishedProjects,
  ["published-projects"],
  { tags: [CACHE_TAGS.projects], revalidate: REVALIDATE_SECONDS },
);

// Story 4.5 : lecture résiliente. Le try/catch entoure l'appel CACHÉ (le repli
// n'est jamais mis en cache → retour auto au réel quand la DB revient).
export async function getPublishedProjects(category: ProjectCategory) {
  return readWithFallback(
    CACHE_TAGS.projects,
    () => cachedPublishedProjects(category),
    () => fallbackProjects(category),
  );
}

export type PublishedProject = Awaited<
  ReturnType<typeof queryPublishedProjects>
>[number];

// ---------------------------------------------------------------------------
// Story 6.10 — LECTURE D'UN PROJET PUBLIÉ PAR SON SLUG (AC1, AC3).
// ---------------------------------------------------------------------------

/**
 * Un projet publié, désigné par son `slug`.
 *
 * 🛑 `published: true` EST DANS LA REQUÊTE, jamais un filtre appliqué en JS
 * après coup. C'est l'invariant d'AC3 : un brouillon ne doit pas seulement être
 * masqué à l'affichage, il ne doit **jamais sortir de la base** sur ce chemin.
 * Un filtre post-requête laisserait le contenu non publié transiter par le
 * cache partagé de `unstable_cache` — donc servable à n'importe qui.
 *
 * ⚠️ `stacks` est inclus ici alors que la lecture par catégorie ne le fait pas :
 * les technologies sont l'un des contenus attendus par AC1 (« le contexte, le
 * rôle tenu et les technologies employées »), et la carte, elle, n'en a pas
 * besoin. On ne les ajoute donc PAS à la lecture de liste, qui les paierait sur
 * chaque projet de la page d'accueil sans les afficher.
 */
function queryPublishedProjectBySlug(slug: string) {
  return prisma.project.findFirst({
    where: { slug, published: true },
    include: {
      highlights: { orderBy: { sortOrder: "asc" } },
      cover: true,
      stacks: { orderBy: { name: "asc" } },
    },
  });
}

const cachedPublishedProjectBySlug = unstable_cache(
  queryPublishedProjectBySlug,
  ["published-project-by-slug"],
  { tags: [CACHE_TAGS.projects], revalidate: REVALIDATE_SECONDS },
);

/**
 * Repli statique d'un projet, par slug.
 *
 * ⚠️ Le repli de la story 4.5 est indexé PAR CATÉGORIE (`fallbackProjects`) :
 * il n'existe aucune entrée par slug. On parcourt donc les deux catégories.
 *
 * ✅ SÛR POUR AC3, et c'est vérifié : `fallbackProjects` force `published: true`
 * sur chaque entrée (`content/fallbacks.ts`), et le contenu statique de
 * `content/projects.ts` ne contient que d'anciens projets publiés. Base
 * injoignable, ce chemin ne peut donc pas servir de brouillon.
 * 🛑 SI DES ENTRÉES SONT AJOUTÉES AU REPLI, MAINTENIR CET INVARIANT.
 *
 * ⚠️ Le repli ne porte NI `stacks` (relation, absente du contenu statique) NI
 * `cover` (ligne `Media`, en base par construction). La page doit donc traiter
 * ces deux blocs comme absents — ce qu'AC2 impose déjà pour tout champ vide.
 */
function fallbackProjectBySlug(slug: string): PublishedProjectDetail | null {
  const match = [
    ...fallbackProjects("FLAGSHIP"),
    ...fallbackProjects("PERSONAL"),
  ].find((project) => project.slug === slug);

  return match ? { ...match, stacks: [] } : null;
}

/**
 * Lecture résiliente (story 4.5) d'un projet publié par slug.
 *
 * Renvoie `null` quand le slug est inconnu OU que le projet est un brouillon :
 * l'appelant en fait un `notFound()`. 🛑 Un brouillon doit produire un VRAI 404
 * (AC3), pas une page vide en 200 — c'est une règle de sécurité, pas
 * d'affichage.
 */
export async function getPublishedProjectBySlug(slug: string) {
  return readWithFallback(
    CACHE_TAGS.projects,
    () => cachedPublishedProjectBySlug(slug),
    () => fallbackProjectBySlug(slug),
  );
}

export type PublishedProjectDetail = NonNullable<
  Awaited<ReturnType<typeof queryPublishedProjectBySlug>>
>;

/**
 * Les slugs publiés, pour `generateStaticParams` (pré-rendu) et le sitemap.
 *
 * ⚠️ Même contrat de cache et de repli que les lectures ci-dessus : le sitemap
 * ne doit PAS faire d'appel Prisma nu, qui contournerait à la fois le cache 4.4
 * et la résilience 4.5.
 */
function queryPublishedProjectSlugs() {
  return prisma.project.findMany({
    where: { published: true },
    select: { slug: true, updatedAt: true },
    orderBy: { sortOrder: "asc" },
  });
}

const cachedPublishedProjectSlugs = unstable_cache(
  queryPublishedProjectSlugs,
  ["published-project-slugs"],
  { tags: [CACHE_TAGS.projects], revalidate: REVALIDATE_SECONDS },
);

export async function getPublishedProjectSlugs() {
  return readWithFallback(
    CACHE_TAGS.projects,
    () => cachedPublishedProjectSlugs(),
    () =>
      [...fallbackProjects("FLAGSHIP"), ...fallbackProjects("PERSONAL")].map(
        (project) => ({ slug: project.slug, updatedAt: project.updatedAt }),
      ),
  );
}

// ---------------------------------------------------------------------------
// Story 5.15 — TECHNOLOGIES affichées publiquement (AC3).
// ---------------------------------------------------------------------------

/**
 * Toutes les technologies, pour la toolbox publique (« Mon pack d'explorateur »).
 *
 * ⚠️ TRI PAR NIVEAU DÉCROISSANT, ce qui rend l'AC3 de 5.15 observable : modifier
 * un niveau depuis l'administration déplace visiblement la technologie.
 *
 * 🛑 CORRECTION story 6.13 — ce commentaire affirmait « décision Jeevons : le
 * niveau ordonne, il ne s'affiche pas en badge ». **Ce n'est plus vrai** : la
 * section « Stack & outils » (6.13, AC1) AFFICHE désormais le niveau en toutes
 * lettres, à côté de chaque technologie. Le tri reste, il s'y ajoute — il ne
 * remplace plus l'affichage. La toolbox « Mon pack d'explorateur », elle,
 * continue de n'en montrer que l'ordre.
 *
 * `level` est NULLABLE (schéma 4.1, et le seed ne le renseigne pas) : les
 * technologies sans niveau passent en dernier plutôt que d'être masquées.
 * Le tri secondaire par nom garantit un ordre stable — sans lui, deux
 * technologies de même niveau sortiraient dans un ordre non garanti par
 * Postgres et la bande « sauterait » d'un rendu à l'autre.
 *
 * ⚠️ Pas de filtre `published` : `Stack` n'a pas cette colonne (schéma 4.1).
 * Une technologie créée dans l'administration est donc publique immédiatement —
 * c'est le modèle existant, pas une décision de cette story.
 */
function queryPublicStacks() {
  return prisma.stack.findMany({
    select: {
      id: true,
      name: true,
      iconKey: true,
      level: true,
      domain: true,
    },
    orderBy: [{ name: "asc" }],
  });
}

const cachedPublicStacks = unstable_cache(
  queryPublicStacks,
  ["public-stacks"],
  {
    // Même tag que les projets : les technologies appartiennent au domaine
    // « projects » (contrat 4.4). Toute mutation de `Stack` appelle donc
    // `revalidateTag('projects')` et rafraîchit cette lecture (AC3).
    tags: [CACHE_TAGS.projects],
    revalidate: REVALIDATE_SECONDS,
  },
);

/** Poids de tri : le plus élevé passe en premier. `null` = non renseigné. */
const LEVEL_WEIGHT: Record<SkillLevel, number> = {
  STRONG: 3,
  COMFORTABLE: 2,
  LEARNING: 1,
};

function levelWeight(level: SkillLevel | null): number {
  return level === null ? 0 : LEVEL_WEIGHT[level];
}

/**
 * Le tri par niveau se fait EN JS et non dans `orderBy` : l'ordre voulu
 * (STRONG → COMFORTABLE → LEARNING → non renseigné) n'est ni l'ordre
 * alphabétique ni l'ordre de déclaration de l'enum Postgres, et l'exprimer en
 * SQL demanderait un `CASE` brut. La liste tient en quelques dizaines de
 * lignes : le coût est nul, la règle reste lisible et testable ici.
 */
function sortStacksByLevel<
  T extends { name: string; level: SkillLevel | null },
>(stacks: T[]): T[] {
  return stacks
    .slice()
    .sort(
      (a, b) =>
        levelWeight(b.level) - levelWeight(a.level) ||
        a.name.localeCompare(b.name, "fr"),
    );
}

export async function getPublicStacks(): Promise<PublicStack[]> {
  const stacks = await readWithFallback(
    CACHE_TAGS.projects,
    () => cachedPublicStacks(),
    () => fallbackStacks(),
  );

  return sortStacksByLevel(stacks);
}

export type PublicStack = {
  id: string;
  name: string;
  iconKey: string | null;
  level: SkillLevel | null;
  /**
   * Story 6.13 — domaine de regroupement, NULLABLE : les technologies sans
   * domaine sont regroupées à part, jamais masquées.
   */
  domain: string | null;
};

// ---------------------------------------------------------------------------
// Story 6.13 — REGROUPEMENT PAR DOMAINE (AC1).
// ---------------------------------------------------------------------------

/** Un domaine et ses technologies, prêt à rendre. Jamais vide (voir plus bas). */
export type StackGroup = {
  /** Clé stable pour `key` React — le libellé peut changer, pas elle. */
  key: string;
  label: string;
  stacks: PublicStack[];
};

/**
 * Regroupe les technologies par domaine, dans l'ORDRE DÉTERMINISTE de
 * `STACK_DOMAINS` (AC1).
 *
 * 🛑 AUCUN GROUPE VIDE N'EST RENVOYÉ. C'est la moitié d'AC3 à l'échelle du
 * groupe : un domaine sans technologie ne doit produire ni titre ni liste — un
 * lecteur d'écran annoncerait sinon un intitulé suivi de « liste, 0 élément ».
 *
 * 🛑 LE GROUPE DE REPLI PASSE EN DERNIER, et il existe : les technologies dont
 * `domain` est `null` — ou porte une valeur retirée de `STACK_DOMAINS` — y sont
 * versées. ❌ Elles ne sont JAMAIS écartées : la colonne est nullable par
 * construction (aucune technologie existante n'avait de domaine avant 6.13), les
 * omettre viderait le site de son contenu.
 *
 * ⚠️ L'ORDRE INTERNE EST CELUI REÇU — niveau décroissant puis nom, décidé par
 * `getPublicStacks`. ❌ On ne retrie SURTOUT pas ici : ce serait annuler la
 * hiérarchie que le tri exprime.
 */
export function groupStacksByDomain(stacks: PublicStack[]): StackGroup[] {
  const groups: StackGroup[] = [];

  for (const domain of STACK_DOMAINS) {
    const matching = stacks.filter((stack) => stack.domain === domain);
    if (matching.length === 0) continue;
    groups.push({
      key: domain,
      label: STACK_DOMAIN_LABELS[domain],
      stacks: matching,
    });
  }

  const ungrouped = stacks.filter(
    (stack) => stack.domain === null || !isKnownStackDomain(stack.domain),
  );
  if (ungrouped.length > 0) {
    groups.push({
      key: "__fallback",
      label: STACK_DOMAIN_FALLBACK_LABEL,
      stacks: ungrouped,
    });
  }

  return groups;
}

// ---------------------------------------------------------------------------
// Story 5.11 — Lecture d'APERÇU (AC2). Brouillons INCLUS, JAMAIS cachée.
// ---------------------------------------------------------------------------

/**
 * Les projets d'une catégorie, brouillons COMPRIS, pour le mode aperçu.
 *
 * ⚠️ PIÈGE CENTRAL (n°1) — cette lecture est délibérément SÉPARÉE du chemin
 * public ci-dessus, et pour deux raisons cumulatives :
 *
 *  1. Elle n'est PAS cachée. `cachedPublishedProjects` est enrobée dans
 *     `unstable_cache` sous le tag `projects`, partagé par tous les visiteurs et
 *     agnostique de la session. Y faire transiter un brouillon le rendrait
 *     servable à n'importe qui jusqu'à la prochaine invalidation — une fuite de
 *     contenu non publié, c'est-à-dire exactement ce que l'AC1 interdit. Le
 *     cache public ne doit contenir QUE du publié : c'est l'invariant.
 *  2. Elle n'a pas de repli statique. `readWithFallback` (4.5) sert
 *     `src/content/*.ts`, qui ne contient que de l'ancien contenu PUBLIÉ : il
 *     n'aurait aucun brouillon à montrer et mentirait sur ce qui est en base.
 *     L'aperçu suppose la base joignable ; si elle ne l'est pas, l'appelant
 *     retombe sur la lecture publique (donc sur le repli), ce qui est le
 *     comportement le moins surprenant.
 *
 * ⚠️ L'autorisation ne se décide PAS ici : l'appelant DOIT avoir validé la
 * session via `isPreviewActive` (lib/preview.ts) avant d'appeler cette
 * fonction. Elle est nommée `…ForPreview` pour que tout appel non gardé saute
 * aux yeux à la relecture.
 */
export async function getProjectsForPreview(category: ProjectCategory) {
  try {
    return await queryProjectsForPreview(category);
  } catch (error) {
    // Base injoignable EN APERÇU : plutôt que de faire tomber la page entière,
    // on retombe sur la lecture publique (cachée, avec son repli statique 4.5).
    // L'aperçu ne montre alors aucun brouillon — acceptable, il en suppose
    // l'accès à la base — mais le site reste debout (NFR17).
    const raw = error instanceof Error ? error.message : String(error);
    console.error(
      `[preview] Lecture d'aperçu échouée — lecture publique servie. Cause : ${raw.replace(/\s+/g, " ").trim()}`,
    );
    return getPublishedProjects(category);
  }
}

function queryProjectsForPreview(category: ProjectCategory) {
  return prisma.project.findMany({
    // Aucun filtre `published` : l'aperçu montre le contenu tel qu'il SERA une
    // fois publié (AC2), donc brouillons et projets publiés ensemble, dans
    // l'ordre d'affichage réel.
    where: { category },
    orderBy: { sortOrder: "asc" },
    include: {
      highlights: { orderBy: { sortOrder: "asc" } },
      // Story 5.12 — Couverture téléversée (AC5). `cover` est nullable : un
      // projet sans illustration reste parfaitement valide.
      cover: true,
    },
  });
}
