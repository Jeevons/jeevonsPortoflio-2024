"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";

import { SortableList, SortableRow } from "@/components/admin/sortable-list";
import type { ReorderableTimelineEntry } from "@/lib/admin/timeline";

import { reorderTimelineAction } from "./reorder-actions";

// Story 5.14 — Écran de réordonnancement du parcours (AC2).
//
// ⚠️ RÉUTILISE la brique générique `SortableList` / `SortableRow` de la story
// 5.10, conçue pour ça : elle ne connaît ni les projets, ni le parcours, elle
// manipule des `{ id }`. Le drag & drop accessible (sensor clavier, annonces
// ARIA en français) vient donc gratuitement — ❌ ne surtout pas redéclarer
// dnd-kit ici (piège n°3).
//
// ⚠️ Différence avec l'écran des projets : PAS de groupes. Le parcours est une
// séquence unique, sans catégories — un seul `SortableList` pour tout.

type TimelineOrderEditorProps = {
  entries: ReorderableTimelineEntry[];
};

/** Période affichée. `null` = toujours en cours (AC1), et on le DIT. */
function periodLabel(entry: ReorderableTimelineEntry): string {
  return entry.endYear === null
    ? `${entry.startYear} — en cours`
    : `${entry.startYear} — ${entry.endYear}`;
}

export function TimelineOrderEditor({ entries }: TimelineOrderEditorProps) {
  // ⚠️ ORDRE CONFIRMÉ PAR LE SERVEUR — la source de vérité.
  //
  // La prop ne peut PAS jouer ce rôle : après un enregistrement réussi,
  // `revalidateTag` rafraîchit la page et la prop arrive dans le nouvel ordre ;
  // mais entre-temps, et surtout en cas d'échec, il faut savoir vers quoi
  // revenir. Cet état retient donc le dernier ordre RÉELLEMENT persisté.
  const [confirmed, setConfirmed] = useState(entries);

  // `useOptimistic` : l'UI adopte le nouvel ordre IMMÉDIATEMENT. L'état
  // optimiste est TRANSITOIRE — React le rejette à la fin de la transition et
  // l'affichage retombe sur `confirmed`. C'est précisément ce qui produit le
  // rollback : si le serveur refuse, on ne met PAS `confirmed` à jour, donc
  // l'ordre précédent réapparaît de lui-même.
  const [optimistic, applyOptimistic] = useOptimistic(confirmed);

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Anti-écrasement : deux glissements rapides déclenchent deux requêtes dont
  // l'ordre d'arrivée n'est pas garanti. On ne prend en compte que la réponse du
  // DERNIER envoi, sans quoi une réponse tardive rétablirait un ordre périmé.
  const requestId = useRef(0);

  const handleReorder = (next: ReorderableTimelineEntry[]) => {
    setError(null);
    setSaved(false);

    const current = requestId.current + 1;
    requestId.current = current;

    // ⚠️ `applyOptimistic` DOIT être appelé dans la transition : hors d'elle,
    // React lève « An optimistic state update occurred outside a transition ».
    startTransition(async () => {
      applyOptimistic(next);

      const result = await reorderTimelineAction({
        orderedIds: next.map((entry) => entry.id),
      });

      // Une réponse doublée par un envoi plus récent est ignorée.
      if (requestId.current !== current) return;

      if (result.status === "success") {
        setConfirmed(next);
        setSaved(true);
        return;
      }

      // On ne touche PAS à `confirmed` : en sortant de la transition,
      // l'affichage revient tout seul à l'ordre précédent. Reste à en informer
      // l'utilisateur, sinon le retour en arrière paraîtrait être un bug.
      setError(result.message);
    });
  };

  if (optimistic.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        Aucune entrée dans votre parcours pour l&apos;instant.
      </p>
    );
  }

  return (
    <section aria-labelledby="timeline-order-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="timeline-order-heading" className="text-lg font-semibold">
          Ordre d&apos;affichage
        </h2>
        {/* `aria-live="polite"` : l'état d'enregistrement est annoncé sans
            interrompre la lecture en cours. */}
        <p aria-live="polite" className="text-xs text-muted-foreground">
          {pending
            ? "Enregistrement de l'ordre…"
            : saved
              ? "Ordre enregistré."
              : `${optimistic.length} entrée(s)`}
        </p>
      </div>

      <p className="mt-1 text-xs text-muted-foreground">
        Glissez une entrée pour la déplacer. Au clavier : atteignez la poignée
        avec Tab, appuyez sur Espace pour la saisir, déplacez avec les flèches
        haut et bas, puis Espace pour déposer (Échap pour annuler).
      </p>

      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive-foreground"
        >
          {error}
        </p>
      ) : null}

      <div className="mt-3">
        <SortableList
          items={optimistic}
          onReorder={handleReorder}
          getLabel={(entry) => entry.title}
          listLabel="Parcours"
        >
          {(entry, index) => (
            <SortableRow
              key={entry.id}
              id={entry.id}
              handleLabel={`Déplacer ${entry.title}, position ${index + 1} sur ${optimistic.length}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {/* Le numéro suit l'ordre optimiste : il change en même
                        temps que la ligne, sans attendre le serveur. */}
                    {index + 1}. {entry.title}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {entry.place} · {periodLabel(entry)}
                  </span>
                </span>
                {!entry.published ? (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    Brouillon
                  </span>
                ) : null}
              </div>
            </SortableRow>
          )}
        </SortableList>
      </div>
    </section>
  );
}
