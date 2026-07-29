import { notFound } from "next/navigation";

import { AdminBackLink } from "@/components/admin/admin-back-link";
import { AdminShell } from "@/components/admin/admin-shell";
import { findStackUsage, getAdminStack } from "@/lib/admin/stacks";
import { auth } from "@/lib/auth";

import { DeleteStackDialog } from "../delete-stack-dialog";
import { StackForm } from "../stack-form";

// Story 5.15 — ÉDITEUR d'une technologie existante (AC1, AC2, AC3).
//
// Server Component : la technologie ET son usage sont chargés côté serveur puis
// passés en props (vue « bête », AGENTS.md §6). `force-dynamic` pour la même
// raison qu'ailleurs dans l'admin — on édite l'état RÉEL, jamais une copie
// cachée.
export const dynamic = "force-dynamic";

export default async function EditStackPage({
  params,
}: {
  // Next 16 : `params` est une promesse.
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const email = session?.user?.email ?? "";

  const stack = await getAdminStack(id);

  // Identifiant inconnu (technologie supprimée entre-temps, URL bricolée) : 404
  // franche plutôt qu'un formulaire vide qui échouerait à l'enregistrement.
  if (!stack) {
    notFound();
  }

  // AC2 — L'usage est chargé ICI, et pas dans la liste : c'est sur cette page
  // qu'on décide d'une suppression, donc le seul endroit où NOMMER les projets
  // concernés vaut la requête supplémentaire.
  const usage = await findStackUsage(stack.id);

  return (
    <AdminShell email={email}>
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-1">
          <AdminBackLink href="/admin/stacks">
            Retour aux technologies
          </AdminBackLink>
          <h1 className="text-2xl font-semibold">{stack.name}</h1>
          <p className="text-sm text-muted-foreground">
            {usage.count === 0
              ? "Aucun projet n'utilise cette technologie."
              : `Utilisée par ${usage.count} projet${usage.count > 1 ? "s" : ""}.`}
          </p>
        </header>

        <StackForm stack={stack} />

        {/* AC2 — Zone de suppression, VISUELLEMENT SÉPARÉE du formulaire : une
            action irréversible ne doit pas voisiner le bouton d'enregistrement,
            au risque du clic malheureux. La confirmation reste obligatoire
            (dialogue), qui porte l'avertissement chiffré. */}
        <section
          aria-labelledby="danger-heading"
          className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-destructive/40 p-4"
        >
          <div className="flex flex-col gap-1">
            <h2 id="danger-heading" className="text-sm font-semibold">
              Supprimer cette technologie
            </h2>
            <p className="text-xs text-muted-foreground">
              Elle disparaîtra du site et des projets qui la mentionnent.{" "}
              <strong className="text-foreground">
                Aucun projet ne sera supprimé.
              </strong>{" "}
              Cette action est irréversible.
            </p>
          </div>
          <DeleteStackDialog
            stackId={stack.id}
            stackName={stack.name}
            projectCount={usage.count}
            projectTitles={usage.titles}
            triggerLabel="Supprimer"
          />
        </section>
      </div>
    </AdminShell>
  );
}
