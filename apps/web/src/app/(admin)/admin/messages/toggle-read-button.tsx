"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";

import {
  markMessageReadAction,
  markMessageUnreadAction,
  type MessageActionState,
} from "./actions";

const initialState: MessageActionState = { status: "idle", message: null };

type ToggleReadButtonProps = {
  messageId: string;
  read: boolean;
};

/**
 * Bascule lu ↔ non lu (AC3), depuis un bouton EXPLICITE — jamais un effet de
 * bord du simple affichage de la page (piège n°3).
 */
export function ToggleReadButton({ messageId, read }: ToggleReadButtonProps) {
  const [state, formAction, pending] = useActionState(
    read ? markMessageUnreadAction : markMessageReadAction,
    initialState,
  );

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={formAction}>
        <input type="hidden" name="id" value={messageId} />
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          {pending ? "…" : read ? "Marquer non lu" : "Marquer lu"}
        </Button>
      </form>
      {state.status === "error" && state.message ? (
        <p role="alert" className="text-xs text-destructive">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
