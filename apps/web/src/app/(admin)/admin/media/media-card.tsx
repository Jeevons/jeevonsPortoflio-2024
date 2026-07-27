"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/admin/use-confirm-dialog";
import type { AdminMedia } from "@/lib/admin/media";
import { cn } from "@/lib/utils";

import {
  deleteMediaAction,
  updateMediaAltAction,
  type MediaActionState,
} from "./actions";

// Story 5.13 — Une IMAGE de la bibliothèque, avec ses trois opérations
// (remplacer, décrire, supprimer).
//
// `"use client"` justifié : remplacement de fichier (`<input type="file">` +
// `fetch`), état des dialogues, et retours d'action. La lecture reste entière-
// ment serveur (page.tsx).
//
// ⚠️ Le remplacement passe par `fetch` vers `/api/admin/media/[id]` (fichier),
// les deux autres par des Server Actions. Même découpage qu'en 5.12.

const initialState: MediaActionState = { status: "idle", message: null };

// Format stable côté client ET serveur : sans `timeZone` fixe, le rendu serveur
// et l'hydratation pourraient différer et provoquer une erreur d'hydratation.
const DATE_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeZone: "Europe/Paris",
});

export function MediaCard({ media }: { media: AdminMedia }) {
  const router = useRouter();
  const {
    dialogRef: deleteDialogRef,
    open: openDeleteDialog,
    close: closeDeleteDialog,
  } = useConfirmDialog();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [replacing, setReplacing] = useState(false);
  const [replaceError, setReplaceError] = useState<string | null>(null);
  const [altOpen, setAltOpen] = useState(false);

  const [deleteState, deleteFormAction, deletePending] = useActionState(
    deleteMediaAction,
    initialState,
  );

  const usages = media.usages;
  const inUse = usages.length > 0;

  // La suppression réussie ne redirige pas (on reste sur la bibliothèque) :
  // c'est donc ici qu'on ferme le dialogue et qu'on rafraîchit la liste.
  useEffect(() => {
    if (deleteState.status === "success") {
      closeDeleteDialog();
      router.refresh();
    }
  }, [deleteState, router, closeDeleteDialog]);

  async function handleReplace(file: File) {
    setReplacing(true);
    setReplaceError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch(`/api/admin/media/${media.id}`, {
        method: "POST",
        body,
      });
      if (!response.ok) {
        // On affiche le message du SERVEUR : lui seul sait pourquoi le fichier
        // a été refusé (format, taille, image illisible).
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setReplaceError(payload?.error ?? "Le remplacement a échoué.");
        return;
      }
      // Le `path` a changé : c'est le rafraîchissement serveur qui apporte la
      // nouvelle URL. Sans lui, la vignette resterait sur l'ancien chemin.
      router.refresh();
    } catch {
      setReplaceError("Le remplacement a échoué. Vérifiez votre connexion.");
    } finally {
      setReplacing(false);
      // Réinitialisé pour que re-choisir LE MÊME fichier déclenche à nouveau
      // `onChange` (sinon la valeur est inchangée, et l'événement ne part pas).
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3">
      <div className="relative overflow-hidden rounded-md bg-muted">
        {media.fileExists ? (
          // `<img>` et non `next/image` : ces images sont déjà normalisées en
          // WebP et redimensionnées au téléversement (5.12). Dimensions
          // explicites = pas de saut de page pendant le chargement.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={media.url}
            alt={media.alt ?? ""}
            width={media.width}
            height={media.height}
            className="h-40 w-full object-cover"
            loading="lazy"
          />
        ) : (
          // Fichier absent du volume : la ligne reste AFFICHÉE et réparable.
          <p className="flex h-40 items-center justify-center px-3 text-center text-xs text-destructive-foreground">
            Fichier introuvable sur le disque. Remplacez l&apos;image pour la
            réparer, ou supprimez-la.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        <span>
          {media.width} × {media.height} px
        </span>
        <span>Ajoutée le {DATE_FORMAT.format(media.createdAt)}</span>
      </div>

      {media.alt ? (
        <p className="line-clamp-2 text-xs text-foreground" title={media.alt}>
          {media.alt}
        </p>
      ) : (
        // Même signalement qu'au sélecteur de couverture (5.12, AC3) — mais ici
        // il est RÉPARABLE, c'est tout l'intérêt de cet écran.
        <p className="text-xs text-amber-600 dark:text-amber-400">
          ⚠ Aucun texte alternatif
        </p>
      )}

      {inUse ? (
        <p className="text-xs text-muted-foreground">
          Utilisée par&nbsp;: {usages.map((usage) => usage.label).join(", ")}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">Utilisée nulle part.</p>
      )}

      {replaceError ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive-foreground"
        >
          {replaceError}
        </p>
      ) : null}

      {/* Le refus de suppression n'est PAS répété ici : le dialogue reste
          ouvert en cas d'échec et porte déjà le message, à l'endroit exact où
          Jeevons vient de cliquer. Le dupliquer dans la carte l'afficherait
          deux fois. */}

      {/* ── Texte alternatif (AC3 de la story 5.12, réparé ici) ───────────── */}
      {altOpen ? (
        <AltForm media={media} onDone={() => setAltOpen(false)} />
      ) : null}

      <div className="mt-auto flex flex-wrap gap-2">
        {!altOpen ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setAltOpen(true)}
          >
            {media.alt ? "Modifier la description" : "Décrire"}
          </Button>
        ) : null}

        {/* Le `<input>` est masqué mais reste dans le DOM et associé au label du
            bouton : le clavier atteint le bouton, qui le déclenche. */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleReplace(file);
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={replacing}
          onClick={() => fileInputRef.current?.click()}
        >
          {replacing ? "Remplacement…" : "Remplacer"}
        </Button>

        {/* ⚠️ Bouton DÉSACTIVÉ quand l'image est utilisée : on annonce le refus
            AVANT le clic plutôt qu'après. Ce n'est qu'un confort — la garde qui
            fait foi est côté serveur (`deleteMediaAction`). */}
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={inUse}
          title={
            inUse
              ? `Image utilisée par ${usages.length} contenu(s) — détachez-la d'abord.`
              : undefined
          }
          onClick={openDeleteDialog}
        >
          Supprimer
        </Button>
      </div>

      <dialog
        ref={deleteDialogRef}
        aria-labelledby={`delete-media-${media.id}`}
        className="max-w-md rounded-lg border border-border bg-card p-6 text-card-foreground backdrop:bg-black/50"
      >
        <h2 id={`delete-media-${media.id}`} className="text-lg font-semibold">
          Supprimer cette image ?
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Le fichier sera définitivement effacé du disque.{" "}
          <strong className="text-foreground">
            Cette action est irréversible.
          </strong>
        </p>

        {deleteState.status === "error" ? (
          <p
            role="alert"
            className={cn(
              "mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm",
              "text-destructive-foreground",
            )}
          >
            {deleteState.message}
          </p>
        ) : null}

        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={closeDeleteDialog}>
            Annuler
          </Button>
          <form action={deleteFormAction}>
            <input type="hidden" name="id" value={media.id} />
            <Button
              type="submit"
              variant="destructive"
              disabled={deletePending}
            >
              {deletePending ? "Suppression…" : "Supprimer définitivement"}
            </Button>
          </form>
        </div>
      </dialog>
    </li>
  );
}

