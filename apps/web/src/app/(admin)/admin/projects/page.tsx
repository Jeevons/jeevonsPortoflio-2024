import Link from "next/link";

import { AdminShell } from "@/components/admin/admin-shell";
import { buttonVariants } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { listAdminProjects, parseProjectFilters } from "@/lib/admin/projects";
import { ProjectCategory } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

import { DeleteProjectDialog } from "./delete-project-dialog";
import { ProjectFiltersBar } from "./project-filters";

// Story 5.8 — LISTE des projets (AC1).
//
// Server Component : la lecture, le filtrage et le tri se font côté serveur
// (AGENTS.md §6). Les seules frontières client sont la barre de filtres
// (navigation programmatique) et le dialogue de suppression (état d'ouverture).
//
// `force-dynamic`, même raison qu'en 5.7 : l'admin doit voir l'état RÉEL de sa
// base. Une liste mise en cache n'afficherait pas le projet qui vient d'être
// créé — et c'est précisément ce que cette page sert à vérifier.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Projets",
};

const CATEGORY_LABELS: Record<ProjectCategory, string> = {
  FLAGSHIP: "Projet phare",
  PERSONAL: "Projet personnel",
  LAB: "Laboratoire",
};

// Format stable et lisible, indépendant de la locale du serveur (qui n'est pas
// celle du navigateur) : deux rendus successifs affichent la même chaîne.
const DATE_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeZone: "Europe/Paris",
});

export default async function AdminProjectsPage({
  searchParams,
}: {
  // Next 16 : `searchParams` est une promesse.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const session = await auth();
  const email = session?.user?.email ?? "";

  // ⚠️ Les paramètres d'URL sont une entrée utilisateur : ils passent par
  // `parseProjectFilters` (liste fermée) avant d'atteindre Prisma.
  const filters = parseProjectFilters(params);
  const list = await listAdminProjects(filters);

  // Retours d'action (`?saved=1`, `?deleted=1`) posés par les redirections des
  // Server Actions : la confirmation survit à la redirection, ce qu'un état
  // React ne ferait pas.
  const justSaved = params.saved === "1";
  const justDeleted = params.deleted === "1";

  return (
    <AdminShell email={email}>
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold">Projets</h1>
            <p className="text-sm text-muted-foreground">
              Créez, modifiez et supprimez les projets de votre portfolio.
            </p>
          </div>
          {/* `buttonVariants()` sur un `<Link>` : apparence de bouton, vraie
              sémantique de lien — jamais de `<button>` dans un `<a>`. */}
          <div className="flex flex-wrap gap-2">
            {/* Story 5.10 — Le réordonnancement a son propre écran : il exige la
                liste COMPLÈTE et non filtrée (voir order/page.tsx). */}
            <Link
              href="/admin/projects/order"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Réordonner
            </Link>
            <Link href="/admin/projects/new" className={cn(buttonVariants())}>
              Nouveau projet
            </Link>
          </div>
        </header>

        {justSaved ? (
          <p
            role="status"
            className="rounded-lg border border-border bg-card p-4 text-sm"
          >
            Vos modifications ont été enregistrées.
          </p>
        ) : null}

        {justDeleted ? (
          <p
            role="status"
            className="rounded-lg border border-border bg-card p-4 text-sm"
          >
            Le projet a été supprimé.
          </p>
        ) : null}

        {!list.available ? (
          // Base injoignable : on le DIT plutôt que d'afficher une liste vide
          // trompeuse (même discipline qu'au tableau de bord, 5.7).
          <p
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive-foreground"
          >
            <strong>Base de données injoignable.</strong> La liste des projets
            ne peut pas être affichée. Réessayez dans un instant.
          </p>
        ) : (
          <>
            <ProjectFiltersBar filters={filters} />

            {list.rows.length === 0 ? (
              // Deux états vides DISTINCTS : « aucun projet du tout » appelle une
              // invitation à créer ; « aucun résultat » appelle un retrait du
              // filtre. Les confondre laisserait croire que le portfolio est vide.
              <p className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
                {list.total === 0 ? (
                  <>
                    Vous n&apos;avez encore aucun projet.{" "}
                    <Link
                      href="/admin/projects/new"
                      className="underline underline-offset-4"
                    >
                      Créez votre premier projet
                    </Link>
                    .
                  </>
                ) : (
                  <>
                    Aucun projet ne correspond à ces critères.{" "}
                    <Link
                      href="/admin/projects"
                      className="underline underline-offset-4"
                    >
                      Réinitialiser les filtres
                    </Link>
                    .
                  </>
                )}
              </p>
            ) : (
              <section
                aria-labelledby="list-heading"
                className="flex flex-col gap-3"
              >
                <h2 id="list-heading" className="sr-only">
                  Liste des projets
                </h2>

                {/* `overflow-x-auto` : le tableau défile dans SON conteneur au
                    lieu de faire déborder la page sur petit écran. */}
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full min-w-[44rem] border-collapse text-sm">
                    <caption className="sr-only">
                      {list.rows.length} projet(s) affiché(s) sur {list.total}.
                    </caption>
                    <thead>
                      <tr className="border-b border-border bg-card/60 text-left">
                        <th scope="col" className="px-4 py-3 font-medium">
                          Titre
                        </th>
                        <th scope="col" className="px-4 py-3 font-medium">
                          Catégorie
                        </th>
                        <th scope="col" className="px-4 py-3 font-medium">
                          Statut
                        </th>
                        <th scope="col" className="px-4 py-3 font-medium">
                          Modifié le
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-3 text-right font-medium"
                        >
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.rows.map((row) => (
                        <tr
                          key={row.id}
                          className="border-b border-border last:border-b-0"
                        >
                          {/* `<th scope="row">` : le titre IDENTIFIE la ligne. Les
                              lecteurs d'écran annoncent alors « Titre — Statut »
                              plutôt qu'une cellule isolée. */}
                          <th
                            scope="row"
                            className="px-4 py-3 text-left font-normal"
                          >
                            <Link
                              href={`/admin/projects/${row.id}`}
                              className="font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            >
                              {row.title}
                            </Link>
                            <span className="block text-xs text-muted-foreground">
                              {row.company} · /{row.slug}
                            </span>
                          </th>
                          <td className="px-4 py-3">
                            {CATEGORY_LABELS[row.category]}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full px-2 py-0.5 text-xs",
                                row.published
                                  ? "bg-primary/15 text-foreground"
                                  : "bg-muted text-muted-foreground",
                              )}
                            >
                              {row.published ? "Publié" : "Brouillon"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {DATE_FORMAT.format(row.updatedAt)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <Link
                                href={`/admin/projects/${row.id}`}
                                className={cn(
                                  buttonVariants({
                                    variant: "outline",
                                    size: "sm",
                                  }),
                                )}
                              >
                                Modifier
                              </Link>
                              <DeleteProjectDialog
                                projectId={row.id}
                                projectTitle={row.title}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="text-xs text-muted-foreground">
                  {list.rows.length} projet(s) affiché(s) sur {list.total} au
                  total.
                </p>
              </section>
            )}
          </>
        )}
      </div>
    </AdminShell>
  );
}
