"use server";

import { redirect } from "next/navigation";

import { resolveAuditUserId, writeAudit } from "@/lib/admin/audit";
import { prisma } from "@/lib/db";
import { requireAdmin, UnauthorizedError } from "@/lib/require-admin";

// Story 5.18 — MUTATIONS de la boîte de réception (AC3, AC4).
//
// ⚠️ Pas de `revalidateTag` ici, contrairement aux mutations de contenu
// (5.8/5.14/5.16) : ces messages n'alimentent AUCUNE lecture publique ni
// cachée (piège n°2 — données personnelles de tiers). La seule invalidation
// nécessaire est celle de la page elle-même, via `force-dynamic` côté lecture.
//
// ⚠️ PIÈGE n°3 — marquer LU doit être un geste EXPLICITE (bouton/ouverture
// réelle de page), jamais un effet de bord d'un `<Link prefetch>` ou d'un
// survol. C'est pourquoi ce n'est PAS une lecture qui marque lu en passant :
// `markMessageReadAction`/`markMessageUnreadAction` sont des Server Actions
// distinctes, déclenchées par un clic explicite depuis l'écran de lecture.

export type MessageActionState = {
  status: "idle" | "error";
  message: string | null;
};

const SESSION_EXPIRED =
  "Session expirée. Reconnectez-vous pour gérer vos messages.";
const GENERIC_ERROR = "L'opération a échoué. Réessayez dans un instant.";

async function guardId(
  formData: FormData,
): Promise<
  | { ok: true; id: string; email: string | null | undefined }
  | { ok: false; state: MessageActionState }
> {
  let email: string | null | undefined;
  try {
    const session = await requireAdmin();
    email = session.user?.email;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return {
        ok: false,
        state: { status: "error", message: SESSION_EXPIRED },
      };
    }
    throw error;
  }

  const rawId = formData.get("id");
  const id = typeof rawId === "string" ? rawId : "";
  if (!id) {
    return {
      ok: false,
      state: { status: "error", message: "Message introuvable." },
    };
  }
  return { ok: true, id, email };
}

/** Marque un message comme lu (AC3). Redirige vers l'écran de lecture. */
export async function markMessageReadAction(
  _prevState: MessageActionState,
  formData: FormData,
): Promise<MessageActionState> {
  const guard = await guardId(formData);
  if (!guard.ok) return guard.state;

  try {
    // Story 5.19 — dédoublonnage : `MarkReadOnOpen` (route API, fond) peut
    // avoir déjà marqué lu avant ce clic explicite. On ne journalise QUE si ce
    // geste fait réellement basculer `read`, pour ne pas produire deux entrées
    // pour une seule action logique (piège n°5 : préserver le comportement
    // existant, mais éviter le doublon d'audit entre les deux points d'entrée).
    const before = await prisma.contactMessage.findUnique({
      where: { id: guard.id },
      select: { read: true },
    });

    await prisma.contactMessage.update({
      where: { id: guard.id },
      data: { read: true },
      select: { id: true },
    });

    if (before && !before.read) {
      const userId = await resolveAuditUserId(guard.email);
      if (userId) {
        await writeAudit({
          userId,
          action: "UPDATE",
          entity: "ContactMessage",
          entityId: guard.id,
          diff: { read: { before: false, after: true } },
        });
      }
    }
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    console.error(
      `[admin] Marquage lu échoué. Cause : ${raw.replace(/\s+/g, " ").trim()}`,
    );
    return { status: "error", message: GENERIC_ERROR };
  }

  redirect(`/admin/messages/${guard.id}`);
}

/** Repasse un message en non lu (AC3). */
export async function markMessageUnreadAction(
  _prevState: MessageActionState,
  formData: FormData,
): Promise<MessageActionState> {
  const guard = await guardId(formData);
  if (!guard.ok) return guard.state;

  try {
    await prisma.contactMessage.update({
      where: { id: guard.id },
      data: { read: false },
      select: { id: true },
    });

    const userId = await resolveAuditUserId(guard.email);
    if (userId) {
      await writeAudit({
        userId,
        action: "UPDATE",
        entity: "ContactMessage",
        entityId: guard.id,
        diff: { read: { before: true, after: false } },
      });
    }
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    console.error(
      `[admin] Marquage non lu échoué. Cause : ${raw.replace(/\s+/g, " ").trim()}`,
    );
    return { status: "error", message: GENERIC_ERROR };
  }

  redirect(`/admin/messages/${guard.id}`);
}

/**
 * Supprime DÉFINITIVEMENT un message (AC4). Pas de corbeille — l'AC dit
 * « disparaît définitivement ». La confirmation vit dans l'interface
 * (dialogue), pas ici, comme en 5.14.
 */
export async function deleteMessageAction(
  _prevState: MessageActionState,
  formData: FormData,
): Promise<MessageActionState> {
  const guard = await guardId(formData);
  if (!guard.ok) return guard.state;

  try {
    await prisma.contactMessage.delete({
      where: { id: guard.id },
      select: { id: true },
    });

    const userId = await resolveAuditUserId(guard.email);
    if (userId) {
      await writeAudit({
        userId,
        action: "DELETE",
        entity: "ContactMessage",
        entityId: guard.id,
      });
    }
  } catch (error) {
    // P2025 : déjà supprimé dans un autre onglet. Pas une panne.
    if (
      typeof error === "object" &&
      error !== null &&
      (error as { code?: unknown }).code === "P2025"
    ) {
      redirect("/admin/messages?deleted=1");
    }
    const raw = error instanceof Error ? error.message : String(error);
    console.error(
      `[admin] Suppression de message échouée. Cause : ${raw.replace(/\s+/g, " ").trim()}`,
    );
    return { status: "error", message: GENERIC_ERROR };
  }

  redirect("/admin/messages?deleted=1");
}
