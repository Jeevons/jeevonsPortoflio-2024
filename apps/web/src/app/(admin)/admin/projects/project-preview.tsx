"use client";

import { ProjectCard } from "@/components/ProjectCard";

// Story 5.9 (AC3) — APERÇU LIVE de la carte projet.
//
// ⚠️ LE POINT CENTRAL DE LA STORY : l'AC3 exige que l'aperçu « ressemble à ce
// que verra réellement un visiteur ». Ce composant ne redessine donc RIEN : il
// rend `ProjectCard`, LE composant du site public (`ProjectList` rend la même).
// Toute évolution du style de la carte se répercute mécaniquement ici — un
// aperçu recodé, lui, aurait divergé au premier ajustement.
//
// ⚠️ POURQUOI CE COMPOSANT PEUT ÊTRE CLIENT : `ProjectCard` est une vue PURE —
// aucun accès base, aucun import `server-only` (pattern « vue bête »,
// AGENTS.md §6, déjà appliqué en 4.2). Elle accepte donc d'être alimentée par
// l'état React du formulaire, c'est-à-dire par des données PAS ENCORE
// ENREGISTRÉES. C'est ce qui rend l'aperçu instantané, sans aller-retour serveur.
//
// ⚠️ FIDÉLITÉ DU FOND : la carte est conçue pour le fond sombre du site public,
// alors que l'admin a son propre thème. Le panneau reproduit donc ce contexte
// (`bg-gray-900`) — sans quoi l'aperçu mentirait sur les contrastes réels.

type ProjectPreviewProps = {
  company: string;
  period: string;
  title: string;
  outcome: string;
  link: string;
  /** Points forts, DANS L'ORDRE d'édition — celui qui sera persisté (AC1). */
  highlights: string[];
  /** Noms des technologies cochées, affichés sous la carte (AC2). */
  stackNames: string[];
};

export function ProjectPreview({
  company,
  period,
  title,
  outcome,
  link,
  highlights,
  stackNames,
}: ProjectPreviewProps) {
  return (
    <aside
      aria-labelledby="preview-heading"
      className="flex flex-col gap-3"
      // Le panneau suit le défilement : sur un formulaire long, l'aperçu doit
      // rester visible pendant la saisie, sinon il n'a plus d'utilité.
      style={{ position: "sticky", top: "1.5rem" }}
    >
      <div className="flex flex-col gap-1">
        <h2 id="preview-heading" className="text-sm font-medium">
          Aperçu
        </h2>
        <p className="text-xs text-muted-foreground">
          Rendu de la carte telle qu&apos;elle apparaîtra sur le site public. Il
          se met à jour à mesure que vous saisissez.
        </p>
      </div>

      {/* `aria-live="off"` (défaut) assumé : l'aperçu change à CHAQUE frappe.
          L'annoncer noierait l'utilisateur de lecteur d'écran sous un flux
          continu. L'information reste accessible à la lecture, et les champs du
          formulaire, eux, sont correctement étiquetés. */}
      <div className="overflow-hidden rounded-2xl bg-gray-900 p-4">
        <ProjectCard
          className="px-6 pt-6 pb-0"
          project={{
            // Valeurs de remplacement quand le champ est encore vide : la carte
            // conserve sa structure au lieu de s'effondrer à l'ouverture d'un
            // formulaire de création vierge.
            company: company || "Entreprise",
            year: period || "Période",
            title: title || "Titre du projet",
            results: highlights
              // Les lignes vides en cours de saisie ne sont pas affichées :
              // l'aperçu montre le rendu FINAL, et une ligne vide ne serait de
              // toute façon pas enregistrée.
              .filter((label) => label.trim().length > 0)
              .map((label) => ({ title: label })),
            link,
            // AC4 — vide : la carte masque la section, exactement comme le fera
            // le site public. L'aperçu montre donc aussi le masquage.
            outcome: outcome.trim() === "" ? null : outcome,
            // L'image reste hors périmètre : la couverture est la story 5.12.
          }}
        />
      </div>

      {/* Les technologies ne figurent pas (encore) sur la carte publique : elles
          sont listées SOUS l'aperçu, pour que la sélection soit tout de même
          vérifiable d'un coup d'œil (AC2), sans faire croire à un rendu public
          qui n'existe pas. */}
      <div className="flex flex-col gap-1">
        <h3 className="text-xs font-medium text-muted-foreground">
          Technologies associées
        </h3>
        {stackNames.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Aucune pour l&apos;instant.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {stackNames.map((name) => (
              <li
                key={name}
                className="rounded-full border border-border px-2 py-0.5 text-xs"
              >
                {name}
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
