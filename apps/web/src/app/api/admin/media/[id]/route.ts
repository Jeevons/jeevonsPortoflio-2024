import { revalidateTag } from "next/cache";

import { resolveAuditUserId, writeAudit } from "@/lib/admin/audit";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { mediaUrl, replaceMedia } from "@/lib/media";
import { MAX_UPLOAD_BYTES, TOO_LARGE_MESSAGE } from "@/lib/media/process";
import { requireAdminApi } from "@/lib/require-admin";

// Story 5.13 — REMPLACEMENT du fichier d'une image existante (AC2).
//
// Route API plutôt que Server Action pour la même raison qu'en 5.12 : elle
// transporte un fichier. Les mutations SANS fichier (suppression, texte
// alternatif) restent des Server Actions dans `(admin)/admin/media/actions.ts`.
//
// Le travail délicat (même `id`, nouveau `path`, ancien fichier supprimé en
// dernier) est dans `replaceMedia`. Cette route ne fait que garder l'accès,
// borner la taille, et purger le cache.

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi();
  if (guard instanceof Response) return guard;

  const { id } = await params;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Aucun fichier reçu." }, { status: 400 });
  }

  // Garde MÉMOIRE seulement, comme au téléversement : `size` vient du client.
  // La validation qui fait foi est celle des octets reçus, dans `replaceMedia`.
  if (file.size > MAX_UPLOAD_BYTES) {
    return Response.json({ error: TOO_LARGE_MESSAGE }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await replaceMedia(id, buffer);

  if (!result.ok) {
    return Response.json({ error: result.message }, { status: 415 });
  }

  const userId = await resolveAuditUserId(guard.user?.email);
  if (userId) {
    await writeAudit({
      userId,
      action: "UPDATE",
      entity: "Media",
      entityId: id,
      diff: { path: { after: result.media.path } },
    });
  }

  // ⚠️ ICI l'invalidation est INDISPENSABLE, contrairement au téléversement :
  // l'image remplacée illustre potentiellement des projets DÉJÀ PUBLIÉS. Sans
  // purge, les pages resteraient sur l'ancienne URL jusqu'à l'expiration de
  // l'ISR (1 h) — « la nouvelle version apparaît partout » (AC2) serait faux.
  revalidateTag(CACHE_TAGS.projects, { expire: 0 });
  revalidateTag(CACHE_TAGS.timeline, { expire: 0 });

  return Response.json({
    media: { ...result.media, url: mediaUrl(result.media.path) },
  });
}
