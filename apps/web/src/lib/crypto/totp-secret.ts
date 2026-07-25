import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";

// Story 5.3 — Chiffrement AU REPOS du secret TOTP (AC5).
//
// Le secret TOTP (base32) permet de générer les codes à 6 chiffres : le stocker
// EN CLAIR ferait d'un simple dump SQL un contournement complet de la 2FA. On le
// chiffre donc en AES-256-GCM avec une clé DÉRIVÉE d'`AUTH_SECRET` (jamais une
// clé stockée en base) : un extrait de base volé, sans le secret d'application,
// ne permet pas de déchiffrer ni de générer des codes valides (AC5).
//
// GCM (authenticated encryption) protège aussi l'intégrité : toute altération du
// ciphertext fait échouer le déchiffrement (authTag), plutôt que de produire un
// secret corrompu exploitable.
//
// Cet utilitaire est la SOURCE UNIQUE du (dé)chiffrement du secret : l'enrôlement
// (5.3) chiffre à la génération, la vérification du code (5.5) déchiffrera pour
// valider. Aucune nouvelle dépendance — `node:crypto` natif.
//
// ⚠️ Ne JAMAIS logguer le secret déchiffré ni l'inclure dans un AuditLog (5.19).

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32; // AES-256 → clé de 32 octets.
const IV_LENGTH = 12; // Taille de nonce recommandée pour GCM.
const AUTH_TAG_LENGTH = 16; // Tag d'authentification GCM (128 bits).

// Sépare cet usage de tout autre dérivé d'AUTH_SECRET (isolation de domaine
// HKDF) : deux usages distincts d'AUTH_SECRET ne partagent jamais la même clé.
const HKDF_INFO = "portfolio:totp-secret:v1";
// Sel fixe (non secret) : HKDF reste sûr avec un sel constant ; la robustesse
// vient d'AUTH_SECRET. Un sel figé garde la dérivation déterministe (on doit
// pouvoir redériver LA MÊME clé pour déchiffrer).
const HKDF_SALT = "portfolio:totp:salt:v1";

/**
 * Dérive la clé AES-256 (32 octets) à partir d'`AUTH_SECRET` via HKDF-SHA256.
 * Lève si `AUTH_SECRET` est absent : mieux vaut échouer bruyamment que chiffrer
 * avec une clé vide (le secret d'application est une exigence de déploiement).
 */
function deriveKey(): Buffer {
  const appSecret = process.env.AUTH_SECRET;
  if (!appSecret) {
    throw new Error(
      "AUTH_SECRET est absent : impossible de dériver la clé de chiffrement TOTP.",
    );
  }
  // hkdfSync renvoie un ArrayBuffer → on l'enveloppe dans un Buffer.
  const derived = hkdfSync(
    "sha256",
    Buffer.from(appSecret, "utf8"),
    Buffer.from(HKDF_SALT, "utf8"),
    Buffer.from(HKDF_INFO, "utf8"),
    KEY_LENGTH,
  );
  return Buffer.from(derived);
}

/**
 * Chiffre le secret TOTP en clair (base32) pour stockage.
 * Format de sortie (base64) : `iv(12) || authTag(16) || ciphertext`.
 * Un IV ALÉATOIRE par appel garantit que deux chiffrements du même secret
 * diffèrent (pas de fuite par comparaison d'égalité en base).
 */
export function encryptTotpSecret(plaintext: string): string {
  const key = deriveKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

/**
 * Déchiffre un secret TOTP produit par `encryptTotpSecret`.
 * Lève si le format est invalide ou si l'authentification GCM échoue (base
 * altérée, mauvaise clé) — jamais de secret corrompu renvoyé silencieusement.
 */
export function decryptTotpSecret(encoded: string): string {
  const key = deriveKey();
  const buffer = Buffer.from(encoded, "base64");
  if (buffer.length <= IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("Secret TOTP chiffré invalide : longueur insuffisante.");
  }
  const iv = buffer.subarray(0, IV_LENGTH);
  const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
