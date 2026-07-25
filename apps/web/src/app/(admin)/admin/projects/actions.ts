"use server";

import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";

import { CACHE_TAGS } from "@/lib/cache-tags";
import { prisma } from "@/lib/db";
import { requireAdmin, UnauthorizedError } from "@/lib/require-admin";
import {
  projectFormDataToInput,
  projectSchema,
  type ProjectInput,
} from "@/lib/schemas/project";

// Story 5.8 — MUTATIONS des projets. Écran pivot de l'Epic 5 : ce fichier
// établit le PATTERN copié par les stories 5.9-5.19 :
//
//   requireAdmin()  →  projectSchema.parse()  →  prisma.write()  →  revalidateTag()
//
// Chaque maillon a une raison d'être :
//  1. `requireAdmin` — une Server Action est un endpoint POST à part entière,
//     atteignable sans passer par la page. Le guard de layout ne la protège
//     PAS (même raisonnement qu'en 5.7).
//  2. `projectSchema` — SOURCE DE VÉRITÉ de la validation (AC2). Le client
//     valide déjà via `zodResolver`, mais un appelant peut le contourner : le
//     serveur revalide avec le MÊME schéma, jamais des règles dupliquées.
//  3. `revalidateTag(projects)` — sans lui, la modification n'apparaîtrait
//     jamais sur le site public, dont la lecture est cachée 1 h (AC4, 4.4).
//
// ⚠️ AuditLog : la traçabilité des mutations est la story 5.19. Ces trois
// actions seront ses points de branchement — ne pas l'anticiper ici (piège n°6).

/**
 * Retour des actions de sauvegarde, consommé par `useActionState` côté client.
 *
 * `fieldErrors` est indexé par nom de champ pour que le formulaire affiche
 * l'erreur SOUS le champ fautif, et non dans un bandeau global : c'est ce qui
 * rend le refus serveur aussi lisible que le refus client (AC2).
 */
export type ProjectFormState = {
  status: "idle" | "error";
  /** Message global (conflit de slug, session expirée, panne). */
  message: string | null;
  /** Erreurs par champ, mêmes messages que côté client (schéma partagé). */
  fieldErrors: Partial<Record<keyof ProjectInput, string>>;
};

// ⚠️ Comme en 5.7 : dans un module `"use server"`, TOUT export runtime doit être
// une fonction async. L'état initial vit donc côté client. Les `export type`
// sont effacés à la compilation — ils restent autorisés ici.

const SESSION_EXPIRED =
  "Session expirée. Reconnectez-vous pour enregistrer vos modifications.";
const GENERIC_ERROR = "L'enregistrement a échoué. Réessayez dans un instant.";

/**
 * Message de conflit d'identifiant (AC3).
 *
 * Explicite la CAUSE et l'ACTION à mener — « l'enregistrement est refusé avec un
 * message qui m'explique le conflit ». Un « Erreur 500 » ou un « contrainte
 * unique violée » brut ne satisferait pas l'AC.
 */
function slugConflictMessage(slug: string): string {
  return `L'identifiant d'URL « ${slug} » est déjà utilisé par un autre projet. Choisissez-en un autre.`;
}

/**
 * Détecte le conflit d'unicité Prisma sur `slug` (P2002).
 *
 * ⚠️ On NE pré-vérifie PAS par un `findUnique` avant l'écriture : entre la
 * lecture et l'écriture, un doublon pourrait s'insérer (course). La contrainte
 * `@unique` en base est la seule garantie réelle — on la laisse parler et on
 * TRADUIT son erreur (AC3), plutôt que de laisser remonter une 500.
 *
 * Le code d'erreur est lu de façon structurelle (`code === "P2002"`) sans
 * importer `Prisma.PrismaClientKnownRequestError` : en Prisma 7 le client est
 * généré, et un `instanceof` sur la classe générée est fragile au rebuild.
 */
function isSlugConflict(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: unknown }).code;
  if (code !== "P2002") return false;
  // `meta.target` liste les colonnes en conflit. `slug` est aujourd'hui la seule
  // contrainte `@unique` du modèle, mais on vérifie tout de même : si une autre
  // s'ajoutait, un conflit sur ELLE ne doit pas s'afficher comme un conflit de
  // slug (message faux, débogage impossible).
  const target = (error as { meta?: { target?: unknown } }).meta?.target;
  if (Array.isArray(target)) return target.includes("slug");
  if (typeof target === "string") return target.includes("slug");
  // `target` absent : on considère que c'est le slug, seule contrainte unique.
  return true;
}

