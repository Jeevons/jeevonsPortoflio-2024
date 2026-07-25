import "server-only";

import { prisma } from "@/lib/db";

import { processUploadedImage } from "./process";
import { deleteMediaFile, newMediaPath, writeMediaFile } from "./storage";

// Story 5.12 — ACCÈS AUX DONNÉES média. Point d'entrée unique entre le
// traitement d'image (process.ts), le volume (storage.ts) et la base.
//
// Les Server Actions passent par ici plutôt que d'orchestrer elles-mêmes les
// trois modules : l'ordre des opérations porte un invariant (voir `createMedia`)
// qu'on ne veut pas voir réimplémenté, ni oublié, à chaque appel.

/** Vue d'un média telle que l'administration et le site public la consomment. */
export type MediaSummary = {
  id: string;
  path: string;
  width: number;
  height: number;
  blurDataUrl: string;
  alt: string | null;
  createdAt: Date;
};

/**
 * URL PUBLIQUE d'un média, servie par la route `/api/media/[...path]`.
 *
 * Centralisée ici : le jour où le stockage passerait derrière un CDN, seul ce
 * calcul change. Les composants n'ont jamais à connaître l'arborescence du
 * volume.
 */
export function mediaUrl(path: string): string {
  return `/api/media/${path}`;
}

export type CreateMediaResult =
  { ok: true; media: MediaSummary } | { ok: false; message: string };

/**
 * Traite un fichier téléversé, l'écrit sur le volume et enregistre ses
 * métadonnées (AC1, AC2).
 *
 * ⚠️ ORDRE DES OPÉRATIONS — fichier d'abord, base ensuite. Ce n'est pas
 * arbitraire : si l'écriture du fichier échoue, aucune ligne n'est créée et la
 * base reste cohérente. Dans l'ordre inverse, un échec d'écriture laisserait un
 * `Media` pointant vers un fichier inexistant — une image cassée sur le site,
 * impossible à distinguer d'un média valide.
 *
 * Le cas résiduel (fichier écrit, insertion en base échouée) laisse un fichier
 * orphelin : il occupe quelques kilo-octets et n'est référencé par rien. C'est
 * la moitié la MOINS grave des deux incohérences possibles, et elle n'a aucun
 * effet visible.
 */
export async function createMedia(
  input: Buffer,
  alt: string | null,
): Promise<CreateMediaResult> {
  const processed = await processUploadedImage(input);
  if (!processed.ok) {
    return { ok: false, message: processed.message };
  }

  const path = newMediaPath();
  await writeMediaFile(path, processed.image.data);

  const media = await prisma.media.create({
    data: {
      path,
      width: processed.image.width,
      height: processed.image.height,
      blurDataUrl: processed.image.blurDataUrl,
      alt,
    },
  });

  return { ok: true, media };
}

/**
 * Traduit un `Media` de la base en couverture prête pour `ProjectCard` (AC5).
 *
 * Factorisé ici plutôt que dupliqué dans chaque section : les deux sections de
 * projets (`Projects`, `SelfProject`) doivent construire exactement la même
 * forme, sans quoi l'une d'elles pourrait oublier `blurDataUrl` et réintroduire
 * le saut de page que l'AC2 cherche à éliminer.
 */
export function toCardCover(
  media: Pick<
    MediaSummary,
    "path" | "width" | "height" | "blurDataUrl" | "alt"
  > | null,
) {
  if (!media) return null;
  return {
    url: mediaUrl(media.path),
    width: media.width,
    height: media.height,
    blurDataUrl: media.blurDataUrl,
    alt: media.alt,
  };
}

/** Liste les médias, du plus récent au plus ancien (bibliothèque, story 5.13). */
export async function listMedia(): Promise<MediaSummary[]> {
  return prisma.media.findMany({ orderBy: { createdAt: "desc" } });
}

/** Récupère un média par son identifiant, ou `null` s'il n'existe pas. */
export async function getMedia(id: string): Promise<MediaSummary | null> {
  return prisma.media.findUnique({ where: { id } });
}

