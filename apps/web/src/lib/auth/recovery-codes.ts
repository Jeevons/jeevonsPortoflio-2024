import "server-only";

import { randomInt } from "node:crypto";

import * as argon2 from "argon2";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

// Story 5.4 — Codes de récupération 2FA (PLAN §9.3).
//
// SOURCE UNIQUE de tout ce qui touche aux codes de secours :
//  - génération des 8 codes à l'activation du TOTP (5.3) ;
//  - vérification + consommation à usage unique (appelée par le login 5.5) ;
//  - régénération quand le jeu est épuisé.
//
// Deux invariants NON NÉGOCIABLES :
//  1. Les codes en clair n'existent QU'AU MOMENT de la génération. Ils sont
//     renvoyés une seule fois à l'appelant (pour affichage immédiat) puis
//     n'existent plus nulle part : seuls les hash argon2id sont persistés (AC2).
//     ❌ Jamais dans un log, un AuditLog (5.19), un e-mail, une URL, une réponse
//     ultérieure. Une seule sortie : l'écran de génération.
//  2. Un code consommé ne resservira JAMAIS (AC3), y compris en cas de double
//     soumission simultanée — voir le compare-and-swap dans
//     `verifyAndConsumeRecoveryCode`.
//
// Aucune dépendance nouvelle : `argon2` vient de la story 5.1 (mots de passe),
// l'aléa vient de `node:crypto`.

/** Nombre de codes générés par jeu (PLAN §9.3 : « 8 codes »). AC1. */
export const RECOVERY_CODE_COUNT = 8;

// Alphabet volontairement SANS caractères ambigus (pas de 0/O, 1/I/L, U/V) :
// ces codes sont recopiés à la main depuis une feuille de papier, souvent sous
// stress (téléphone perdu). Chaque erreur de lecture évitée est un lock-out
// évité. 28 symboles → 8 caractères ≈ 38 bits d'entropie par code, largement
// suffisant pour un secret à usage unique protégé par ailleurs (rate-limit 5.5).
const ALPHABET = "ABCDEFGHJKMNPQRSTWXYZ23456789";
const GROUP_LENGTH = 4;
const GROUP_COUNT = 2; // → format XXXX-XXXX

/**
 * Forme persistée dans `User.recoveryCodes` (colonne `Json?`).
 * `usedAt` : `null` tant que le code est disponible, horodatage ISO une fois
 * consommé. On CONSERVE les codes utilisés (plutôt que de les retirer) pour que
 * le décompte « restants » et l'historique restent lisibles.
 */
export type StoredRecoveryCode = {
  hash: string;
  usedAt: string | null;
};

/**
 * Tire un code au format `XXXX-XXXX` avec un aléa cryptographique.
 * `randomInt` (node:crypto) est non biaisé — contrairement à `Math.random()`,
 * inutilisable ici.
 */
function generatePlainCode(): string {
  const groups: string[] = [];
  for (let g = 0; g < GROUP_COUNT; g += 1) {
    let group = "";
    for (let i = 0; i < GROUP_LENGTH; i += 1) {
      group += ALPHABET[randomInt(ALPHABET.length)];
    }
    groups.push(group);
  }
  return groups.join("-");
}

/**
 * Normalise une saisie utilisateur avant comparaison : le code est recopié à la
 * main, donc on tolère la casse, les espaces et l'oubli (ou l'ajout) du tiret.
 * `ABCD efgh` et `abcd-efgh` doivent valider le même code.
 */
export function normalizeRecoveryCode(input: string): string {
  const compact = input.replace(/[\s-]/g, "").toUpperCase();
  if (compact.length !== GROUP_LENGTH * GROUP_COUNT) return "";
  // Re-pose le tiret pour retrouver EXACTEMENT la forme qui a été hashée.
  return `${compact.slice(0, GROUP_LENGTH)}-${compact.slice(GROUP_LENGTH)}`;
}

/**
 * Génère un jeu de 8 codes : renvoie les codes EN CLAIR (à afficher une seule
 * fois, AC1) et leur forme persistable hashée argon2id (AC2).
 *
 * ⚠️ L'appelant est responsable de n'afficher `plain` qu'une fois et de ne
 * jamais le persister ni le logguer.
 */
export async function generateRecoveryCodes(): Promise<{
  plain: string[];
  stored: StoredRecoveryCode[];
}> {
  const plain = Array.from({ length: RECOVERY_CODE_COUNT }, generatePlainCode);
  // argon2id EXPLICITE (AC2), même réglage que le mot de passe admin (5.1,
  // prisma/seed.ts). Sel aléatoire par code, intégré au hash produit.
  const stored = await Promise.all(
    plain.map(async (code) => ({
      hash: await argon2.hash(code, { type: argon2.argon2id }),
      usedAt: null,
    })),
  );
  return { plain, stored };
}

/**
 * Relit la colonne `Json?` de façon DÉFENSIVE : Prisma type le JSON en
 * `unknown`, et le champ peut être `null` (compte seedé avant 5.4) ou contenir
 * une forme héritée. Tout ce qui n'est pas exploitable est ignoré plutôt que de
 * faire planter l'authentification.
 */
export function parseStoredRecoveryCodes(value: unknown): StoredRecoveryCode[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): StoredRecoveryCode[] => {
    if (typeof entry !== "object" || entry === null) return [];
    const { hash, usedAt } = entry as Record<string, unknown>;
    if (typeof hash !== "string" || hash.length === 0) return [];
    return [{ hash, usedAt: typeof usedAt === "string" ? usedAt : null }];
  });
}

