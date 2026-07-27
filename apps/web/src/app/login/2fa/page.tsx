import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { mfaStateFromToken } from "@/lib/auth.config";
import { safeCallbackUrl } from "@/lib/safe-callback-url";

import { MfaForm } from "./mfa-form";

// Story 5.5 — Écran de saisie du second facteur (AC2).
//
// Vit sous /login, donc HORS du groupe protégé /admin : le guard admin peut
// ainsi refuser TOUTE session partielle sans exception à gérer (contrairement à
// l'écran d'enrôlement de 5.3, qui doit rester joignable depuis /admin). Une
// exception de moins dans le point de décision, c'est un trou de moins.
export const metadata: Metadata = {
  title: "Vérification en deux étapes",
  robots: { index: false, follow: false },
};

export default async function MfaChallengePage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.callbackUrl)
    ? params.callbackUrl[0]
    : params.callbackUrl;
  // Assainie dès ici : seul un chemin interne est retenu (anti open-redirect,
  // 5.2 piège n°3). La server action la ré-assainit de toute façon.
  const callbackUrl = safeCallbackUrl(raw);

  const session = await auth();
  const state = mfaStateFromToken(session);

  // Pas de session partielle valide (jamais connecté, ou les 5 min sont
  // écoulées, AC1) → on repart du mot de passe. La `callbackUrl` est conservée
  // pour revenir à la page demandée après le login complet.
  if (state === "none") {
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  // Session déjà complète : plus rien à vérifier ici.
  if (state === "full") {
    redirect(callbackUrl);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-6">
      <header className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold">Vérification en deux étapes</h1>
        <p className="max-w-sm text-sm text-white/70">
          Votre mot de passe a été accepté. Confirmez votre identité pour
          accéder à l&apos;administration.
        </p>
      </header>
      <MfaForm callbackUrl={callbackUrl} />
    </main>
  );
}
