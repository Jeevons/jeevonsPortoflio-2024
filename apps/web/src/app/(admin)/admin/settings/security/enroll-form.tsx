"use client";

import { useActionState } from "react";

import { confirmEnrollmentAction, type EnrollState } from "./actions";

// Story 5.3 — Vue « bête » (AGENTS.md §6) : formulaire de confirmation du 1er
// code TOTP, branché sur la server action `confirmEnrollmentAction`. Aucune
// logique de vérification ici ; le client n'affiche que le champ, l'état de
// soumission et le message d'erreur.
const initialState: EnrollState = { error: null };

export function EnrollForm() {
  const [state, formAction, pending] = useActionState(
    confirmEnrollmentAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex w-full flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span>Code à 6 chiffres</span>
        <input
          type="text"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]*"
          maxLength={7}
          required
          autoFocus
          aria-describedby={state.error ? "enroll-error" : undefined}
          className="rounded border border-white/20 bg-transparent px-3 py-2 font-mono tracking-widest"
        />
      </label>

      {state.error ? (
        <p id="enroll-error" role="alert" className="text-sm text-red-400">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-60"
      >
        {pending ? "Vérification…" : "Activer la double authentification"}
      </button>
    </form>
  );
}
