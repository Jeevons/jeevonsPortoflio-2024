import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { auth } from "@/lib/auth";
import { getAdminProject } from "@/lib/admin/projects";

import { DeleteProjectDialog } from "../delete-project-dialog";
import { ProjectForm } from "../project-form";

// Story 5.8 — ÉDITEUR d'un projet existant (AC2, AC3, AC4, AC5).
//
// Server Component : le projet est chargé côté serveur puis passé en props au
// formulaire (vue « bête », AGENTS.md §6). `force-dynamic` pour la même raison
// qu'ailleurs dans l'admin — on édite l'état RÉEL, jamais une copie cachée.
export const dynamic = "force-dynamic";

export default async function EditProjectPage({
  params,
}: {
  // Next 16 : `params` est une promesse.
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const email = session?.user?.email ?? "";

  const project = await getAdminProject(id);

  // Identifiant inconnu (projet supprimé entre-temps, URL bricolée) : 404
  // franche plutôt qu'un formulaire vide qui échouerait à l'enregistrement.
  if (!project) {
    notFound();
  }

  return (
    <AdminShell email={email}>
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-1">
          <Link
            href="/admin/projects"
            className="w-fit text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            ← Retour aux projets
          </Link>
          <h1 className="text-2xl font-semibold">{project.title}</h1>
          <p className="text-sm text-muted-foreground">
            {project.published
              ? "Ce projet est visible sur le site public."
              : "Ce projet est un brouillon : il n'apparaît pas sur le site public."}
          </p>
        </header>

        <ProjectForm project={project} />

        {/* AC5 — Zone de suppression, VISUELLEMENT SÉPARÉE du formulaire : une
            action irréversible ne doit pas voisiner le bouton d'enregistrement,
            au risque du clic malheureux. La confirmation reste obligatoire
            (dialogue). */}
        <section
          aria-labelledby="danger-heading"
          className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-destructive/40 p-4"
        >
          <div className="flex flex-col gap-1">
            <h2 id="danger-heading" className="text-sm font-semibold">
              Supprimer ce projet
            </h2>
            <p className="text-xs text-muted-foreground">
              Le projet et ses points forts seront définitivement supprimés.
              Cette action est irréversible.
            </p>
          </div>
          <DeleteProjectDialog
            projectId={project.id}
            projectTitle={project.title}
          />
        </section>
      </div>
    </AdminShell>
  );
}
