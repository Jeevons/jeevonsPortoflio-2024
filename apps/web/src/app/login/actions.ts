"use server";

import { headers } from "next/headers";
import { isRedirectError } from "next/dist/client/components/redirect-error";

import { signIn } from "@/lib/auth";
import { safeCallbackUrl } from "@/lib/safe-callback-url";
import {
  isLoginRateLimited,
  clientIpFromHeaders,
} from "@/lib/login-rate-limit";

// Story 5.1 — Server action de connexion. La logique vit CÔTÉ SERVEUR
// (AGENTS.md §6) ; la page /login n'est qu'une vue « bête ».
//
// Anti-énumération (AC4, 5.1) : quelle que soit la cause de l'échec (e-mail
// inconnu, mauvais mot de passe, entrée malformée), on renvoie le MÊME message
// générique. Le coût argon2 constant est déjà payé dans `authorize` (dummy
// verify), donc le timing ne trahit pas non plus l'existence du compte.
//
// Rate-limit (AC4, 5.2) : au-delà de 5 tentatives / 15 min / IP, on refuse AVANT
// même de tenter le login — sans offrir de canal de calcul argon2. Le message
// reste générique mais explicite (« trop de tentatives »), le verrou se lève
// seul.

export type LoginState = { error: string | null };

const GENERIC_ERROR = "Identifiants invalides.";
const RATE_LIMITED_ERROR =
  "Trop de tentatives. Réessayez dans quelques minutes.";

export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  // Rate-limit (AC4). Le COMPTAGE (source unique) vit dans `authorize`
  // (src/lib/auth.ts), qui est la vraie frontière et couvre aussi les appels
  // directs à /api/auth. Ici on ne fait que CONSULTER l'état (sans incrémenter,
  // pour ne pas double-compter) afin d'afficher un message dédié à l'UI si l'IP
  // est déjà verrouillée. IP réelle via X-Forwarded-For (derrière Traefik).
  const requestHeaders = await headers();
  const ip = clientIpFromHeaders(requestHeaders);
  if (isLoginRateLimited(ip)) {
    return { error: RATE_LIMITED_ERROR };
  }

  const email = formData.get("email");
  const password = formData.get("password");

  // Callback URL sûre (AC3, story 5.2). La valeur vient d'un champ caché posé
  // par la page de login (elle-même alimentée par le middleware). On la
  // ré-assainit ICI, côté serveur : jamais faire confiance à une valeur de
  // formulaire — seul un chemin interne est accepté (anti open-redirect).
  const rawCallback = formData.get("callbackUrl");
  const callbackUrl = safeCallbackUrl(
    typeof rawCallback === "string" ? rawCallback : null,
  );

  try {
    // redirectTo : après succès, Auth.js redirige (throw d'un redirect Next géré
    // ci-dessous) vers la page initialement demandée (AC3), assainie ci-dessus.
    await signIn("credentials", {
      email,
      password,
      redirectTo: callbackUrl,
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
