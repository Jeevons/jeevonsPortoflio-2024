import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

// Story 5.12 — STOCKAGE des fichiers téléversés (AC1).
//
// ⚠️ INVARIANT (piège n°2) — les fichiers vivent sur un VOLUME PERSISTANT, hors
// de l'image du conteneur. Écrits dans l'image, ils disparaîtraient à chaque
// redéploiement : le portfolio perdrait toutes ses illustrations à la première
// mise à jour. Le volume `portfolio_uploads` est monté sur `/app/uploads`
// (docker-compose.prod.yml, et docker-compose.yml pour le dev).
//
// ⚠️ Le conteneur de production tourne en utilisateur NON-ROOT `nextjs`
// (uid 1001, Epic 2) : le volume doit lui être inscriptible. Voir le Dockerfile,
// qui crée et attribue `/app/uploads` AVANT le `USER nextjs`.

/**
 * Racine du stockage. Surchargeable par `UPLOADS_DIR` pour le développement
 * hors conteneur (`bun run dev` sur l'hôte), où `/app` n'existe pas.
 *
 * ⚠️ Lue à chaque appel plutôt que figée dans une constante de module : en
 * développement, Next conserve les modules entre les rechargements à chaud, et
 * une valeur capturée au premier import survivrait à un changement d'env.
 */
export function uploadsRoot(): string {
  return process.env.UPLOADS_DIR ?? "/app/uploads";
}

/**
 * Fabrique un chemin RELATIF unique pour un nouveau fichier.
 *
 * Rangé par année/mois : un répertoire unique finirait par contenir des
 * milliers d'entrées, ce que les systèmes de fichiers gèrent mal et qui rend
 * toute inspection manuelle pénible.
 *
 * ⚠️ Le nom est ALÉATOIRE (`randomUUID`), jamais dérivé du nom d'origine. Trois
 * raisons cumulatives :
 *  1. le nom d'origine est une entrée utilisateur (traversée de chemin,
 *     caractères non ASCII, longueurs absurdes) ;
 *  2. deux téléversements du même nom se écraseraient l'un l'autre ;
 *  3. story 5.13 — le REMPLACEMENT d'une image réutilise cette fonction pour
 *     obtenir un chemin NEUF, ce qui casse le cache `immutable` du navigateur
 *     (l'URL change) sans changer l'identifiant du `Media`.
 */
export function newMediaPath(extension = "webp"): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}/${month}/${randomUUID()}.${extension}`;
}

/**
 * Résout un chemin relatif en chemin absolu SÛR, sous la racine des uploads.
 *
 * ⚠️ ANTI-TRAVERSÉE DE CHEMIN (piège n°3) — c'est LA fonction de sécurité du
 * module, et le seul endroit où un chemin devient absolu.
 *
 * Un `[...path]` d'URL ou une valeur de base corrompue peuvent contenir `..`,
 * un chemin absolu, voire des séparateurs encodés. `path.resolve` normalise
 * (`a/../../etc/passwd` → `/etc/passwd`), après quoi on VÉRIFIE que le résultat
 * est bien sous la racine. Sans ce contrôle, `/api/media/../../etc/passwd`
 * servirait des fichiers arbitraires du conteneur.
 *
 * On compare avec un séparateur final (`root + path.sep`) : sans lui,
 * `/app/uploads-secret` passerait le test `startsWith("/app/uploads")`.
 *
 * Renvoie `null` si le chemin sort de la racine — l'appelant répond alors 404,
 * jamais une erreur qui confirmerait l'existence de la cible.
 */
export function resolveMediaPath(relativePath: string): string | null {
  // Un `\0` tronque le chemin dans certains appels système sous-jacents.
  if (relativePath.includes("\0")) return null;

  const root = path.resolve(uploadsRoot());
  const absolute = path.resolve(root, relativePath);

  if (absolute !== root && !absolute.startsWith(root + path.sep)) {
    return null;
  }
  return absolute;
}

/**
 * Écrit un fichier sur le volume, en créant l'arborescence au besoin.
 *
 * Le chemin passe par `resolveMediaPath` : même une valeur construite en interne
 * est vérifiée, pour que l'invariant tienne quel que soit l'appelant futur.
 */
export async function writeMediaFile(
  relativePath: string,
  data: Buffer,
): Promise<void> {
  const absolute = resolveMediaPath(relativePath);
  if (!absolute) {
    throw new Error(`Chemin de média refusé : ${relativePath}`);
  }
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, data);
}

/**
 * Supprime un fichier du volume. IDEMPOTENT (story 5.13, AC4).
 *
 * ⚠️ Un fichier déjà absent n'est PAS une erreur : la suppression d'un média
 * doit aboutir même si le fichier a disparu (volume restauré, nettoyage manuel,
 * seconde tentative après un échec partiel). Faire échouer l'opération
 * laisserait une ligne orpheline en base, impossible à supprimer — exactement
 * l'inverse du but recherché.
 */
export async function deleteMediaFile(relativePath: string): Promise<void> {
  const absolute = resolveMediaPath(relativePath);
  if (!absolute) return;

  try {
    await unlink(absolute);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "ENOENT") return; // déjà absent : objectif atteint
    throw error;
  }
}
