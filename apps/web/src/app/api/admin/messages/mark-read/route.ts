import { resolveAuditUserId, writeAudit } from "@/lib/admin/audit";
import { prisma } from "@/lib/db";
import { requireAdminApi } from "@/lib/require-admin";

// Story 5.18 — Marque un message comme lu depuis `MarkReadOnOpen` (AC3).
//
// Route API plutôt que Server Action : appelée par un `fetch(keepalive)` de
// fond depuis un effet client, pas une soumission de formulaire — il n'y a pas
// de `FormData` de navigation ni de redirection à faire suivre.
export async function POST(request: Request): Promise<Response> {
  const guard = await requireAdminApi();
  if (guard instanceof Response) return guard;

  const formData = await request.formData();
  const rawId = formData.get("id");
  const id = typeof rawId === "string" ? rawId : "";
  if (!id) {
    return Response.json({ error: "Identifiant manquant." }, { status: 400 });
  }

  try {
    // Story 5.19 — dédoublonnage vs. `markMessageReadAction` (Server Action) :
    // n'écrire qu'une entrée si CE geste fait réellement basculer `read`.
    const before = await prisma.contactMessage.findUnique({
      where: { id },
      select: { read: true },
    });

    await prisma.contactMessage.update({
      where: { id },
      data: { read: true },
      select: { id: true },
    });

    if (before && !before.read) {
      const userId = await resolveAuditUserId(guard.user?.email);
      if (userId) {
        await writeAudit({
          userId,
          action: "UPDATE",
          entity: "ContactMessage",
          entityId: id,
          diff: { read: { before: false, after: true } },
        });
      }
    }
  } catch (error) {
    // P2025 : message déjà supprimé — pas une panne à signaler.
    if (
      typeof error === "object" &&
      error !== null &&
      (error as { code?: unknown }).code === "P2025"
    ) {
      return Response.json({ ok: true });
    }
    const raw = error instanceof Error ? error.message : String(error);
    console.error(
      `[admin] Marquage lu (auto) échoué. Cause : ${raw.replace(/\s+/g, " ").trim()}`,
    );
    return Response.json({ error: "Échec du marquage." }, { status: 500 });
  }

  return Response.json({ ok: true });
}
