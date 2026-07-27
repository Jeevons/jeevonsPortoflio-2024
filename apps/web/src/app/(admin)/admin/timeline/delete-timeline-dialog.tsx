"use client";

import { useActionState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/admin/use-confirm-dialog";

import {
  deleteTimelineEntryAction,
  type DeleteTimelineEntryState,
} from "./actions";

// Story 5.14 — CONFIRMATION de suppression (AC4 : « quand je confirme »).
//
// Même choix technique qu'en 5.8, et pour les mêmes raisons : un `<dialog>`
// natif apporte le piège du focus, la fermeture par Échap, l'inertie du fond et
// le rôle `dialog` implicite — sans aucune dépendance, là où un `AlertDialog`
// Radix en imposerait une (AGENTS.md §9 règle 6). `window.confirm()` est exclu :
// il bloque le thread et son libellé ne peut pas nommer l'entrée concernée, or
// c'est justement ce qui évite de supprimer la mauvaise.

const initialState: DeleteTimelineEntryState = {
  status: "idle",
  message: null,
};

type DeleteTimelineDialogProps = {
  entryId: string;
  /** Intitulé affiché dans la confirmation — évite de supprimer la mauvaise. */
  entryTitle: string;
};

export function DeleteTimelineDialog({
  entryId,
  entryTitle,
}: DeleteTimelineDialogProps) {
  const { dialogRef, open, close } = useConfirmDialog();
  const [state, formAction, pending] = useActionState(
    deleteTimelineEntryAction,
    initialState,
  );

  // En cas d'ÉCHEC serveur, le dialogue doit rester ouvert pour porter le
  // message : le fermer ferait disparaître l'explication et donnerait l'illusion
  // d'un succès. En cas de succès, l'action redirige — ce composant est démonté.
  useEffect(() => {
    if (state.status === "error") {
      dialogRef.current?.showModal();
    }
  }, [state, dialogRef]);

  return (
    <>
      <Button type="button" variant="destructive" size="sm" onClick={open}>
        Supprimer
      </Button>

      <dialog
        ref={dialogRef}
        aria-labelledby="delete-timeline-dialog-title"
        className="max-w-md rounded-lg border border-border bg-card p-6 text-card-foreground backdrop:bg-black/50"
      >
        <h2 id="delete-timeline-dialog-title" className="text-lg font-semibold">
          Supprimer cette entrée ?
        </h2>

        <p className="mt-2 text-sm text-muted-foreground">
          L&apos;entrée{" "}
          <strong className="text-foreground">{entryTitle}</strong> sera
          définitivement supprimée de votre parcours.{" "}
          <strong className="text-foreground">
            Cette action est irréversible.
          </strong>
        </p>

        {/* L'illustration n'est PAS supprimée avec l'entrée : elle reste dans la
            bibliothèque, où elle peut servir à d'autres contenus. On le dit,
            sinon on pourrait croire l'image perdue et hésiter à supprimer. */}
        <p className="mt-2 text-xs text-muted-foreground">
          Son illustration reste disponible dans la bibliothèque d&apos;images.
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
          <Button type="button" variant="ghost" onClick={close}>
            Annuler
          </Button>

          <form action={formAction}>
            <input type="hidden" name="id" value={entryId} />
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Suppression…" : "Supprimer définitivement"}
            </Button>
          </form>
        </div>
      </dialog>
    </>
  );
}
