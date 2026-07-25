"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ReactNode } from "react";

// Story 5.10 — BRIQUE GÉNÉRIQUE de réordonnancement (piège n°5).
//
// ⚠️ Ce composant ne connaît NI les projets, NI l'admin, NI la moindre Server
// Action. Il manipule des `{ id }` et rend ce qu'on lui donne. C'est
// délibéré : le même besoin de tri revient pour le parcours (5.14), et le PLAN
// §3.2 parle explicitement du « même pattern ». Y introduire quoi que ce soit
// de spécifique aux projets obligerait 5.14 à le dupliquer ou à le disséquer.
//
// Le composant est CONTRÔLÉ : il ne conserve aucun ordre en interne et remonte
// simplement la liste réordonnée via `onReorder`. C'est ce qui permet à
// l'appelant de brancher `useOptimistic` (AC1) et de revenir en arrière si le
// serveur refuse (AC2) — un état interne entrerait en conflit avec le sien.

/** Contrainte minimale d'un élément triable : une identité stable. */
export type SortableItem = { id: string };

type SortableListProps<T extends SortableItem> = {
  items: T[];
  /** Reçoit la liste RÉORDONNÉE. L'appelant décide quoi en faire. */
  onReorder: (items: T[]) => void;
  /** Rendu d'une ligne. `handleProps` doit être posé sur la poignée. */
  children: (item: T, index: number) => ReactNode;
  /**
   * Libellé lisible d'un élément, utilisé par les ANNONCES vocales (AC4).
   * Sans lui, un lecteur d'écran annoncerait « élément 3 sur 7 » — inexploitable
   * pour savoir CE QU'ON déplace.
   */
  getLabel: (item: T) => string;
  /** Décrit la liste dans les annonces (« Projets phares »). */
  listLabel: string;
  /** Désactive toute interaction pendant un enregistrement, par exemple. */
  disabled?: boolean;
};

export function SortableList<T extends SortableItem>({
  items,
  onReorder,
  children,
  getLabel,
  listLabel,
  disabled = false,
}: SortableListProps<T>) {
  // ⚠️ AC4 — L'accessibilité clavier ne vient PAS gratuitement avec le drag &
  // drop : elle tient à ce `KeyboardSensor`. Sans lui, dnd-kit n'écoute que le
  // pointeur et la fonctionnalité serait souris-only, ce que l'AC4 interdit
  // explicitement (AGENTS.md §6 : navigation clavier complète).
  //
  // `distance: 8` sur le pointeur : en deçà, un simple clic sur la poignée
  // déclencherait un drag parasite et rendrait les boutons voisins difficiles à
  // activer.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Annonces ARIA : dnd-kit en fournit par défaut, mais en anglais et sans le
  // nom de l'élément. Le site est en français et l'utilisateur doit savoir CE
  // QU'IL déplace et OÙ il en est (AC4).
  const announcements: Announcements = {
    onDragStart({ active }) {
      const index = items.findIndex((item) => item.id === active.id);
      const item = items[index];
      if (!item) return;
      return `Déplacement de ${getLabel(item)} commencé, position ${index + 1} sur ${items.length} dans ${listLabel}. Utilisez les flèches haut et bas pour déplacer, Espace pour déposer, Échap pour annuler.`;
    },
    onDragOver({ active, over }) {
      if (!over) return;
      const item = items.find((entry) => entry.id === active.id);
      const overIndex = items.findIndex((entry) => entry.id === over.id);
      if (!item || overIndex === -1) return;
      return `${getLabel(item)} est en position ${overIndex + 1} sur ${items.length}.`;
    },
    onDragEnd({ active, over }) {
      const item = items.find((entry) => entry.id === active.id);
      if (!item) return;
      if (!over) return `Déplacement de ${getLabel(item)} annulé.`;
      const overIndex = items.findIndex((entry) => entry.id === over.id);
      return `${getLabel(item)} déposé en position ${overIndex + 1} sur ${items.length}. L'ordre est en cours d'enregistrement.`;
    },
    onDragCancel({ active }) {
      const item = items.find((entry) => entry.id === active.id);
      return item
        ? `Déplacement de ${getLabel(item)} annulé, position inchangée.`
        : undefined;
    },
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    // `over === null` : déposé hors de toute cible. Rien à faire — surtout pas
    // réordonner au hasard.
    if (!over || active.id === over.id) return;

    const from = items.findIndex((item) => item.id === active.id);
    const to = items.findIndex((item) => item.id === over.id);
    if (from === -1 || to === -1) return;

    onReorder(arrayMove(items, from, to));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={{ announcements }}
      // Le déplacement est vertical et borné à la liste : sans ces modifiers,
      // une ligne peut être traînée n'importe où à l'écran, ce qui brouille la
      // lecture de la position d'arrivée.
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items}
        strategy={verticalListSortingStrategy}
        disabled={disabled}
      >
        {/* `<ol>` : l'ordre PORTE DU SENS ici — c'est tout le sujet de l'écran.
            Un `<ul>` annoncerait une liste non ordonnée, à tort. */}
        <ol className="flex flex-col gap-2">
          {items.map((item, index) => children(item, index))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

type SortableRowProps = {
  id: string;
  /** Libellé de la poignée, annoncé par les lecteurs d'écran. */
  handleLabel: string;
  children: ReactNode;
  disabled?: boolean;
};

/**
 * Une ligne déplaçable. Générique elle aussi : elle rend `children` sans rien
 * supposer de leur contenu.
 *
 * ⚠️ Les attributs de drag sont posés sur une POIGNÉE dédiée (`<button>`), pas
 * sur la ligne entière. Deux raisons :
 *  - la ligne contient des liens et des boutons ; les rendre déplaçables
 *    rendrait un simple clic imprévisible ;
 *  - une poignée `<button>` est focusable nativement, donc atteignable au
 *    clavier par Tab — c'est le point d'entrée du réordonnancement clavier (AC4).
 */
export function SortableRow({
  id,
  handleLabel,
  children,
  disabled = false,
}: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={[
        "flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2",
        // Retour visuel du déplacement en cours. `relative z-10` : la ligne
        // saisie passe AU-DESSUS de ses voisines pendant le glissement.
        isDragging ? "relative z-10 shadow-lg ring-2 ring-ring" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        // `setActivatorNodeRef` : dit à dnd-kit que C'EST cet élément qui
        // déclenche le drag, pour que ses annonces et son focus clavier visent
        // la poignée et non la ligne entière.
        ref={setActivatorNodeRef}
        type="button"
        // ⚠️ `touch-none` : sans cela, sur mobile le navigateur interprète le
        // geste comme un défilement de page et le drag ne démarre jamais.
        className="cursor-grab touch-none rounded-md px-2 py-1 text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={handleLabel}
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        {/* Glyphe purement décoratif : l'information est portée par
            `aria-label`, pas par ces points. */}
        <span aria-hidden="true">⠿</span>
      </button>

      <div className="min-w-0 flex-1">{children}</div>
    </li>
  );
}
