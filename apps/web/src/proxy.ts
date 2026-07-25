import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import {
  authConfig,
  mfaStateFromToken,
  MFA_CHALLENGE_PATH,
} from "@/lib/auth.config";

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

  // Story 5.5 — Trois états, pas deux (AC1). Une session PARTIELLE (mot de
  // passe validé, code TOTP pas encore fourni) n'ouvre AUCUNE route /admin :
  // elle est renvoyée vers l'écran de saisie du code, en mémorisant la page
  // demandée pour y revenir une fois la session complète (AC2).
  //
  // ⚠️ `mfaStateFromToken` est la source unique partagée avec le layout admin
  // (Node) : edge et Node prennent ici exactement la même décision. Elle juge
  // aussi de l'EXPIRATION des 5 min → une session partielle périmée retombe en
  // `none` et repart du login (AC1).
  const mfaState = mfaStateFromToken(req.auth);

  if (mfaState === "pending") {
    const callbackUrl = `${nextUrl.pathname}${nextUrl.search}`;
    const challengeUrl = new URL(MFA_CHALLENGE_PATH, nextUrl.origin);
    challengeUrl.searchParams.set("callbackUrl", callbackUrl);
    // 307 : aucun octet de la page /admin demandée n'est rendu (AC1).
    return NextResponse.redirect(challengeUrl);
  }

  // `req.auth` est la session résolue par Auth.js (null si absente/invalide).
  if (req.auth && mfaState === "full") {
    // Story 5.3 — Le gate 2FA (redirection forcée vers l'enrôlement, AC2) vit
    // dans le layout admin (runtime Node : il lit `totpEnabledAt` en base, ce
    // que ce garde EDGE ne peut pas faire). Ce garde connaît en revanche le
    // chemin exact : on le transmet via un header interne pour que le layout
    // sache s'il rend l'écran d'enrôlement (à laisser passer) ou une autre page
    // admin (à rediriger si la 2FA n'est pas encore activée). Header POSÉ par
    // nous, non falsifiable par le client (le proxy le réécrit à chaque requête
    // /admin/* avant d'atteindre le layout).
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-pathname", nextUrl.pathname);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

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
