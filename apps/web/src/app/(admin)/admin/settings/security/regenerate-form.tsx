"use client";

import { useActionState, useState } from "react";

import { regenerateRecoveryCodesAction, type RegenerateState } from "./actions";
import { RecoveryCodesPanel } from "./recovery-codes-panel";

// Story 5.4 (AC4) — Vue « bête » de la régénération d'un jeu de codes.
//
// Action DESTRUCTIVE : elle invalide tous les codes existants. On impose donc
// une confirmation explicite en deux temps côté client (le serveur, lui, vérifie
// `requireAdmin` + 2FA active — la protection ne repose jamais sur ce garde-fou
// d'interface). Les nouveaux codes remplacent le formulaire dès leur retour :
// affichage UNIQUE, comme à l'enrôlement (AC1).

const initialState: RegenerateState = { error: null };

type RegenerateFormProps = {
  /** Codes encore utilisables — pilote le ton du message (AC4). */
  remaining: number;
};

export function RegenerateForm({ remaining }: RegenerateFormProps) {
  const [state, formAction, pending] = useActionState(
    regenerateRecoveryCodesAction,
    initialState,
  );
  const [confirming, setConfirming] = useState(false);

  if (state.recoveryCodes && state.recoveryCodes.length > 0) {
    return (
      <RecoveryCodesPanel codes={state.recoveryCodes}>
        <p className="text-xs text-white/60">
          Vos anciens codes ne fonctionnent plus.
        </p>
      </RecoveryCodesPanel>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state.error ? (
        <p role="alert" className="text-sm text-red-400">
          {state.error}
        </p>
      ) : null}

      {confirming ? (
        <>
          <p role="alert" className="text-sm text-amber-200">
            {remaining > 0
              ? `Vos ${remaining} code(s) restant(s) seront immédiatement invalidés et remplacés par 8 nouveaux codes.`
              : "8 nouveaux codes vont être générés et affichés une seule fois."}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-60"
            >
              {pending ? "Génération…" : "Confirmer la régénération"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={pending}
              className="rounded border border-white/25 px-4 py-2 text-sm hover:bg-white/10"
            >
              Annuler
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="self-start rounded border border-white/25 px-4 py-2 text-sm hover:bg-white/10"
        >
          Régénérer un nouveau jeu de codes
        </button>
      )}
    </form>
  );
}
