import "server-only";

// `import type * as` en plus de l'import par défaut : sharp expose ses types
// (`Sharp`, `Metadata`) dans un NAMESPACE, que l'import par défaut seul ne rend
// pas visible sous `verbatimModuleSyntax`.
import sharp from "sharp";
import type * as SharpTypes from "sharp";

// Story 5.12 — TRAITEMENT des images téléversées (AC2, AC4).
//
// ⚠️ VERSION DE SHARP ÉPINGLÉE À 0.34.x, ET PAS À LA PLUS RÉCENTE.
// Next 16 embarque sharp en `optionalDependencies` avec la plage `^0.34.5`
// (son optimiseur d'images s'en sert). Installer 0.35.x en dépendance directe
// ne satisfait PAS cette plage : bun installe alors DEUX copies, chacune avec
// sa propre libvips native. Les deux bibliothèques exportent les mêmes symboles
// et le chargeur en avertit explicitement :
//   « Class GNotificationCenterDelegate is implemented in both … libvips-cpp.8.17
//     and … libvips-cpp.8.18. This may cause spurious casting failures and
//     mysterious crashes. »
// Rester dans la plage de Next déduplique l'installation : une seule libvips
// chargée, avertissement disparu. Toute montée de sharp doit donc vérifier
// d'abord la plage déclarée par Next, sinon le doublon réapparaît.
//
// Toute image entrante est normalisée : conversion WebP, redimensionnement,
// génération d'une miniature floutée et relevé des dimensions réelles. Le
// portfolio ne sert donc jamais un fichier brut de 8 Mo sorti d'un appareil
// photo, quel que soit ce que Jeevons dépose.

/** Taille maximale ACCEPTÉE en entrée (AC4). */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 Mo

/** Largeur maximale de l'image produite. Au-delà, aucun gain visible. */
const MAX_WIDTH = 1600;

/**
 * Formats d'ENTRÉE acceptés, tels que sharp les identifie.
 *
 * ⚠️ On se fie au format DÉTECTÉ PAR SHARP dans les octets, jamais à
 * l'extension ni au `type` MIME déclaré par le navigateur (piège n°4) : les
 * deux sont trivialement falsifiables. Un `.png` renommé depuis un exécutable
 * échoue au décodage et est refusé ici.
 *
 * SVG est volontairement EXCLU : un SVG est un document actif (scripts,
 * références externes). Servi depuis notre domaine, il ouvrirait une porte au
 * XSS stocké. Ce n'est pas un format de photographie de projet.
 */
const ACCEPTED_INPUT_FORMATS = new Set([
  "jpeg",
  "png",
  "webp",
  "avif",
  "gif",
  "tiff",
]);

/** Message d'erreur EXPLICITE sur la limite (AC4 l'exige nommément). */
export const TOO_LARGE_MESSAGE = `Ce fichier dépasse la taille maximale autorisée (${Math.round(
  MAX_UPLOAD_BYTES / (1024 * 1024),
)} Mo). Compressez-le ou choisissez une autre image.`;

export const UNSUPPORTED_MESSAGE =
  "Ce format n'est pas pris en charge. Déposez une image JPEG, PNG, WebP, AVIF, GIF ou TIFF.";

/** Résultat d'un traitement réussi. */
export type ProcessedImage = {
  /** Octets WebP à écrire sur le volume. */
  data: Buffer;
  /** Dimensions RÉELLES du fichier produit (AC2). */
  width: number;
  height: number;
  /** Miniature floutée en data-URI, placeholder anti-saut de page (AC2). */
  blurDataUrl: string;
};

export type ProcessResult =
  { ok: true; image: ProcessedImage } | { ok: false; message: string };

/**
 * Valide puis normalise une image téléversée (AC2, AC4).
 *
 * ⚠️ LA VALIDATION EST ICI, CÔTÉ SERVEUR, et c'est le fond de l'AC4 : « la
 * vérification est faite côté serveur, pas seulement côté navigateur ». Les
 * contrôles du navigateur (attribut `accept`, taille lue en JavaScript) ne sont
 * qu'un confort d'interface — un appelant qui poste directement sur la route
 * les contourne intégralement. Rien de ce qui suit ne doit donc dépendre d'une
 * information fournie par le client.
 *
 * Renvoie un résultat, jamais une exception, pour que l'appelant produise un
 * message utilisable dans le formulaire.
 */
