"use server";

import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";

import { CACHE_TAGS } from "@/lib/cache-tags";
import { prisma } from "@/lib/db";
import { requireAdmin, UnauthorizedError } from "@/lib/require-admin";
import {
  timelineEntrySchema,
  timelineFormDataToInput,
  type TimelineEntryInput,
} from "@/lib/schemas/timeline";

// Story 5.14 — MUTATIONS du parcours (AC1, AC3, AC4).
//
// ⚠️ Applique STRICTEMENT le pattern établi par 5.8 (`projects/actions.ts`),
// sans en dévier — c'est ce que demande le PLAN §3.2 (« même pattern ») :
//
//   requireAdmin()  →  timelineEntrySchema.parse()  →  prisma.write()  →  revalidateTag()
//
// Chaque maillon a la même raison d'être qu'en 5.8 :
//  1. `requireAdmin` — une Server Action est un endpoint POST à part entière,
//     atteignable sans passer par la page. Le guard de layout ne la protège PAS.
//  2. `timelineEntrySchema` — SOURCE DE VÉRITÉ de la validation. Le client
//     valide déjà via `zodResolver`, mais un appelant peut le contourner : le
//     serveur revalide avec le MÊME schéma, jamais des règles dupliquées.
//  3. `revalidateTag(timeline)` — sans lui, la modification n'apparaîtrait
//     jamais sur le site public, dont la lecture est cachée 1 h (AC4).
//
// ⚠️ PIÈGE n°4 — Le tag `timeline` couvre le parcours ET les hobbies (décision
// 4.4 : « même section conceptuelle »). Invalider ici rafraîchit donc aussi les
// centres d'intérêt. C'est SANS DANGER (au pire une relecture inutile) et
// volontaire : les deux lectures partagent le tag depuis 4.4.
//
// ⚠️ AuditLog : la traçabilité des mutations est la story 5.19. Ces actions
// seront ses points de branchement — ne pas l'anticiper ici.

/**
 * Retour des actions de sauvegarde, consommé par `useActionState`.
 *
 * `fieldErrors` est indexé par nom de champ pour que le formulaire affiche
 * l'erreur SOUS le champ fautif plutôt que dans un bandeau global.
 */
export type TimelineFormState = {
  status: "idle" | "error";
  /** Message global (conflit d'identifiant, session expirée, panne). */
  message: string | null;
  /** Erreurs par champ, mêmes messages que côté client (schéma partagé). */
  fieldErrors: Partial<Record<keyof TimelineEntryInput, string>>;
};

// ⚠️ Comme en 5.8 : dans un module `"use server"`, TOUT export runtime doit être
// une fonction async. L'état initial vit donc côté client. Les `export type`
// sont effacés à la compilation — ils restent autorisés ici.

const SESSION_EXPIRED =
  "Session expirée. Reconnectez-vous pour enregistrer vos modifications.";
const GENERIC_ERROR = "L'enregistrement a échoué. Réessayez dans un instant.";

/** Message de conflit d'identifiant : explicite la CAUSE et l'ACTION à mener. */
function slugConflictMessage(slug: string): string {
  return `L'identifiant « ${slug} » est déjà utilisé par une autre entrée du parcours. Choisissez-en un autre.`;
}

/**
 * Détecte le conflit d'unicité Prisma sur `slug` (P2002).
 *
 * ⚠️ On NE pré-vérifie PAS par un `findUnique` avant l'écriture : entre la
 * lecture et l'écriture, un doublon pourrait s'insérer (course). La contrainte
 * `@unique` en base est la seule garantie réelle — on la laisse parler et on
 * TRADUIT son erreur, plutôt que de laisser remonter une 500.
 *
 * Le code est lu de façon structurelle (`code === "P2002"`) sans importer la
 * classe d'erreur générée : en Prisma 7 un `instanceof` dessus est fragile au
 * rebuild (même raisonnement qu'en 5.8).
 */
function isSlugConflict(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ((error as { code?: unknown }).code !== "P2002") return false;
  const target = (error as { meta?: { target?: unknown } }).meta?.target;
  if (Array.isArray(target)) return target.includes("slug");
  if (typeof target === "string") return target.includes("slug");
  // `target` absent : `slug` est la seule contrainte unique du modèle.
  return true;
}

/**
 * Détecte une clé étrangère invalide (P2003) — l'illustration désigne un média
 * inexistant, supprimé depuis l'ouverture du formulaire ou forgé.
 *
 * ⚠️ Ce cas n'existe QUE depuis la story 5.14 : `avatarId` était auparavant un
 * `String?` nu, que la base n'aurait pas contrôlé. La promotion en vraie
 * relation (migration `add_timeline_avatar_relation`) est précisément ce qui
 * rend cette erreur possible — et donc l'entrée impossible à orpheliner.
 */
