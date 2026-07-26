import { AdminShell } from "@/components/admin/admin-shell";
import { Skeleton } from "@/components/admin/skeleton";

// Story 5.20 (AC3) — Silhouette de la bibliothèque de MÉDIAS (grille de
// cartes), même grille que `page.tsx` (1/2/3 colonnes) pour éviter le saut.
export default function AdminMediaLoading() {
  return (
    <AdminShell>
      <div
        role="status"
        aria-label="Chargement des médias"
        className="mx-auto flex max-w-5xl flex-col gap-8"
      >
        <span className="sr-only">Chargement…</span>
        <div className="flex flex-col gap-1">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-72" />
        </div>

        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <li key={index}>
              <Skeleton className="aspect-video w-full" />
            </li>
          ))}
        </ul>
      </div>
    </AdminShell>
  );
}
