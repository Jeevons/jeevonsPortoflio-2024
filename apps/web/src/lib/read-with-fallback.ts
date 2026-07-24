import "server-only";

// Story 4.5 — Lecture résiliente (AC2). Enveloppe une lecture (déjà cachée en
// 4.4) : si elle échoue — typiquement DB injoignable — on trace l'incident côté
// serveur et on renvoie le contenu de repli statique. La page se rend donc
// NORMALEMENT avec le repli, sans page d'erreur (piège n°1).
//
// Interaction cache 4.4 (piège n°4, décision Jeevons) : le try/catch entoure
// l'appel caché. On ne met JAMAIS le repli en cache sous le tag normal → dès que
// la DB revient, la lecture cachée suivante réussit et repeuple le cache avec le
// vrai contenu (AC3, retour automatique).
//
// Sécurité (piège n°5) : on logue le domaine + le message d'erreur, JAMAIS la
// DATABASE_URL ni un secret, et rien n'est exposé au visiteur (log serveur seul).

type CacheDomain = "projects" | "timeline" | "settings";

export async function readWithFallback<T>(
  domain: CacheDomain,
  read: () => Promise<T>,
  fallback: () => T,
): Promise<T> {
  try {
    return await read();
  } catch (error) {
    // Les erreurs Prisma commencent par des sauts de ligne et sont multi-lignes
    // (« Invalid prisma.x.findMany()… \n\n Can't reach database server at host:port »).
    // On aplatit les blancs pour garder toute la cause SUR LA MÊME LIGNE que le
    // préfixe [fallback] → un seul log grep-able, diagnostic complet.
    const raw = error instanceof Error ? error.message : String(error);
    const message = raw.replace(/\s+/g, " ").trim();
    // Log structuré niveau erreur : suffisant pour diagnostiquer, sans secret
    // (le message Prisma expose l'hôte:port de la DB, jamais les identifiants).
    console.error(
      `[fallback] Lecture "${domain}" échouée — repli statique servi. Cause : ${message}`,
    );
    return fallback();
  }
}
