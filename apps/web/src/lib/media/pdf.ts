import "server-only";

import sharp from "sharp";

// Story 5.17 — TRAITEMENT du CV téléversé (AC1, AC3).
//
// ⚠️ PIÈGE n°1 (CENTRAL) — `sharp` (5.12) ne rend PAS nativement une page PDF :
// le support PDF de libvips dépend de poppler/pdfium, absent de l'image alpine
// utilisée par ce projet. Générer la vignette de la 1ʳᵉ page exige donc une
// capacité NOUVELLE, distincte du traitement image de 5.12.
//
// Décision Jeevons : `pdf-to-img` (JS pur, aucun binaire système). Contrairement
// à sharp/vips (5.12) ou poppler (piège n°1, option écartée), ce paquet ne
// dépend que de `pdfjs-dist` — zéro changement Dockerfile, zéro étage à
// modifier. `pdf-to-img` rend la page en PNG ; `sharp` prend ensuite le relais
// pour produire la vignette WebP, exactement comme pour une image (5.12).

/** Taille maximale ACCEPTÉE en entrée. Un CV est un document court. */
export const MAX_CV_BYTES = 8 * 1024 * 1024; // 8 Mo

/** Largeur de la vignette générée. Même ordre de grandeur qu'une cover (5.12). */
const THUMBNAIL_WIDTH = 480;

export const TOO_LARGE_MESSAGE = `Ce fichier dépasse la taille maximale autorisée (${Math.round(
  MAX_CV_BYTES / (1024 * 1024),
)} Mo). Compressez-le ou choisissez un autre PDF.`;

export const NOT_A_PDF_MESSAGE =
  "Ce fichier n'est pas un PDF valide. Déposez un document au format PDF.";

/**
 * Un PDF commence TOUJOURS par ces 5 octets (spec ISO 32000). Contrairement à
 * `processUploadedImage` (5.12), qui délègue la détection de type à sharp, on
 * vérifie ici la signature nous-mêmes : `pdf-to-img` ne rejette pas toujours
 * proprement un flux non-PDF (il peut lever une exception peu explicite, voire
 * rendre une page blanche selon le contenu). Le magic bytes est donc la
 * PREMIÈRE ligne de défense (AC3 — piège n°3), avant même d'invoquer la lib.
 *
 * ⚠️ Comme pour les images (5.12), on ne se fie JAMAIS à l'extension ni au type
 * MIME déclaré par le navigateur — trivialement falsifiables.
 */
function hasPdfSignature(input: Buffer): boolean {
  return input.subarray(0, 5).toString("latin1") === "%PDF-";
}

export type ProcessedCv = {
  /** Octets PDF, inchangés (on ne retraite jamais le document lui-même). */
  data: Buffer;
  /** Vignette WebP de la 1ʳᵉ page. */
  thumbnail: Buffer;
};

export type ProcessCvResult =
  { ok: true; cv: ProcessedCv } | { ok: false; message: string };

/**
 * Valide puis traite un CV téléversé (AC1, AC3).
 *
 * ⚠️ VALIDATION SERVEUR (AC3) — même discipline que `processUploadedImage`
 * (5.12) : rien de ce qui suit ne dépend d'une information fournie par le
 * client. Renvoie un résultat, jamais une exception.
 */
export async function processUploadedCv(
  input: Buffer,
): Promise<ProcessCvResult> {
  if (input.byteLength > MAX_CV_BYTES) {
    return { ok: false, message: TOO_LARGE_MESSAGE };
  }
  if (input.byteLength === 0) {
    return { ok: false, message: "Le fichier reçu est vide." };
  }

  if (!hasPdfSignature(input)) {
    return { ok: false, message: NOT_A_PDF_MESSAGE };
  }

  // Import dynamique : `pdf-to-img` charge `pdfjs-dist`, une dépendance lourde
  // qu'on ne veut pas payer sur chaque requête du serveur, seulement à l'upload.
  const { pdf } = await import("pdf-to-img");

  let document: Awaited<ReturnType<typeof pdf>>;
  try {
    document = await pdf(input);
  } catch {
    // Un flux qui commence par `%PDF-` mais qu'aucun analyseur ne peut lire
    // (tronqué, corrompu, chiffré sans mot de passe) atterrit ici.
    return { ok: false, message: NOT_A_PDF_MESSAGE };
  }

  if (document.length === 0) {
    await document.destroy();
    return { ok: false, message: NOT_A_PDF_MESSAGE };
  }

  let firstPagePng: Buffer;
  try {
    firstPagePng = await document.getPage(1);
  } finally {
    // Libère les ressources pdfjs (workers/canvas internes) quel que soit le
    // résultat — un CV volumineux ou fréquemment remplacé ne doit pas
    // accumuler de fuite mémoire dans le conteneur.
    await document.destroy();
  }

  // Vignette WebP : même traitement que le placeholder flouté de 5.12, mais en
  // taille d'aperçu plutôt qu'en miniature de quelques pixels — cette vignette
  // est affichée telle quelle (bouton public), pas étirée en flou.
  const thumbnail = await sharp(firstPagePng)
    .resize({ width: THUMBNAIL_WIDTH, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();

  return {
    ok: true,
    cv: { data: input, thumbnail },
  };
}
