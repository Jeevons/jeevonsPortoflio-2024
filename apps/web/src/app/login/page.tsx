import type { Metadata } from "next";

import { LoginForm } from "./login-form";

// Story 5.1 — Page de connexion au back-office. Vit HORS du (futur) groupe
// protégé /admin pour éviter une boucle de redirection quand 5.2 ajoutera le
// guard. Aucune inscription n'existe (PLAN §3.1) : c'est l'unique porte d'entrée.
export const metadata: Metadata = {
  title: "Connexion",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-6">
      <h1 className="text-2xl font-semibold">Administration</h1>
      <LoginForm />
    </main>
  );
}
