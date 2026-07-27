import type { NextAuthConfig } from "next-auth";

// Story 5.5 — Durée de vie de la session PARTIELLE (AC1) : cinq minutes pour
// aller au bout du second facteur. Passé ce délai, la session partielle est
// traitée comme INEXISTANTE partout (proxy edge, layout admin, requireAdmin) et
// l'utilisateur repart du mot de passe.
export const MFA_PENDING_TTL_MS = 5 * 60 * 1000;

/** Route de saisie du second facteur. Hors du groupe /admin (voir proxy). */
export const MFA_CHALLENGE_PATH = "/login/2fa";

/**
 * Story 5.5 — Les trois états d'une session, dérivés du token.
 *
 * Le login en deux temps introduit un état INTERMÉDIAIRE : mot de passe validé,
 * second facteur pas encore franchi. Cette fonction est la SOURCE UNIQUE qui le
 * qualifie, pour que l'edge (proxy) et le Node (layout, requireAdmin) prennent
 * exactement la même décision.
 *
 *  - `none`    : pas de session, ou session partielle EXPIRÉE (AC1) ;
 *  - `pending` : mot de passe OK, code attendu → aucun accès /admin (AC1) ;
 *  - `full`    : second facteur franchi → administration ouverte (AC2).
 */
export type MfaState = "none" | "pending" | "full";

export function mfaStateFromToken(
  token: { mfaPending?: unknown; mfaDeadline?: unknown } | null | undefined,
  now: number = Date.now(),
): MfaState {
  if (!token) return "none";
  if (token.mfaPending !== true) return "full";
  // Session partielle : elle n'a de valeur que dans sa fenêtre de 5 min (AC1).
  // Deadline absente ou dépassée → on ne la traite PAS comme une session
  // partielle utilisable, mais comme une absence de session (fail-safe : jamais
  // d'accès accordé sur un token partiel douteux).
  const deadline =
    typeof token.mfaDeadline === "number" ? token.mfaDeadline : 0;
  if (now >= deadline) return "none";
  return "pending";
}

// Story 5.2 — Config Auth.js EDGE-SAFE (base partagée).
//
// Le middleware (src/middleware.ts) tourne sur le runtime EDGE : il ne peut pas
// embarquer Prisma (`node:` schemes) ni argon2 (module natif). On isole donc ici
// la partie de la config qui NE dépend PAS de la base ni de Node — cookies,
// stratégie de session, pages, callbacks — pour la partager entre :
//  - le middleware (edge) : vérifie seulement la PRÉSENCE d'une session JWT ;
//  - la config complète (src/lib/auth.ts, Node) : ajoute le Credentials provider
//    avec le `authorize` qui lit la base et vérifie argon2.
//
// C'est le pattern « split config » recommandé par Auth.js v5 pour cohabiter
// avec un provider dépendant de Node derrière un middleware edge.

export const authConfig = {
  // Voir src/lib/auth.ts pour le détail : conteneur derrière Traefik → trustHost.
  trustHost: true,
  session: { strategy: "jwt" },
  secret: process.env.AUTH_SECRET,
  cookies: {
    sessionToken: {
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      },
    },
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    // `authorized` est consulté par le wrapper de middleware d'Auth.js v5. On
    // ne l'utilise pas pour la logique de redirection (gérée explicitement dans
    // middleware.ts pour porter le callbackUrl), mais on le garde cohérent :
    // une route /admin exige une session COMPLÈTE (5.5 : une session partielle
    // ne vaut pas accès, AC1).
    authorized({ auth, request }) {
      const isAdminArea = request.nextUrl.pathname.startsWith("/admin");
      if (isAdminArea) return auth?.user ? auth.mfaPending !== true : false;
      return true;
    },

    // Story 5.5 — Cycle de vie du flag `mfaPending` dans le JWT.
    //
    // Trois moments :
    //  1. Connexion (`user` présent) : `authorize` (src/lib/auth.ts) a posé
    //     `mfaPending` selon que le compte a une 2FA active. Si oui, on ouvre
    //     une session PARTIELLE horodatée (deadline à +5 min, AC1).
    //  2. Promotion (`trigger === "update"` avec `mfaSatisfied`) : le second
    //     facteur vient d'être validé côté serveur → la session devient
    //     COMPLÈTE (AC2) et la deadline partielle disparaît.
    //  3. Lectures suivantes : le token est relu tel quel ; c'est
    //     `mfaStateFromToken` qui juge de l'expiration à chaque décision.
    jwt({ token, user, trigger, session }) {
      if (user) {
        const pending = (user as { mfaPending?: boolean }).mfaPending === true;
        if (pending) {
          token.mfaPending = true;
          token.mfaDeadline = Date.now() + MFA_PENDING_TTL_MS;
        } else {
          delete token.mfaPending;
          delete token.mfaDeadline;
        }
        return token;
      }

      // Promotion en session complète. ⚠️ Le drapeau vient d'un appel serveur
      // (`unstable_update` depuis la server action qui a VALIDÉ le code) : le
      // client ne peut pas déclencher cette branche seul, `unstable_update`
      // n'étant appelable que côté serveur ici.
      if (
        trigger === "update" &&
        (session as { mfaSatisfied?: boolean } | undefined)?.mfaSatisfied ===
          true
      ) {
        delete token.mfaPending;
        delete token.mfaDeadline;
      }

      return token;
    },

    // Expose l'état partiel à la couche serveur (layout admin, requireAdmin) et
    // au proxy. `mfaPending` n'est vrai que tant que la session est partielle.
    session({ session, token }) {
      session.mfaPending = token.mfaPending === true;
      session.mfaDeadline =
        typeof token.mfaDeadline === "number" ? token.mfaDeadline : undefined;
      return session;
    },
  },
  // Les providers dépendant de Node (Credentials + argon2 + Prisma) sont ajoutés
  // UNIQUEMENT dans src/lib/auth.ts, jamais ici : cette config doit rester
  // importable depuis l'edge.
  providers: [],
} satisfies NextAuthConfig;
