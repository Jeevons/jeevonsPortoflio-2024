import Link from "next/link";

import { AdminShell } from "@/components/admin/admin-shell";
import { auth } from "@/lib/auth";
import { listProjectsForReorder } from "@/lib/admin/projects";

import { ProjectOrderEditor } from "../project-order-editor";

// Story 5.10 — ÉCRAN DE RÉORDONNANCEMENT des projets (AC1, AC3, AC4).
//
// ⚠️ Écran SÉPARÉ de la liste `/admin/projects`, et non un mode de celle-ci.
// La liste est filtrable et triable par colonne (5.8) : y greffer le drag & drop
// permettrait de réordonner une vue partielle ou triée par date de modification,
// et les `sortOrder` seraient alors calculés sur une séquence incomplète — donc
// un ordre faux pour les projets non affichés. Ici, la liste est complète,
// groupée par catégorie et présentée dans l'ordre public réel : « position dans
// la liste = `sortOrder` » reste vrai (piège n°1).
//
// `force-dynamic`, même raison qu'en 5.7/5.8 : réordonner suppose de partir de
// l'ordre RÉEL. Une page cachée afficherait un ordre périmé et le premier
// glissement écraserait des positions à partir d'une base fausse.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Ordre des projets",
};

export default async function AdminProjectsOrderPage() {
  const session = await auth();
  const email = session?.user?.email ?? "";

  const result = await listProjectsForReorder();

  return (
    <AdminShell email={email}>
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Ordre des projets</h1>
          <p className="text-sm text-muted-foreground">
            Réordonnez vos projets au sein de chaque catégorie. L&apos;ordre
            défini ici est celui du site public.
          </p>
          <p className="mt-2">
            <Link
              href="/admin/projects"
              className="text-sm underline underline-offset-4"
            >
              Retour à la liste des projets
            </Link>
          </p>
        </header>

        {!result.available ? (
          // Base injoignable : on le DIT, plutôt que d'afficher une liste vide
          // qu'on pourrait croire réordonnable (même discipline qu'en 5.7/5.8).
          <p
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive-foreground"
          >
            <strong>Base de données injoignable.</strong> L&apos;ordre des
            projets ne peut pas être affiché. Réessayez dans un instant.
          </p>
        ) : (
          <ProjectOrderEditor groups={result.groups} />
        )}
      </div>
    </AdminShell>
  );
}
