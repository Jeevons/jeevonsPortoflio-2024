import Link from "next/link";

import { AdminShell } from "@/components/admin/admin-shell";
import { buttonVariants } from "@/components/ui/button";
import { listAdminStacks } from "@/lib/admin/stacks";
import { auth } from "@/lib/auth";
import { SKILL_LEVEL_LABELS } from "@/lib/schemas/stack";
import { isKnownStackIconKey, STACK_ICON_LABELS } from "@/lib/stack-icons";
import { cn } from "@/lib/utils";

import { DeleteStackDialog } from "./delete-stack-dialog";

// Story 5.15 — LISTE des technologies (AC1, AC2).
//
// Server Component : lecture et tri côté serveur (AGENTS.md §6). La seule
// frontière client est le dialogue de suppression (état d'ouverture).
//
// `force-dynamic`, même raison qu'en 5.7/5.8/5.14 : l'admin doit voir l'état
// RÉEL de sa base, pas une copie cachée — c'est ce que cette page sert à
// vérifier après une modification.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Technologies",
};

/** Libellé de la clé d'icône. Une clé hors registre est SIGNALÉE, pas masquée. */
function iconLabel(iconKey: string | null): string {
  if (iconKey === null || iconKey === "") return "Aucune";
  if (isKnownStackIconKey(iconKey)) return STACK_ICON_LABELS[iconKey];
  return `${iconKey} (inconnue)`;
}

export default async function AdminStacksPage({
  searchParams,
}: {
  // Next 16 : `searchParams` est une promesse.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const session = await auth();
  const email = session?.user?.email ?? "";

  const list = await listAdminStacks();

  // Retours d'action posés par les redirections des Server Actions : la
  // confirmation survit à la redirection, ce qu'un état React ne ferait pas.
  const justSaved = params.saved === "1";
  const justDeleted = params.deleted === "1";

  return (
    <AdminShell email={email}>
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold">Technologies</h1>
            <p className="text-sm text-muted-foreground">
              Créez, modifiez et supprimez les technologies affichées sur votre
              site et associées à vos projets.
            </p>
          </div>
          {/* `buttonVariants()` sur un `<Link>` : apparence de bouton, vraie
              sémantique de lien — jamais de `<button>` dans un `<a>`. */}
          <Link href="/admin/stacks/new" className={cn(buttonVariants())}>
            Nouvelle technologie
          </Link>
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
            La technologie a été supprimée. Les projets concernés ont été
            conservés.
          </p>
        ) : null}

        {!list.available ? (
          // Base injoignable : on le DIT plutôt que d'afficher une liste vide
          // trompeuse (même discipline qu'au tableau de bord, 5.7).
          <p
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive-foreground"
          >
            <strong>Base de données injoignable.</strong> La liste de vos
            technologies ne peut pas être affichée. Réessayez dans un instant.
          </p>
        ) : list.rows.length === 0 ? (
          <p className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            Aucune technologie enregistrée.{" "}
            <Link
              href="/admin/stacks/new"
              className="underline underline-offset-4"
            >
              Ajoutez la première
            </Link>
            .
          </p>
        ) : (
          <section
            aria-labelledby="list-heading"
            className="flex flex-col gap-3"
          >
            <h2 id="list-heading" className="sr-only">
              Liste des technologies
            </h2>

            {/* `overflow-x-auto` : le tableau défile dans SON conteneur au lieu
                de faire déborder la page sur petit écran. */}
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[42rem] border-collapse text-sm">
                <caption className="sr-only">
                  {list.rows.length} technologie(s), par ordre alphabétique.
                </caption>
                <thead>
                  <tr className="border-b border-border bg-card/60 text-left">
                    <th scope="col" className="px-4 py-3 font-medium">
                      Nom
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Icône
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Niveau
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Projets
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
                      {/* `<th scope="row">` : le nom IDENTIFIE la ligne. Les
                          lecteurs d'écran annoncent alors « Nom — Niveau »
                          plutôt qu'une cellule isolée. */}
                      <th
                        scope="row"
                        className="px-4 py-3 text-left font-normal"
                      >
                        <Link
                          href={`/admin/stacks/${row.id}`}
                          className="font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                          {row.name}
                        </Link>
                      </th>
                      <td className="px-4 py-3 text-muted-foreground">
                        {iconLabel(row.iconKey)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {row.level === null
                          ? "Non précisé"
                          : SKILL_LEVEL_LABELS[row.level]}
                      </td>
                      {/* AC2 — Le nombre de projets est visible AVANT toute
                          suppression : la conséquence est connue d'un coup
                          d'œil, sans ouvrir le dialogue. */}
                      <td className="px-4 py-3 text-muted-foreground">
                        {row.projectCount}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/admin/stacks/${row.id}`}
                            className={cn(
                              buttonVariants({
                                variant: "outline",
                                size: "sm",
                              }),
                            )}
                          >
                            Modifier
                          </Link>
                          {/* `projectTitles` vide ici volontairement : la liste
                              ne charge que le NOMBRE (`_count`), qui suffit à
                              l'avertissement. Les titres, eux, sont chargés par
                              l'éditeur, où l'on prend le temps de décider. */}
                          <DeleteStackDialog
                            stackId={row.id}
                            stackName={row.name}
                            projectCount={row.projectCount}
                            projectTitles={[]}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-muted-foreground">
              {list.rows.length} technologie(s). Sur le site public, elles sont
              affichées par niveau décroissant.
            </p>
          </section>
        )}
      </div>
    </AdminShell>
  );
}
