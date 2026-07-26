"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/require-admin";
import { resolveAuditUserId, writeAudit } from "@/lib/admin/audit";
import { prisma } from "@/lib/db";
import { encryptTotpSecret, decryptTotpSecret } from "@/lib/crypto/totp-secret";
import {
  generateTotpSecret,
  buildTotpUri,
  verifyTotpCode,
} from "@/lib/auth/totp";
import {
  generateRecoveryCodes,
  replaceRecoveryCodes,
} from "@/lib/auth/recovery-codes";

// Story 5.3 — Server actions de l'écran d'enrôlement 2FA (AGENTS.md §6 : toute
// la logique côté serveur, la page reste une vue « bête »).
//
// Story 5.4 — Ces actions portent aussi les CODES DE RÉCUPÉRATION : génération à
// l'activation (AC1) et régénération manuelle (AC4). Les codes en clair ne
// sortent QUE par la valeur de retour de l'action, consommée immédiatement par
// l'écran d'affichage. ❌ Jamais dans une URL, un log ou une réponse ultérieure.

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

/**
 * État du formulaire d'enrôlement.
 *
 * Story 5.4 : sur succès, `recoveryCodes` porte les 8 codes EN CLAIR — c'est
 * leur UNIQUE sortie (AC1). Le formulaire bascule alors sur l'écran
 * d'affichage. Aucun rechargement ne peut les récupérer : ils n'existent que
 * dans cette réponse-là.
 */
export type EnrollState = {
  error: string | null;
  recoveryCodes?: string[];
};

const GENERIC_ERROR =
  "Ce code n'est pas valide. Vérifiez l'heure de votre téléphone et réessayez.";

/**
 * Confirme l'enrôlement par un PREMIER code valide (5.3 AC4).
 *
 * Tant que ce code n'est pas fourni et validé contre le secret, `totpEnabledAt`
 * reste `null` : la 2FA n'est pas active et l'utilisateur ne peut pas se
 * verrouiller dehors.
 *
 * Story 5.4 (AC1) — Sur succès, l'activation et la génération des 8 codes de
 * récupération se font dans la MÊME écriture : « je viens d'activer mon second
 * facteur » et « huit codes me sont présentés » sont un seul et même instant.
 * Une écriture unique interdit l'état bâtard « 2FA active sans aucun code de
 * secours », qui est exactement le lock-out que cette story doit empêcher.
 *
 * ⚠️ Plus de `redirect()` vers /admin ici : les codes en clair doivent être
 * affichés AVANT de quitter l'écran (AC1, une seule fois). C'est l'écran de
 * codes qui renvoie vers /admin une fois l'utilisateur prêt.
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
  // Déjà activée : ne rien re-poser (idempotent). ⚠️ Surtout ne PAS régénérer de
  // codes ici — ce serait invalider silencieusement le jeu de l'utilisateur sur
  // une double soumission. La régénération est une action explicite et séparée
  // (`regenerateRecoveryCodesAction`, AC4).
  if (user.totpEnabledAt) {
    return { error: null };
  }

  const rawCode = formData.get("code");
  const code = typeof rawCode === "string" ? rawCode : "";

  const secret = decryptTotpSecret(user.totpSecret);
  const valid = await verifyTotpCode(secret, code);
  if (!valid) {
    // Échec : la 2FA reste INACTIVE (totpEnabledAt inchangé, null). AC4.
    return { error: GENERIC_ERROR };
  }

  // Succès : activation confirmée (5.3 AC4) + jeu de 8 codes de récupération
  // (5.4 AC1/AC2). Les hash sont écrits dans la MÊME requête que
  // `totpEnabledAt` : jamais de 2FA active sans moyen de secours.
  const { plain, stored } = await generateRecoveryCodes();
  await prisma.user.update({
    where: { email },
    data: { totpEnabledAt: new Date(), recoveryCodes: stored },
  });

  // Story 5.19 (piège n°2) — diff FIXE, sans valeur : `User` n'a délibérément
  // aucune entrée dans `ENTITY_FIELDS`, donc `buildDiff` ne peut pas y être
  // appelé. Ce marqueur ne révèle ni secret ni code.
  const auditUserId = await resolveAuditUserId(email);
  if (auditUserId) {
    await writeAudit({
      userId: auditUserId,
      action: "UPDATE",
      entity: "User",
      diff: { totpEnabled: true },
    });
  }

  // La décision de redirection (guard du layout) lit la base : on rafraîchit.
  revalidatePath("/admin", "layout");

  // Les codes remontent au formulaire, qui bascule sur l'écran d'affichage.
  // Unique sortie du clair (AC1) — rien n'est loggué ni persisté en clair.
  return { error: null, recoveryCodes: plain };
}

export type RegenerateState = {
  error: string | null;
  recoveryCodes?: string[];
};

/**
 * Story 5.4 (AC4) — Régénère un jeu complet de 8 codes de récupération.
 *
 * Action SENSIBLE : elle invalide d'un coup tous les codes existants. Trois
 * protections :
 *  - `requireAdmin` (5.2) : aucune exécution sans session admin valide ;
 *  - 2FA active exigée : régénérer avant l'enrôlement n'a aucun sens (les codes
 *    sont générés par l'activation elle-même) ;
 *  - confirmation explicite côté écran (l'utilisateur sait qu'il écrase).
 *
 * ⚠️ Traçable (5.19) SANS jamais enregistrer les codes : le jour où l'AuditLog
 * existera, on y consignera « jeu de codes régénéré » et l'horodatage — rien
 * d'autre. Les codes en clair ne sortent que par la valeur de retour.
 */
export async function regenerateRecoveryCodesAction(
  _prevState: RegenerateState,
  _formData: FormData,
): Promise<RegenerateState> {
  const session = await requireAdmin();
  const email = session.user?.email;
  if (!email) {
    return { error: "Session invalide : régénération impossible." };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { totpEnabledAt: true },
  });
  if (!user?.totpEnabledAt) {
    // Pas de 2FA active → pas de jeu à régénérer (l'activation s'en charge).
    return {
      error:
        "Activez d'abord la double authentification : les codes de récupération sont générés avec elle.",
    };
  }

  const plain = await replaceRecoveryCodes(email);

  // Story 5.19 — traçable SANS jamais enregistrer les codes (voir la note de
  // tête de fonction) : marqueur fixe, comme pour l'activation 2FA.
  const auditUserId = await resolveAuditUserId(email);
  if (auditUserId) {
    await writeAudit({
      userId: auditUserId,
      action: "UPDATE",
      entity: "User",
      diff: { recoveryCodesRegenerated: true },
    });
  }

  // L'écran de sécurité affiche le décompte restant : il doit refléter le
  // nouveau jeu au prochain rendu.
  revalidatePath("/admin", "layout");

  return { error: null, recoveryCodes: plain };
}
