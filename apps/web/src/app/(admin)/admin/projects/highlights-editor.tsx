"use client";

import { useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Story 5.9 (AC1) — Éditeur de POINTS FORTS : ajout, modification, suppression
// « sans limite arbitraire », et réordonnancement dont l'ordre est persisté.
//
// ⚠️ POURQUOI PAS DE DRAG & DROP ICI (piège n°2) : la story 5.10 introduit
// dnd-kit pour le tri des projets. Dupliquer une seconde infra de glisser-déposer
// dans cette story serait à la fois hors périmètre et redondant. Le
// réordonnancement se fait donc par des BOUTONS « monter / descendre » — solution
// qui a l'avantage d'être nativement accessible au clavier (AGENTS.md §6), sans
// gestionnaire de touches ad hoc ni annonces ARIA à réinventer.
//
// ⚠️ L'ORDRE N'EST PAS STOCKÉ DANS LES DONNÉES : il EST la position dans le
// tableau. Les champs sont émis avec un index (`highlights[i].label`) que le
// serveur relit pour en dériver `sortOrder`. Une seule source de vérité, donc
// aucun risque de voir la liste affichée et l'ordre persisté diverger.

/** Une ligne éditée. `id` absent = point fort nouvellement ajouté (non persisté). */
export type HighlightDraft = {
  id?: string;
  label: string;
  /** Clé React STABLE, purement locale — voir `nextKey`. */
  key: string;
};

/**
 * Fabrique une clé locale unique.
 *
 * ⚠️ On ne peut PAS utiliser l'index du tableau comme clé React : lors d'un
 * déplacement ou d'une suppression, React réassocierait les champs aux mauvaises
 * lignes et le focus (ou le texte en cours de frappe) sauterait d'une ligne à
 * l'autre. On ne peut pas non plus utiliser `id`, absent des lignes nouvelles.
 * D'où cette clé locale, indépendante de la persistance.
 */
let keyCounter = 0;
function nextKey(): string {
  keyCounter += 1;
  return `hl-${keyCounter}`;
}

export function toDrafts(
  highlights: { id: string; label: string }[],
): HighlightDraft[] {
  return highlights.map((highlight) => ({
    id: highlight.id,
    label: highlight.label,
    key: nextKey(),
  }));
}

type HighlightsEditorProps = {
  /** Lignes initiales, déjà dans l'ordre persisté. */
  initial: HighlightDraft[];
  /** Remonte l'état à chaque frappe — alimente l'aperçu live (AC3). */
  onChange: (drafts: HighlightDraft[]) => void;
};

export function HighlightsEditor({ initial, onChange }: HighlightsEditorProps) {
  const [drafts, setDrafts] = useState<HighlightDraft[]>(initial);
  const headingId = useId();

  // Après un déplacement, le focus doit SUIVRE la ligne déplacée : sinon
  // l'utilisateur au clavier perd sa position et doit re-tabuler depuis le début
  // à chaque appui. On mémorise donc la clé à refocaliser et le sens du geste.
  const pendingFocus = useRef<{ key: string; direction: "up" | "down" } | null>(
    null,
  );

  const commit = (next: HighlightDraft[]) => {
    setDrafts(next);
    onChange(next);
  };

  const addHighlight = () => {
    // Aucune borne supérieure : AC1 exige « sans limite arbitraire ».
    commit([...drafts, { label: "", key: nextKey() }]);
  };

  const updateLabel = (key: string, label: string) => {
    commit(
      drafts.map((draft) => (draft.key === key ? { ...draft, label } : draft)),
    );
  };

  const removeHighlight = (key: string) => {
    commit(drafts.filter((draft) => draft.key !== key));
  };

  /** Échange une ligne avec sa voisine. `delta` vaut -1 (monter) ou +1 (descendre). */
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= drafts.length) return;

    const next = [...drafts];
    [next[index], next[target]] = [next[target], next[index]];
    pendingFocus.current = {
      key: drafts[index].key,
      direction: delta < 0 ? "up" : "down",
    };
    commit(next);
  };

  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <legend className="px-1 text-sm font-medium" id={headingId}>
        Points forts
      </legend>
      <p className="text-xs text-muted-foreground">
        Ce que ce projet a apporté concrètement. L&apos;ordre défini ici est
        celui affiché sur le site public. Utilisez les boutons « Monter » et «
        Descendre » pour réorganiser.
      </p>

      {drafts.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
          Aucun point fort. Le site n&apos;affichera pas de liste pour ce
          projet.
        </p>
      ) : (
        // `<ol>` : la liste est ORDONNÉE, et cet ordre porte du sens (il est
        // persisté et rendu tel quel côté public). Les lecteurs d'écran
        // annoncent alors la position de chaque élément.
        <ol className="flex flex-col gap-3">
          {drafts.map((draft, index) => (
            <li key={draft.key} className="flex items-start gap-2">
              <span
                aria-hidden
                className="mt-2.5 w-5 shrink-0 text-right text-xs text-muted-foreground"
              >
                {index + 1}
              </span>

              <div className="flex min-w-0 flex-1 flex-col gap-1">
                {/* L'identifiant persisté voyage en champ caché : c'est lui qui
                    permet au serveur de METTRE À JOUR la ligne existante plutôt
                    que de la recréer (réconciliation, cf. actions.ts). */}
                {draft.id ? (
                  <input
                    type="hidden"
                    name={`highlights[${index}].id`}
                    value={draft.id}
                  />
                ) : null}

                <input
                  type="text"
                  // ⚠️ L'INDEX du nom est recalculé à chaque rendu : après un
                  // déplacement, les champs sont donc renumérotés dans le nouvel
                  // ordre, et c'est cet ordre que le serveur persiste.
                  name={`highlights[${index}].label`}
                  value={draft.label}
                  onChange={(event) =>
                    updateLabel(draft.key, event.target.value)
                  }
                  placeholder="Ex. Réduction de 40 % du temps de chargement"
                  aria-label={`Point fort ${index + 1}`}
                  className={cn(
                    "w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  )}
                />
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  // La première ligne ne peut pas monter, la dernière ne peut pas
                  // descendre : le bouton est désactivé plutôt que silencieusement
                  // inopérant.
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  // Libellé EXPLICITE pour les lecteurs d'écran : « Monter »
                  // seul ne dirait pas de quel point fort il s'agit.
                  aria-label={`Monter le point fort ${index + 1}`}
                  ref={(element) => {
                    const pending = pendingFocus.current;
                    if (
                      element &&
                      pending?.key === draft.key &&
                      pending.direction === "up"
                    ) {
                      element.focus();
                      pendingFocus.current = null;
                    }
                  }}
                >
                  <span aria-hidden>↑</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={index === drafts.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label={`Descendre le point fort ${index + 1}`}
                  ref={(element) => {
                    const pending = pendingFocus.current;
                    if (
                      element &&
                      pending?.key === draft.key &&
                      pending.direction === "down"
                    ) {
                      element.focus();
                      pendingFocus.current = null;
                    }
                  }}
                >
                  <span aria-hidden>↓</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeHighlight(draft.key)}
                  aria-label={`Supprimer le point fort ${index + 1}`}
                >
                  <span aria-hidden>✕</span>
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}

      {/* `type="button"` IMPÉRATIF : dans un `<form>`, un bouton sans type vaut
          `submit` — ajouter une ligne enregistrerait le projet. */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        onClick={addHighlight}
      >
        Ajouter un point fort
      </Button>

      {/* Annonce du changement d'ordre aux lecteurs d'écran : sans elle, un
          utilisateur non-voyant déclencherait « Monter » sans aucun retour sur
          l'effet obtenu. `aria-live="polite"` n'interrompt pas la lecture en
          cours. */}
      <p aria-live="polite" className="sr-only">
        {drafts.length} point(s) fort(s) dans la liste.
      </p>
    </fieldset>
  );
}
