"use client";

import { useState } from "react";

// Story 5.4 — Écran d'affichage UNIQUE des codes de récupération (AC1).
//
// Vue « bête » (AGENTS.md §6) : elle reçoit les codes en clair en props et se
// contente de les rendre. Aucune logique de génération ici.
//
// ⚠️ Ces codes n'existent QUE dans ce rendu. Ils viennent de la valeur de retour
// d'une server action et ne sont récupérables par aucun rechargement : seuls
// leurs hash argon2id sont en base (AC2). D'où l'avertissement insistant et la
// confirmation explicite avant de quitter l'écran.
//
// ❌ Ne jamais les envoyer ailleurs (URL, log, analytics, requête réseau) : la
// seule copie autorisée est celle que l'utilisateur fait lui-même.

type RecoveryCodesPanelProps = {
  codes: string[];
  /** Rendu sous les codes : bouton « continuer », lien de retour… */
  children?: React.ReactNode;
};

export function RecoveryCodesPanel({
  codes,
  children,
}: RecoveryCodesPanelProps) {
  // `idle | copied | failed` — le presse-papier peut être refusé (permission,
  // contexte non sécurisé) : on le dit plutôt que de laisser croire au succès.
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <section
      aria-labelledby="recovery-codes-title"
      className="flex flex-col gap-4 rounded-lg border border-amber-400/40 bg-amber-400/5 p-4"
    >
      <div className="flex flex-col gap-2">
        <h2 id="recovery-codes-title" className="text-lg font-semibold">
          Vos {codes.length} codes de récupération
        </h2>
        {/* `role="alert"` : l'avertissement est la seule chance de l'utilisateur
            de comprendre qu'il doit agir MAINTENANT — il doit être annoncé. */}
        <p role="alert" className="text-sm text-amber-200">
          <strong>Conservez-les dès maintenant.</strong> Ils ne vous seront plus
          jamais affichés. Chacun ne fonctionne qu&apos;une seule fois et permet
          de vous connecter si vous perdez votre téléphone. Notez-les sur papier
          ou dans votre gestionnaire de mots de passe.
        </p>
      </div>

      <ul className="grid grid-cols-2 gap-2">
        {codes.map((code) => (
          <li
            key={code}
            className="select-all rounded border border-white/15 bg-black/30 px-3 py-2 text-center font-mono text-sm tracking-widest"
          >
            {code}
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="rounded border border-white/25 px-4 py-2 text-sm hover:bg-white/10"
        >
          Copier les codes
        </button>
        {/* Retour d'état annoncé aux lecteurs d'écran sans voler le focus. */}
        <p aria-live="polite" className="min-h-5 text-xs text-white/60">
          {copyState === "copied"
            ? "Codes copiés dans le presse-papier."
            : copyState === "failed"
              ? "Copie impossible : recopiez les codes manuellement."
              : ""}
        </p>
      </div>

      {children}
    </section>
  );
}
