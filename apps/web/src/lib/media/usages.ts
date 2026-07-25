import "server-only";

import { prisma } from "@/lib/db";

// Story 5.13 — GARDE D'INTÉGRITÉ : qui utilise cette image ? (AC3, AC4)
//
// C'est le cœur de la story. Supprimer une image encore utilisée casserait
// silencieusement des contenus publiés ; cette détection est la seule chose qui
// l'empêche.
//
// ⚠️ POURQUOI UNE VÉRIFICATION APPLICATIVE ET NON LES CLÉS ÉTRANGÈRES.
// Tous les usages d'un média ne sont PAS des relations Prisma :
//  - `Project.coverId` EST une vraie relation (5.12), déclarée `onDelete:
//    SetNull` — la base accepterait donc la suppression et VIDERAIT la
//    couverture des projets concernés, sans rien signaler ;
//  - `TimelineEntry.avatarId` est un `String?` SANS relation déclarée (décision
//    de la story 4.2 : « pas de relation ici, joint par slug »). Aucune
//    contrainte ne le protège du tout.
// S'en remettre à la base laisserait donc passer les deux cas. La détection est
// faite ici, explicitement, colonne par colonne.
//
// ⚠️ CONÇU POUR ÊTRE ÉTENDU. Les stories 5.14 (avatars du parcours) et 5.17
// (CV) ajouteront des références à `Media`. Chacune doit ajouter SON test dans
// `findMediaUsages` — c'est le point unique à compléter, et l'oublier ferait
// réapparaître exactement le trou que cette story vient boucher.

/** Un contenu qui référence le média, décrit pour être AFFICHÉ tel quel. */
export type MediaUsage = {
  /** Type de contenu, pour grouper la liste (« Projet », « Parcours »…). */
  kind: string;
  /** Libellé identifiant le contenu aux yeux de Jeevons (AC3 : « précisément »). */
  label: string;
};

/**
 * Recense TOUS les contenus utilisant ce média (AC3).
 *
 * Renvoie un tableau vide si le média est libre — c'est la seule condition qui
 * autorise sa suppression.
 */
export async function findMediaUsages(mediaId: string): Promise<MediaUsage[]> {
  const usages: MediaUsage[] = [];

  // 1. Couvertures de projet (relation déclarée, story 5.12).
  const projects = await prisma.project.findMany({
    where: { coverId: mediaId },
    select: { title: true, company: true },
    orderBy: { title: "asc" },
  });
  for (const project of projects) {
    usages.push({
      kind: "Projet",
      // Titre ET entreprise : deux projets peuvent porter le même titre chez
      // des clients différents. L'AC3 demande de dire PRÉCISÉMENT quel contenu
      // utilise l'image.
      label: `${project.title} — ${project.company}`,
    });
  }

  // 2. Avatars du parcours (`String?` SANS relation — cf. en-tête).
  //
  // ⚠️ Testé DÈS MAINTENANT, avant même que la story 5.14 ne permette d'en
  // associer : la colonne existe déjà et peut être renseignée par le seed ou à
  // la main. Attendre 5.14 laisserait un angle mort exploitable entre-temps.
  const timelineEntries = await prisma.timelineEntry.findMany({
    where: { avatarId: mediaId },
    select: { title: true, place: true },
    orderBy: { title: "asc" },
  });
  for (const entry of timelineEntries) {
    usages.push({
      kind: "Parcours",
      label: `${entry.title} — ${entry.place}`,
    });
  }

  // 3. Story 5.17 (CV) — À COMPLÉTER ICI quand une référence média sera
  //    ajoutée. Ne pas créer un second point de détection ailleurs.

  return usages;
}

/**
 * Recense les usages de TOUS les médias en une seule passe, pour la grille.
 *
 * ⚠️ Pourquoi une fonction séparée plutôt qu'un `findMediaUsages` par vignette :
 * la grille affiche N images. Appeler la version unitaire dans une boucle ferait
 * 2×N requêtes — le fameux N+1, qui rend l'écran de plus en plus lent à mesure
 * que la bibliothèque grossit. Ici : deux requêtes, quel que soit N.
 *
 * ⚠️ Ce recensement sert l'AFFICHAGE (griser le bouton, expliquer pourquoi).
 * Il ne remplace PAS `findMediaUsages` au moment de supprimer : la garde doit
 * relire l'état courant, pas se fier à ce qu'un écran a affiché il y a cinq
 * minutes.
 */
export async function findAllMediaUsages(): Promise<Map<string, MediaUsage[]>> {
  const byMedia = new Map<string, MediaUsage[]>();

  const push = (mediaId: string, usage: MediaUsage) => {
    const existing = byMedia.get(mediaId);
    if (existing) existing.push(usage);
    else byMedia.set(mediaId, [usage]);
  };

  const projects = await prisma.project.findMany({
    where: { coverId: { not: null } },
    select: { coverId: true, title: true, company: true },
    orderBy: { title: "asc" },
  });
  for (const project of projects) {
    // `coverId` est non-nul par le `where`, mais TypeScript ne le sait pas.
    if (!project.coverId) continue;
    push(project.coverId, {
      kind: "Projet",
      label: `${project.title} — ${project.company}`,
    });
  }

  const timelineEntries = await prisma.timelineEntry.findMany({
    where: { avatarId: { not: null } },
    select: { avatarId: true, title: true, place: true },
    orderBy: { title: "asc" },
  });
  for (const entry of timelineEntries) {
    if (!entry.avatarId) continue;
    push(entry.avatarId, {
      kind: "Parcours",
      label: `${entry.title} — ${entry.place}`,
    });
  }

  // ⚠️ Story 5.17 (CV) — à compléter ICI **en même temps** que
  // `findMediaUsages`. Les deux fonctions doivent rester d'accord : si celle-ci
  // oubliait une source, la grille proposerait un bouton actif que la garde
  // refuserait ensuite — incohérent, mais SANS danger (la garde tient).

  return byMedia;
}

/**
 * Formule le refus de suppression en énumérant les usages (AC3).
 *
 * Centralisé ici pour que l'écran et l'action renvoient le même texte, et pour
 * que le message reste exact si la liste des relations s'allonge.
 */
export function usagesRefusalMessage(usages: MediaUsage[]): string {
  const list = usages.map((usage) => `${usage.kind} « ${usage.label} »`);
  const count = list.length;
  return count === 1
    ? `Cette image ne peut pas être supprimée : elle est utilisée par ${list[0]}.`
    : `Cette image ne peut pas être supprimée : elle est utilisée par ${count} contenus — ${list.join(", ")}.`;
}
