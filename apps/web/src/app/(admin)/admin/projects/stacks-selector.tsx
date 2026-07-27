"use client";

import Link from "next/link";

import type { AdminStackOption } from "@/lib/admin/projects";

// Story 5.9 (AC2) — Sélecteur des TECHNOLOGIES associées au projet.
//
// ⚠️ PÉRIMÈTRE : on ASSOCIE des technologies existantes, on n'en CRÉE pas. Le
// CRUD des `Stack` est la story 5.15 — d'où l'invitation affichée, plutôt qu'un
// champ de saisie libre qui déborderait sur cette story.
//
// ⚠️ BIDIRECTIONNALITÉ (AC2 : « la technologie connaît ses projets ») : elle est
// STRUCTURELLE, pas quelque chose que cet écran a à implémenter. La relation
// `ProjectStacks` du schéma Prisma est déclarée des deux côtés
// (`Project.stacks` ⇄ `Stack.projects`) : écrire d'un côté suffit, la jointure
// est la même table. Aucune seconde écriture n'est nécessaire ni souhaitable.
//
// Choix de contrôle : des CASES À COCHER plutôt qu'un `<select multiple>`. Ce
// dernier est notoirement pénible (ctrl+clic pour la sélection multiple,
// désélection accidentelle) et mal restitué sur mobile. Les cases à cocher sont
// nativement accessibles au clavier, sans aucun code de gestion des touches.

type StacksSelectorProps = {
  /** Toutes les technologies existantes (5.15 les crée). */
  options: AdminStackOption[];
  /**
   * Sélection courante. Le composant est CONTRÔLÉ par le formulaire parent, qui
   * détient déjà cet état pour alimenter l'aperçu live (AC3) : le dupliquer ici
   * ferait deux sources de vérité pouvant diverger.
   */
  selected: string[];
  /** Remonte la sélection — alimente l'aperçu live (AC3). */
  onChange: (selectedIds: string[]) => void;
};

export function StacksSelector({
  options,
  selected,
  onChange,
}: StacksSelectorProps) {
  const toggle = (id: string, checked: boolean) => {
    onChange(
      checked ? [...selected, id] : selected.filter((value) => value !== id),
    );
  };

  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <legend className="px-1 text-sm font-medium">Technologies</legend>

      {options.length === 0 ? (
        // Liste vide : on explique OÙ créer des technologies plutôt que de
        // laisser un bloc vide sans issue.
        <p className="text-sm text-muted-foreground">
          Aucune technologie n&apos;existe encore. Créez-en depuis la page{" "}
          <Link
            href="/admin/stacks"
            className="underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Technologies
          </Link>{" "}
          pour pouvoir les associer à vos projets.
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Cochez les technologies utilisées sur ce projet.
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {options.map((option) => {
              const checked = selected.includes(option.id);
              return (
                <label
                  key={option.id}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    // Même `name` pour toutes : le `FormData` porte une entrée
                    // par case cochée, relue par `getAll("stackIds")`.
                    name="stackIds"
                    value={option.id}
                    checked={checked}
                    onChange={(event) =>
                      toggle(option.id, event.target.checked)
                    }
                    className="size-4 rounded border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  />
                  <span>{option.name}</span>
                </label>
              );
            })}
          </div>
        </>
      )}
    </fieldset>
  );
}
