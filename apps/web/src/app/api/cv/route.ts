import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";

import { getCurrentCvPath } from "@/lib/cv";
import { resolveMediaPath } from "@/lib/media/storage";

// Story 5.17 — SERVICE du CV courant (AC1, AC2). Lien PUBLIC et STABLE : cette
// URL ne change jamais, quel que soit le nombre de téléversements (AC2 — « sans
// référence à un numéro de version »).
//
// ⚠️ PIÈGE n°2 — contrairement à `/api/media/[...path]` (5.12), qui sert des
// fichiers dont le CHEMIN est l'identité (UUID immuable, `Cache-Control:
// immutable`), cette route résout d'ABORD la référence « CV courant » en base,
// PUIS sert le fichier qu'elle désigne. Le chemin physique change à chaque
// upload ; l'URL, elle, ne bouge jamais.
//
// ⚠️ Cache REVALIDABLE, PAS `immutable` : le contenu pointé par cette URL
// change dans le temps (remplacement de CV). Un cache `immutable` d'un an
// laisserait les navigateurs afficher l'ANCIEN CV bien après un remplacement,
// à rebours de l'AC2 (« servi immédiatement »). `no-cache` force le navigateur
// à revalider systématiquement, ce qui est le comportement voulu ici — un CV
// se remplace rarement, la fraîcheur prime sur l'économie de requêtes.

export const dynamic = "force-dynamic";

export async function GET() {
  const relativePath = await getCurrentCvPath();
  if (!relativePath) {
    return new Response(null, { status: 404 });
  }

  // Même anti-traversée que `/api/media/[...path]` (5.12) : `relativePath` vient
  // de la base, pas de l'URL, mais la fonction reste le seul point qui produit
  // un chemin absolu — aucune exception à cet invariant.
  const absolute = resolveMediaPath(relativePath);
  if (!absolute) {
    return new Response(null, { status: 404 });
  }

  let fileStat;
  try {
    fileStat = await stat(absolute);
  } catch {
    return new Response(null, { status: 404 });
  }
  if (!fileStat.isFile()) {
    return new Response(null, { status: 404 });
  }

  const headers = new Headers({
    "Content-Type": "application/pdf",
    "Content-Length": String(fileStat.size),
    "Cache-Control": "no-cache",
    "X-Content-Type-Options": "nosniff",
    // Nom de fichier stable côté téléchargement, indépendant du chemin physique.
    "Content-Disposition": 'inline; filename="cv-jeevons.pdf"',
  });

  const stream = Readable.toWeb(
    createReadStream(absolute),
  ) as ReadableStream<Uint8Array>;

  return new Response(stream, { headers });
}
