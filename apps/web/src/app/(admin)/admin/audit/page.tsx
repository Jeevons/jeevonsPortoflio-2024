import { AdminShell } from "@/components/admin/admin-shell";
import { listAuditLog } from "@/lib/admin/audit";
import { auth } from "@/lib/auth";

// Story 5.19 — CONSULTATION du journal des mutations (AC2, piège n°6).
//
// Server Component en LECTURE SEULE : aucune Server Action sur cet écran,
// aucune possibilité d'éditer ou de supprimer une entrée (intégrité de la
// preuve). Le guard vit dans `app/(admin)/admin/layout.tsx`, comme les autres
// pages de liste (`/admin/messages`) : pas de `requireAdmin` supplémentaire
// ici, car aucune mutation n'y transite.
//
// `force-dynamic`, même discipline que le reste de l'admin : le journal doit
// refléter l'état réel, jamais un instantané en cache.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Journal",
};

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Création",
  UPDATE: "Modification",
  DELETE: "Suppression",
};

const ENTITY_LABELS: Record<string, string> = {
  Project: "Projet",
  TimelineEntry: "Parcours",
  Stack: "Technologie",
  SiteSetting: "Réglages",
  ContactMessage: "Message",
  Media: "Média",
  User: "Compte",
};

function formatDiff(diff: unknown): string | null {
  if (!diff || typeof diff !== "object") return null;
  const entries = Object.entries(diff as Record<string, unknown>);
  if (entries.length === 0) return null;
  return entries
    .map(([field, value]) => `${field} : ${JSON.stringify(value)}`)
    .join(" · ");
}

export default async function AdminAuditPage() {
  const session = await auth();
  const email = session?.user?.email ?? "";

  const list = await listAuditLog();

  return (
    <AdminShell email={email}>
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Journal</h1>
          <p className="text-sm text-muted-foreground">
            L&apos;historique des modifications apportées depuis
            l&apos;administration, du plus récent au plus ancien.
          </p>
        </header>

        {!list.available ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive-foreground"
          >
            <strong>Base de données injoignable.</strong> Le journal ne peut pas
            être affiché. Réessayez dans un instant.
          </p>
        ) : list.rows.length === 0 ? (
          <p className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            Aucune modification enregistrée pour le moment. Chaque modification
            effectuée depuis l&apos;administration apparaîtra ici.
          </p>
        ) : (
          <section
            aria-labelledby="list-heading"
            className="flex flex-col gap-3"
          >
            <h2 id="list-heading" className="sr-only">
              Historique des modifications
            </h2>

            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
              {list.rows.map((row) => {
                const diffText = formatDiff(row.diff);
                return (
                  <li key={row.id} className="flex flex-col gap-1 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium">
                        {ACTION_LABELS[row.action] ?? row.action}
                        {" · "}
                        {ENTITY_LABELS[row.entity] ?? row.entity}
                      </span>
                      <time
                        dateTime={row.createdAt.toISOString()}
                        className="text-xs text-muted-foreground"
                      >
                        {dateFormatter.format(row.createdAt)}
                      </time>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Par {row.userEmail}
                      {row.entityId ? ` · ${row.entityId}` : ""}
                    </span>
                    {diffText ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {diffText}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>

            <p className="text-xs text-muted-foreground">
              {list.rows.length} entrée(s), les 200 plus récentes au maximum.
            </p>
          </section>
        )}
      </div>
    </AdminShell>
  );
}
