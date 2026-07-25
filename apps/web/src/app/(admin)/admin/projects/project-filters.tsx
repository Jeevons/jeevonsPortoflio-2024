"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRef } from "react";

import { buttonVariants } from "@/components/ui/button";
import { ProjectCategory } from "@/generated/prisma/enums";
import type { ProjectFilters } from "@/lib/admin/projects";
import { cn } from "@/lib/utils";

// Story 5.8 — Barre de filtres de la liste (AC1).
//
// Décision (Jeevons) : l'état du filtre vit dans l'URL, pas dans un `useState`.
// Conséquences voulues :
//  - la liste reste rendue par un SERVER Component, le filtrage se fait en base ;
//  - un filtre est partageable et survit à un rechargement ;
//  - le bouton « retour » du navigateur défait le filtre, comme attendu.
//
// `"use client"` justifié uniquement par la navigation programmatique : le
// formulaire se soumet tout seul au changement d'un `<select>`, sans obliger à
// cliquer sur « Filtrer ». Le `<form method="get">` reste fonctionnel SANS
// JavaScript (le bouton de repli ci-dessous prend alors le relais).

const CATEGORY_LABELS: Record<ProjectCategory, string> = {
  FLAGSHIP: "Projet phare",
  PERSONAL: "Projet personnel",
  LAB: "Laboratoire",
};

const SORT_OPTIONS: { value: ProjectFilters["sort"]; label: string }[] = [
  { value: "updatedAt", label: "Dernière modification" },
  { value: "title", label: "Titre" },
  { value: "category", label: "Catégorie" },
  { value: "published", label: "Statut" },
];

export function ProjectFiltersBar({ filters }: { filters: ProjectFilters }) {
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement | null>(null);

  // Un `<select>` modifié relance la requête immédiatement : sur un back-office
  // mono-utilisateur, imposer un clic supplémentaire sur « Filtrer » n'apporte
  // rien.
  const submitNow = () => formRef.current?.requestSubmit();

  const hasActiveFilter =
    filters.q !== "" || filters.category !== "all" || filters.status !== "all";

  return (
    <form
      ref={formRef}
      // `method="get"` : les champs deviennent les `searchParams` de l'URL. Next
      // intercepte et navigue côté client, mais sans JS le navigateur fait la
      // même chose nativement.
      method="get"
      className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card/40 p-4"
    >
      <div className="flex min-w-48 flex-1 flex-col gap-1.5">
        <label htmlFor="filter-q" className="text-xs font-medium">
          Rechercher
        </label>
        <input
          id="filter-q"
          type="search"
          name="q"
          defaultValue={filters.q}
          placeholder="Titre ou entreprise…"
          className="rounded-md border border-border bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="filter-category" className="text-xs font-medium">
          Catégorie
        </label>
        <select
          id="filter-category"
          name="category"
          defaultValue={filters.category}
          onChange={submitNow}
          className="rounded-md border border-border bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <option value="all">Toutes</option>
          {Object.values(ProjectCategory).map((value) => (
            <option key={value} value={value}>
              {CATEGORY_LABELS[value]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="filter-status" className="text-xs font-medium">
          Statut
        </label>
        <select
          id="filter-status"
          name="status"
          defaultValue={filters.status}
          onChange={submitNow}
          className="rounded-md border border-border bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <option value="all">Tous</option>
          <option value="published">Publiés</option>
          <option value="draft">Brouillons</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="filter-sort" className="text-xs font-medium">
          Trier par
        </label>
        <select
          id="filter-sort"
          name="sort"
          defaultValue={filters.sort}
          onChange={submitNow}
          className="rounded-md border border-border bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {SORT_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="filter-dir" className="text-xs font-medium">
          Ordre
        </label>
        <select
          id="filter-dir"
          name="dir"
          defaultValue={filters.dir}
          onChange={submitNow}
          className="rounded-md border border-border bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <option value="asc">Croissant</option>
          <option value="desc">Décroissant</option>
        </select>
      </div>

      {/* Repli sans JavaScript : les `<select>` ne se soumettent alors pas seuls,
          ce bouton reste le chemin nominal. Avec JS il sert de confirmation
          explicite pour le champ de recherche (qui, lui, ne s'auto-soumet pas à
          chaque frappe). */}
      <button
        type="submit"
        className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
      >
        Filtrer
      </button>

      {hasActiveFilter ? (
        // `<Link>` vers l'URL nue : réinitialise en retirant tous les paramètres,
        // sans avoir à remettre chaque champ à sa valeur par défaut à la main.
        <Link
          href="/admin/projects"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          // La navigation re-rend le Server Component ; on efface en plus
          // l'état du champ de recherche, qui est non contrôlé.
          onClick={() => formRef.current?.reset()}
        >
          Réinitialiser
        </Link>
      ) : null}

      {/* `searchParams`/`router` sont lus pour que le composant se re-rende à
          chaque changement d'URL — les `defaultValue` restent alors cohérents
          après un retour arrière du navigateur. */}
      <span className="sr-only" aria-live="polite">
        {searchParams.size > 0 ? "Liste filtrée." : "Liste complète."}
      </span>
    </form>
  );
}
