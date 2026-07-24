"use client";

import { useActionState } from "react";

import { loginAction, type LoginState } from "./actions";

// Story 5.1 — Vue « bête » (AGENTS.md §6) : formulaire minimal branché sur la
// server action `loginAction`. Aucune logique d'authentification ici ; le client
// ne fait qu'afficher le champ, l'état de soumission et le message générique.

const initialState: LoginState = { error: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(
    loginAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span>E-mail</span>
        <input
          type="email"
          name="email"
          autoComplete="username"
          required
          className="rounded border border-white/20 bg-transparent px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span>Mot de passe</span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          className="rounded border border-white/20 bg-transparent px-3 py-2"
        />
      </label>

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
        {pending ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
