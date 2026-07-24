import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

// Story 5.2 — Guard SERVEUR du groupe /admin (défense en profondeur, AC1/AC2).
//
// Le middleware (src/middleware.ts) redirige déjà au bord, mais ce layout
// re-vérifie la session AVANT tout rendu d'enfant. Objectif AC1 « aucun contenu
// rendu, même partiellement » : si le middleware était contourné (selon la
// config de déploiement), aucun composant enfant ne s'exécuterait ni ne
// fuiterait de données — `redirect()` court-circuite le rendu ici, côté serveur.
//
// ❌ Surtout PAS un `useSession` client qui masque après hydratation : le HTML
// serait déjà parti. Le gating est strictement serveur.
export const metadata: Metadata = {
  title: "Administration",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  if (!session) {
    // Le middleware (chemin nominal) porte déjà le `callbackUrl` exact de la
    // page demandée. Ce guard n'agit qu'en cas de CONTOURNEMENT du middleware :
    // on renvoie alors vers le login avec un fallback interne sûr (`/admin`).
    // Chemin relatif codé en dur → aucun open-redirect possible (piège n°3).
    redirect("/login?callbackUrl=%2Fadmin");
  }

  return children;
}