/**
 * Détecte une référence inexistante (P2025) — story 5.9.
 *
 * Se produit si le formulaire poste l'identifiant d'une technologie supprimée
 * entre-temps (autre onglet, liste obsolète). Sans traduction, l'utilisateur
 * verrait une erreur générique de panne alors que la cause est connue et que
 * l'action à mener est simple : rafraîchir la page.
 */
function isMissingRelation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2025"
  );
}

const STALE_STACK_ERROR =
  "Une technologie sélectionnée n'existe plus. Rafraîchissez la page puis réessayez.";

/**
 * Détecte une clé étrangère invalide (P2003).
 *
 * Story 5.12 — Cas visé : le `coverId` posté désigne un média inexistant, soit
 * parce qu'il a été supprimé depuis l'ouverture du formulaire, soit parce que
 * l'identifiant a été forgé. Distinct de `isMissingRelation` (P2025), que
 * Prisma renvoie pour un `connect` vers un enregistrement absent : la
 * couverture est une colonne scalaire, sa contrainte est vérifiée par la BASE,
 * pas par le moteur de relations.
 */
function isMissingCover(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2003"
  );
}

const STALE_COVER_ERROR =
  "L'image de couverture sélectionnée n'existe plus. Rafraîchissez la page puis choisissez-en une autre.";

/**
 * Garde + validation communes à la création et à la modification (AC2).
 *
 * Renvoie soit les données validées, soit l'état d'erreur à retourner au
 * client. Factorisé pour que create et update ne puissent PAS diverger dans
 * leurs règles — c'est exactement le risque que l'AC2 interdit.
 */
