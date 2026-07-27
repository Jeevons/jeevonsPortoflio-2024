import Link from "next/link";

import { AdminShell } from "@/components/admin/admin-shell";
import { auth } from "@/lib/auth";

import { TimelineForm } from "../timeline-form";

// Story 5.14 — CRÉATION d'une entrée de parcours (AC1).
//
// La page ne fait que rendre le formulaire en mode « création » (aucune `entry`
// passée) : toute la logique vit dans la Server Action `createTimelineEntryAction`
// (AGENTS.md §6 — vue « bête »).
//
// ⚠️ Cette route DOIT rester sous `/admin/timeline/new`, donc AVANT le segment
// dynamique `[id]` dans l'ordre de résolution de Next : une route statique
// l'emporte sur une route dynamique de même profondeur. Aucune entrée ne peut
// donc être « masquée » par cette page, même si un cuid valait « new ».
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Nouvelle entrée de parcours",
};

export default async function NewTimelineEntryPage() {
  const session = await auth();
  const email = session?.user?.email ?? "";

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
          <h1 className="text-2xl font-semibold">
            Nouvelle entrée de parcours
          </h1>
          <p className="text-sm text-muted-foreground">
            Les champs marqués d&apos;un astérisque sont obligatoires. Laissez
            l&apos;année de fin vide si l&apos;étape est toujours en cours.
          </p>
        </header>

        <TimelineForm />
      </div>
    </AdminShell>
  );
}
