import "server-only";

// Story 4.5 — Adaptateurs : transforment le contenu statique (src/content/*)
// en objets AU MÊME SHAPE que les lectures Prisma (PublishedProject,
// TimelineEntryData, HobbyData, lignes SiteSetting). Ainsi les composants
// reçoivent des données identiques, que la source soit la DB ou le repli.
//
// Ce module est `server-only` : il n'est utilisé que dans les fonctions de
// lecture (chemin serveur). Les modules `src/content/*` restent, eux, du pur
// data importable aussi par le seed.

import { projectsContent } from "@/content/projects";
import { settingsContent } from "@/content/settings";
import { hobbiesContent, timelineContent } from "@/content/timeline";
import type { ProjectCategory } from "@/generated/prisma/enums";
import type { PublishedProject } from "@/lib/projects";
import type { HobbyData, TimelineEntryData } from "@/lib/timeline";

// Date figée pour les champs createdAt/updatedAt du repli (valeur stable, non
// affichée). Évite un Date.now() qui rendrait le fallback non déterministe.
const FALLBACK_DATE = new Date(0);

// Projets de repli d'une catégorie, triés + highlights ordonnés, au shape exact
// de getPublishedProjects (colonnes Project + highlights inclus).
export function fallbackProjects(
  category: ProjectCategory,
): PublishedProject[] {
  return projectsContent
    .filter((p) => p.category === category)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((p) => ({
      id: `fallback-${p.slug}`,
      slug: p.slug,
      category: p.category,
      company: p.company,
      title: p.title,
      description: null,
      period: p.period,
      sortOrder: p.sortOrder,
      published: true,
      link: p.link,
      repoUrl: null,
      // Story 5.9 — le contenu statique de repli ne porte pas de résultat
      // chiffré : `null`, donc la carte masque simplement la section (AC4).
      outcome: null,
      createdAt: FALLBACK_DATE,
      updatedAt: FALLBACK_DATE,
      highlights: p.highlights.map((label, index) => ({
        id: `fallback-${p.slug}-hl-${index}`,
        label,
        sortOrder: index,
        projectId: `fallback-${p.slug}`,
      })),
    }));
}

// Parcours de repli, trié par sortOrder, au shape de getPublishedTimeline.
export function fallbackTimeline(): TimelineEntryData[] {
  return timelineContent
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((e) => ({
      id: `fallback-${e.slug}`,
      slug: e.slug,
      title: e.title,
      place: e.place,
      body: e.body,
      avatarId: null,
      startYear: e.startYear,
      endYear: e.endYear,
      sortOrder: e.sortOrder,
      published: true,
    }));
}

// Hobbies de repli, triés par sortOrder, au shape de getHobbies.
export function fallbackHobbies(): HobbyData[] {
  return hobbiesContent
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((h) => ({
      id: `fallback-${h.slug}`,
      slug: h.slug,
      title: h.title,
      emoji: h.emoji,
      posLeft: h.posLeft,
      posTop: h.posTop,
      sortOrder: h.sortOrder,
    }));
}

// Réglages de repli, au shape des lignes lues par settings.ts ({ key, value }).
export function fallbackSettingRows(): { key: string; value: unknown }[] {
  return settingsContent.map((s) => ({ key: s.key, value: s.value }));
}
