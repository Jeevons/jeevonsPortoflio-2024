import "server-only";

import { unstable_cache } from "next/cache";

import { fallbackHobbies, fallbackTimeline } from "@/content/fallbacks";
import { CACHE_TAGS, REVALIDATE_SECONDS } from "@/lib/cache-tags";
import { prisma } from "@/lib/db";
import { readWithFallback } from "@/lib/read-with-fallback";

// Lecture serveur du parcours publié (Story 4.2, AC2). Filtre `published: true`
// DANS la requête, tri par `sortOrder`.
//
// Story 4.4 : enrobée dans `unstable_cache`, tag `timeline`. Décision Jeevons :
// le tag `timeline` couvre parcours ET hobbies → les deux lectures partagent le
// même tag et sont invalidées ensemble par `revalidateTag('timeline')`.
function queryPublishedTimeline() {
  return prisma.timelineEntry.findMany({
    where: { published: true },
    orderBy: { sortOrder: "asc" },
  });
}

const cachedPublishedTimeline = unstable_cache(
  queryPublishedTimeline,
  ["published-timeline"],
  { tags: [CACHE_TAGS.timeline], revalidate: REVALIDATE_SECONDS },
);

export async function getPublishedTimeline() {
  return readWithFallback(
    CACHE_TAGS.timeline,
    () => cachedPublishedTimeline(),
    () => fallbackTimeline(),
  );
}

// Centres d'intérêt (Story 4.2). Pas de `published` (modèle §2.1 : toujours
// affichés). Tri par `sortOrder` pour préserver l'ordre d'origine.
function queryHobbies() {
  return prisma.hobby.findMany({
    orderBy: { sortOrder: "asc" },
  });
}

const cachedHobbies = unstable_cache(queryHobbies, ["hobbies"], {
  tags: [CACHE_TAGS.timeline],
  revalidate: REVALIDATE_SECONDS,
});

export async function getHobbies() {
  return readWithFallback(
    CACHE_TAGS.timeline,
    () => cachedHobbies(),
    () => fallbackHobbies(),
  );
}

export type TimelineEntryData = Awaited<
  ReturnType<typeof queryPublishedTimeline>
>[number];
export type HobbyData = Awaited<ReturnType<typeof queryHobbies>>[number];
