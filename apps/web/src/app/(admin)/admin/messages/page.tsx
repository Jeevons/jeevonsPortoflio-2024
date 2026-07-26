import Link from "next/link";

import { AdminShell } from "@/components/admin/admin-shell";
import { listAdminMessages } from "@/lib/admin/messages";
import { auth } from "@/lib/auth";
import { cn } from "@/lib/utils";

// Story 5.18 — BOÎTE DE RÉCEPTION (AC2, AC5).
//
// Server Component : lecture côté serveur (AGENTS.md §6). Seuls la bascule
// lu/non lu et le dialogue de suppression sont des frontières client, sur
// l'écran de lecture d'un message.
//
// `force-dynamic`, même raison qu'ailleurs dans l'admin : l'état RÉEL de la
// boîte de réception, jamais un instantané en cache.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Messages",
};

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const session = await auth();
  const email = session?.user?.email ?? "";

  const list = await listAdminMessages();
  const justDeleted = params.deleted === "1";

  return (
    <AdminShell email={email}>
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Messages</h1>
          <p className="text-sm text-muted-foreground">
            Les demandes reçues via le formulaire de contact de votre site.
          </p>
        </header>

        {justDeleted ? (
          <p
            role="status"
            className="rounded-lg border border-border bg-card p-4 text-sm"
          >
            Le message a été supprimé.
          </p>
        ) : null}

        {!list.available ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive-foreground"
          >
            <strong>Base de données injoignable.</strong> Vos messages ne
            peuvent pas être affichés. Réessayez dans un instant.
          </p>
        ) : list.rows.length === 0 ? (
          // AC5 — État vide EXPLICITE, sans erreur. C'est aussi l'état par
          // défaut tant que le formulaire public (Epic 6) n'existe pas.
          <p className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            Aucun message pour le moment. Les demandes envoyées depuis le
            formulaire de contact du site apparaîtront ici.
          </p>
        ) : (
          <section
            aria-labelledby="list-heading"
            className="flex flex-col gap-3"
          >
            <h2 id="list-heading" className="sr-only">
              Liste des messages reçus
            </h2>

            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
              {list.rows.map((row) => (
                <li key={row.id}>
                  <Link
                    href={`/admin/messages/${row.id}`}
                    className={cn(
                      "flex flex-col gap-1 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:ring-offset-0 hover:bg-accent/50",
                      // AC2 — les non lus sont DISTINGUÉS visuellement : fond
                      // légèrement teinté + puce, plutôt qu'une seule couleur de
                      // texte (accessible aussi sans distinguer les couleurs,
                      // grâce à la puce + au texte "Non lu").
                      !row.read && "bg-primary/5",
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        {!row.read ? (
                          <span
                            aria-hidden
                            className="size-2 shrink-0 rounded-full bg-primary"
                          />
                        ) : null}
                        <span
                          className={cn(
                            "text-sm",
                            !row.read ? "font-semibold" : "font-medium",
                          )}
                        >
                          {row.name}
                        </span>
                        {!row.read ? (
                          <span className="text-3xs uppercase tracking-wide text-primary">
                            Non lu
                          </span>
                        ) : null}
                      </span>
                      <time
                        dateTime={row.createdAt.toISOString()}
                        className="text-xs text-muted-foreground"
                      >
                        {dateFormatter.format(row.createdAt)}
                      </time>
                    </div>
                    <span className="truncate text-xs text-muted-foreground">
                      {row.email}
                    </span>
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {row.excerpt}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>

            <p className="text-xs text-muted-foreground">
              {list.rows.length} message(s), du plus récent au plus ancien.
            </p>
          </section>
        )}
      </div>
    </AdminShell>
  );
}
