// Story 5.20 — Silhouette de chargement partagée (AC3, anti-CLS).
//
// `animate-pulse` est un utilitaire Tailwind natif (aucune dépendance,
// AGENTS.md §9). Son animation est neutralisée par la règle globale
// `prefers-reduced-motion` déjà présente dans `globals.css` (AC4) : cette
// règle cible `*` et `animation-duration`, donc `animate-pulse` en hérite sans
// rien ajouter ici.
//
// `aria-hidden` : purement décoratif, le vrai statut de chargement est porté
// par le `role="status"` du composant appelant (voir chaque `loading.tsx`).
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-muted ${className ?? ""}`}
    />
  );
}