export async function processUploadedImage(
  input: Buffer,
): Promise<ProcessResult> {
  // 1. TAILLE — vérifiée sur les octets RÉELLEMENT reçus, pas sur un en-tête
  //    déclaré. Un `Content-Length` menteur ne trompe donc pas ce contrôle.
  if (input.byteLength > MAX_UPLOAD_BYTES) {
    return { ok: false, message: TOO_LARGE_MESSAGE };
  }
  if (input.byteLength === 0) {
    return { ok: false, message: "Le fichier reçu est vide." };
  }

  // 2. TYPE RÉEL — sharp lit les octets d'en-tête (magic bytes). Un PDF ou un
  //    exécutable renommé `.png` échoue ici, à la lecture des métadonnées.
  let pipeline: SharpTypes.Sharp;
  let metadata: SharpTypes.Metadata;
  try {
    // `failOn: "error"` : refuser une image tronquée ou corrompue plutôt que
    // d'en servir une moitié. `limitInputPixels` borne la décompression pour
    // qu'une petite image déclarant des dimensions démesurées ne fasse pas
    // exploser la mémoire du conteneur (« zip bomb » d'image).
    pipeline = sharp(input, { failOn: "error", limitInputPixels: 50_000_000 });
    metadata = await pipeline.metadata();
  } catch {
    return { ok: false, message: UNSUPPORTED_MESSAGE };
  }

  if (!metadata.format || !ACCEPTED_INPUT_FORMATS.has(metadata.format)) {
    return { ok: false, message: UNSUPPORTED_MESSAGE };
  }
  if (!metadata.width || !metadata.height) {
    return { ok: false, message: UNSUPPORTED_MESSAGE };
  }

  // 3. NORMALISATION — WebP, redimensionné, orientation corrigée.
  //
  // `rotate()` sans argument applique l'orientation EXIF : sans lui, une photo
  // prise en portrait s'afficherait couchée. Il doit précéder `resize`, qui
  // raisonne sur les dimensions post-rotation.
  //
  // `withoutEnlargement` : ne JAMAIS agrandir une image plus petite que la
  // limite — on ne fabrique pas de pixels, on n'obtiendrait qu'un fichier plus
  // lourd et plus flou.
  const normalized = sharp(input, {
    failOn: "error",
    limitInputPixels: 50_000_000,
  })
    .rotate()
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    // Les métadonnées EXIF sont écartées par défaut : elles peuvent contenir
    // des coordonnées GPS et le modèle d'appareil, à ne pas publier.
    .webp({ quality: 82 });

  const { data, info } = await normalized.toBuffer({ resolveWithObject: true });

  // 4. PLACEHOLDER FLOUTÉ (AC2) — une vignette minuscule, étirée par le
  //    navigateur pendant le chargement. Elle occupe la place définitive dès le
  //    premier rendu : c'est ce qui empêche la page de sauter (CLS), exigence
  //    transverse du projet (AGENTS.md §6).
  //
  //    16 px de large : quelques centaines d'octets une fois en base64, assez
  //    pour restituer les couleurs dominantes. Plus grand, on alourdirait
  //    inutilement chaque page qui affiche la carte.
  const blurBuffer = await sharp(data)
    .resize({ width: 16 })
    .webp({ quality: 40 })
    .toBuffer();

  return {
    ok: true,
    image: {
      data,
      // Dimensions du fichier PRODUIT (AC2 : « ses dimensions réelles sont
      // enregistrées ») — pas celles de l'original, qui ne décriraient plus le
      // fichier servi après redimensionnement.
      width: info.width,
      height: info.height,
      blurDataUrl: `data:image/webp;base64,${blurBuffer.toString("base64")}`,
    },
  };
}
