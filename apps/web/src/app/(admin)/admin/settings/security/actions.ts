"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/require-admin";
import { prisma } from "@/lib/db";
import { encryptTotpSecret, decryptTotpSecret } from "@/lib/crypto/totp-secret";
import {
  generateTotpSecret,
  buildTotpUri,
  verifyTotpCode,
} from "@/lib/auth/totp";

// Story 5.3 — Server actions de l'écran d'enrôlement 2FA (AGENTS.md §6 : toute
// la logique côté serveur, la page reste une vue « bête »).

/**
 * Prépare le secret à afficher sur l'écran d'enrôlement (AC3 + AC4).
 *
 * Anti-lock-out (AC4, piège n°4) : le secret est persisté CHIFFRÉ dès sa
 * génération, mais `totpEnabledAt` reste `null` → la 2FA n'est PAS active. Un
 * secret non confirmé n'est de toute façon exploitable par personne d'autre.
 *
 * Idempotence : si un secret en attente existe déjà (2FA non encore confirmée),
 * on le RÉUTILISE — sinon un rechargement de page invaliderait le QR déjà scanné
 * par l'utilisateur. On n'en régénère un que s'il n'y en a pas encore.
 *
 * Renvoie le secret EN CLAIR et l'URI otpauth — uniquement à l'admin légitime,
 * sur sa propre page. Jamais loggé.
 */
export async function preparePendingSecret(): Promise<{
  secret: string;
  uri: string;
}> {
  const session = await requireAdmin();
  const email = session.user?.email;
  if (!email) {
    // requireAdmin garantit une session ; l'email est la clé du compte unique.
    throw new Error("Session sans e-mail : enrôlement impossible.");
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error("Compte administrateur introuvable.");
  }

  // Déjà activée : rien à enrôler (le guard n'aurait pas dû amener ici).
  if (user.totpEnabledAt) {
    redirect("/admin");
  }

  let plaintextSecret: string;
  if (user.totpSecret) {
    // Secret en attente déjà généré → on le réutilise (QR stable).
    plaintextSecret = decryptTotpSecret(user.totpSecret);
  } else {
    plaintextSecret = generateTotpSecret();
    await prisma.user.update({
      where: { email },
      data: { totpSecret: encryptTotpSecret(plaintextSecret) },
    });
  }

  return {
    secret: plaintextSecret,
    uri: buildTotpUri(plaintextSecret, email),
  };
}

export type EnrollState = { error: string | null };

const GENERIC_ERROR =
  "Ce code n'est pas valide. Vérifiez l'heure de votre téléphone et réessayez.";

/**
 * Confirme l'enrôlement par un PREMIER code valide (AC4).
 *
 * Tant que ce code n'est pas fourni et validé contre le secret, `totpEnabledAt`
 * reste `null` : la 2FA n'est pas active et l'utilisateur ne peut pas se
 * verrouiller dehors. Sur succès : on pose `totpEnabledAt = now()` et on
 * redirige vers l'admin (le guard laisse alors passer).
 */
export async function confirmEnrollmentAction(
  _prevState: EnrollState,
  formData: FormData,
): Promise<EnrollState> {
  const session = await requireAdmin();
  const email = session.user?.email;
  if (!email) {
    return { error: GENERIC_ERROR };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  // Pas de secret en attente : l'utilisateur a soumis sans charger le secret.
  if (!user || !user.totpSecret) {
    return { error: GENERIC_ERROR };
  }
  // Déjà activée : ne rien re-poser (idempotent), laisser le guard router.
  if (user.totpEnabledAt) {
    redirect("/admin");
  }

  const rawCode = formData.get("code");
  const code = typeof rawCode === "string" ? rawCode : "";

  const secret = decryptTotpSecret(user.totpSecret);
  const valid = await verifyTotpCode(secret, code);
  if (!valid) {
    // Échec : la 2FA reste INACTIVE (totpEnabledAt inchangé, null). AC4.
    return { error: GENERIC_ERROR };
  }

  // Succès : activation confirmée (AC4). Le secret déjà chiffré reste tel quel.
  await prisma.user.update({
    where: { email },
    data: { totpEnabledAt: new Date() },
  });

  // La décision de redirection (guard du layout) lit la base : on rafraîchit.
  revalidatePath("/admin", "layout");
  redirect("/admin");
}
