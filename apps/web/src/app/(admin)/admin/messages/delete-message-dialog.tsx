"use client";

import { useActionState, useEffect } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/admin/use-confirm-dialog";

import { deleteMessageAction, type MessageActionState } from "./actions";

// Story 5.18 — CONFIRMATION de suppression (AC4 : « après confirmation »).
//
// Même choix technique qu'en 5.14/5.8 : `<dialog>` natif, aucune dépendance
// (AGENTS.md §9). `window.confirm()` est exclu : son libellé ne peut pas nommer
// l'expéditeur du message, or c'est justement ce qui évite de supprimer le
// mauvais.

const initialState: MessageActionState = { status: "idle", message: null };

type DeleteMessageDialogProps = {
  messageId: string;
  /** Nom de l'expéditeur — affiché dans la confirmation. */
  senderName: string;
  /**
   * Libellé visible du déclencheur. Absent = bouton icône.
   * Présent = bouton texte (écran de lecture d'un message).
   */
  triggerLabel?: string;
};

export function DeleteMessageDialog({
  messageId,
  senderName,
  triggerLabel,
}: DeleteMessageDialogProps) {
  const { dialogRef, open, close } = useConfirmDialog();
  const [state, formAction, pending] = useActionState(
    deleteMessageAction,
    initialState,
  );

  useEffect(() => {
    if (state.status === "error") {
      dialogRef.current?.showModal();
    }
  }, [state, dialogRef]);

  const iconLabel = `Supprimer le message de ${senderName}`;

  return (
    <>
      {triggerLabel ? (
        <Button type="button" variant="destructive" size="sm" onClick={open}>
          {triggerLabel}
        </Button>
      ) : (
        <Button
          type="button"
          variant="destructive"
          size="icon"
          className="size-8"
          onClick={open}
          aria-label={iconLabel}
          title={iconLabel}
        >
          <Trash2 aria-hidden className="size-4" />
        </Button>
      )}

      <dialog
        ref={dialogRef}
        aria-labelledby={`delete-message-title-${messageId}`}
        className="max-w-md rounded-lg border border-border bg-card p-6 text-card-foreground backdrop:bg-black/50"
      >
        <h2
          id={`delete-message-title-${messageId}`}
          className="text-lg font-semibold"
        >
          Supprimer ce message ?
        </h2>

        <p className="mt-2 text-sm text-muted-foreground">
          Le message de{" "}
          <strong className="text-foreground">{senderName}</strong> sera
          définitivement supprimé.{" "}
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
          <Button type="button" variant="ghost" onClick={close}>
            Annuler
          </Button>

          <form action={formAction}>
            <input type="hidden" name="id" value={messageId} />
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Suppression…" : "Supprimer définitivement"}
            </Button>
          </form>
        </div>
      </dialog>
    </>
  );
}
