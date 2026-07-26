import { AdminShell } from "@/components/admin/admin-shell";
import { Skeleton } from "@/components/admin/skeleton";

// Story 5.20 (AC3) — Silhouette du JOURNAL (liste divisée), écran livré par
// la story 5.19 sur cette même branche.
export default function AdminAuditLoading() {
  return (
    <AdminShell>
      <div
        role="status"
        aria-label="Chargement du journal"
        className="mx-auto flex max-w-3xl flex-col gap-8"
      >
        <span className="sr-only">Chargement…</span>
        <div className="flex flex-col gap-1">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-4 w-80" />
        </div>

        <div className="overflow-hidden rounded-lg border border-border">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton
              key={index}
              className="h-16 w-full rounded-none border-b border-border last:border-b-0"
            />
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
