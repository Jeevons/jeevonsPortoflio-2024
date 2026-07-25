import "server-only";

// Story 5.2 — Rate-limit anti-force-brute sur le login (AC4).
//
// 5 tentatives / 15 min / IP. Au-delà, les tentatives suivantes sont refusées ;
// le verrou est TEMPORAIRE et se lève de lui-même à l'expiration de la fenêtre.
//
// Choix de stockage : compteur EN MÉMOIRE process (validé avec Jeevons).
// L'archi est mono-conteneur, sans Redis (coût VPS nul, AGENTS.md §1) — cohérent
// avec le raisonnement « pas de verrou distribué » de la story 4.6. Le compteur
// est remis à zéro à chaque redémarrage du conteneur : acceptable pour un unique
// utilisateur légitime, et sans impact sur la sécurité (au pire, on repart d'un
// compteur vide, comme après l'expiration naturelle de la fenêtre).
//
// ⚠️ Ce module NE DOIT PAS remplacer l'anti-énumération de 5.1 : le rate-limit
// s'applique AVANT la vérification du mot de passe (pour ne pas offrir de canal
// de calcul), mais le message d'échec reste générique. Voir la server action.

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

type Bucket = { count: number; resetAt: number };

// Map IP → fenêtre courante. En mémoire process (mono-conteneur).
const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  /** true si la tentative est autorisée, false si l'IP est verrouillée. */
  allowed: boolean;
  /** Secondes restantes avant auto-levée du verrou (0 si autorisé). */
  retryAfterSeconds: number;
};

/**
 * Enregistre une tentative de login pour `ip` et indique si elle est autorisée.
 * Fenêtre glissante par IP : la 6ᵉ tentative en moins de 15 min est refusée ;
 * la fenêtre expire seule (auto-levée). Appeler UNE FOIS par tentative, avant
 * la vérification du mot de passe.
 */
export function checkLoginRateLimit(
  ip: string,
  now: number = Date.now(),
): RateLimitResult {
  const bucket = buckets.get(ip);

  // Pas de fenêtre en cours, ou fenêtre expirée → on (ré)ouvre une fenêtre
  // fraîche. C'est le mécanisme d'auto-levée : une IP verrouillée redevient
  // autorisée dès que sa fenêtre a expiré.
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    // Nettoyage opportuniste des fenêtres expirées pour borner la taille de la
    // Map (pas de tâche de fond dans un mono-conteneur). Coût négligeable.
    pruneExpired(now);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  // Fenêtre en cours : la limite est déjà atteinte → refus temporaire.
  if (bucket.count >= MAX_ATTEMPTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  // Sinon on incrémente et on autorise.
  bucket.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * Consulte l'état du rate-limit pour `ip` SANS incrémenter le compteur. Sert à
 * la server action de login pour afficher un message dédié (« trop de
 * tentatives ») sans fausser le comptage : le SEUL incrément a lieu dans
 * `authorize` (source unique, story 5.2). Renvoie true si l'IP est verrouillée.
 */
export function isLoginRateLimited(
  ip: string,
  now: number = Date.now(),
): boolean {
  const bucket = buckets.get(ip);
  if (!bucket || now >= bucket.resetAt) return false;
  return bucket.count >= MAX_ATTEMPTS;
}

function pruneExpired(now: number): void {
  for (const [ip, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(ip);
  }
}

/**
 * Extrait l'IP cliente RÉELLE. En production le conteneur est derrière le
 * reverse-proxy (Traefik/Coolify, story 2.6) : l'IP de socket serait celle du
 * proxy, donc TOUTES les requêtes partageraient une IP et un seul attaquant
 * verrouillerait tout le monde. On lit donc `X-Forwarded-For` et on prend la
 * PREMIÈRE entrée (le client d'origine ; les proxies ajoutent à droite).
 *
 * ⚠️ En dev local (pas de proxy) l'en-tête est absent : on retombe sur une clé
 * fixe, ce qui suffit pour éprouver le verrou localement.
 */
export function clientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  // `x-real-ip` est un fallback fréquent posé par certains proxies.
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

// Exporté pour les vérifications locales (piège n°6) : forcer l'expiration
// d'une IP sans attendre 15 min.
export function _resetRateLimit(ip?: string): void {
  if (ip) buckets.delete(ip);
  else buckets.clear();
}