function isMissingAvatar(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2003"
  );
}

const STALE_AVATAR_ERROR =
  "L'illustration sélectionnée n'existe plus. Rafraîchissez la page puis choisissez-en une autre.";

/**
 * Garde + validation communes à la création et à la modification.
 *
 * Factorisé pour que create et update ne puissent PAS diverger dans leurs
 * règles — exactement le risque que la validation partagée vise à écarter.
 */
async function guardAndValidate(
  formData: FormData,
): Promise<
  | { ok: true; data: TimelineEntryInput }
  | { ok: false; state: TimelineFormState }
> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return {
        ok: false,
        state: { status: "error", message: SESSION_EXPIRED, fieldErrors: {} },
      };
    }
    throw error;
  }

  const parsed = timelineEntrySchema.safeParse(
    timelineFormDataToInput(formData),
  );

  if (!parsed.success) {
    // Une entrée invalide est REFUSÉE côté serveur même si le client l'a
    // laissée passer. On renvoie les messages du schéma partagé, donc
    // rigoureusement les mêmes qu'affiche le navigateur.
    const fieldErrors: TimelineFormState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === "string" && !(field in fieldErrors)) {
        fieldErrors[field as keyof TimelineEntryInput] = issue.message;
      }
    }
    return {
      ok: false,
      state: {
        status: "error",
        message: "Certains champs sont invalides. Corrigez-les puis réessayez.",
        fieldErrors,
      },
    };
  }

  return { ok: true, data: parsed.data };
}

/**
 * Crée une entrée de parcours (AC1, AC3, AC4).
 *
 * ⚠️ `published` est écrit EXPLICITEMENT depuis le formulaire, qui le propose
 * décoché à la création (décision Jeevons). Le `@default(true)` de la colonne —
 * hérité de 4.2 pour le seed — n'est donc jamais atteint par ce chemin : une
 * entrée créée depuis l'admin naît brouillon, et reste invisible du public
 * jusqu'à publication explicite (AC3).
 *
 * ⚠️ `redirect()` fonctionne en LEVANT une exception spéciale : il doit rester
 * HORS de tout `try/catch` qui l'avalerait. D'où l'appel en fin de fonction.
 */
export async function createTimelineEntryAction(
  _prevState: TimelineFormState,
  formData: FormData,
): Promise<TimelineFormState> {
  const guard = await guardAndValidate(formData);
  if (!guard.ok) return guard.state;

  let createdId: string;
  try {
    const created = await prisma.timelineEntry.create({
      // `sortOrder` non fourni : le défaut `0` du schéma s'applique. La nouvelle
      // entrée se place donc en tête, et Jeevons la positionne depuis l'écran
      // de réordonnancement (AC2) — même comportement que pour un projet.
      data: guard.data,
      select: { id: true },
    });
    createdId = created.id;
  } catch (error) {
    if (isSlugConflict(error)) {
      return {
        status: "error",
        message: slugConflictMessage(guard.data.slug),
        fieldErrors: { slug: "Cet identifiant est déjà pris." },
      };
    }
    if (isMissingAvatar(error)) {
      return {
        status: "error",
        message: STALE_AVATAR_ERROR,
        fieldErrors: { avatarId: "Cette image n'existe plus." },
      };
    }
    const raw = error instanceof Error ? error.message : String(error);
    console.error(
      `[admin] Création d'entrée de parcours échouée. Cause : ${raw.replace(/\s+/g, " ").trim()}`,
    );
    return { status: "error", message: GENERIC_ERROR, fieldErrors: {} };
  }

  // AC4 — Sans cette invalidation, l'entrée publiée resterait invisible sur le
  // site public jusqu'à l'expiration de l'ISR (1 h).
  revalidateTag(CACHE_TAGS.timeline, { expire: 0 });

  redirect(`/admin/timeline/${createdId}`);
}

/**
 * Modifie une entrée existante (AC1, AC3, AC4).
 *
 * L'identifiant vient d'un champ caché du formulaire : c'est donc lui aussi une
 * entrée non fiable. On ne le valide pas par un schéma (c'est un cuid opaque),
 * mais `prisma.update` échoue proprement sur un identifiant inconnu (P2025).
 *
 * ⚠️ Pas de transaction ici, contrairement à la modification d'un projet (5.8) :
 * une entrée de parcours n'a AUCUNE relation à réconcilier (ni points forts, ni
 * technologies). C'est une seule écriture, donc déjà atomique.
 */
