"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth, unstable_update } from "@/lib/auth";
import { mfaStateFromToken } from "@/lib/auth.config";
import { prisma } from "@/lib/db";
import { safeCallbackUrl } from "@/lib/safe-callback-url";
import { decryptTotpSecret } from "@/lib/crypto/totp-secret";
import { looksLikeTotpCode, verifyTotpCodeWithStep } from "@/lib/auth/totp";
import { verifyAndConsumeRecoveryCode } from "@/lib/auth/recovery-codes";
import { checkMfaRateLimit, resetMfaRateLimit } from "@/lib/mfa-rate-limit";
import { clientIpFromHeaders } from "@/lib/login-rate-limit";

// Story 5.5 — Server action du SECOND FACTEUR : c'est ici que la session
// partielle devient complète (AGENTS.md §6 : toute la logique côté serveur ;
// l'écran reste une vue « bête »).
//
// Enchaînement complet du login en deux temps :
//   mot de passe (5.1) → session partielle `mfaPending` 5 min (AC1)
//     → code TOTP (5.3) OU code de récupération (5.4)
//     → session COMPLÈTE, administration ouverte (AC2)
//
// Trois protections, dans cet ordre :
//  1. Session partielle valide exigée (une session expirée repart du login) ;
//  2. Rate-limit 5/15 min/IP AVANT toute vérification (AC5) ;
//  3. Anti-rejeu du pas TOTP consommé (AC4) + tolérance ±1 pas (AC3).

export type MfaState = { error: string | null };

// Message UNIQUE quelle que soit la cause de l'échec (code faux, code déjà
// consommé, code de récupération inconnu). Cohérent avec l'anti-énumération de
// 5.1 : rien ne doit indiquer à un attaquant s'il « approche ».
const GENERIC_ERROR =
  "Ce code n'est pas valide. Vérifiez l'heure de votre téléphone et réessayez.";
const RATE_LIMITED_ERROR =
  "Trop de tentatives. Réessayez dans quelques minutes.";
const EXPIRED_ERROR =
  "Votre session a expiré. Reconnectez-vous avec votre mot de passe.";

export async function verifyMfaAction(
  _prevState: MfaState,
  formData: FormData,
): Promise<MfaState> {
  const session = await auth();
  const email = session?.user?.email;

  // La session partielle doit exister ET être dans sa fenêtre de 5 min (AC1).
  // `full` : le second facteur est déjà franchi → rien à faire ici.
  const state = mfaStateFromToken(session);
  if (!email || state === "none") {
    return { error: EXPIRED_ERROR };
  }

  // Défensif : une soumission malformée (formulaire posté hors du flux normal)
  // ne doit pas produire une 500 mais un refus propre — une pile d'erreur en
  // réponse est aussi une fuite d'information sur l'écran d'authentification.
  if (!formData || typeof formData.get !== "function") {
    return { error: GENERIC_ERROR };
  }

  const rawCallback = formData.get("callbackUrl");
  const callbackUrl = safeCallbackUrl(
    typeof rawCallback === "string" ? rawCallback : null,
  );

  if (state === "full") {
    redirect(callbackUrl);
  }

  // Rate-limit (AC5) — AVANT toute vérification cryptographique : une IP
  // verrouillée ne déclenche ni calcul TOTP ni `argon2.verify` (codes de
  // récupération). IP réelle via X-Forwarded-For derrière Traefik (5.2).
  const ip = clientIpFromHeaders(await headers());
  if (!checkMfaRateLimit(ip, email).allowed) {
    return { error: RATE_LIMITED_ERROR };
  }

  const rawCode = formData.get("code");
  const code = typeof rawCode === "string" ? rawCode.trim() : "";
  if (code.length === 0) {
    return { error: GENERIC_ERROR };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, totpSecret: true, totpLastCounter: true },
  });
  if (!user?.totpSecret) {
    return { error: GENERIC_ERROR };
  }

  // Aiguillage TOTP / code de récupération (piège n°4). Un code à 6 chiffres est
  // un TOTP ; toute autre forme est tentée comme code de récupération. ❌ On ne
  // réimplémente PAS la logique de récupération : `verifyAndConsumeRecoveryCode`
  // (5.4) reste la source unique, y compris pour l'usage unique.
  let accepted = false;

  if (looksLikeTotpCode(code)) {
    const secret = decryptTotpSecret(user.totpSecret);
    // Tolérance ±1 pas (AC3, figée dans le module TOTP) + anti-rejeu (AC4) :
    // `totpLastCounter` est le dernier pas consommé ; otplib refuse tout pas
    // qui lui est inférieur ou égal.
    const result = await verifyTotpCodeWithStep(
      secret,
      code,
      user.totpLastCounter,
    );
    if (result.valid) {
      // Le pas consommé est persisté AVANT d'ouvrir la session : le code qui
      // vient de servir est mort, y compris pour une autre session et après un
      // redémarrage du conteneur (AC4).
      //
      // Anti-course : le filtre porte sur la valeur EXACTE relue plus haut. Si
      // deux soumissions simultanées présentent le même code, la seconde touche
      // 0 ligne et est refusée — jamais deux promotions pour un seul code.
      const updated = await prisma.user.updateMany({
        where: { id: user.id, totpLastCounter: user.totpLastCounter },
        data: { totpLastCounter: result.timeStep },
      });
      accepted = updated.count === 1;
    }
  } else {
    // Code de récupération (5.4) : usage unique garanti par le compare-and-swap
    // de `verifyAndConsumeRecoveryCode`. Ouvre la session au même titre (AC2).
    const recovery = await verifyAndConsumeRecoveryCode(email, code);
    accepted = recovery.ok;
  }

  if (!accepted) {
    // Échec : la session reste PARTIELLE. La tentative a déjà été comptée par
    // le rate-limit ci-dessus (AC5).
    return { error: GENERIC_ERROR };
  }

  // Succès (AC2) — PROMOTION en session complète. `unstable_update` ré-encode le
  // JWT via le callback `jwt` (trigger "update") : `mfaPending` et l'échéance
  // des 5 min disparaissent, l'administration s'ouvre.
  await unstable_update({ mfaSatisfied: true });

  // Le quota est libéré : une connexion réussie ne doit pas laisser un compteur
  // entamé qui verrouillerait la prochaine (compte unique).
  resetMfaRateLimit(ip, email);

  // Retour à la page initialement demandée, assainie côté serveur (5.2) : seul
  // un chemin interne est accepté, aucun open-redirect possible.
  redirect(callbackUrl);
}
