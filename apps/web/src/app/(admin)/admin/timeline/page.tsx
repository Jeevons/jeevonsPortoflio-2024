import Link from "next/link";

import { AdminShell } from "@/components/admin/admin-shell";
import { buttonVariants } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { listAdminTimeline } from "@/lib/admin/timeline";
import { cn } from "@/lib/utils";

import { DeleteTimelineDialog } from "./delete-timeline-dialog";

// Story 5.14 — LISTE du parcours (AC1, AC3).
//
// Server Component : la lecture et le tri se font côté serveur (AGENTS.md §6).
// La seule frontière client est le dialogue de suppression (état d'ouverture).
//
// ⚠️ Pas de barre de filtres ici, contrairement aux projets (5.8) : le parcours
// est une séquence courte et unique, sans catégories. Un filtre y masquerait des
// entrées sans rien simplifier.
//
// `force-dynamic`, même raison qu'en 5.7/5.8 : l'admin doit voir l'état RÉEL de
// sa base. Une liste mise en cache n'afficherait pas l'entrée qui vient d'être
// créée — et c'est précisément ce que cette page sert à vérifier.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Parcours",
};

/**
 * Période affichée. `endYear === null` = entrée toujours en cours (AC1), et on
 * l'ÉCRIT : afficher « 2020 — » laisserait croire à une donnée manquante.
 */
function periodLabel(startYear: number, endYear: number | null): string {
  return endYear === null
    ? `${startYear} — en cours`
    : `${startYear} — ${endYear}`;
}

export default async function AdminTimelinePage({
  searchParams,
}: {
  // Next 16 : `searchParams` est une promesse.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const session = await auth();
  const email = session?.user?.email ?? "";

  const list = await listAdminTimeline();

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
            <h1 className="text-2xl font-semibold">Parcours</h1>
            <p className="text-sm text-muted-foreground">
              Créez, modifiez et supprimez les étapes de votre parcours
              professionnel.
            </p>
          </div>
          {/* `buttonVariants()` sur un `<Link>` : apparence de bouton, vraie
              sémantique de lien — jamais de `<button>` dans un `<a>`. */}
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/timeline/order"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Réordonner
            </Link>
            <Link href="/admin/timeline/new" className={cn(buttonVariants())}>
              Nouvelle entrée
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
            L&apos;entrée a été supprimée.
          </p>
        ) : null}

        {!list.available ? (
          // Base injoignable : on le DIT plutôt que d'afficher une liste vide
          // trompeuse (même discipline qu'au tableau de bord, 5.7).
          <p
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive-foreground"
          >
            <strong>Base de données injoignable.</strong> La liste de votre
            parcours ne peut pas être affichée. Réessayez dans un instant.
          </p>
        ) : list.rows.length === 0 ? (
          <p className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            Votre parcours est encore vide.{" "}
            <Link
              href="/admin/timeline/new"
              className="underline underline-offset-4"
            >
              Ajoutez votre première étape
            </Link>
            .
          </p>
        ) : (
          <section
            aria-labelledby="list-heading"
            className="flex flex-col gap-3"
          >
            <h2 id="list-heading" className="sr-only">
              Liste des entrées du parcours
            </h2>

            {/* `overflow-x-auto` : le tableau défile dans SON conteneur au lieu
                de faire déborder la page sur petit écran. */}
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[40rem] border-collapse text-sm">
                <caption className="sr-only">
                  {list.rows.length} entrée(s) de parcours, dans leur ordre
                  d&apos;affichage public.
                </caption>
                <thead>
                  <tr className="border-b border-border bg-card/60 text-left">
                    <th scope="col" className="px-4 py-3 font-medium">
                      Intitulé
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Période
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Statut
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
                      {/* `<th scope="row">` : l'intitulé IDENTIFIE la ligne. Les
                          lecteurs d'écran annoncent alors « Intitulé — Statut »
                          plutôt qu'une cellule isolée. */}
                      <th
                        scope="row"
                        className="px-4 py-3 text-left font-normal"
                      >
                        <Link
                          href={`/admin/timeline/${row.id}`}
                          className="font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                          {row.title}
                        </Link>
                        <span className="block text-xs text-muted-foreground">
                          {row.place} · /{row.slug}
                        </span>
                      </th>
                      <td className="px-4 py-3 text-muted-foreground">
                        {periodLabel(row.startYear, row.endYear)}
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
                          {row.published ? "Publiée" : "Brouillon"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/admin/timeline/${row.id}`}
                            className={cn(
                              buttonVariants({
                                variant: "outline",
                                size: "sm",
                              }),
                            )}
                          >
                            Modifier
                          </Link>
                          <DeleteTimelineDialog
                            entryId={row.id}
                            entryTitle={row.title}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-muted-foreground">
              {list.rows.length} entrée(s), affichées dans l&apos;ordre du site
              public.
            </p>
          </section>
        )}
      </div>
    </AdminShell>
  );
}
