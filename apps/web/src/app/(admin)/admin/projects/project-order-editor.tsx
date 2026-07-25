"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";

import { SortableList, SortableRow } from "@/components/admin/sortable-list";
import type {
  ProjectCategoryGroup,
  ReorderableProject,
} from "@/lib/admin/projects";
import type { ProjectCategory } from "@/generated/prisma/enums";

import { reorderProjectsAction } from "./reorder-actions";

// Story 5.10 — Écran de réordonnancement des projets (AC1, AC2, AC4).
//
// ⚠️ Un groupe = UNE catégorie, et le tri se fait à l'intérieur (décision
// Jeevons). Chaque catégorie a donc sa propre séquence `sortOrder` 0..n-1 :
// c'est cohérent avec le rendu public, qui affiche une section par catégorie, et
// avec l'index `@@index([category, sortOrder])`.

const CATEGORY_LABELS: Record<ProjectCategory, string> = {
  FLAGSHIP: "Projets phares",
  PERSONAL: "Projets personnels",
  LAB: "Laboratoire",
};

type ProjectOrderEditorProps = {
  groups: ProjectCategoryGroup[];
};

export function ProjectOrderEditor({ groups }: ProjectOrderEditorProps) {
  return (
    <div className="flex flex-col gap-10">
      {groups.map((group) => (
        <CategoryOrderGroup key={group.category} group={group} />
      ))}
    </div>
  );
}

function CategoryOrderGroup({ group }: { group: ProjectCategoryGroup }) {
  const label = CATEGORY_LABELS[group.category];

  // ⚠️ ORDRE CONFIRMÉ PAR LE SERVEUR — la source de vérité.
  //
  // `group.projects` (la prop) ne peut PAS jouer ce rôle : après un
  // enregistrement réussi, `revalidateTag` rafraîchit la page et la prop arrive
  // dans le nouvel ordre ; mais entre-temps, et surtout en cas d'échec, il faut
  // savoir vers quoi revenir. Cet état retient donc le dernier ordre RÉELLEMENT
  // persisté, et c'est lui que l'affichage optimiste habille (AC2).
  const [confirmed, setConfirmed] = useState(group.projects);

  // AC1 — `useOptimistic` : l'UI adopte le nouvel ordre IMMÉDIATEMENT, sans
  // attendre le serveur. L'état optimiste est TRANSITOIRE : React le rejette
  // automatiquement à la fin de la transition, et l'affichage retombe alors sur
  // `confirmed`. C'est précisément ce qui produit le rollback (AC2) : si le
  // serveur refuse, on ne met PAS `confirmed` à jour, donc l'ordre précédent
  // réapparaît de lui-même.
  const [optimistic, applyOptimistic] = useOptimistic(confirmed);

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Anti-écrasement : deux glissements rapides déclenchent deux requêtes dont
  // l'ordre d'arrivée n'est pas garanti. On ne prend en compte que la réponse
  // du DERNIER envoi, sans quoi une réponse tardive rétablirait un ordre périmé.
  const requestId = useRef(0);

  const handleReorder = (next: ReorderableProject[]) => {
    setError(null);
    setSaved(false);

    const current = requestId.current + 1;
    requestId.current = current;

    // ⚠️ `applyOptimistic` DOIT être appelé dans la transition : hors d'elle,
    // React lève « An optimistic state update occurred outside a transition ».
    startTransition(async () => {
      applyOptimistic(next);

      const result = await reorderProjectsAction({
        category: group.category,
        orderedIds: next.map((project) => project.id),
      });

      // Une réponse doublée par un envoi plus récent est ignorée.
      if (requestId.current !== current) return;

      if (result.status === "success") {
        // Promotion de l'ordre optimiste en ordre confirmé (AC1).
        setConfirmed(next);
        setSaved(true);
        return;
      }

      // AC2 — On ne touche PAS à `confirmed` : en sortant de la transition,
      // l'affichage revient tout seul à l'ordre précédent. Reste à en informer
      // l'utilisateur, sinon le retour en arrière paraîtrait être un bug.
      setError(result.message);
    });
  };

  if (optimistic.length === 0) {
    return (
      <section aria-labelledby={`order-${group.category}`}>
        <h2 id={`order-${group.category}`} className="text-lg font-semibold">
          {label}
        </h2>
        <p className="mt-2 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          Aucun projet dans cette catégorie.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby={`order-${group.category}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={`order-${group.category}`} className="text-lg font-semibold">
          {label}
        </h2>
        {/* `aria-live="polite"` : l'état d'enregistrement est annoncé sans
            interrompre la lecture en cours. */}
        <p aria-live="polite" className="text-xs text-muted-foreground">
          {pending
            ? "Enregistrement de l'ordre…"
            : saved
              ? "Ordre enregistré."
              : `${optimistic.length} projet(s)`}
        </p>
      </div>

      <p
        id={`order-help-${group.category}`}
        className="mt-1 text-xs text-muted-foreground"
      >
        Glissez un projet pour le déplacer. Au clavier : atteignez la poignée
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
          getLabel={(project) => project.title}
          listLabel={label}
        >
          {(project, index) => (
            <SortableRow
              key={project.id}
              id={project.id}
              handleLabel={`Déplacer ${project.title}, position ${index + 1} sur ${optimistic.length}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {/* Le numéro affiché suit l'ordre optimiste : il change en
                        même temps que la ligne, sans attendre le serveur. */}
                    {index + 1}. {project.title}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {project.company}
                  </span>
                </span>
                {!project.published ? (
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
