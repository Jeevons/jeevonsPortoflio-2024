import { createMedia, listMedia, mediaUrl } from "@/lib/media";
import { MAX_UPLOAD_BYTES, TOO_LARGE_MESSAGE } from "@/lib/media/process";
import { requireAdminApi } from "@/lib/require-admin";

// Story 5.12 — TÉLÉVERSEMENT d'une image depuis l'administration (AC1, AC4).
//
// Route API et non Server Action, à dessein : l'envoi d'un fichier demande une
// barre de progression et une gestion d'erreur propres au transfert, que le
// couple `useActionState` / Server Action ne donne pas. Le formulaire projet
// (5.9) reste ainsi un formulaire de TEXTE, inchangé dans son contrat.
//
// ⚠️ Route d'ADMINISTRATION (`/api/admin/…`), contrairement à `/api/media/…` qui
// sert les images au public. Elle écrit sur le volume : elle exige donc une
// session admin complète, comme toute mutation (5.2, 5.5).

/**
 * Le corps est un flux de fichier : rien à mettre en cache, et la réponse
 * dépend de la session.
 */
export const dynamic = "force-dynamic";

/** Liste des médias, pour le sélecteur de couverture et la bibliothèque (5.13). */
export async function GET() {
  const guard = await requireAdminApi();
  if (guard instanceof Response) return guard;

  const media = await listMedia();
  return Response.json({
    media: media.map((item) => ({ ...item, url: mediaUrl(item.path) })),
  });
}

export async function POST(request: Request) {
  const guard = await requireAdminApi();
  if (guard instanceof Response) return guard;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    // Corps illisible ou tronqué : refus explicite plutôt qu'une 500.
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Aucun fichier reçu." }, { status: 400 });
  }

  // ⚠️ Premier filtre sur `file.size` : il évite de charger 200 Mo en mémoire
  // avant de les refuser. Ce n'est PAS la validation de sécurité — `size` est
  // renseigné par le client. Le contrôle qui fait foi est celui de
  // `processUploadedImage`, sur les octets RÉELLEMENT reçus (AC4).
  if (file.size > MAX_UPLOAD_BYTES) {
    return Response.json({ error: TOO_LARGE_MESSAGE }, { status: 413 });
  }

  const altRaw = formData.get("alt");
  const alt =
    typeof altRaw === "string" && altRaw.trim() ? altRaw.trim() : null;

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await createMedia(buffer, alt);

  if (!result.ok) {
    // 415 : le fichier est intelligible comme requête, mais son CONTENU n'est
    // pas un format d'image accepté. Le message vient de la validation serveur
    // et nomme la cause (AC4).
    return Response.json({ error: result.message }, { status: 415 });
  }

  // ⚠️ Pas de `revalidateTag` ici, volontairement : une image fraîchement
  // téléversée n'illustre encore AUCUN projet, le site public est donc
  // strictement inchangé. C'est l'ASSOCIATION de la couverture au projet, dans
  // l'action de sauvegarde, qui purge le cache `projects` (AC5).
  return Response.json(
    { media: { ...result.media, url: mediaUrl(result.media.path) } },
    { status: 201 },
  );
}
