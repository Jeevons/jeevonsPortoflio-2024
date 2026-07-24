import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/lib/auth.config";

// Story 5.2 — Garde de bord (edge) sur /admin/*.
//
// ⚠️ Next 16 a renommé la convention `middleware` en `proxy` (même mécanisme,
// même runtime edge). On utilise donc `proxy.ts` (le fichier `middleware.ts`
// étant déprécié). L'intention du PLAN §3.1 (« Middleware protégeant /admin/* »)
// est inchangée : c'est le même garde de bord.
//
// PREMIÈRE ligne de défense : aucune requête vers /admin ne parvient à un
// composant serveur sans session valide. On réutilise la config Auth.js de 5.1
// via sa base EDGE-SAFE (`auth.config.ts`) plutôt que la config complète : ce
// garde tourne sur le runtime edge et ne peut pas embarquer Prisma/argon2. Il
// n'a besoin que de VÉRIFIER la présence d'une session JWT — aucune requête
// base (piège n°1, split-config Auth.js v5).
//
// ⚠️ Défense en profondeur : ce garde protège au bord, mais chaque layout admin
// (guard serveur) et chaque mutation (`requireAdmin`) RE-vérifie la session.
// AC2 exige une protection côté serveur indépendante du navigateur ; un garde
// de bord seul peut être contourné selon la config de déploiement.
//
// ⚠️ Le `matcher` (voir `config` plus bas) NE couvre QUE /admin/*. Il n'inclut
// ni la page de login (5.1), ni /api/auth/*, ni les assets — sinon boucle de
// redirection infinie (non connecté → login → protégé → login…).
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;

  // `req.auth` est la session résolue par Auth.js (null si absente/invalide).
  if (req.auth) return NextResponse.next();

  // Pas de session : rediriger vers le login en mémorisant la page demandée
  // pour y revenir après authentification (AC3). On ne transmet que le CHEMIN
  // interne + query (jamais l'origine), ce qui empêche tout open-redirect côté
  // callbackUrl (piège n°3) : la valeur reste relative au site.
  const callbackUrl = `${nextUrl.pathname}${nextUrl.search}`;
  const loginUrl = new URL("/login", nextUrl.origin);
  loginUrl.searchParams.set("callbackUrl", callbackUrl);

  // 307 (temporaire) : aucun octet de la page /admin demandée n'est rendu (AC1).
  return NextResponse.redirect(loginUrl);
});

export const config = {
  // Ne matcher QUE /admin et ses sous-chemins. La page de login, /api/auth/*,
  // les assets (_next, favicon…) et le reste du site public restent HORS du
  // périmètre du garde (piège n°1). /admin exact et /admin/quoi/que/ce/soit
  // sont couverts.
  matcher: ["/admin", "/admin/:path*"],
};
