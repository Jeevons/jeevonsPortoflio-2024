import { AdminShell } from "@/components/admin/admin-shell";
import { Skeleton } from "@/components/admin/skeleton";

// Story 5.20 (AC3) — Silhouette de la boîte de réception (liste divisée).
export default function AdminMessagesLoading() {
  return (
    <AdminShell>
      <div
        role="status"
        aria-label="Chargement des messages"
        className="mx-auto flex max-w-3xl flex-col gap-8"
      >
        <span className="sr-only">Chargement…</span>
        <div className="flex flex-col gap-1">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-4 w-72" />
        </div>

        <div className="overflow-hidden rounded-lg border border-border">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton
              key={index}
              className="h-20 w-full rounded-none border-b border-border last:border-b-0"
            />
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
