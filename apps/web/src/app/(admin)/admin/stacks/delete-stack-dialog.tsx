"use client";

import { useActionState, useEffect } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/admin/use-confirm-dialog";

import { deleteStackAction, type DeleteStackState } from "./actions";

// Story 5.15 — CONFIRMATION de suppression avec AVERTISSEMENT (AC2).
//
// Même choix technique qu'en 5.8 / 5.14 : `<dialog>` natif, qui apporte le piège
// du focus, la fermeture par Échap, l'inertie du fond et le rôle `dialog`
// implicite — sans dépendance, là où un `AlertDialog` Radix en imposerait une
// (AGENTS.md §9 règle 6). `window.confirm()` est exclu : il bloque le thread et
// son libellé ne peut pas porter l'avertissement chiffré exigé par l'AC2.
//
// ⚠️ Ce dialogue AVERTIT, il ne BLOQUE pas — à ne pas confondre avec la garde
// média de 5.13, qui REFUSE la suppression d'une image utilisée. Ici la
// suppression est autorisée : les projets sont conservés, seule l'association
// disparaît.

const initialState: DeleteStackState = {
  status: "idle",
  message: null,
};

type DeleteStackDialogProps = {
  stackId: string;
  /** Nom affiché dans la confirmation — évite de supprimer la mauvaise. */
  stackName: string;
  /** Nombre de projets associés — le cœur de l'avertissement (AC2). */
  projectCount: number;
  /** Quelques titres de projets concernés, pour rendre l'impact concret. */
  projectTitles: string[];
  /**
   * Libellé visible du déclencheur. Absent = bouton icône (listes).
   * Présent = bouton texte (zone danger des écrans d'édition).
   */
  triggerLabel?: string;
  /** Suffixe d'id DOM quand le dialogue est monté deux fois (tableau + cartes). */
  instanceKey?: string;
};

export function DeleteStackDialog({
  stackId,
  stackName,
  projectCount,
  projectTitles,
  triggerLabel,
  instanceKey = "default",
}: DeleteStackDialogProps) {
  const { dialogRef, open, close } = useConfirmDialog();
  const [state, formAction, pending] = useActionState(
    deleteStackAction,
    initialState,
  );

  // En cas d'ÉCHEC serveur, le dialogue doit rester ouvert pour porter le
  // message : le fermer donnerait l'illusion d'un succès. En cas de succès,
  // l'action redirige — ce composant est démonté.
  useEffect(() => {
    if (state.status === "error") {
      dialogRef.current?.showModal();
    }
  }, [state, dialogRef]);

  const remaining = projectCount - projectTitles.length;
  const iconLabel = `Supprimer la technologie ${stackName}`;
  const titleId = `delete-stack-title-${stackId}-${instanceKey}`;

  return (
    <>
      {triggerLabel ? (
        <Button type="button" variant="destructive" size="sm" onClick={open}>
          {triggerLabel}
        </Button>
      ) : (
        <Button
          type="button"
          variant="destructive"
          size="icon"
          className="size-8"
          onClick={open}
          aria-label={iconLabel}
          title={iconLabel}
        >
          <Trash2 aria-hidden className="size-4" />
        </Button>
      )}

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="max-w-md rounded-lg border border-border bg-card p-6 text-card-foreground backdrop:bg-black/50"
      >
        <h2 id={titleId} className="text-lg font-semibold">
          Supprimer cette technologie ?
        </h2>

        <p className="mt-2 text-sm text-muted-foreground">
          La technologie{" "}
          <strong className="text-foreground">{stackName}</strong> sera
          définitivement supprimée.{" "}
          <strong className="text-foreground">
            Cette action est irréversible.
          </strong>
        </p>

        {/* AC2 — L'AVERTISSEMENT. Le nombre passe avant tout le reste : c'est
            l'information qui décide. Le message dit aussi, explicitement, ce qui
            N'ARRIVE PAS — sans quoi on pourrait craindre de perdre les projets
            et renoncer à une suppression pourtant sans danger. */}
        {projectCount > 0 ? (
          <div className="mt-4 rounded-md border border-border bg-muted/40 p-3 text-sm">
            <p>
              Elle est associée à{" "}
              <strong className="text-foreground">
                {projectCount} projet{projectCount > 1 ? "s" : ""}
              </strong>
              . {projectCount > 1 ? "Ces projets" : "Ce projet"} ne{" "}
              {projectCount > 1 ? "seront" : "sera"} pas supprimé
              {projectCount > 1 ? "s" : ""}&nbsp;: seule la mention de{" "}
              {stackName} en disparaîtra.
            </p>
            {projectTitles.length > 0 ? (
              <ul className="mt-2 list-disc pl-5 text-muted-foreground">
                {projectTitles.map((title) => (
                  <li key={title}>{title}</li>
                ))}
                {remaining > 0 ? (
                  <li>
                    …et {remaining} autre{remaining > 1 ? "s" : ""}
                  </li>
                ) : null}
              </ul>
            ) : null}
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            Aucun projet n&apos;utilise cette technologie.
          </p>
        )}

        {state.message ? (
          <p
            role="alert"
            className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive-foreground"
          >
            {state.message}
          </p>
        ) : null}

        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={close}>
            Annuler
          </Button>

          <form action={formAction}>
            <input type="hidden" name="id" value={stackId} />
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Suppression…" : "Supprimer définitivement"}
            </Button>
          </form>
        </div>
      </dialog>
    </>
  );
}
