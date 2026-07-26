import { AdminShell } from "@/components/admin/admin-shell";
import { Skeleton } from "@/components/admin/skeleton";

// Story 5.20 (AC3) — Silhouette des RÉGLAGES : formulaire de textes + bloc CV.
export default function AdminSettingsLoading() {
  return (
    <AdminShell>
      <div
        role="status"
        aria-label="Chargement des réglages"
        className="mx-auto flex max-w-3xl flex-col gap-8"
      >
        <span className="sr-only">Chargement…</span>
        <div className="flex flex-col gap-1">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-96" />
        </div>

        <div className="flex flex-col gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>

        <Skeleton className="h-40 w-full" />
      </div>
    </AdminShell>
  );
}