export async function updateTimelineEntryAction(
  _prevState: TimelineFormState,
  formData: FormData,
): Promise<TimelineFormState> {
  const guard = await guardAndValidate(formData);
  if (!guard.ok) return guard.state;

  const rawId = formData.get("id");
  const id = typeof rawId === "string" ? rawId : "";
  if (!id) {
    return { status: "error", message: GENERIC_ERROR, fieldErrors: {} };
  }

  try {
    await prisma.timelineEntry.update({
      where: { id },
      data: guard.data,
      select: { id: true },
    });
  } catch (error) {
    if (isSlugConflict(error)) {
      return {
        status: "error",
        message: slugConflictMessage(guard.data.slug),
        fieldErrors: { slug: "Cet identifiant est déjà pris." },
      };
    }
    if (isMissingAvatar(error)) {
      return {
        status: "error",
        message: STALE_AVATAR_ERROR,
        fieldErrors: { avatarId: "Cette image n'existe plus." },
      };
    }
    // P2025 : l'entrée elle-même n'existe plus (supprimée dans un autre onglet).
    if (
      typeof error === "object" &&
      error !== null &&
      (error as { code?: unknown }).code === "P2025"
    ) {
      return {
        status: "error",
        message: "Cette entrée n'existe plus. Rafraîchissez la liste.",
        fieldErrors: {},
      };
    }
    const raw = error instanceof Error ? error.message : String(error);
    console.error(
      `[admin] Modification d'entrée de parcours échouée. Cause : ${raw.replace(/\s+/g, " ").trim()}`,
    );
    return { status: "error", message: GENERIC_ERROR, fieldErrors: {} };
  }

  // AC3/AC4 — Dépublier une entrée doit la faire DISPARAÎTRE du site public,
  // ce qui n'arrive que si le cache est invalidé.
  revalidateTag(CACHE_TAGS.timeline, { expire: 0 });

  // Redirection vers la liste : la modification est finie. Hors try/catch.
  redirect("/admin/timeline?saved=1");
}

/** Retour de la suppression — seul un échec a besoin d'être communiqué (AC4). */
export type DeleteTimelineEntryState = {
  status: "idle" | "error";
  message: string | null;
};

/**
 * Supprime une entrée de parcours (AC4).
 *
 * ⚠️ L'illustration N'EST PAS supprimée avec l'entrée : un `Media` est partagé
 * et vit dans la bibliothèque (5.13). Supprimer l'entrée retire seulement la
 * référence ; l'image reste disponible pour d'autres contenus, et sa
 * suppression éventuelle relève de `/admin/media`, où la garde d'intégrité
 * vérifie qu'elle n'est plus utilisée.
 *
 * ⚠️ La CONFIRMATION exigée par l'AC4 vit dans l'interface
 * (`delete-timeline-dialog`), pas ici : une Server Action n'a pas de dialogue.
 */
export async function deleteTimelineEntryAction(
  _prevState: DeleteTimelineEntryState,
  formData: FormData,
): Promise<DeleteTimelineEntryState> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { status: "error", message: SESSION_EXPIRED };
    }
    throw error;
  }

  const rawId = formData.get("id");
  const id = typeof rawId === "string" ? rawId : "";
  if (!id) {
    return {
      status: "error",
      message: "Entrée introuvable. Rafraîchissez la liste.",
    };
  }

  try {
    await prisma.timelineEntry.delete({ where: { id }, select: { id: true } });
  } catch (error) {
    // P2025 : l'enregistrement n'existe pas (déjà supprimé dans un autre
    // onglet). Ce n'est pas une panne — on le dit sans alarmer.
    if (
      typeof error === "object" &&
      error !== null &&
      (error as { code?: unknown }).code === "P2025"
    ) {
      return {
        status: "error",
        message: "Cette entrée n'existe plus. Rafraîchissez la liste.",
      };
    }
    const raw = error instanceof Error ? error.message : String(error);
    console.error(
      `[admin] Suppression d'entrée de parcours échouée. Cause : ${raw.replace(/\s+/g, " ").trim()}`,
    );
    return {
      status: "error",
      message: "La suppression a échoué. Réessayez dans un instant.",
    };
  }

  // AC4 — « elle disparaît du site après revalidation ».
  revalidateTag(CACHE_TAGS.timeline, { expire: 0 });

  redirect("/admin/timeline?deleted=1");
}
