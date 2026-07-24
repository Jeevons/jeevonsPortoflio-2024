"use server";

import { isRedirectError } from "next/dist/client/components/redirect-error";

import { signIn } from "@/lib/auth";

// Story 5.1 — Server action de connexion. La logique vit CÔTÉ SERVEUR
// (AGENTS.md §6) ; la page /login n'est qu'une vue « bête ».
//
// Anti-énumération (AC4) : quelle que soit la cause de l'échec (e-mail inconnu,
// mauvais mot de passe, entrée malformée), on renvoie le MÊME message générique.
// Le coût argon2 constant est déjà payé dans `authorize` (dummy verify), donc le
// timing ne trahit pas non plus l'existence du compte.

export type LoginState = { error: string | null };

const GENERIC_ERROR = "Identifiants invalides.";

export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = formData.get("email");
  const password = formData.get("password");

  try {
    // redirectTo : après succès, Auth.js redirige (throw d'un redirect Next géré
    // ci-dessous). La protection de /admin arrive en 5.2 ; on pointe la racine
    // en attendant l'écran d'administration (5.7+).
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/",
    });
  } catch (error) {
    // Un signIn RÉUSSI lève une redirection Next : on la laisse se propager.
    if (isRedirectError(error)) throw error;
    // Tout autre échec (CredentialsSignin, etc.) → message générique unique.
    return { error: GENERIC_ERROR };
  }

  // Inatteignable en pratique (succès = redirect throw), mais type-safe.
  return { error: null };
}
