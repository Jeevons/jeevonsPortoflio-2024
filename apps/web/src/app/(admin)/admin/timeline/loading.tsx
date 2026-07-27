import { AdminShell } from "@/components/admin/admin-shell";
import { Skeleton } from "@/components/admin/skeleton";

// Story 5.20 (AC3) — Silhouette de la liste du PARCOURS (tableau).
export default function AdminTimelineLoading() {
  return (
    <AdminShell>
      <div
        role="status"
        aria-label="Chargement du parcours"
        className="mx-auto flex max-w-5xl flex-col gap-8"
      >
        <span className="sr-only">Chargement…</span>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-72" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-32" />
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-border">
          <Skeleton className="h-10 w-full rounded-none" />
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton
              key={index}
              className="h-14 w-full rounded-none border-t border-border"
            />
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
