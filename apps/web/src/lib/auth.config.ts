import type { NextAuthConfig } from "next-auth";

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
    // une route /admin exige une session.
    authorized({ auth, request }) {
      const isAdminArea = request.nextUrl.pathname.startsWith("/admin");
      if (isAdminArea) return Boolean(auth?.user);
      return true;
    },
  },
  // Les providers dépendant de Node (Credentials + argon2 + Prisma) sont ajoutés
  // UNIQUEMENT dans src/lib/auth.ts, jamais ici : cette config doit rester
  // importable depuis l'edge.
  providers: [],
} satisfies NextAuthConfig;
