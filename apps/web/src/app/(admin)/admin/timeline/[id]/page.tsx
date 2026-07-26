import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { auth } from "@/lib/auth";
import { getAdminTimelineEntry } from "@/lib/admin/timeline";

import { DeleteTimelineDialog } from "../delete-timeline-dialog";
import { TimelineForm } from "../timeline-form";

// Story 5.14 — ÉDITEUR d'une entrée de parcours existante (AC1, AC3, AC4).
//
// Server Component : l'entrée est chargée côté serveur puis passée en props au
// formulaire (vue « bête », AGENTS.md §6). `force-dynamic` pour la même raison
// qu'ailleurs dans l'admin — on édite l'état RÉEL, jamais une copie cachée.
export const dynamic = "force-dynamic";

export default async function EditTimelineEntryPage({
  params,
}: {
  // Next 16 : `params` est une promesse.
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const email = session?.user?.email ?? "";

  const entry = await getAdminTimelineEntry(id);

  // Identifiant inconnu (entrée supprimée entre-temps, URL bricolée) : 404
  // franche plutôt qu'un formulaire vide qui échouerait à l'enregistrement.
  if (!entry) {
    notFound();
  }

  return (
    <AdminShell email={email}>
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-1">
          <Link
            href="/admin/timeline"
            className="w-fit text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            ← Retour au parcours
          </Link>
          <h1 className="text-2xl font-semibold">{entry.title}</h1>
          <p className="text-sm text-muted-foreground">
            {entry.published
              ? "Cette entrée est visible sur le site public."
              : "Cette entrée est un brouillon : elle n'apparaît pas sur le site public."}
          </p>
        </header>

        <TimelineForm entry={entry} />

        {/* AC4 — Zone de suppression, VISUELLEMENT SÉPARÉE du formulaire : une
            action irréversible ne doit pas voisiner le bouton d'enregistrement,
            au risque du clic malheureux. La confirmation reste obligatoire
            (dialogue). */}
        <section
          aria-labelledby="danger-heading"
          className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-destructive/40 p-4"
        >
          <div className="flex flex-col gap-1">
            <h2 id="danger-heading" className="text-sm font-semibold">
              Supprimer cette entrée
            </h2>
            <p className="text-xs text-muted-foreground">
              L&apos;entrée sera définitivement supprimée de votre parcours. Son
              illustration reste dans la bibliothèque d&apos;images. Cette
              action est irréversible.
            </p>
          </div>
          <DeleteTimelineDialog entryId={entry.id} entryTitle={entry.title} />
        </section>
      </div>
    </AdminShell>
  );
}
