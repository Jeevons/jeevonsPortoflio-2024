import "server-only";

// Story 5.5 — Rate-limit anti-devinette sur le SECOND FACTEUR (AC5).
//
// 5 tentatives / 15 min / IP. Au-delà, les tentatives suivantes sont refusées et
// le compte est temporairement verrouillé ; le verrou se lève de lui-même à
// l'expiration de la fenêtre (AC5 : « temporairement »).
//
// ⚠️ CLÉ DISTINCTE de celle du mot de passe (src/lib/login-rate-limit.ts). Les
// deux étapes ont leur propre compteur : épuiser ses essais de code ne doit pas
// verrouiller la saisie du mot de passe, et inversement. Sans préfixe distinct,
// les 5 tentatives de mot de passe de 5.2 consommeraient d'avance le quota du
// code — l'utilisateur légitime se retrouverait verrouillé après un seul login.
//
// Même choix de stockage qu'en 5.2 : compteur EN MÉMOIRE process, sans Redis
// (mono-conteneur, coût VPS nul — AGENTS.md §1). Remise à zéro au redémarrage :
// au pire on repart d'un compteur vide, comme après expiration naturelle.
//
// ⚠️ Le verrou frappe la paire (compte, IP) via la clé, et reste TEMPORAIRE :
// le compte étant unique, un verrou définitif offrirait à un attaquant un déni
// de service permanent contre Jeevons. L'auto-levée est donc essentielle.

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type MfaRateLimitResult = {
  /** true si la tentative est autorisée, false si le verrou est actif. */
  allowed: boolean;
  /** Secondes restantes avant auto-levée du verrou (0 si autorisé). */
  retryAfterSeconds: number;
};

/**
 * Clé du compteur : préfixe dédié + IP + compte. Le préfixe garantit
 * l'indépendance vis-à-vis du rate-limit de mot de passe (5.2).
 */
function bucketKey(ip: string, email: string): string {
  return `mfa:${ip}:${email.toLowerCase()}`;
}

/**
 * Enregistre une tentative de second facteur et indique si elle est autorisée.
 * Appeler UNE FOIS par tentative, AVANT toute vérification cryptographique :
 * on ne paie pas le coût d'un argon2 (codes de récupération) pour une IP déjà
 * verrouillée, et on n'offre aucun canal de calcul à un attaquant.
 */
export function checkMfaRateLimit(
  ip: string,
  email: string,
  now: number = Date.now(),
): MfaRateLimitResult {
  const key = bucketKey(ip, email);
  const bucket = buckets.get(key);

  // Pas de fenêtre en cours, ou fenêtre expirée → fenêtre fraîche. C'est le
  // mécanisme d'AUTO-LEVÉE exigé par AC5.
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    pruneExpired(now);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  // Limite déjà atteinte → refus temporaire (compte verrouillé, AC5).
  if (bucket.count >= MAX_ATTEMPTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * Libère le compteur après un second facteur RÉUSSI : une connexion légitime ne
 * doit pas laisser derrière elle un quota entamé qui verrouillerait la
 * prochaine (le compte est unique, donc chaque essai compte).
 */
export function resetMfaRateLimit(ip: string, email: string): void {
  buckets.delete(bucketKey(ip, email));
}

function pruneExpired(now: number): void {
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}

// Exporté pour les vérifications locales (piège n°6) : forcer l'expiration sans
// attendre 15 min.
export function _resetMfaRateLimit(): void {
  buckets.clear();
}
