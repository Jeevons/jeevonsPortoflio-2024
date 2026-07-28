"use client";

import { startTransition, useActionState, useEffect } from "react";

import {
  deleteMediaAction,
  type MediaActionState,
} from "@/app/(admin)/admin/media/actions";
import { useConfirmDialog } from "@/components/admin/use-confirm-dialog";
import { Button } from "@/components/ui/button";

// Suppression d'une image DEPUIS LES GRILLES DE SÉLECTION (retour Jeevons,
// 28/07 : « j'aimerai bien qu'on puisse supprimer les images qu'on ajoute, là
// on peut pas, et ça s'entasse »).
//
// ⚠️ LA SUPPRESSION EXISTAIT DÉJÀ, mais uniquement sur `/admin/media`
// (story 5.13). Depuis l'éditeur d'un projet, la bibliothèque n'offrait qu'un
// geste « ajouter » : les images téléversées par erreur restaient visibles à
// jamais dans le sélecteur, sans aucun moyen de les retirer sans changer
// d'écran et perdre la saisie en cours.
//
// 🛑 ON RÉUTILISE `deleteMediaAction` TELLE QUELLE, sans la dupliquer ni
// l'assouplir. Elle porte le garde-fou qui fait foi : une image utilisée par un
// projet ou le parcours est REFUSÉE, avec la liste des contenus concernés
// (`findMediaUsages`, étendu aux galeries). Contrairement à `/admin/media`,
// cet écran ne connaît PAS les usages (l'API `/api/admin/media` ne les renvoie
// pas) : on ne peut donc pas désactiver le bouton à l'avance, et c'est le
// message du serveur qui informe — d'où le dialogue qui reste ouvert en cas de
// refus, pour l'afficher là où le clic vient d'avoir lieu.
//
// ⚠️ SUPPRIME LE FICHIER, il ne le retire pas d'une liste. À ne pas confondre
// avec le `✕` d'une ligne de galerie, qui détache l'image DU PROJET en la
// laissant en bibliothèque. Les libellés le disent explicitement.

const initialState: MediaActionState = { status: "idle", message: null };

type MediaDeleteButtonProps = {
  mediaId: string;
  /** Décrit l'image dans les libellés accessibles (texte alternatif). */
  label: string;
  /** Rejouer le chargement de la bibliothèque après une suppression réussie. */
  onDeleted: () => void;
};

export function MediaDeleteButton({
  mediaId,
  label,
  onDeleted,
}: MediaDeleteButtonProps) {
  const { dialogRef, open, close } = useConfirmDialog();
  const [state, formAction, pending] = useActionState(
    deleteMediaAction,
    initialState,
  );

  // La suppression ne navigue pas : c'est ici qu'on referme et qu'on rafraîchit
  // la grille. ⚠️ `router.refresh()` ne suffirait PAS — la bibliothèque de ces
  // sélecteurs est chargée en `fetch` côté client, pas par le rendu serveur :
  // elle doit être rechargée explicitement, d'où `onDeleted`.
  useEffect(() => {
    if (state.status === "success") {
      close();
      onDeleted();
    }
    // `onDeleted` est une closure recréée à chaque rendu du parent : l'inclure
    // relancerait l'effet sans raison. Seul le résultat de l'action compte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, close]);

  return (
    <>
      {/* 🛑 BOUTON FRÈRE de la vignette, jamais IMBRIQUÉ dedans : la vignette
          est déjà un `<button>` (galerie) ou un `<label>` porteur d'un radio
          (couverture). Imbriquer un contrôle dans un autre est du HTML invalide
          et rend la cible ambiguë au clavier (AGENTS.md §6). Le positionnement
          absolu le superpose visuellement, sans l'imbriquer dans l'arbre. */}
      <button
        type="button"
        onClick={open}
        title="Supprimer définitivement cette image de la bibliothèque"
        aria-label={`Supprimer définitivement ${label} de la bibliothèque`}
        className="absolute bottom-1 right-1 z-10 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white opacity-0 transition-opacity hover:bg-destructive focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
      >
        <span aria-hidden="true">🗑</span>
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={`delete-media-${mediaId}`}
        className="max-w-md rounded-lg border border-border bg-card p-6 text-card-foreground backdrop:bg-black/50"
      >
        <h2 id={`delete-media-${mediaId}`} className="text-lg font-semibold">
          Supprimer cette image ?
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Le fichier sera définitivement effacé du disque et disparaîtra de la
          bibliothèque.{" "}
          <strong className="text-foreground">
            Cette action est irréversible.
          </strong>
        </p>

        {/* Refus du serveur (image utilisée ailleurs) : affiché DANS le
            dialogue, qui reste ouvert — le message nomme les contenus à
            détacher d'abord. */}
        {state.status === "error" ? (
          <p
            role="alert"
            className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive-foreground"
          >
            {state.message}
          </p>
        ) : null}

        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={close}>
            Annuler
          </Button>
          {/* 🛑 PAS DE `<form>` ICI, ET C'EST ESSENTIEL. Ce composant est rendu
              À L'INTÉRIEUR du `<form>` d'édition du projet (project-form.tsx) ;
              or le parseur HTML SUPPRIME un `<form>` imbriqué et fait remonter
              son contenu dans le parent. Le bouton se serait donc retrouvé
              rattaché au formulaire du PROJET : cliquer « Supprimer
              définitivement » aurait enregistré le projet au lieu d'effacer
              l'image — sans la moindre erreur visible.
              (Le `<dialog>` est promu en top layer à l'affichage, mais cela ne
              change RIEN à l'arbre DOM : l'imbrication reste réelle.)

              On appelle donc l'action À LA MAIN, avec un `FormData` construit
              ici. `startTransition` est requis : hors transition, React refuse
              l'appel d'une action de `useActionState`.

              ❌ NE PAS revenir à `<Button name="id" value={mediaId}
              formAction={…}>` : React RÉÉCRIT le `name` du bouton pour y
              encoder la référence de l'action (vérifié dans le HTML rendu :
              `name="$ACTION_REF_1"`). Le champ `id` n'arriverait jamais au
              serveur, et `formData.get("id")` y serait `null` — la suppression
              échouerait avec un message générique, sans rien indiquer. */}
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={() => {
              const data = new FormData();
              data.set("id", mediaId);
              startTransition(() => formAction(data));
            }}
          >
            {pending ? "Suppression…" : "Supprimer définitivement"}
          </Button>
        </div>
      </dialog>
    </>
  );
}
