"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { MediaDeleteButton } from "@/components/admin/media-delete-button";
import { type MediaOption } from "@/components/admin/media-selector";
import { cn } from "@/lib/utils";

// GALERIE D'IMAGES d'un projet — ajout, légende, retrait et réordonnancement.
//
// ⚠️ POURQUOI PAS `MediaSelector` TEL QUEL (le sélecteur de couverture) : il est
// conçu pour UNE seule image (`value: string | null`, un `radiogroup` où choisir
// désélectionne le précédent). Une galerie est une LISTE ORDONNÉE de plusieurs
// images, chacune portant sa propre légende — deux modèles d'interaction
// distincts. On réutilise en revanche son type `MediaOption` et la même route
// `/api/admin/media`, pour ne pas inventer un second contrat.
//
// ⚠️ POURQUOI PAS DE DRAG & DROP (même raison qu'`HighlightsEditor`, story 5.9) :
// les boutons « Monter / Descendre » sont nativement accessibles au clavier,
// sans gestionnaire de touches ni annonces ARIA à réinventer (AGENTS.md §6).
//
// ⚠️ L'ORDRE N'EST PAS UNE DONNÉE : il EST la position dans le tableau. Les
// champs sont émis indexés (`images[i].mediaId`) et le serveur en dérive
// `sortOrder` — une seule source de vérité.

/** Une ligne de galerie éditée. `id` absent = image ajoutée, non encore persistée. */
export type GalleryDraft = {
  id?: string;
  mediaId: string;
  caption: string;
  /** Clé React STABLE, purement locale — même raison que dans `HighlightsEditor`. */
  key: string;
};

// Compteur local : ni l'index (React réassocierait les champs aux mauvaises
// lignes après un déplacement) ni `id` (absent des lignes nouvelles) ne peuvent
// servir de clé.
let keyCounter = 0;
function nextKey(): string {
  keyCounter += 1;
  return `img-${keyCounter}`;
}

export function toGalleryDrafts(
  images: { id: string; mediaId: string; caption: string | null }[],
): GalleryDraft[] {
  return images.map((image) => ({
    id: image.id,
    mediaId: image.mediaId,
    caption: image.caption ?? "",
    key: nextKey(),
  }));
}

type GalleryEditorProps = {
  /** Lignes initiales, déjà dans l'ordre persisté. */
  initial: GalleryDraft[];
  /** Remonte l'état à chaque changement — alimente l'aperçu live. */
  onChange: (drafts: GalleryDraft[]) => void;
  /** Erreur serveur portant sur la galerie (image supprimée, doublon). */
  error?: string;
};

