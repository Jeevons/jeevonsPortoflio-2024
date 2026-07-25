"use client";

import { useActionState } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { revalidateSiteAction, type RevalidateState } from "./actions";

// Story 5.7 (AC2) — Vue « bête » du bouton « Revalider le site ».
//
// Seule frontière client du tableau de bord : tout le reste de la page est rendu
// côté serveur (AGENTS.md §6, `"use client"` uniquement quand l'interactivité
// l'impose). Ici elle l'impose — il faut l'état de soumission et le retour
// visuel de confirmation exigé par l'AC.

// L'état initial vit ICI, et non dans `actions.ts` : un module `"use server"`
// ne peut exporter que des fonctions async (voir le commentaire dans actions.ts).
const INITIAL_STATE: RevalidateState = {
  status: "idle",
  message: null,
  at: null,
};

export function RevalidateButton() {
  const [state, formAction, pending] = useActionState(
    revalidateSiteAction,
    INITIAL_STATE,
  );

  return (
    // `items-start` : sans lui, le bouton s'étirerait sur toute la largeur de la
    // carte (comportement par défaut d'un enfant de colonne flex).
    <form action={formAction} className="flex flex-col items-start gap-2">
      <Button type="submit" variant="outline" disabled={pending}>
        {/* `animate-spin` pendant l'attente : neutralisé automatiquement sous
            `prefers-reduced-motion: reduce` par la règle globale de
            globals.css (durée ramenée à 0.01ms) — AGENTS.md §6. L'état reste
            lisible sans le mouvement grâce au libellé « Revalidation… ». */}
        <RefreshCw
          aria-hidden="true"
          className={pending ? "animate-spin" : undefined}
        />
        {pending ? "Revalidation…" : "Revalider le site"}
      </Button>

      {/* `aria-live` : le retour de confirmation est ANNONCÉ aux lecteurs
          d'écran, pas seulement affiché (a11y non négociable). La région existe
          dans le DOM dès le départ — un conteneur inséré après coup ne serait
          pas annoncé par certains lecteurs. */}
      <p
        aria-live="polite"
        role="status"
        className={
          state.status === "error"
            ? "text-sm text-destructive"
            : "text-sm text-primary"
        }
      >
        {state.message}
      </p>
    </form>
  );
}
