import "server-only";

import { generateSecret, generateURI, verify } from "otplib";

// Story 5.3 — Cœur TOTP (RFC 6238) centralisé sur `otplib` (PLAN §9.1).
//
// SOURCE UNIQUE des opérations TOTP :
//  - génération du secret base32 (enrôlement, 5.3) ;
//  - URI otpauth:// pour le QR code (5.3) ;
//  - vérification d'un code à 6 chiffres (confirmation d'enrôlement en 5.3,
//    connexion en deux temps en 5.5).
//
// Choix figés ici pour que TOUTES les vérifications partagent les mêmes règles :
//  - fenêtre de tolérance ±1 pas de 30 s (PLAN §9 : « ±1 pas, pas plus »), pour
//    absorber la dérive d'horloge sans élargir la surface d'attaque ;
//  - comparaison en temps constant (assurée par `otplib`).
//
// L'émetteur affiché dans l'app d'authentification. Le libellé complet devient
// « Portfolio (email) » côté app.
const ISSUER = "Portfolio";

// ±1 pas de 30 s. `epochTolerance` est en SECONDES chez otplib v13.
const EPOCH_TOLERANCE_SECONDS = 30;

/**
 * Génère un nouveau secret TOTP en base32 (compatible Google Authenticator,
 * Authy, 1Password, Bitwarden). À chiffrer AVANT stockage (voir
 * `encryptTotpSecret`) — ne jamais persister ni logguer en clair.
 */
export function generateTotpSecret(): string {
  return generateSecret();
}

/**
 * Construit l'URI `otpauth://totp/Portfolio:<email>?secret=…&issuer=Portfolio`
 * (PLAN §9.2), encodée dans le QR code de l'écran d'enrôlement. Le secret y
 * figure : cette URI ne doit JAMAIS quitter le serveur autrement que rendue en
 * image QR / affichée à l'utilisateur légitime sur sa propre page d'enrôlement.
 */
export function buildTotpUri(secret: string, accountLabel: string): string {
  return generateURI({
    issuer: ISSUER,
    label: accountLabel,
    secret,
  });
}

/**
 * Vérifie un code TOTP à 6 chiffres contre le secret (en clair). Renvoie `true`
 * si le code est valide dans la fenêtre ±1 pas. Utilisé pour confirmer
 * l'enrôlement (5.3) et, plus tard, la connexion en deux temps (5.5).
 *
 * ⚠️ L'appelant fournit le secret DÉCHIFFRÉ (voir `decryptTotpSecret`) ; ce
 * secret ne doit jamais être loggué.
 */
export async function verifyTotpCode(
  secret: string,
  token: string,
): Promise<boolean> {
  return (await verifyTotpCodeWithStep(secret, token)).valid;
}

/**
 * Forme d'un code TOTP acceptable AVANT toute vérification cryptographique.
 * Sert au login en deux temps (5.5) à distinguer « l'utilisateur a saisi un
 * code TOTP » de « l'utilisateur a saisi un code de récupération » (5.4), afin
 * d'aiguiller vers la bonne vérification sans tenter les deux à l'aveugle.
 */
export function looksLikeTotpCode(token: string): boolean {
  return /^\d{6}$/.test(token.replace(/\s+/g, ""));
}

export type TotpVerification =
  { valid: true; timeStep: number } | { valid: false };

/**
 * Story 5.5 — Vérification TOTP avec ANTI-REJEU (AC4) et tolérance ±1 pas (AC3).
 *
 * Renvoie, en cas de succès, le `timeStep` (pas RFC 6238) auquel le code a
 * été validé. L'appelant DOIT le persister (`User.totpLastCounter`) et le
 * repasser en `lastTimeStep` à la vérification suivante : otplib refuse alors
 * tout code dont le pas est ≤ au dernier consommé. Un code déjà utilisé est
 * donc refusé même s'il est encore dans sa fenêtre de validité (AC4).
 *
 * ⚠️ L'anti-rejeu repose sur la PERSISTANCE du pas par l'appelant : sans
 * `lastTimeStep`, la fonction valide normalement (cas de l'enrôlement 5.3, où
 * aucun code n'a encore été consommé).
 */
export async function verifyTotpCodeWithStep(
  secret: string,
  token: string,
  lastTimeStep?: number | null,
): Promise<TotpVerification> {
  // Normalise : l'utilisateur peut coller un code avec un espace au milieu.
  const normalized = token.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(normalized)) return { valid: false };
  const result = await verify({
    secret,
    token: normalized,
    epochTolerance: EPOCH_TOLERANCE_SECONDS,
    // Anti-rejeu natif d'otplib : refuse tout pas ≤ `afterTimeStep` (AC4).
    // `undefined` quand aucun code n'a encore été consommé.
    afterTimeStep: lastTimeStep ?? undefined,
  });
  if (!result.valid) return { valid: false };

  // ⚠️ La façade `otplib` type `verify` comme l'union TOTP | HOTP, et la
  // variante HOTP ne porte pas `timeStep` — le champ disparaît donc du type
  // narrowé, alors qu'il est bien présent à l'exécution en stratégie TOTP (la
  // stratégie par défaut, celle qu'on utilise). On ne peut pas importer
  // `@otplib/totp` directement : c'est une dépendance TRANSITIVE non déclarée
  // (AGENTS.md §9 : zéro dépendance ajoutée sans validation). On relit donc le
  // champ de façon défensive.
  //
  // FAIL-SAFE : sans `timeStep` exploitable, on REFUSE le code plutôt que
  // d'ouvrir une session sans pouvoir armer l'anti-rejeu — un code qu'on ne
  // peut pas marquer comme consommé serait rejouable (AC4).
  const timeStep = (result as { timeStep?: unknown }).timeStep;
  if (typeof timeStep !== "number") return { valid: false };
  return { valid: true, timeStep };
}
