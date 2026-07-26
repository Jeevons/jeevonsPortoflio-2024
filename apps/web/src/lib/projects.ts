import "server-only";

import { unstable_cache } from "next/cache";

import { fallbackProjects, fallbackStacks } from "@/content/fallbacks";
import { CACHE_TAGS, REVALIDATE_SECONDS } from "@/lib/cache-tags";
import { prisma } from "@/lib/db";
import { readWithFallback } from "@/lib/read-with-fallback";
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
// Story 5.15 — TECHNOLOGIES affichées publiquement (AC3).
// ---------------------------------------------------------------------------

/**
 * Toutes les technologies, pour la toolbox publique (« Mon pack d'explorateur »).
 *
 * ⚠️ TRI PAR NIVEAU DÉCROISSANT, et c'est ce qui rend l'AC3 observable
 * (décision Jeevons : le niveau ordonne, il ne s'affiche pas en badge).
 * Modifier un niveau depuis l'administration déplace donc visiblement la
 * technologie dans la bande — sans quoi « les niveaux sont reflétés côté
 * public » n'aurait aucune traduction à l'écran.
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
    select: { id: true, name: true, iconKey: true, level: true },
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
};

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
