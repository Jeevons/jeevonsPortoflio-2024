"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";

import { CACHE_TAGS } from "@/lib/cache-tags";
import { prisma } from "@/lib/db";
import { requireAdmin, UnauthorizedError } from "@/lib/require-admin";

// Story 5.14 — PERSISTANCE DE L'ORDRE du parcours (AC2).
//
// Même chaîne que les mutations de `actions.ts`, sans en dévier :
//
//   requireAdmin()  →  Zod  →  transaction  →  revalidateTag(timeline)
//
// ⚠️ Action SÉPARÉE de `actions.ts` (création/modification/suppression), pour la
// même raison qu'en 5.10 : réordonner ne touche AUCUN champ éditorial. Mélanger
// les deux chemins ferait passer un `sortOrder` dans le schéma du formulaire,
// alors qu'il en est justement exclu.
//
// ⚠️ Différence avec 5.10 (projets) : PAS de catégorie. Le parcours est une
// séquence UNIQUE, sans regroupement — une seule suite `sortOrder` 0..n-1 pour
// tout le parcours, ce que reflètent l'index `@@index([published, sortOrder])`
// et la lecture publique de `lib/timeline.ts`.
//
// ⚠️ AuditLog : story 5.19. Point de branchement — ne pas l'anticiper ici.

/** Retour de l'action, consommé par le client pour décider du rollback. */
export type ReorderState =
  { status: "success" } | { status: "error"; message: string };

const SESSION_EXPIRED =
  "Session expirée. Reconnectez-vous pour enregistrer l'ordre.";
const GENERIC_ERROR =
  "L'ordre n'a pas pu être enregistré. L'affichage a été rétabli.";
const STALE_LIST_ERROR =
  "La liste a changé entre-temps (entrée supprimée ou ajoutée). Rechargez la page pour repartir de l'ordre réel.";

/**
 * Entrée de l'action : la liste ORDONNÉE des identifiants.
 *
 * ⚠️ La position dans le tableau EST l'ordre voulu — aucun `sortOrder` n'est
 * transmis par le client. C'est volontaire : si le client envoyait des valeurs,
 * il pourrait produire des doublons ou des trous, et l'ordre deviendrait non
 * déterministe. Le serveur réassigne `sortOrder = index`, ce qui garantit une
 * séquence contiguë et sans collision à chaque enregistrement.
 */
const reorderSchema = z.object({
  orderedIds: z
    .array(z.string().min(1))
    .min(1, "La liste du parcours est vide.")
    // Un même id deux fois rendrait `sortOrder = index` ambigu : deux positions
    // pour une seule ligne, la dernière écrasant la première en silence.
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "La liste du parcours contient un doublon.",
    }),
});

/**
 * Réassigne le `sortOrder` de TOUTES les entrées du parcours (AC2).
 *
 * Appelée depuis un composant client (pas un `<form>`) : elle reçoit un objet
 * typé et non un `FormData`. Cet objet reste une entrée NON FIABLE — il
 * traverse le réseau et l'action est atteignable directement — d'où la
 * validation Zod systématique avant tout accès base.
 *
 * ⚠️ Ne renvoie JAMAIS d'exception au client : l'appelant a besoin d'un retour
 * exploitable pour décider s'il conserve l'ordre optimiste ou revient en
 * arrière. Une exception se traduirait par une erreur générique React, sans
 * rollback propre.
 */
export async function reorderTimelineAction(input: {
  orderedIds: string[];
}): Promise<ReorderState> {
  try {
    // Une Server Action est un endpoint POST à part entière : le guard de
    // layout ne la protège pas.
    await requireAdmin();

    const parsed = reorderSchema.safeParse(input);
    if (!parsed.success) {
      return { status: "error", message: GENERIC_ERROR };
    }
    const { orderedIds } = parsed.data;

    await prisma.$transaction(async (tx) => {
      // ⚠️ GARDE DE COHÉRENCE — on ne fait pas confiance au client sur la
      // COMPOSITION de la liste. On vérifie que les ids soumis sont exactement
      // ceux du parcours :
      //  - un id étranger écrirait sur une ligne que l'écran n'affichait pas ;
      //  - une liste incomplète (entrée créée ou supprimée dans un autre onglet
      //    entre-temps) calculerait les index sur une séquence partielle, donc
      //    un ordre faux pour les absentes.
      // Dans les deux cas on refuse plutôt que d'écrire un ordre erroné : le
      // client rétablit alors l'affichage précédent.
      const actual = await tx.timelineEntry.findMany({ select: { id: true } });

      const actualIds = new Set(actual.map((row) => row.id));
      const sameSize = actualIds.size === orderedIds.length;
      const allBelong = orderedIds.every((id) => actualIds.has(id));
      if (!sameSize || !allBelong) {
        throw new StaleListError();
      }

      // Réassignation par index : séquence contiguë 0..n-1, sans collision
      // possible. En transaction, pour qu'une panne à mi-parcours ne laisse pas
      // un ordre à moitié réécrit.
      await Promise.all(
        orderedIds.map((id, index) =>
          tx.timelineEntry.update({
            where: { id },
            data: { sortOrder: index },
            select: { id: true },
          }),
        ),
      );
    });

    // AC2 — « l'ordre est persisté ET reflété sur le site public ». Sans cette
    // invalidation, le nouvel ordre n'y apparaîtrait qu'au bout d'une heure.
    revalidateTag(CACHE_TAGS.timeline, { expire: 0 });

    return { status: "success" };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { status: "error", message: SESSION_EXPIRED };
    }
    if (error instanceof StaleListError) {
      return { status: "error", message: STALE_LIST_ERROR };
    }

    const raw = error instanceof Error ? error.message : String(error);
    console.error(
      `[admin] Réordonnancement du parcours échoué. Cause : ${raw.replace(/\s+/g, " ").trim()}`,
    );
    return { status: "error", message: GENERIC_ERROR };
  }
}

/**
 * Liste soumise incohérente avec l'état réel de la base. Classe interne : elle
 * sert uniquement à distinguer ce cas d'une panne, pour afficher un message qui
 * explique quoi faire (recharger) plutôt qu'un « réessayez » inutile.
 */
class StaleListError extends Error {}
