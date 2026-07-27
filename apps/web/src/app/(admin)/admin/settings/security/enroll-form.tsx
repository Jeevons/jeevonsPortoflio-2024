"use client";

import Link from "next/link";
import { useActionState } from "react";

import { confirmEnrollmentAction, type EnrollState } from "./actions";
import { RecoveryCodesPanel } from "./recovery-codes-panel";

// Story 5.3 — Vue « bête » (AGENTS.md §6) : formulaire de confirmation du 1er
// code TOTP, branché sur la server action `confirmEnrollmentAction`. Aucune
// logique de vérification ici ; le client n'affiche que le champ, l'état de
// soumission et le message d'erreur.
//
// Story 5.4 — Après activation réussie, l'action renvoie les 8 codes de
// récupération : le formulaire cède alors la place à leur affichage UNIQUE
// (AC1). C'est pour cela que l'activation ne redirige plus vers /admin — le
// passage à l'admin se fait depuis l'écran de codes, une fois notés.
const initialState: EnrollState = { error: null };

export function EnrollForm() {
  const [state, formAction, pending] = useActionState(
    confirmEnrollmentAction,
    initialState,
  );

  // Activation réussie : on n'affiche PLUS le formulaire, seulement les codes.
  // Ils ne survivent qu'à ce rendu (aucun rechargement ne les ramène).
  if (state.recoveryCodes && state.recoveryCodes.length > 0) {
    return (
      <RecoveryCodesPanel codes={state.recoveryCodes}>
        <Link
          href="/admin"
          className="rounded bg-white px-4 py-2 text-center text-sm font-medium text-black"
        >
          J&apos;ai noté mes codes — accéder à l&apos;administration
        </Link>
      </RecoveryCodesPanel>
    );
  }

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
