import { AdminShell } from "@/components/admin/admin-shell";
import { auth } from "@/lib/auth";
import { listAdminMedia } from "@/lib/admin/media";

import { MediaCard } from "./media-card";

// Story 5.13 — BIBLIOTHÈQUE d'images (AC1).
//
// Server Component : lecture base + volume côté serveur, comme la liste des
// projets (5.8). Seule la carte est cliente, car elle porte les mutations.
//
// `force-dynamic`, même raison qu'en 5.7/5.8 : cet écran sert à voir l'état RÉEL
// du stockage. Une version mise en cache montrerait une image qu'on vient de
// supprimer, ou masquerait un fichier manquant.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Médias",
};

export default async function AdminMediaPage() {
  const session = await auth();
  const email = session?.user?.email ?? "";

  const list = await listAdminMedia();

  const missingFiles = list.rows.filter((row) => !row.fileExists).length;
  const missingAlt = list.rows.filter((row) => !row.alt).length;

  return (
    <AdminShell email={email}>
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Médias</h1>
          <p className="text-sm text-muted-foreground">
            Remplacez, décrivez ou supprimez les images de votre portfolio. Les
            nouvelles images s&apos;ajoutent depuis le formulaire d&apos;un
            projet.
          </p>
        </header>

        {!list.available ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive-foreground"
          >
            <strong>Base de données injoignable.</strong> La bibliothèque ne
            peut pas être affichée. Réessayez dans un instant.
          </p>
        ) : list.rows.length === 0 ? (
          <p className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            Votre bibliothèque est vide. Les images arrivent ici dès que vous en
            téléversez une depuis un projet.
          </p>
        ) : (
          <>
            {/* Deux signalements distincts, en tête : sans eux, un fichier
                manquant ou une image non décrite se perdrait dans la grille. */}
            {missingFiles > 0 ? (
              <p
                role="alert"
                className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive-foreground"
              >
                <strong>
                  {missingFiles} image(s) dont le fichier est introuvable.
                </strong>{" "}
                Remplacez-les pour les réparer, ou supprimez-les.
              </p>
            ) : null}

            {missingAlt > 0 ? (
              <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
                {missingAlt} image(s) sans texte alternatif. Décrivez-les pour
                rester accessible aux lecteurs d&apos;écran.
              </p>
            ) : null}

            <section aria-labelledby="library-heading">
              <h2 id="library-heading" className="sr-only">
                Bibliothèque d&apos;images
              </h2>
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {list.rows.map((media) => (
                  <MediaCard key={media.id} media={media} />
                ))}
              </ul>
              <p className="mt-4 text-xs text-muted-foreground">
                {list.rows.length} image(s) dans la bibliothèque.
              </p>
            </section>
          </>
        )}
      </div>
    </AdminShell>
  );
}
