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
  // Normalise : l'utilisateur peut coller un code avec un espace au milieu.
  const normalized = token.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(normalized)) return false;
  const result = await verify({
    secret,
    token: normalized,
    epochTolerance: EPOCH_TOLERANCE_SECONDS,
  });
  return result.valid;
}