/** Nombre de codes encore utilisables dans un jeu. AC3 / AC4. */
export function countRemainingRecoveryCodes(
  codes: StoredRecoveryCode[],
): number {
  return codes.filter((code) => code.usedAt === null).length;
}

/**
 * Lit l'état des codes d'un compte : combien restent, et si le jeu est épuisé.
 * Utilisé par l'écran de sécurité et le bandeau d'avertissement (AC4).
 */
export async function getRecoveryCodesStatus(email: string): Promise<{
  total: number;
  remaining: number;
  exhausted: boolean;
}> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { recoveryCodes: true },
  });
  const codes = parseStoredRecoveryCodes(user?.recoveryCodes);
  const remaining = countRemainingRecoveryCodes(codes);
  return {
    total: codes.length,
    remaining,
    // Un compte SANS jeu du tout (total 0) est aussi « épuisé » du point de vue
    // de l'utilisateur : il n'a aucun moyen de secours et doit en générer un.
    exhausted: remaining === 0,
  };
}

export type RecoveryCodeVerification =
  { ok: true; remaining: number } | { ok: false };

/**
 * Vérifie un code de récupération et le CONSOMME s'il est valide (AC3).
 *
 * 🔌 POINT D'INTÉGRATION 5.5 (connexion en deux temps) : à l'étape du second
 * facteur, si l'entrée saisie n'est pas un code TOTP à 6 chiffres valide
 * (`verifyTotpCode`), appeler cette fonction avec la même saisie. Un `ok: true`
 * autorise l'ouverture de session ; `remaining` est le nombre de codes encore
 * disponibles, à afficher à l'utilisateur (AC3). La story 5.5 porte l'écran, le
 * rate-limit et la session partielle — pas cette fonction.
 *
 * Anti-course (piège n°3) : la consommation est écrite par un COMPARE-AND-SWAP.
 * On relit l'état exact qu'on a validé et on n'écrit QUE s'il n'a pas changé
 * entre-temps (`updateMany ... where recoveryCodes = <valeur lue>`). Postgres
 * évalue ce prédicat au moment de l'écriture : si deux soumissions simultanées
 * tentent de consommer le même code, la seconde touche 0 ligne et est refusée.
 * Le code est donc marqué utilisé AVANT que le succès ne soit renvoyé — jamais
 * deux sessions pour un seul code.
 */
export async function verifyAndConsumeRecoveryCode(
  email: string,
  input: string,
): Promise<RecoveryCodeVerification> {
  const normalized = normalizeRecoveryCode(input);
  if (!normalized) return { ok: false };

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, recoveryCodes: true },
  });
  if (!user) return { ok: false };

  const codes = parseStoredRecoveryCodes(user.recoveryCodes);
  if (codes.length === 0) return { ok: false };

  // On ne compare QUE contre les codes non encore utilisés : un code consommé
  // est définitivement mort, même si l'utilisateur le ressaisit (AC3).
  let matchedIndex = -1;
  for (let i = 0; i < codes.length; i += 1) {
    if (codes[i].usedAt !== null) continue;
    // argon2.verify est en temps constant et lève sur un hash malformé — on
    // traite l'échec comme une non-correspondance plutôt que d'interrompre
    // l'authentification à cause d'une entrée corrompue en base.
    let matches = false;
    try {
      matches = await argon2.verify(codes[i].hash, normalized);
    } catch {
      matches = false;
    }
    if (matches) {
      matchedIndex = i;
      break;
    }
  }
  if (matchedIndex === -1) return { ok: false };

  const updated = codes.map((code, i) =>
    i === matchedIndex ? { ...code, usedAt: new Date().toISOString() } : code,
  );

  // COMPARE-AND-SWAP : le filtre `equals` compare la colonne à la valeur EXACTE
  // relue plus haut. Postgres évalue ce prédicat au moment de l'écriture → si
  // une soumission concurrente a déjà modifié le jeu, 0 ligne est touchée.
  const result = await prisma.user.updateMany({
    where: {
      id: user.id,
      recoveryCodes: {
        equals: user.recoveryCodes as Prisma.InputJsonValue,
      },
    },
    data: { recoveryCodes: updated },
  });
  if (result.count === 0) {
    // Le jeu a changé entre la lecture et l'écriture (double soumission, ou
    // régénération concurrente) : on REFUSE plutôt que de risquer un double
    // usage. L'utilisateur réessaie avec un autre code.
    return { ok: false };
  }

  return { ok: true, remaining: countRemainingRecoveryCodes(updated) };
}

/**
 * Remplace INTÉGRALEMENT le jeu de codes d'un compte et renvoie les nouveaux
 * codes en clair (à afficher une seule fois, AC1/AC4).
 *
 * Les anciens hash sont écrasés : tous les codes précédents — utilisés ou non —
 * deviennent invalides. Utilisé à l'activation du TOTP (5.3) et à la
 * régénération manuelle (AC4).
 *
 * ⚠️ L'appelant DOIT avoir vérifié l'autorisation (`requireAdmin`) avant.
 */
export async function replaceRecoveryCodes(email: string): Promise<string[]> {
  const { plain, stored } = await generateRecoveryCodes();
  await prisma.user.update({
    where: { email },
    data: { recoveryCodes: stored },
  });
  return plain;
}