/**
 * Met à jour le seul texte alternatif (AC3).
 *
 * Séparé du remplacement de fichier : corriger un `alt` ne doit ni retraiter
 * l'image, ni changer son URL, ni invalider le cache navigateur.
 */
export async function updateMediaAlt(
  id: string,
  alt: string | null,
): Promise<void> {
  await prisma.media.update({ where: { id }, data: { alt } });
}

export type ReplaceMediaResult =
  { ok: true; media: MediaSummary } | { ok: false; message: string };

/**
 * Remplace le CONTENU d'un média en conservant son identifiant (5.13, AC2).
 *
 * ⚠️ C'est le MÊME `Media.id` qui survit, et c'est tout l'intérêt : les projets
 * référencent l'image par son `id`. En le conservant, tous les usages pointent
 * vers la nouvelle image AUTOMATIQUEMENT — « je n'ai pas à modifier chaque
 * projet un par un » (AC2). Créer un nouveau `Media` obligerait à repointer
 * chaque référence, ce que l'AC exclut explicitement.
 *
 * ⚠️ MAIS LE `path` CHANGE, et c'est indispensable. La route de service pose
 * `Cache-Control: immutable` sur un an (5.12) : réécrire le fichier sous le
 * même chemin laisserait les navigateurs afficher l'ANCIENNE image jusqu'à un
 * an, malgré une base parfaitement à jour. Un chemin neuf change l'URL, donc
 * contourne le cache PAR CONSTRUCTION, plutôt que par un paramètre de version
 * qu'un intermédiaire pourrait ignorer. (Décision Jeevons : même `Media`,
 * nouveau `path`.)
 */
export async function replaceMedia(
  id: string,
  input: Buffer,
): Promise<ReplaceMediaResult> {
  const existing = await prisma.media.findUnique({ where: { id } });
  if (!existing) {
    return { ok: false, message: "Cette image n'existe plus." };
  }

  const processed = await processUploadedImage(input);
  if (!processed.ok) {
    return { ok: false, message: processed.message };
  }

  const nextPath = newMediaPath();
  await writeMediaFile(nextPath, processed.image.data);

  const media = await prisma.media.update({
    where: { id },
    data: {
      path: nextPath,
      // Dimensions et miniature RECALCULÉES : garder celles de l'ancienne image
      // réserverait la mauvaise place et ferait sauter la page — exactement ce
      // que l'AC2 de 5.12 cherche à éviter.
      width: processed.image.width,
      height: processed.image.height,
      blurDataUrl: processed.image.blurDataUrl,
      // `alt` volontairement PRÉSERVÉ : remplacer le fichier ne change pas ce
      // que l'image représente. L'effacer ferait régresser l'accessibilité sans
      // que personne ne s'en aperçoive.
    },
  });

  // Ancien fichier supprimé EN DERNIER : si la mise à jour en base avait
  // échoué, il serait encore là et le média resterait affichable. Un résidu
  // n'est qu'un gaspillage d'espace, jamais une image cassée.
  await deleteMediaFile(existing.path);

  return { ok: true, media };
}

/**
 * Supprime un média : ligne en base PUIS fichier (5.13, AC4).
 *
 * ⚠️ ORDRE — base d'abord, fichier ensuite. Si la suppression du fichier échoue,
 * il reste un orphelin que plus rien ne référence : invisible et sans
 * conséquence. Dans l'ordre inverse, un échec en base laisserait un `Media`
 * pointant vers un fichier absent, c'est-à-dire une image cassée sur le site.
 *
 * ⚠️ Cette fonction NE VÉRIFIE PAS les usages : l'appelant doit passer par
 * `findMediaUsages` d'abord (voir l'action de suppression). La garde est
 * délibérément à l'extérieur, pour que la vérification et le message de refus
 * restent au même endroit.
 */
export async function deleteMedia(id: string): Promise<void> {
  const existing = await prisma.media.findUnique({ where: { id } });
  if (!existing) return; // déjà supprimé : objectif atteint (idempotent)

  await prisma.media.delete({ where: { id } });
  await deleteMediaFile(existing.path);
}
