import { auth } from "@/lib/auth";

// Story 5.2 — Page /admin PLACEHOLDER.
//
// Elle ne sert qu'à PROUVER la protection (middleware + guard de layout) : elle
// n'est atteignable qu'avec une session valide. Le vrai tableau de bord est la
// story 5.7 — ne rien construire d'autre ici (anti-scope-creep, périmètre 5.2).
export default async function AdminHomePage() {
  // La session est déjà garantie par le layout (guard serveur). On la relit
  // uniquement pour afficher l'identité connectée — preuve visible que la page
  // n'est servie qu'authentifié.
  const session = await auth();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Administration</h1>
      <p className="text-sm text-white/70">
        Connecté en tant que {session?.user?.email ?? "administrateur"}.
      </p>
      <p className="text-xs text-white/40">
        Espace protégé — le tableau de bord arrive en story 5.7.
      </p>
    </main>
  );
}
