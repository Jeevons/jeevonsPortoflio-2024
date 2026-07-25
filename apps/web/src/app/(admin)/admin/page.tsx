import Link from "next/link";

import { auth } from "@/lib/auth";
import { getRecoveryCodesStatus } from "@/lib/auth/recovery-codes";

// Story 5.2 — Page /admin PLACEHOLDER.
//
// Elle ne sert qu'à PROUVER la protection (middleware + guard de layout) : elle
// n'est atteignable qu'avec une session valide. Le vrai tableau de bord est la
// story 5.7 — ne rien construire d'autre ici (anti-scope-creep, périmètre 5.2).
//
// Story 5.4 (AC4) — Seul ajout : le bandeau d'avertissement « plus de codes de
// récupération ». L'AC exige d'être averti « quand je consulte
// l'administration » : c'est ici, à l'entrée du back-office, que l'information
// doit apparaître — pas seulement sur l'écran de sécurité qu'on ne visite
// jamais spontanément. Le tableau de bord de 5.7 reprendra ce bandeau.
export default async function AdminHomePage() {
  // La session est déjà garantie par le layout (guard serveur). On la relit
  // uniquement pour afficher l'identité connectée — preuve visible que la page
  // n'est servie qu'authentifié.
  const session = await auth();
  const email = session?.user?.email ?? "";
  const { exhausted, remaining } = await getRecoveryCodesStatus(email);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Administration</h1>

      {exhausted ? (
        <p
          role="alert"
          className="max-w-md rounded-lg border border-red-400/40 bg-red-400/10 p-4 text-sm text-red-200"
        >
          <strong>Vous n&apos;avez plus de code de récupération.</strong> En cas
          de perte de votre téléphone, vous ne pourriez plus accéder à
          l&apos;administration.{" "}
          <Link href="/admin/settings/security" className="underline">
            Générer un nouveau jeu
          </Link>
          .
        </p>
      ) : null}

      <p className="text-sm text-white/70">
        Connecté en tant que {session?.user?.email ?? "administrateur"}.
      </p>
      {!exhausted ? (
        <p className="text-xs text-white/40">
          {remaining} code(s) de récupération disponible(s) —{" "}
          <Link href="/admin/settings/security" className="underline">
            gérer
          </Link>
        </p>
      ) : null}
      <p className="text-xs text-white/40">
        Espace protégé — le tableau de bord arrive en story 5.7.
      </p>
    </main>
  );
}