export function GalleryEditor({
  initial,
  onChange,
  error,
}: GalleryEditorProps) {
  const [drafts, setDrafts] = useState<GalleryDraft[]>(initial);
  const [library, setLibrary] = useState<MediaOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [altDraft, setAltDraft] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const headingId = useId();

  // Le focus doit SUIVRE la ligne déplacée, sinon l'utilisateur au clavier perd
  // sa position à chaque appui (même mécanique que `HighlightsEditor`).
  const pendingFocus = useRef<{ key: string; direction: "up" | "down" } | null>(
    null,
  );

  // Bibliothèque chargée à l'affichage : elle évolue à chaque téléversement, y
  // compris depuis cet écran.
  //
  // ⚠️ Extrait de l'effet pour être RAPPELABLE après une suppression d'image
  // (`MediaDeleteButton`) : cette grille est peuplée par `fetch`, donc un
  // `router.refresh()` ne la mettrait pas à jour — l'image supprimée resterait
  // affichée jusqu'au rechargement complet de la page.
  const reloadLibrary = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/media");
      if (!response.ok) throw new Error(String(response.status));
      const data = (await response.json()) as { media: MediaOption[] };
      setLibrary(data.media);
    } catch {
      setUploadError("La bibliothèque n'a pas pu être chargée.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/admin/media");
        if (!response.ok) throw new Error(String(response.status));
        const data = (await response.json()) as { media: MediaOption[] };
        // La requête peut aboutir APRÈS le démontage (navigation rapide) :
        // écrire l'état alors ferait réapparaître une liste obsolète.
        if (!cancelled) setLibrary(data.media);
      } catch {
        if (!cancelled)
          setUploadError("La bibliothèque n'a pas pu être chargée.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const commit = (next: GalleryDraft[]) => {
    setDrafts(next);
    onChange(next);
  };

  /** Identifiants déjà dans la galerie : une image ne peut y figurer qu'une fois. */
  const usedIds = new Set(drafts.map((draft) => draft.mediaId));

  const addImage = (mediaId: string) => {
    // Garde côté client de la contrainte `@@unique([projectId, mediaId])`. Le
    // schéma la revérifie de son côté : ceci n'est qu'un confort de saisie.
    if (usedIds.has(mediaId)) return;
    commit([...drafts, { mediaId, caption: "", key: nextKey() }]);
  };

  const updateCaption = (key: string, caption: string) => {
    commit(
      drafts.map((draft) =>
        draft.key === key ? { ...draft, caption } : draft,
      ),
    );
  };

  const removeImage = (key: string) => {
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

  async function handleUpload(file: File) {
    setUploading(true);
    setUploadError(null);

    const body = new FormData();
    body.append("file", file);
    body.append("alt", altDraft);

    try {
      const response = await fetch("/api/admin/media", {
        method: "POST",
        body,
      });
      const data = (await response.json()) as {
        media?: MediaOption;
        error?: string;
      };

      if (!response.ok || !data.media) {
        // Message du SERVEUR, qui nomme la cause réelle (format refusé, taille
        // dépassée) : un texte générique laisserait sans indication.
        setUploadError(data.error ?? "Le téléversement a échoué.");
        return;
      }

      // L'image rejoint la bibliothèque ET la galerie : c'est la raison pour
      // laquelle on téléverse depuis cet écran.
      setLibrary((current) => [data.media as MediaOption, ...current]);
      addImage(data.media.id);
      setAltDraft("");
    } catch {
      setUploadError("Le téléversement a échoué. Vérifiez votre connexion.");
    } finally {
      setUploading(false);
      // Sans cette remise à zéro, re-sélectionner LE MÊME fichier après une
      // erreur ne déclencherait aucun évènement `change`.
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (uploading) return;
    const file = event.dataTransfer.files?.[0];
    if (file) void handleUpload(file);
  }

  const byId = new Map(library.map((item) => [item.id, item]));

  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <legend className="px-1 text-sm font-medium" id={headingId}>
        Galerie d&apos;images
      </legend>
      <p className="text-xs text-muted-foreground">
        Images secondaires illustrant le projet, affichées sous la couverture
        sur la fiche détaillée. L&apos;ordre défini ici est celui du site
        public.
      </p>

      {/* Zone de téléversement. `onDragOver` DOIT appeler preventDefault, sinon
          le navigateur ouvre le fichier au lieu de déclencher `onDrop`.
          Le glisser-déposer DOUBLE le champ fichier, il ne le remplace pas :
          il est inaccessible au clavier (AGENTS.md §6). */}
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!uploading) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "flex flex-col gap-3 rounded-md border border-dashed p-4 transition-colors",
          dragging ? "border-primary bg-primary/5" : "border-border",
        )}
      >
        <label className="flex flex-col gap-1 text-sm">
          <span>
            Texte alternatif de la prochaine image{" "}
            <span className="text-muted-foreground">(recommandé)</span>
          </span>
          <input
            type="text"
            value={altDraft}
            onChange={(event) => setAltDraft(event.target.value)}
            disabled={uploading}
            placeholder="Ex. : écran de validation des factures"
            aria-describedby="gallery-alt-hint"
            className="rounded-md border border-border bg-background px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          />
          <span id="gallery-alt-hint" className="text-xs text-muted-foreground">
            Décrit l&apos;image pour les personnes qui ne la voient pas.
            Différent de la légende, qui est affichée à tout le monde.
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
            <input
              ref={fileInputRef}
              type="file"
              // `accept` filtre la boîte de dialogue, ce n'est PAS une
              // sécurité : la validation qui fait foi est côté serveur.
              accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/tiff"
              className="sr-only"
              disabled={uploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleUpload(file);
              }}
            />
            <span>
              {uploading ? "Téléversement…" : "Téléverser et ajouter une image"}
            </span>
          </label>
          <span className="text-xs text-muted-foreground">
            ou glissez une image ici
          </span>
        </div>
      </div>

      {/* Le résultat du téléversement est annoncé aux lecteurs d'écran, qui ne
          « voient » pas apparaître la vignette. */}
      <p role="status" className="sr-only">
        {uploading ? "Téléversement en cours" : ""}
      </p>

      {uploadError ? (
        <p className="text-sm text-destructive">{uploadError}</p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {/* LISTE ORDONNÉE des images retenues. `<ol>` : l'ordre porte du sens (il
          est persisté et rendu tel quel côté public), les lecteurs d'écran
          annoncent donc la position de chaque élément. */}
      {drafts.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
          Aucune image dans la galerie. La fiche du projet n&apos;affichera que
          la couverture.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {drafts.map((draft, index) => {
            const media = byId.get(draft.mediaId);
            return (
              <li
                key={draft.key}
                className="flex items-start gap-3 rounded-md border border-border p-3"
              >
                <span
                  aria-hidden
                  className="mt-2 w-5 shrink-0 text-right text-xs text-muted-foreground"
                >
                  {index + 1}
                </span>

                {/* L'identifiant persisté voyage en champ caché : c'est lui qui
                    permet au serveur de METTRE À JOUR la ligne existante plutôt
                    que de la recréer (réconciliation, cf. actions.ts). */}
                {draft.id ? (
                  <input
                    type="hidden"
                    name={`images[${index}].id`}
                    value={draft.id}
                  />
                ) : null}
                {/* ⚠️ L'INDEX est recalculé à chaque rendu : après un
                    déplacement, les champs sont renumérotés dans le nouvel
                    ordre, et c'est cet ordre que le serveur persiste. */}
                <input
                  type="hidden"
                  name={`images[${index}].mediaId`}
                  value={draft.mediaId}
                />

                {media ? (
                  /* `<img>` et non `next/image` : l'image est DÉJÀ normalisée en
                     WebP et redimensionnée par sharp au téléversement. */
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={media.url}
                    alt={media.alt ?? ""}
                    width={media.width}
                    height={media.height}
                    loading="lazy"
                    className="h-16 w-24 shrink-0 rounded object-cover"
                  />
                ) : (
                  // La bibliothèque n'est pas encore chargée, ou l'image a été
                  // supprimée entre-temps : on n'affiche pas une vignette
                  // cassée, et la ligne reste modifiable/retirable.
                  <span className="flex h-16 w-24 shrink-0 items-center justify-center rounded border border-dashed border-border text-xs text-muted-foreground">
                    {loading ? "…" : "Image absente"}
                  </span>
                )}

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                    <span>Légende (facultative)</span>
                    <input
                      type="text"
                      name={`images[${index}].caption`}
                      value={draft.caption}
                      onChange={(event) =>
                        updateCaption(draft.key, event.target.value)
                      }
                      placeholder="Ex. Écran de validation des factures"
                      aria-label={`Légende de l'image ${index + 1}`}
                      className={cn(
                        "w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm text-foreground",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      )}
                    />
                  </label>
                  {media && !media.alt ? (
                    // Même signalement que le sélecteur de couverture : absence
                    // de texte alternatif = défaut d'accessibilité, signalé mais
                    // jamais bloquant.
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      ⚠ Cette image n&apos;a pas de texte alternatif.
                    </p>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    aria-label={`Monter l'image ${index + 1}`}
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
                    aria-label={`Descendre l'image ${index + 1}`}
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
                    onClick={() => removeImage(draft.key)}
                    aria-label={`Retirer l'image ${index + 1} de la galerie`}
                  >
                    <span aria-hidden>✕</span>
                  </Button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {/* CHOISIR une image DÉJÀ présente dans la bibliothèque. Boutons et non
          `radiogroup` (contrairement au sélecteur de couverture) : ici le geste
          est « ajouter à la liste », pas « choisir l'unique ». */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : library.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          La bibliothèque est vide. Téléversez une première image ci-dessus.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">
            Ou ajoutez une image déjà présente dans la bibliothèque :
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {library.map((item) => {
              const already = usedIds.has(item.id);
              return (
                /* `group` + `relative` : conteneur nécessaire pour poser le
                   bouton de suppression EN FRÈRE de la vignette. Il ne peut pas
                   vivre à l'intérieur, la vignette étant elle-même un
                   `<button>` (imbriquer deux contrôles est invalide). */
                <div key={item.id} className="group relative">
                  <button
                    type="button"
                    // `disabled` plutôt que masqué : l'image reste visible, avec
                    // la raison pour laquelle on ne peut pas la rajouter.
                    disabled={already}
                    onClick={() => addImage(item.id)}
                    title={
                      already ? "Déjà dans la galerie" : "Ajouter à la galerie"
                    }
                    aria-label={
                      already
                        ? `${item.alt ?? "Image"} — déjà dans la galerie`
                        : `Ajouter ${item.alt ?? "cette image"} à la galerie`
                    }
                    className={cn(
                      "block w-full overflow-hidden rounded-md border-2 border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      already
                        ? "cursor-not-allowed opacity-40"
                        : "hover:border-primary",
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.url}
                      alt={item.alt ?? ""}
                      width={item.width}
                      height={item.height}
                      loading="lazy"
                      className="aspect-video w-full object-cover"
                    />
                    {!item.alt ? (
                      <span
                        title="Texte alternatif manquant"
                        className="absolute right-1 top-1 rounded bg-amber-500 px-1 text-xs text-white"
                      >
                        <span aria-hidden="true">⚠</span>
                        <span className="sr-only">
                          Texte alternatif manquant
                        </span>
                      </span>
                    ) : null}
                  </button>

                  {/* Supprime le FICHIER de la bibliothèque — à distinguer du
                      `✕` d'une ligne de galerie, qui ne fait que détacher
                      l'image du projet. `reloadLibrary` remet la grille à jour,
                      celle-ci étant chargée en `fetch` et non par le serveur. */}
                  <MediaDeleteButton
                    mediaId={item.id}
                    label={item.alt ?? "cette image"}
                    onDeleted={reloadLibrary}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Annonce des changements aux lecteurs d'écran : sans elle, « Monter »
          n'aurait aucun retour perceptible. `polite` n'interrompt pas la
          lecture en cours. */}
      <p aria-live="polite" className="sr-only">
        {drafts.length} image(s) dans la galerie.
      </p>
    </fieldset>
  );
}
