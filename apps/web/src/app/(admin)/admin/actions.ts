"use server";

import { revalidateTag } from "next/cache";

import { CACHE_TAG_VALUES } from "@/lib/cache-tags";
import { requireAdmin, UnauthorizedError } from "@/lib/require-admin";

// Story 5.7 (AC2) — Bouton « Revalider le site ».
//
// 🛑 Décision (Jeevons, story 5.7) : SERVER ACTION DIRECTE, et non un appel HTTP
// à `app/api/revalidate/route.ts` (story 4.4). Raisons :
//  - l'appelant est DÉJÀ authentifié (`requireAdmin` : session complète, 2FA
//    franchie) — le secret partagé n'apporterait aucune sécurité de plus ;
//  - il faudrait sinon transporter `REVALIDATE_SECRET` pour se rappeler
//    soi-même en HTTP : un aller-retour réseau et une surface d'exposition du
//    secret, pour rien ;
//  - un clic doit purger les TROIS domaines : via la route, ce serait trois
//    requêtes (le paramètre `tag` est unitaire).
//
// La route de 4.4 reste en place, inchangée : c'est la surface EXTERNE
// (webhook, CI, curl). Les deux chemins appellent le même `revalidateTag` sur le
// même contrat `CACHE_TAGS` — aucune duplication de logique.

/** Retour de l'action, consommé par `useActionState` côté client. */
export type RevalidateState = {
  status: "idle" | "success" | "error";
  message: string | null;
  /** Horodatage du succès — rend deux revalidations successives distinguables. */
  at: number | null;
};

// ⚠️ NE PAS exporter l'état initial depuis ce fichier : dans un module
// `"use server"`, TOUT export doit être une fonction async (chaque export
// devient un endpoint POST). Exporter un objet fait échouer le module entier
// au runtime — « A "use server" file can only export async functions, found
// object » — et le bouton reste inerte. L'état initial vit donc côté client,
// dans `revalidate-button.tsx`. Un `export type` est effacé à la compilation :
// il ne compte pas comme un export runtime, et reste donc autorisé ici.

/**
 * Purge le cache des trois domaines de contenu public (AC2).
 *
 * Signature `(prevState, formData)` imposée par `useActionState`. Le premier
 * argument n'est pas utilisé : l'action est idempotente, chaque clic repart
 * d'un état neuf.
 */
export async function revalidateSiteAction(
  _prevState: RevalidateState,
  _formData: FormData,
): Promise<RevalidateState> {
  try {
    // Défense en profondeur (AGENTS.md §6) : une Server Action est un endpoint
    // POST à part entière, atteignable sans passer par la page. Le guard de
    // layout ne la protège donc PAS — d'où ce `requireAdmin` explicite, qui
    // refuse aussi les sessions partielles (5.5).
    await requireAdmin();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return {
        status: "error",
        message: "Session expirée. Reconnectez-vous pour revalider le site.",
        at: null,
      };
    }
    throw error;
  }

  try {
    // Les trois tags du contrat 4.4 (`projects`, `timeline`, `settings`) : on
    // itère sur `CACHE_TAG_VALUES` plutôt que de les lister à la main — un tag
    // ajouté au contrat sera couvert automatiquement, sans oubli silencieux.
    //
    // `{ expire: 0 }` : 2e argument obligatoire en Next 16, purge immédiate
    // sans dépendre d'un profil `cacheLife` nommé (même appel que la route 4.4).
    for (const tag of CACHE_TAG_VALUES) {
      revalidateTag(tag, { expire: 0 });
    }
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    console.error(
      `[admin] Revalidation échouée. Cause : ${raw.replace(/\s+/g, " ").trim()}`,
    );
    return {
      status: "error",
      message: "La revalidation a échoué. Réessayez dans un instant.",
      at: null,
    };
  }

  return {
    status: "success",
    message: "Le contenu public a été rafraîchi.",
    at: Date.now(),
  };
}
