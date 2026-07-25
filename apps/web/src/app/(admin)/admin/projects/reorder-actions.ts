"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";

import { CACHE_TAGS } from "@/lib/cache-tags";
import { prisma } from "@/lib/db";
import { ProjectCategory } from "@/generated/prisma/enums";
import { requireAdmin, UnauthorizedError } from "@/lib/require-admin";

// Story 5.10 — PERSISTANCE DE L'ORDRE des projets (AC1, AC3).
//
// Même chaîne que les mutations de 5.8, sans en dévier :
//
//   requireAdmin()  →  Zod  →  transaction  →  revalidateTag(projects)
//
// ⚠️ Action SÉPARÉE de `actions.ts` (qui gère la création/modification/
// suppression) pour une raison de fond : réordonner ne touche AUCUN champ
// éditorial. Mélanger les deux chemins ferait passer un `sortOrder` dans le
// schéma du formulaire de projet, alors que 5.8 l'en avait justement exclu.
//
// ⚠️ AuditLog : story 5.19. Ce fichier en sera un point de branchement — ne pas
// l'anticiper ici.

/** Retour de l'action, consommé par le client pour décider du rollback (AC2). */
export type ReorderState =
  { status: "success" } | { status: "error"; message: string };

const SESSION_EXPIRED =
  "Session expirée. Reconnectez-vous pour enregistrer l'ordre.";
const GENERIC_ERROR =
  "L'ordre n'a pas pu être enregistré. L'affichage a été rétabli.";
const STALE_LIST_ERROR =
  "La liste a changé entre-temps (projet supprimé ou déplacé). Rechargez la page pour repartir de l'ordre réel.";

/**
 * Entrée de l'action : une catégorie et la liste ORDONNÉE de ses identifiants.
 *
 * ⚠️ La position dans le tableau EST l'ordre voulu — aucun `sortOrder` n'est
 * transmis par le client. C'est volontaire : si le client envoyait des valeurs,
 * il pourrait produire des doublons ou des trous, et l'ordre deviendrait non
 * déterministe (piège n°1). Le serveur réassigne `sortOrder = index`, ce qui
 * garantit une séquence contiguë et sans collision à chaque enregistrement.
 */
const reorderSchema = z.object({
  category: z.enum(ProjectCategory),
  orderedIds: z
    .array(z.string().min(1))
    .min(1, "La liste des projets est vide.")
    // Un même id deux fois rendrait `sortOrder = index` ambigu : deux positions
    // pour une seule ligne, la dernière écrasant la première en silence.
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "La liste des projets contient un doublon.",
    }),
});

/**
 * Réassigne le `sortOrder` des projets d'UNE catégorie (AC1, AC3).
 *
 * Appelée depuis un composant client (pas un `<form>`) : elle reçoit donc un
 * objet typé et non un `FormData`. Cet objet reste une entrée NON FIABLE — il
 * traverse le réseau et l'action est atteignable directement — d'où la
 * validation Zod systématique avant tout accès base.
 *
 * ⚠️ Ne renvoie JAMAIS d'exception au client : l'appelant a besoin d'un retour
 * exploitable pour décider s'il conserve l'ordre optimiste ou revient en
 * arrière (AC2). Une exception se traduirait par une erreur générique React,
 * sans rollback propre.
 */
export async function reorderProjectsAction(input: {
  category: string;
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
    const { category, orderedIds } = parsed.data;

    await prisma.$transaction(async (tx) => {
      // ⚠️ GARDE DE COHÉRENCE — on ne fait pas confiance au client sur la
      // COMPOSITION de la liste. On vérifie que les ids soumis sont exactement
      // ceux de la catégorie :
      //  - un id étranger à la catégorie déplacerait un projet hors de sa
      //    section, voire écrirait sur une ligne que l'écran n'affichait pas ;
      //  - une liste incomplète (projet créé ou supprimé dans un autre onglet
      //    entre-temps) calculerait les index sur une séquence partielle, donc
      //    un ordre faux pour les absents.
      // Dans les deux cas on refuse plutôt que d'écrire un ordre erroné : le
      // client rétablit alors l'affichage précédent (AC2).
      const actual = await tx.project.findMany({
        where: { category },
        select: { id: true },
      });

      const actualIds = new Set(actual.map((row) => row.id));
      const sameSize = actualIds.size === orderedIds.length;
      const allBelong = orderedIds.every((id) => actualIds.has(id));
      if (!sameSize || !allBelong) {
        throw new StaleListError();
      }

      // Réassignation par index : séquence contiguë 0..n-1, sans collision
      // possible (piège n°1). En transaction, pour qu'une panne à mi-parcours
      // ne laisse pas un ordre à moitié réécrit.
      await Promise.all(
        orderedIds.map((id, index) =>
          tx.project.update({
            where: { id },
            data: { sortOrder: index },
            select: { id: true },
          }),
        ),
      );
    });

    // Sans cette invalidation, le nouvel ordre n'apparaîtrait sur le site public
    // qu'au bout d'une heure de cache (AC3).
    revalidateTag(CACHE_TAGS.projects, { expire: 0 });

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
      `[admin] Réordonnancement des projets échoué. Cause : ${raw.replace(/\s+/g, " ").trim()}`,
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
