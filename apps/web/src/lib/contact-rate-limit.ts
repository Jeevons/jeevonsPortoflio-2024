import "server-only";

// Story 6.12 — Limitation de débit du formulaire de contact (AC4).
//
// 3 envois / heure / IP (seuil validé avec Jeevons). Au-delà, les soumissions
// suivantes sont refusées avec un message COMPRÉHENSIBLE — pas un échec muet :
// c'est AC3 (champ piège) qui est silencieux, AC4 ne l'est pas. Le verrou est
// TEMPORAIRE et se lève de lui-même à l'expiration de la fenêtre.
//
// 🛑 MODULE DÉDIÉ, calqué sur `login-rate-limit.ts` (5.2) mais avec son PROPRE
// compteur. Partager la Map du login serait un bug fonctionnel : un envoi de
// contact consommerait le quota de connexion de Jeevons, et réciproquement —
// leurs seuils n'ont rien à voir (5/15 min y sont calibrés anti-force-brute).
// ✅ En revanche `clientIpFromHeaders()` est RÉUTILISÉ tel quel : l'extraction
// d'IP derrière Traefik/Coolify n'a aucune raison d'exister en double.
//
// Stockage : compteur EN MÉMOIRE process, même raisonnement qu'en 5.2 — archi
// mono-conteneur, pas de Redis (coût VPS nul, AGENTS.md §1). Le compteur repart
// à zéro au redémarrage : au pire un spammeur regagne un quota, ce qui équivaut
// à l'expiration naturelle de sa fenêtre.

const MAX_SUBMISSIONS = 3;
const WINDOW_MS = 60 * 60 * 1000; // 1 heure

type Bucket = { count: number; resetAt: number };

// Map IP → fenêtre courante. ⚠️ Volontairement PROPRE à ce module.
const buckets = new Map<string, Bucket>();

export type ContactRateLimitResult = {
  /** true si la soumission est autorisée, false si l'IP est verrouillée. */
  allowed: boolean;
  /** Secondes restantes avant auto-levée du verrou (0 si autorisé). */
  retryAfterSeconds: number;
};

/**
 * Enregistre une soumission de contact pour `ip` et indique si elle est
 * autorisée. Fenêtre glissante par IP : la 4ᵉ soumission en moins d'une heure
 * est refusée ; la fenêtre expire seule (auto-levée).
 *
 * ⚠️ Appeler UNE FOIS par soumission, et APRÈS le test du champ piège : une
 * soumission de robot ne doit pas consommer le quota d'une IP potentiellement
 * partagée (réseau d'entreprise), sinon un recruteur légitime derrière la même
 * sortie NAT paierait pour le robot.
 */
export function checkContactRateLimit(
  ip: string,
  now: number = Date.now(),
): ContactRateLimitResult {
  const bucket = buckets.get(ip);

  // Pas de fenêtre en cours, ou fenêtre expirée → on (ré)ouvre une fenêtre
  // fraîche. C'est le mécanisme d'auto-levée.
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    // Nettoyage opportuniste des fenêtres expirées pour borner la taille de la
    // Map (pas de tâche de fond dans un mono-conteneur). Coût négligeable.
    pruneExpired(now);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  // Fenêtre en cours : la limite est déjà atteinte → refus temporaire.
  if (bucket.count >= MAX_SUBMISSIONS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

function pruneExpired(now: number): void {
  for (const [ip, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(ip);
  }
}

/**
 * Message d'AC4, en français et ACTIONNABLE : il nomme la cause et le délai.
 * Arrondi à la minute supérieure — annoncer « 3 542 secondes » serait exact et
 * illisible.
 */
export function rateLimitMessage(retryAfterSeconds: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `Vous avez déjà envoyé plusieurs messages. Merci de réessayer dans ${minutes} minute${minutes > 1 ? "s" : ""}.`;
}

// Exporté pour les vérifications locales : forcer l'expiration d'une IP sans
// attendre une heure (même intention que `_resetRateLimit` en 5.2).
export function _resetContactRateLimit(ip?: string): void {
  if (ip) buckets.delete(ip);
  else buckets.clear();
}
