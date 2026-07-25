import Link from "next/link";

import { AdminShell } from "@/components/admin/admin-shell";
import { auth } from "@/lib/auth";

import { ProjectForm } from "../project-form";

// Story 5.8 — CRÉATION d'un projet (AC2, AC3).
//
// La page ne fait que rendre le formulaire en mode « création » (aucun `project`
// passé) : toute la logique vit dans la Server Action `createProjectAction`
// (AGENTS.md §6 — vue « bête »).
//
// ⚠️ Cette route DOIT rester sous `/admin/projects/new`, donc AVANT le segment
// dynamique `[id]` dans l'ordre de résolution de Next : une route statique
// l'emporte sur une route dynamique de même profondeur. Aucun projet ne peut
// donc être « masqué » par cette page, même si un cuid valait « new ».
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Nouveau projet",
};

export default async function NewProjectPage() {
  const session = await auth();
  const email = session?.user?.email ?? "";

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
          <h1 className="text-2xl font-semibold">Nouveau projet</h1>
          <p className="text-sm text-muted-foreground">
            Les champs marqués d&apos;un astérisque sont obligatoires.
          </p>
        </header>

        <ProjectForm />
      </div>
    </AdminShell>
  );
}
