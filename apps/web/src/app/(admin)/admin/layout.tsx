import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { mfaStateFromToken, MFA_CHALLENGE_PATH } from "@/lib/auth.config";

// Story 5.2 — Guard SERVEUR du groupe /admin (défense en profondeur, AC1/AC2).
//
// Le proxy (src/proxy.ts) redirige déjà au bord, mais ce layout re-vérifie la
// session AVANT tout rendu d'enfant. Objectif AC1 « aucun contenu rendu, même
// partiellement » : si le proxy était contourné (selon la config de
// déploiement), aucun composant enfant ne s'exécuterait ni ne fuiterait de
// données — `redirect()` court-circuite le rendu ici, côté serveur.
//
// Story 5.3 — Ce layout porte aussi la REDIRECTION FORCÉE vers l'enrôlement 2FA
// (AC2). C'est le POINT DE DÉCISION UNIQUE « cette session a-t-elle le droit
// d'accéder à cette route admin ? » : il lit l'état réel en base
// (`totpEnabledAt`) — donc runtime Node, pas edge. La story 5.5 (connexion en
// deux temps) s'y greffera en durcissant cette même décision, sans réécriture.
//
// ❌ Surtout PAS un `useSession` client qui masque après hydratation : le HTML
// serait déjà parti. Le gating est strictement serveur.
export const metadata: Metadata = {
  title: "Administration",
  robots: { index: false, follow: false },
};

// Seul écran admin accessible AVANT que la 2FA ne soit activée (AC2). Tout autre
// chemin /admin/* est inaccessible tant que `totpEnabledAt` est null.
//
// Story 5.4 — Cette même route reste accessible APRÈS activation : elle devient
// l'écran de gestion des codes de récupération (décompte, avertissement si
// épuisés, régénération — AC4). Le guard ne l'expulse donc plus vers /admin ;
// c'est la page elle-même qui choisit son mode selon `totpEnabledAt`.
const SECURITY_PATH = "/admin/settings/security";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  if (!session?.user?.email) {
    // Le proxy (chemin nominal) porte déjà le `callbackUrl` exact de la page
    // demandée. Ce guard n'agit qu'en cas de CONTOURNEMENT du proxy : on renvoie
    // alors vers le login avec un fallback interne sûr (`/admin`). Chemin relatif
    // codé en dur → aucun open-redirect possible (piège n°3).
    redirect("/login?callbackUrl=%2Fadmin");
  }

  // Story 5.5 — Défense en profondeur sur la session PARTIELLE (AC1). Le proxy
  // a normalement déjà dévié ces requêtes, mais s'il était contourné, AUCUNE
  // page admin ne doit se rendre avec un second facteur non franchi : le
  // `redirect()` court-circuite le rendu ici, côté serveur.
  //
  // Même source de vérité que le proxy (`mfaStateFromToken`) : une session
  // partielle EXPIRÉE (> 5 min) est traitée comme absente et repart du login.
  const mfaState = mfaStateFromToken(session);
  if (mfaState === "pending") {
    redirect(`${MFA_CHALLENGE_PATH}?callbackUrl=%2Fadmin`);
  }
  if (mfaState === "none") {
    redirect("/login?callbackUrl=%2Fadmin");
  }

  // Redirection forcée vers l'enrôlement (AC2). On lit l'état FRAIS en base à
  // chaque rendu admin (back-office : coût négligeable, toujours à jour — pas de
  // token à rafraîchir après activation).
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { totpEnabledAt: true },
  });

  // Le pathname est fourni par le proxy (header interne réécrit à chaque requête
  // /admin/*). FAIL-SAFE : si le header manque (proxy contourné), on considère
  // qu'on n'est PAS sur l'écran d'enrôlement → une session non enrôlée est
  // redirigée vers l'enrôlement plutôt que de laisser passer.
  const pathname = (await headers()).get("x-pathname") ?? "";
  const isOnSecurityScreen = pathname === SECURITY_PATH;

  // 2FA non encore activée : SEUL l'écran de sécurité est accessible (AC2).
  if (!user?.totpEnabledAt && !isOnSecurityScreen) {
    redirect(SECURITY_PATH);
  }

  // 2FA activée : plus aucune redirection ici. L'écran de sécurité bascule de
  // lui-même en mode « gestion des codes de récupération » (5.4).

  return children;
}
