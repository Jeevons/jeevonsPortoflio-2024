"use client";

import { useActionState, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";

import { deleteProjectAction, type DeleteProjectState } from "./actions";

// Story 5.8 — CONFIRMATION de suppression (AC5).
//
// L'AC est explicite : « une confirmation m'a été demandée avant l'action, qui
// est irréversible ». Un bouton « Supprimer » qui supprime au premier clic ne la
// satisfait PAS.
//
// ⚠️ Pourquoi un `<dialog>` natif plutôt qu'un `window.confirm()` ou un
// `AlertDialog` Radix ?
//  - `window.confirm()` bloque le thread, n'est pas stylable et son libellé
//    ne peut pas nommer le projet concerné (or c'est justement ce qui évite de
//    supprimer le mauvais) ;
//  - `AlertDialog` de shadcn/ui imposerait `@radix-ui/react-alert-dialog`, une
//    dépendance NON prévue par la story (périmètre : `zod` + react-hook-form
//    validés, rien d'autre — AGENTS.md §9 règle 6) ;
//  - `<dialog showModal()>` apporte NATIVEMENT ce qu'on attend ici : piège du
//    focus, fermeture par Échap, inertie du fond, rôle `dialog` implicite.
//    Zéro dépendance, accessibilité correcte par construction.

const initialState: DeleteProjectState = { status: "idle", message: null };

type DeleteProjectDialogProps = {
  projectId: string;
  /** Titre affiché dans la confirmation — évite de supprimer le mauvais projet. */
  projectTitle: string;
};

export function DeleteProjectDialog({
  projectId,
  projectTitle,
}: DeleteProjectDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [state, formAction, pending] = useActionState(
    deleteProjectAction,
    initialState,
  );

  // En cas d'ÉCHEC serveur, le dialogue doit rester ouvert pour porter le
  // message : le fermer ferait disparaître l'explication et donnerait
  // l'illusion d'un succès. En cas de succès, l'action redirige — ce composant
  // est démonté, rien à fermer.
  useEffect(() => {
    if (state.status === "error") {
      dialogRef.current?.showModal();
    }
  }, [state]);

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        onClick={() => dialogRef.current?.showModal()}
      >
        Supprimer
      </Button>

      {/* `closedby="any"` n'est pas encore universel : on s'appuie sur le
          comportement garanti de `showModal()` (Échap ferme, le fond est
          inerte). Le bouton « Annuler » ferme explicitement. */}
      <dialog
        ref={dialogRef}
        aria-labelledby="delete-dialog-title"
        className="max-w-md rounded-lg border border-border bg-card p-6 text-card-foreground backdrop:bg-black/50"
      >
        <h2 id="delete-dialog-title" className="text-lg font-semibold">
          Supprimer ce projet ?
        </h2>

        <p className="mt-2 text-sm text-muted-foreground">
          Le projet <strong className="text-foreground">{projectTitle}</strong>{" "}
          et ses points forts seront définitivement supprimés.{" "}
          <strong className="text-foreground">
            Cette action est irréversible.
          </strong>
        </p>

        {state.message ? (
          <p
            role="alert"
            className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive-foreground"
          >
            {state.message}
          </p>
        ) : null}

        <div className="mt-6 flex justify-end gap-3">
          {/* `formMethod="dialog"` sur un bouton d'un formulaire imbriqué serait
              ambigu : on ferme donc par un handler explicite, hors du form. */}
          <Button
            type="button"
            variant="ghost"
            onClick={() => dialogRef.current?.close()}
          >
            Annuler
          </Button>

          <form action={formAction}>
            <input type="hidden" name="id" value={projectId} />
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Suppression…" : "Supprimer définitivement"}
            </Button>
          </form>
        </div>
      </dialog>
    </>
  );
}
