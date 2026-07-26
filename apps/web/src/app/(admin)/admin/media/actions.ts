"use server";

import { revalidateTag } from "next/cache";

import { resolveAuditUserId, writeAudit } from "@/lib/admin/audit";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { deleteMedia, updateMediaAlt } from "@/lib/media";
import { findMediaUsages, usagesRefusalMessage } from "@/lib/media/usages";
import { requireAdmin, UnauthorizedError } from "@/lib/require-admin";

// Story 5.13 — MUTATIONS de la bibliothèque d'images.
//
// Même pattern que les projets (5.8), pour les mêmes raisons :
//   requireAdmin() → validation → écriture → revalidateTag()
//
// Le REMPLACEMENT n'est pas ici mais dans une route API
// (`/api/admin/media/[id]`) : il transporte un fichier, ce que `useActionState`
// gère mal. Même découpage qu'en 5.12 pour le téléversement.
//
// ⚠️ AuditLog = story 5.19. Ces actions en seront des points de branchement —
// ne pas l'anticiper ici.

/** Retour commun, consommé par `useActionState` côté client. */
export type MediaActionState = {
  status: "idle" | "error" | "success";
  message: string | null;
};

const SESSION_EXPIRED =
  "Session expirée. Reconnectez-vous pour modifier vos images.";
const GENERIC_ERROR = "L'opération a échoué. Réessayez dans un instant.";

/**
 * Supprime une image, SI et seulement si elle n'est utilisée nulle part
 * (AC3, AC4).
 *
 * ⚠️ LA GARDE EST ICI, CÔTÉ SERVEUR, et c'est le cœur de la story. Le bouton
 * est déjà désactivé côté client quand des usages sont connus, mais une Server
 * Action est un endpoint POST à part entière : elle est atteignable sans passer
 * par l'écran. Sans cette vérification, un appel direct viderait la couverture
 * de projets publiés (`onDelete: SetNull`) sans le moindre signalement.
 *
 * La vérification est refaite AU MOMENT de la suppression, et non reprise de ce
 * que l'écran avait affiché : entre l'affichage de la grille et le clic, une
 * image peut avoir été associée à un projet dans un autre onglet.
 */
export async function deleteMediaAction(
  _prev: MediaActionState,
  formData: FormData,
): Promise<MediaActionState> {
  let email: string | null | undefined;
  try {
    const session = await requireAdmin();
    email = session.user?.email;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { status: "error", message: SESSION_EXPIRED };
    }
    throw error;
  }

  const id = formData.get("id");
  if (typeof id !== "string" || id === "") {
    return { status: "error", message: GENERIC_ERROR };
  }

  try {
    const usages = await findMediaUsages(id);
    if (usages.length > 0) {
      // AC3 — Refus AVEC la liste précise des contenus concernés : Jeevons doit
      // savoir quoi détacher avant de pouvoir supprimer.
      return { status: "error", message: usagesRefusalMessage(usages) };
    }

    await deleteMedia(id);

    const userId = await resolveAuditUserId(email);
    if (userId) {
      await writeAudit({
        userId,
        action: "DELETE",
        entity: "Media",
        entityId: id,
      });
    }
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    console.error(
      `[admin] Suppression de média échouée. Cause : ${raw.replace(/\s+/g, " ").trim()}`,
    );
    return { status: "error", message: GENERIC_ERROR };
  }

  // L'image n'était utilisée par aucun contenu : le site public est donc
  // inchangé. On invalide malgré tout, car la vérification et l'affichage
  // public reposent sur des lectures cachées qui doivent rester cohérentes.
  revalidateTag(CACHE_TAGS.projects, { expire: 0 });
  revalidateTag(CACHE_TAGS.timeline, { expire: 0 });

  return { status: "success", message: "Image supprimée." };
}

/**
 * Corrige le texte alternatif d'une image (AC3 de la story 5.12).
 *
 * C'est l'écran qui rend cet AC complet : 5.12 demande le texte au
 * téléversement et SIGNALE son absence, mais c'est ici qu'on peut la réparer
 * après coup, sans avoir à re-téléverser le fichier.
 */
export async function updateMediaAltAction(
  _prev: MediaActionState,
  formData: FormData,
): Promise<MediaActionState> {
  let email: string | null | undefined;
  try {
    const session = await requireAdmin();
    email = session.user?.email;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { status: "error", message: SESSION_EXPIRED };
    }
    throw error;
  }

  const id = formData.get("id");
  const altRaw = formData.get("alt");
  if (typeof id !== "string" || id === "") {
    return { status: "error", message: GENERIC_ERROR };
  }

  const alt =
    typeof altRaw === "string" && altRaw.trim() !== "" ? altRaw.trim() : null;

  try {
    await updateMediaAlt(id, alt);

    const userId = await resolveAuditUserId(email);
    if (userId) {
      await writeAudit({
        userId,
        action: "UPDATE",
        entity: "Media",
        entityId: id,
        diff: { alt: { after: alt } },
      });
    }
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    console.error(
      `[admin] Mise à jour du texte alternatif échouée. Cause : ${raw.replace(/\s+/g, " ").trim()}`,
    );
    return { status: "error", message: GENERIC_ERROR };
  }

  // Le texte alternatif est rendu sur les cartes publiques : sans invalidation,
  // la correction resterait invisible jusqu'à l'expiration de l'ISR (1 h).
  revalidateTag(CACHE_TAGS.projects, { expire: 0 });
  revalidateTag(CACHE_TAGS.timeline, { expire: 0 });

  return {
    status: "success",
    message: alt
      ? "Texte alternatif enregistré."
      : "Texte alternatif effacé — cette image est désormais signalée comme non décrite.",
  };
}
