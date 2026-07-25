import Link from "next/link";

import { AdminShell } from "@/components/admin/admin-shell";
import { auth } from "@/lib/auth";
import { listTimelineForReorder } from "@/lib/admin/timeline";

import { TimelineOrderEditor } from "../timeline-order-editor";

// Story 5.14 — ÉCRAN DE RÉORDONNANCEMENT du parcours (AC2).
//
// ⚠️ Écran SÉPARÉ de la liste `/admin/timeline`, comme pour les projets (5.10) :
// « position dans la liste = `sortOrder` » n'est vrai que si la liste affichée
// est COMPLÈTE. Séparer les deux écrans garantit cette condition par
// construction.
//
// `force-dynamic` : réordonner suppose de partir de l'ordre RÉEL. Une page
// cachée afficherait un ordre périmé et le premier glissement écraserait des
// positions à partir d'une base fausse.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Ordre du parcours",
};

export default async function AdminTimelineOrderPage() {
  const session = await auth();
  const email = session?.user?.email ?? "";

  const result = await listTimelineForReorder();

  return (
    <AdminShell email={email}>
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Ordre du parcours</h1>
          <p className="text-sm text-muted-foreground">
            Réordonnez les étapes de votre parcours. L&apos;ordre défini ici est
            celui du site public.
          </p>
          <p className="mt-2">
            <Link
              href="/admin/timeline"
              className="text-sm underline underline-offset-4"
            >
              Retour à la liste du parcours
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
            <strong>Base de données injoignable.</strong> L&apos;ordre du
            parcours ne peut pas être affiché. Réessayez dans un instant.
          </p>
        ) : (
          <TimelineOrderEditor entries={result.entries} />
        )}
      </div>
    </AdminShell>
  );
}