async function guardAndValidate(
  formData: FormData,
): Promise<
  { ok: true; data: ProjectInput } | { ok: false; state: ProjectFormState }
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

  const parsed = projectSchema.safeParse(projectFormDataToInput(formData));

  if (!parsed.success) {
    // Une entrée invalide est REFUSÉE côté serveur même si le client l'a laissée
    // passer (AC2 : « refusée dans les deux cas »). On renvoie les messages du
    // schéma partagé, donc rigoureusement les mêmes qu'affiche le navigateur.
    const fieldErrors: ProjectFormState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === "string" && !(field in fieldErrors)) {
        fieldErrors[field as keyof ProjectInput] = issue.message;
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
 * Crée un projet (AC2, AC3, AC4).
 *
 * En cas de succès, `redirect()` vers l'éditeur du projet créé : l'utilisateur
 * voit immédiatement sa fiche persistée plutôt qu'un formulaire vide dont il ne
 * saurait pas s'il a été enregistré.
 *
 * ⚠️ `redirect()` fonctionne en LEVANT une exception spéciale : il doit rester
 * HORS de tout `try/catch` qui l'avalerait. D'où l'appel en fin de fonction,
 * après le bloc protégé.
 */
export async function createProjectAction(
  _prevState: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const guard = await guardAndValidate(formData);
  if (!guard.ok) return guard.state;

  // Story 5.9 — les relations sont extraites des champs scalaires : Prisma
  // n'accepte pas un tableau brut là où il attend une écriture imbriquée.
  const { highlights, stackIds, ...scalars } = guard.data;

  let createdId: string;
  try {
    const created = await prisma.project.create({
      // `sortOrder` non fourni : le défaut `0` du schéma s'applique. Le
      // réordonnancement est la story 5.10.
      data: {
        ...scalars,
        // AC1 — L'ORDRE DU TABLEAU devient le `sortOrder` persisté. C'est ce qui
        // fait que l'ordre saisi dans l'éditeur se retrouve tel quel sur le site
        // public, dont la lecture ordonne déjà par `sortOrder`.
        highlights: {
          create: highlights.map((highlight, index) => ({
            label: highlight.label,
            sortOrder: index,
          })),
        },
        // AC2 — `connect` sur des technologies EXISTANTES. La relation
        // `ProjectStacks` étant bidirectionnelle en base, associer ici suffit :
        // la technologie « connaît » aussitôt ce projet, sans seconde écriture.
        stacks: { connect: stackIds.map((id) => ({ id })) },
      },
      select: { id: true },
    });
    createdId = created.id;
  } catch (error) {
    if (isSlugConflict(error)) {
      return {
        status: "error",
        message: slugConflictMessage(guard.data.slug),
        // Erreur portée AUSSI par le champ : le focus et le message vont là où
        // la correction doit se faire.
        fieldErrors: { slug: "Cet identifiant est déjà pris." },
      };
    }
    if (isMissingRelation(error)) {
      return { status: "error", message: STALE_STACK_ERROR, fieldErrors: {} };
    }
    if (isMissingCover(error)) {
      return {
        status: "error",
        message: STALE_COVER_ERROR,
        fieldErrors: { coverId: "Cette image n'existe plus." },
      };
    }
    const raw = error instanceof Error ? error.message : String(error);
    console.error(
      `[admin] Création de projet échouée. Cause : ${raw.replace(/\s+/g, " ").trim()}`,
    );
    return { status: "error", message: GENERIC_ERROR, fieldErrors: {} };
  }

  // AC4 — Le site public lit les projets via un cache étiqueté `projects`
  // (4.4). Sans cette invalidation, le nouveau projet publié resterait invisible
  // jusqu'à l'expiration de l'ISR (1 h).
  revalidateTag(CACHE_TAGS.projects, { expire: 0 });

  redirect(`/admin/projects/${createdId}`);
}

/**
 * Modifie un projet existant (AC2, AC3, AC4).
 *
 * L'identifiant vient d'un champ caché du formulaire : il est donc lui aussi
 * une entrée non fiable. On ne le valide pas par un schéma (c'est un cuid
 * opaque), mais `prisma.update` échoue proprement sur un identifiant inconnu
 * (P2025) — traité comme une erreur générique plutôt qu'un crash.
 */
export async function updateProjectAction(
  _prevState: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const guard = await guardAndValidate(formData);
  if (!guard.ok) return guard.state;

  const rawId = formData.get("id");
  const id = typeof rawId === "string" ? rawId : "";
  if (!id) {
    return { status: "error", message: GENERIC_ERROR, fieldErrors: {} };
  }

  const { highlights, stackIds, ...scalars } = guard.data;

  try {
    // ⚠️ TRANSACTION — points forts et technologies sont réconciliés en
    // plusieurs écritures. Sans transaction, un échec en cours de route
    // laisserait le projet à moitié modifié : des points forts supprimés mais
    // pas recréés, donc une perte de données silencieuse.
    await prisma.$transaction(async (tx) => {
      // AC1 — RÉCONCILIATION des points forts par identifiant (piège n°2).
      //
      // On ne fait PAS « tout supprimer puis tout recréer » : cette facilité
      // changerait l'identifiant de chaque point fort à chaque enregistrement
      // et ferait churner la table sans raison. On calcule donc les trois
      // opérations réelles :
      //  - SUPPRIMER les points forts existants absents de la soumission ;
      //  - METTRE À JOUR ceux qui portent un `id` connu (label + position) ;
      //  - CRÉER ceux qui arrivent sans `id`.
      const existing = await tx.highlight.findMany({
        where: { projectId: id },
        select: { id: true },
      });
      const existingIds = new Set(existing.map((highlight) => highlight.id));

      // ⚠️ Un `id` posté qui n'appartient PAS à ce projet est ignoré (traité
      // comme un ajout) : le formulaire est une entrée utilisateur, et un
      // identifiant emprunté à un autre projet ne doit pas permettre de le
      // modifier au passage.
      const submittedIds = new Set(
        highlights
          .map((highlight) => highlight.id)
          .filter((value): value is string => value !== undefined)
          .filter((value) => existingIds.has(value)),
      );

      const removedIds = [...existingIds].filter(
        (existingId) => !submittedIds.has(existingId),
      );
      if (removedIds.length > 0) {
        await tx.highlight.deleteMany({ where: { id: { in: removedIds } } });
      }

      // L'INDEX dans le tableau devient le `sortOrder` : l'ordre affiché dans
      // l'éditeur est donc exactement celui persisté, puis celui rendu sur le
      // site public (AC1).
      for (const [index, highlight] of highlights.entries()) {
        if (highlight.id !== undefined && submittedIds.has(highlight.id)) {
          await tx.highlight.update({
            where: { id: highlight.id },
            data: { label: highlight.label, sortOrder: index },
          });
        } else {
          await tx.highlight.create({
            data: { label: highlight.label, sortOrder: index, projectId: id },
          });
        }
      }

      await tx.project.update({
        where: { id },
        data: {
          ...scalars,
          // AC2 — `set` (et non `connect`) : il REMPLACE l'ensemble des
          // associations par celui soumis. C'est ce qui permet de DÉSASSOCIER
          // une technologie décochée ; un `connect` seul ne saurait qu'ajouter.
          stacks: { set: stackIds.map((stackId) => ({ id: stackId })) },
        },
        select: { id: true },
      });
    });
  } catch (error) {
    if (isSlugConflict(error)) {
      return {
        status: "error",
        message: slugConflictMessage(guard.data.slug),
        fieldErrors: { slug: "Cet identifiant est déjà pris." },
      };
    }
    // P2025 en modification : soit une technologie sélectionnée a disparu, soit
    // le projet lui-même. Le message couvre les deux cas par la même action —
    // rafraîchir — car l'utilisateur n'a pas à distinguer laquelle des deux.
    if (isMissingRelation(error)) {
      return { status: "error", message: STALE_STACK_ERROR, fieldErrors: {} };
    }
    // Story 5.12 — L'image de couverture a été supprimée depuis l'ouverture du
    // formulaire (bibliothèque, 5.13), ou l'identifiant a été forgé.
    if (isMissingCover(error)) {
      return {
        status: "error",
        message: STALE_COVER_ERROR,
        fieldErrors: { coverId: "Cette image n'existe plus." },
      };
    }
    const raw = error instanceof Error ? error.message : String(error);
    console.error(
      `[admin] Modification de projet échouée. Cause : ${raw.replace(/\s+/g, " ").trim()}`,
    );
    return { status: "error", message: GENERIC_ERROR, fieldErrors: {} };
  }

  // AC4 — « les changements sont [...] visibles sur le site public après
  // revalidation ».
  revalidateTag(CACHE_TAGS.projects, { expire: 0 });

  // Redirection vers la liste : la modification est finie, on revient au point
  // de départ. Hors try/catch (voir `createProjectAction`).
  redirect("/admin/projects?saved=1");
}

/** Retour de la suppression — seul un échec a besoin d'être communiqué (AC5). */
export type DeleteProjectState = {
  status: "idle" | "error";
  message: string | null;
};

/**
 * Supprime un projet (AC5).
 *
 * ⚠️ CASCADE — le schéma (Epic 4) déclare `Highlight.project` avec
 * `onDelete: Cascade` : la base supprime elle-même les points forts du projet.
 * On ne les supprime donc PAS à la main (ce serait redondant et divergerait si
 * la relation changeait).
 *
 * ⚠️ STACKS — `Stack` est en many-to-many (`ProjectStacks`). La suppression du
 * projet retire les LIGNES DE JOINTURE, pas les technologies elles-mêmes, qui
 * sont partagées entre projets. C'est le comportement voulu : supprimer un
 * projet ne doit pas faire disparaître « React » du référentiel.
 *
 * ⚠️ La CONFIRMATION exigée par l'AC5 (« une confirmation m'a été demandée avant
 * l'action, qui est irréversible ») vit dans l'interface (`delete-project-dialog`),
 * pas ici : une Server Action n'a pas de dialogue. Le serveur, lui, exécute.
 */
export async function deleteProjectAction(
  _prevState: DeleteProjectState,
  formData: FormData,
): Promise<DeleteProjectState> {
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
      message: "Projet introuvable. Rafraîchissez la liste.",
    };
  }

  try {
    await prisma.project.delete({ where: { id }, select: { id: true } });
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
        message: "Ce projet n'existe plus. Rafraîchissez la liste.",
      };
    }
    const raw = error instanceof Error ? error.message : String(error);
    console.error(
      `[admin] Suppression de projet échouée. Cause : ${raw.replace(/\s+/g, " ").trim()}`,
    );
    return {
      status: "error",
      message: "La suppression a échoué. Réessayez dans un instant.",
    };
  }

  // AC5 — le projet supprimé doit disparaître du site public, pas seulement de
  // l'admin.
  revalidateTag(CACHE_TAGS.projects, { expire: 0 });

  redirect("/admin/projects?deleted=1");
}