/**
 * Formulaire de texte alternatif (AC3 de la story 5.12, réparé ici).
 *
 * ⚠️ COMPOSANT SÉPARÉ, à dessein. `useActionState` garde son résultat tant que
 * le composant est monté : porté par `MediaCard`, un `status: "success"` y
 * resterait indéfiniment, et il faudrait le neutraliser à la main pour rouvrir
 * le formulaire. Ici, fermer DÉMONTE le formulaire, ce qui remet l'état d'action
 * à zéro par construction — sans état de synchronisation ni effet.
 */
function AltForm({ media, onDone }: { media: AdminMedia; onDone: () => void }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    updateMediaAltAction,
    initialState,
  );

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
      onDone();
    }
    // `onDone` est une closure recréée à chaque rendu du parent : l'inclure
    // relancerait l'effet sans raison. Seul le résultat de l'action compte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, router]);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={media.id} />
      <label
        htmlFor={`alt-${media.id}`}
        className="text-xs font-medium text-foreground"
      >
        Texte alternatif
      </label>
      <input
        id={`alt-${media.id}`}
        name="alt"
        type="text"
        defaultValue={media.alt ?? ""}
        placeholder="Ce que montre l'image"
        className="rounded-md border border-border bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {state.status === "error" ? (
        <p role="alert" className="text-xs text-destructive-foreground">
          {state.message}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
