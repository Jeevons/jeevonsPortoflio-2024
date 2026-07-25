import "server-only";

import { prisma } from "@/lib/db";

import { processUploadedImage } from "./process";
import { newMediaPath, writeMediaFile } from "./storage";

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
