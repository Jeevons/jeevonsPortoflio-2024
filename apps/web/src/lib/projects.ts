import "server-only";

import { unstable_cache } from "next/cache";

import { fallbackProjects } from "@/content/fallbacks";
import { CACHE_TAGS, REVALIDATE_SECONDS } from "@/lib/cache-tags";
import { prisma } from "@/lib/db";
import { readWithFallback } from "@/lib/read-with-fallback";
import type { ProjectCategory } from "@/generated/prisma/enums";

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
