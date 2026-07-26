import { revalidateTag } from "next/cache";

import { resolveAuditUserId, writeAudit } from "@/lib/admin/audit";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { getAdminCv, setCurrentCv } from "@/lib/cv";
import { newMediaPath, writeMediaFile } from "@/lib/media/storage";
import {
  MAX_CV_BYTES,
  processUploadedCv,
  TOO_LARGE_MESSAGE,
} from "@/lib/media/pdf";
import { requireAdminApi } from "@/lib/require-admin";
import sharp from "sharp";

// Story 5.17 — TÉLÉVERSEMENT du CV depuis l'administration (AC1, AC2, AC3).
//
// Même pattern que `/api/admin/media` (5.12) : route API et non Server Action,
// pour les mêmes raisons (progression/erreurs de transfert propres à un fichier).

export const dynamic = "force-dynamic";

/** CV courant, pour l'écran de réglages. */
export async function GET() {
  const guard = await requireAdminApi();
  if (guard instanceof Response) return guard;

  const cv = await getAdminCv();
  return Response.json({ cv });
}

export async function POST(request: Request) {
  const guard = await requireAdminApi();
  if (guard instanceof Response) return guard;

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

  // Filtre `file.size` avant lecture complète — même garde-fou mémoire non
  // sécuritaire qu'en 5.12 ; la validation qui fait foi lit les octets réels.
  if (file.size > MAX_CV_BYTES) {
    return Response.json({ error: TOO_LARGE_MESSAGE }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await processUploadedCv(buffer);

  if (!result.ok) {
    // 415 : requête intelligible, contenu refusé (AC3 — message explicite).
    return Response.json({ error: result.message }, { status: 415 });
  }

  // ⚠️ Fichiers d'abord, référence ensuite (même ordre que `createMedia`,
  // 5.12) : si l'écriture échoue, la référence en base reste inchangée plutôt
  // que de pointer vers un fichier absent.
  const pdfPath = newMediaPath("pdf");
  const thumbnailPath = newMediaPath("webp");
  await writeMediaFile(pdfPath, result.cv.data);
  await writeMediaFile(thumbnailPath, result.cv.thumbnail);

  const { width, height } = await sharp(result.cv.thumbnail).metadata();

  const cv = {
    path: pdfPath,
    thumbnailPath,
    thumbnailWidth: width ?? 0,
    thumbnailHeight: height ?? 0,
  };
  await setCurrentCv(cv);

  // Story 5.19 — marqueur fixe : `SiteSetting.diff` (allow-list `["key"]`) ne
  // capture pas un chemin de fichier de façon exploitable ; l'événement seul
  // ("le CV a été remplacé") est l'information utile ici.
  const userId = await resolveAuditUserId(guard.user?.email);
  if (userId) {
    await writeAudit({
      userId,
      action: "UPDATE",
      entity: "SiteSetting",
      diff: { cvUpdated: true },
    });
  }

  // AC2 — le site public doit servir le nouveau CV IMMÉDIATEMENT après
  // l'upload, sur la même URL stable. `settings` est le tag qui couvre
  // `SiteSetting` (4.4) — la clé `cv.current` y vit désormais aussi.
  revalidateTag(CACHE_TAGS.settings, { expire: 0 });

  return Response.json({ cv }, { status: 201 });
}
