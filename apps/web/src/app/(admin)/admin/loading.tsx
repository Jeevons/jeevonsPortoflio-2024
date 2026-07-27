import { AdminShell } from "@/components/admin/admin-shell";
import { Skeleton } from "@/components/admin/skeleton";

// Story 5.20 (AC3) — Silhouette du TABLEAU DE BORD, aux dimensions du contenu
// réel de `page.tsx` : bandeau de titre, deux compteurs, deux cartes
// d'activité. `role="status"` + texte `sr-only` : les lecteurs d'écran
// annoncent le chargement au lieu d'un silence déroutant.
export default function AdminDashboardLoading() {
  return (
    <AdminShell>
      <div
        role="status"
        aria-label="Chargement du tableau de bord"
        className="mx-auto flex max-w-5xl flex-col gap-8"
      >
        <span className="sr-only">Chargement…</span>
        <div className="flex flex-col gap-1">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-80" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    </AdminShell>
  );
}
