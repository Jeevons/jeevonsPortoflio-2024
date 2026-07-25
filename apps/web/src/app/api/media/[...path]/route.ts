import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";

import { resolveMediaPath } from "@/lib/media/storage";

// Story 5.12 — SERVICE des images téléversées (AC1).
//
// Les fichiers vivent sur un volume hors de l'image du conteneur : ils ne sont
// donc PAS dans `public/`, et le serveur de fichiers statiques de Next ne les
// voit pas. Cette route est le seul chemin par lequel ils atteignent le
// navigateur.
//
// ⚠️ Route PUBLIQUE, et c'est voulu : ces images illustrent le portfolio public.
// Aucun `requireAdmin` ici — il rendrait les illustrations invisibles aux
// visiteurs, ce que la story cherche précisément à permettre.

/**
 * `force-static` serait faux : les fichiers apparaissent au fil des
 * téléversements, après le build. La route doit donc être évaluée à la demande.
 */
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;

  // ⚠️ ANTI-TRAVERSÉE DE CHEMIN (piège n°3) — `segments` vient de l'URL, donc
  // d'un inconnu. `resolveMediaPath` normalise puis VÉRIFIE que la cible reste
  // sous la racine des uploads ; elle renvoie `null` pour tout ce qui s'en
  // échappe (`..`, chemin absolu, octet nul).
  //
  // On répond 404 et non 403 : un 403 confirmerait que le chemin visé existe,
  // renseignant l'attaquant sur l'arborescence du conteneur.
  const absolute = resolveMediaPath(segments.join("/"));
  if (!absolute) {
    return new Response(null, { status: 404 });
  }

  let fileStat;
  try {
    fileStat = await stat(absolute);
  } catch {
    return new Response(null, { status: 404 });
  }

  // Un répertoire n'est pas un fichier servable — et le streamer produirait une
  // erreur d'exécution (EISDIR) plutôt qu'une réponse propre.
  if (!fileStat.isFile()) {
    return new Response(null, { status: 404 });
  }

  // ⚠️ `immutable` — sans danger ICI, et seulement ici, parce que le nom de
  // fichier est un UUID aléatoire (storage.ts) : un chemin donné désigne
  // toujours le même contenu, à vie. Le navigateur peut donc le garder un an
  // sans jamais revalider.
  //
  // C'est ce qui dicte le mécanisme de REMPLACEMENT en story 5.13 : réécrire un
  // fichier sous le même chemin laisserait les visiteurs sur l'ancienne image
  // pendant un an. Le remplacement génère donc un chemin NEUF pour le même
  // `Media` — l'URL change, le cache est contourné par construction.
  const headers = new Headers({
    // Tout ce qui sort d'ici est du WebP : `process.ts` n'écrit rien d'autre.
    "Content-Type": "image/webp",
    "Content-Length": String(fileStat.size),
    "Cache-Control": "public, max-age=31536000, immutable",
    // Ceinture de sécurité : interdit au navigateur de re-deviner le type. Si
    // un fichier inattendu se retrouvait sur le volume, il ne serait jamais
    // interprété comme du HTML ou du script.
    "X-Content-Type-Options": "nosniff",
  });

  // Flux plutôt que lecture complète en mémoire : plusieurs images demandées en
  // parallèle ne doivent pas charger chacune leur contenu entier dans le tas du
  // conteneur.
  const stream = Readable.toWeb(
    createReadStream(absolute),
  ) as ReadableStream<Uint8Array>;

  return new Response(stream, { headers });
}
