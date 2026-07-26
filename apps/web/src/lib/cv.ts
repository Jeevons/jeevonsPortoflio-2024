import "server-only";

import { unstable_cache } from "next/cache";

import { CACHE_TAGS, REVALIDATE_SECONDS } from "@/lib/cache-tags";
import { prisma } from "@/lib/db";
import { mediaUrl } from "@/lib/media";

// Story 5.17 — RÉFÉRENCE « CV courant » (AC2, AC3).
//
// ⚠️ PIÈGE n°2 (CENTRAL) — le lien public du CV ne doit JAMAIS changer au fil
// des versions (AC2 : « sans référence à un numéro de version »). On DÉCOUPLE
// donc l'URL publique du nom de fichier physique : une clé `SiteSetting`
// dédiée, `cv.current`, RESSPOINTE vers le fichier courant à chaque upload. La
// route publique (`/api/cv`) lit toujours cette même clé — son URL, elle, ne
// change jamais.
//
// ⚠️ Clé VOLONTAIREMENT hors de `SETTING_KEYS`/`SETTING_DEFAULTS`
// (`lib/settings.ts`, 5.16) : ce contrat porte une garde de cohérence stricte
// contre le repli statique (4.5) pour des clés qui ont TOUJOURS existé (les 9
// textes historiques). Le CV n'a pas d'équivalent statique — avant le premier
// upload, il n'existe simplement pas, et ce n'est pas une panne. L'étendre au
// CV romprait cette garde pour rien : `readCurrentCv` gère l'absence
// nativement (retourne `null`), pas de « défaut » à fournir.
const CV_SETTING_KEY = "cv.current";

/** Forme stockée dans `SiteSetting.value` pour la clé `cv.current`. */
export type CurrentCv = {
  /** Chemin RELATIF du PDF sur le volume (storage.ts, comme les images 5.12). */
  path: string;
  /** Chemin RELATIF de la vignette WebP de la 1ʳᵉ page. */
  thumbnailPath: string;
  /** Dimensions réelles de la vignette (placeholder anti-CLS, cohérent 5.12). */
  thumbnailWidth: number;
  thumbnailHeight: number;
};

function isCurrentCv(value: unknown): value is CurrentCv {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.path === "string" &&
    typeof v.thumbnailPath === "string" &&
    typeof v.thumbnailWidth === "number" &&
    typeof v.thumbnailHeight === "number"
  );
}

/**
 * Lecture PUBLIQUE, cachée sous le tag `settings` (même tag que le reste de
 * `SiteSetting`, 4.4/5.16 — la table est la même, la clé s'ajoute au même lot
 * d'invalidation).
 *
 * ⚠️ PIÈGE n°2 (suite) — contrairement aux images de 5.12 (`Cache-Control:
 * immutable`, chemin = UUID jamais réécrit), le CONTENU pointé par cette clé
 * CHANGE à chaque upload. `unstable_cache` + `revalidateTag` est le régime
 * REVALIDABLE qui convient ici : un nouvel upload appelle `revalidateTag`, la
 * prochaine lecture repeuple le cache avec la nouvelle référence — jamais
 * `immutable`, sous peine de servir l'ancien CV jusqu'à un an (AC2).
 */
const cachedCurrentCv = unstable_cache(
  async () => {
    const row = await prisma.siteSetting.findUnique({
      where: { key: CV_SETTING_KEY },
      select: { value: true },
    });
    return row?.value ?? null;
  },
  ["cv-current"],
  { tags: [CACHE_TAGS.settings], revalidate: REVALIDATE_SECONDS },
);

/** Vue publique du CV : URL stable + vignette, ou `null` si aucun CV. */
export type PublicCv = {
  url: string;
  thumbnailUrl: string;
  thumbnailWidth: number;
  thumbnailHeight: number;
};

/** URL stable du CV, servie par `/api/cv` (résout toujours le courant). */
export const CV_PUBLIC_URL = "/api/cv";

/**
 * CV courant pour le rendu public (piège n°5 : bouton « Télécharger mon CV »).
 *
 * ⚠️ PAS de `readWithFallback` (4.5) ici : un CV absent n'est pas une panne DB,
 * c'est un état de départ légitime (avant le premier upload). Le rendu public
 * doit alors afficher un état neutre, pas un texte de repli — il n'existe pas
 * de « CV par défaut ».
 */
export async function getPublicCv(): Promise<PublicCv | null> {
  let value: unknown;
  try {
    value = await cachedCurrentCv();
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    console.error(
      `[fallback] Lecture "cv" échouée — CV masqué côté public. Cause : ${raw.replace(/\s+/g, " ").trim()}`,
    );
    return null;
  }
  if (!isCurrentCv(value)) return null;

  return {
    url: CV_PUBLIC_URL,
    thumbnailUrl: mediaUrl(value.thumbnailPath),
    thumbnailWidth: value.thumbnailWidth,
    thumbnailHeight: value.thumbnailHeight,
  };
}

/**
 * Lecture ADMIN, NON cachée (même discipline que `getAdminSettings`, 5.16) :
 * l'écran de réglages doit voir l'état réel de la base, pas une copie qui
 * daterait de la dernière invalidation.
 */
export async function getAdminCv(): Promise<CurrentCv | null> {
  const row = await prisma.siteSetting.findUnique({
    where: { key: CV_SETTING_KEY },
    select: { value: true },
  });
  return isCurrentCv(row?.value) ? row.value : null;
}

/** Chemin RELATIF (volume) du PDF courant — pour la route de service `/api/cv`. */
export async function getCurrentCvPath(): Promise<string | null> {
  const row = await prisma.siteSetting.findUnique({
    where: { key: CV_SETTING_KEY },
    select: { value: true },
  });
  return isCurrentCv(row?.value) ? row.value.path : null;
}

/**
 * Repointe la référence « CV courant » (AC1, AC2). Appelée APRÈS l'écriture
 * des fichiers sur le volume (même ordre fichier-puis-base que `createMedia`,
 * 5.12) : si l'écriture avait échoué, aucune référence ne pointerait vers un
 * fichier absent.
 *
 * ⚠️ `upsert`, comme le reste de `SiteSetting` (piège n°5, 5.16) : la clé
 * `cv.current` n'existe pas avant le premier téléversement.
 */
export async function setCurrentCv(cv: CurrentCv): Promise<void> {
  await prisma.siteSetting.upsert({
    where: { key: CV_SETTING_KEY },
    create: { key: CV_SETTING_KEY, value: cv },
    update: { value: cv },
  });
}
