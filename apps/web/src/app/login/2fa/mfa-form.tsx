"use client";

import { useActionState } from "react";

import { verifyMfaAction, type MfaState } from "./actions";

// Story 5.5 — Vue « bête » (AGENTS.md §6) : saisie du second facteur, branchée
// sur `verifyMfaAction`. Aucune logique de vérification ici — ni TOTP, ni
// anti-rejeu, ni rate-limit : tout vit côté serveur.

const initialState: MfaState = { error: null };

export function MfaForm({ callbackUrl }: { callbackUrl: string }) {
  const [state, formAction, pending] = useActionState(
    verifyMfaAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <label className="flex flex-col gap-1 text-sm">
        <span>Code de vérification</span>
        <input
          type="text"
          name="code"
          // `one-time-code` déclenche l'autoremplissage depuis le trousseau /
          // le gestionnaire de mots de passe. `inputMode numeric` fait sortir le
          // pavé chiffré sur mobile pour le cas nominal (TOTP à 6 chiffres).
          autoComplete="one-time-code"
          inputMode="numeric"
          autoFocus
          required
          // Pas de `pattern` ni de `maxLength` : le champ accepte AUSSI un code
          // de récupération au format XXXX-XXXX (5.4), plus long et alphanumérique.
          className="rounded border border-white/20 bg-transparent px-3 py-2 tracking-widest"
        />
      </label>

      <p className="text-xs text-white/60">
        Saisissez le code à six chiffres de votre application
        d&apos;authentification, ou l&apos;un de vos codes de récupération.
      </p>

      {state.error ? (
        <p role="alert" className="text-sm text-red-400">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-white/90 px-4 py-2 font-medium text-black disabled:opacity-60"
      >
        {pending ? "Vérification…" : "Vérifier"}
      </button>
    </form>
  );
}
