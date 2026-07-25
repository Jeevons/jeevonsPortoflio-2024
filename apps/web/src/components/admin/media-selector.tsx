"use client";

import { useEffect, useRef, useState } from "react";

// Story 5.12 (AC1, AC3, AC5) — Sélecteur d'IMAGE, téléversement compris.
//
// Deux gestes en un seul endroit : téléverser une nouvelle image, ou reprendre
// une image déjà présente dans la bibliothèque. Les séparer obligerait à quitter
// le formulaire pour revenir ensuite, en perdant la saisie en cours.
//
// ⚠️ Composant CONTRÔLÉ, comme `StacksSelector` (5.9) : l'état de sélection vit
// dans le formulaire parent, qui alimente déjà l'aperçu live. Le dupliquer ici
// créerait deux sources de vérité pouvant diverger.
//
// ⚠️ Story 5.14 — GÉNÉRALISÉ et DÉPLACÉ ici (il vivait sous `admin/projects/`
// sous le nom `CoverSelector`). Le parcours a exactement le même besoin :
// choisir ou téléverser une illustration. Le dupliquer aurait créé deux
// implémentations d'un même geste, vouées à diverger — et l'infra média de
// 5.12/5.13 est explicitement conçue pour être réutilisée, pas réécrite.
//
// Rien de spécifique à un modèle ne subsiste : le composant ne connaît ni les
// projets, ni le parcours. Ce qui varie (nom du champ posté, libellés) est
// passé en props.

/** Vue d'un média telle que la route d'administration la renvoie. */
export type MediaOption = {
  id: string;
  url: string;
  width: number;
  height: number;
  blurDataUrl: string;
  alt: string | null;
};

type MediaSelectorProps = {
  /** Média sélectionné, ou `null` : un contenu sans illustration est valide. */
  value: string | null;
  onChange: (mediaId: string | null) => void;
  /** Erreur serveur portant sur ce champ (média supprimé entre-temps). */
  error?: string;
  /**
   * Nom du champ caché posté avec le formulaire (`coverId` pour un projet,
   * `avatarId` pour une entrée de parcours). C'est la SEULE chose qui rattache
   * ce composant générique au modèle qui l'utilise.
   */
  name: string;
  /** Titre du `fieldset` (ex. « Image de couverture », « Illustration »). */
  legend: string;
  /** Libellé du bouton de retrait, nommant ce qu'on retire. */
  removeLabel: string;
  /** Libellé du `radiogroup`, annoncé par les lecteurs d'écran. */
  pickerLabel: string;
  /** Invite affichée quand la bibliothèque est vide. */
  emptyLabel: string;
};

export function MediaSelector({
  value,
  onChange,
  error,
  name,
  legend,
  removeLabel,
  pickerLabel,
  emptyLabel,
}: MediaSelectorProps) {
  const [library, setLibrary] = useState<MediaOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // AC3 — Le texte alternatif est DEMANDÉ au moment du téléversement, saisi
  // avant de choisir le fichier. Il part avec la requête d'upload, ce qui évite
  // un second aller-retour et, surtout, évite de créer des médias sans
  // description que personne ne reviendra corriger.
  const [altDraft, setAltDraft] = useState("");

  // La bibliothèque est chargée à l'affichage plutôt que passée en props par le
  // serveur : elle évolue à chaque téléversement, y compris depuis cet écran.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/admin/media");
        if (!response.ok) throw new Error(String(response.status));
        const data = (await response.json()) as { media: MediaOption[] };
        // ⚠️ La requête peut aboutir APRÈS le démontage du composant (navigation
        // rapide). Écrire l'état alors provoquerait un avertissement React et,
        // pire, ferait réapparaître une liste obsolète.
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

  async function handleUpload(file: File) {
    setUploading(true);
    setUploadError(null);

    const body = new FormData();
    body.append("file", file);
    // AC3 — Vide → le serveur enregistre `null`, et l'absence sera SIGNALÉE
    // (jamais bloquante : un champ obligatoire pousserait à saisir n'importe
    // quoi, ce qui dégraderait l'accessibilité au lieu de l'améliorer).
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
        // ⚠️ On affiche le message du SERVEUR, qui nomme la cause réelle (format
        // refusé, taille dépassée — AC4). Un message générique fabriqué ici
        // laisserait Jeevons sans indication sur ce qu'il doit corriger.
        setUploadError(data.error ?? "Le téléversement a échoué.");
        return;
      }

      // La nouvelle image rejoint la bibliothèque ET devient la sélection : c'est
      // la raison pour laquelle on téléverse depuis cet écran.
      setLibrary((current) => [data.media as MediaOption, ...current]);
      onChange(data.media.id);
      // Le texte alternatif appartient à l'image qui vient d'être créée : le
      // garder l'appliquerait par erreur au téléversement suivant.
      setAltDraft("");
    } catch {
      setUploadError("Le téléversement a échoué. Vérifiez votre connexion.");
    } finally {
      setUploading(false);
      // Réinitialise le champ fichier : sans cela, re-sélectionner LE MÊME
      // fichier après une erreur ne déclencherait aucun évènement `change`.
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const selected = library.find((item) => item.id === value) ?? null;

  // Glisser-déposer (story : « par simple glisser-déposer »).
  //
  // ⚠️ Il DOUBLE le bouton de sélection, il ne le remplace pas : un glisser-
  // déposer est inaccessible au clavier et impraticable au lecteur d'écran.
  // Le champ fichier reste donc le chemin nominal, conformément à l'exigence
  // d'accessibilité non négociable du projet (AGENTS.md §6).
  const [dragging, setDragging] = useState(false);

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (uploading) return;
    const file = event.dataTransfer.files?.[0];
    if (file) void handleUpload(file);
  }

  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <legend className="px-1 text-sm font-medium">{legend}</legend>

      {/* Le formulaire parent poste un FormData : la sélection doit exister en
          tant que champ. Caché car pilotée par la grille ci-dessous. */}
      <input type="hidden" name={name} value={value ?? ""} />

      <p className="text-xs text-muted-foreground">
        Facultative. Formats acceptés : JPEG, PNG, WebP, AVIF, GIF, TIFF — 8 Mo
        maximum. L&apos;image est convertie et redimensionnée automatiquement.
      </p>

      {/* AC3 — Le texte alternatif est demandé AVANT le choix du fichier : une
          fois le fichier sélectionné, le téléversement part immédiatement. */}
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
          placeholder="Ex. : page d'accueil du site, vue sur mobile"
          // ⚠️ Identifiant DÉRIVÉ du nom du champ : deux sélecteurs sur une même
          // page (cas possible dès qu'un formulaire porte deux illustrations)
          // partageraient sinon le même `id`, ce qui produit un HTML invalide et
          // fait pointer les deux `aria-describedby` sur le même texte.
          aria-describedby={`${name}-alt-hint`}
          className="rounded-md border border-border bg-background px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        />
        <span id={`${name}-alt-hint`} className="text-xs text-muted-foreground">
          Décrit l&apos;image pour les personnes qui ne la voient pas. Vous
          pourrez le corriger plus tard depuis la bibliothèque d&apos;images.
        </span>
      </label>

      {/* Zone de dépôt. `onDragOver` DOIT appeler preventDefault, sinon le
          navigateur ouvre le fichier au lieu de déclencher `onDrop`.
          Aucun rôle ARIA : ce n'est pas un contrôle interactif au sens
          accessible — le chemin clavier est le bouton qu'elle contient. */}
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!uploading) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`flex flex-wrap items-center gap-3 rounded-md border border-dashed p-4 transition-colors ${
          dragging ? "border-primary bg-primary/5" : "border-border"
        }`}
      >
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
          <input
            ref={fileInputRef}
            type="file"
            // `accept` est un CONFORT de sélection, jamais une sécurité : il
            // filtre la boîte de dialogue et rien d'autre. La validation qui
            // fait foi est côté serveur (AC4).
            accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/tiff"
            className="sr-only"
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleUpload(file);
            }}
          />
          <span>{uploading ? "Téléversement…" : "Téléverser une image"}</span>
        </label>

        {value ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {removeLabel}
          </button>
        ) : null}

        <span className="text-xs text-muted-foreground">
          ou glissez une image ici
        </span>
      </div>

      {/* `role="status"` : le résultat du téléversement est annoncé aux lecteurs
          d'écran, qui ne « voient » pas l'apparition de la vignette. */}
      <p role="status" className="sr-only">
        {uploading ? "Téléversement en cours" : ""}
      </p>

      {uploadError ? (
        <p className="text-sm text-destructive">{uploadError}</p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {selected && !selected.alt ? (
        // AC3 — L'absence de texte alternatif est SIGNALÉE comme un défaut
        // d'accessibilité, sans jamais bloquer l'enregistrement : un champ
        // obligatoire pousserait à saisir n'importe quoi, ce qui est pire.
        <p className="text-sm text-amber-700 dark:text-amber-400">
          ⚠ Cette image n&apos;a pas de texte alternatif : elle sera invisible
          pour les personnes utilisant un lecteur d&apos;écran. Ajoutez-en un
          depuis la bibliothèque d&apos;images.
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : library.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        // Grille de choix en boutons radio : un seul média sélectionnable, et
        // la navigation par flèches est native au clavier (AC5).
        <div
          role="radiogroup"
          aria-label={pickerLabel}
          className="grid grid-cols-3 gap-2 sm:grid-cols-4"
        >
          {library.map((item) => {
            const isSelected = item.id === value;
            return (
              <label
                key={item.id}
                className={`relative cursor-pointer overflow-hidden rounded-md border-2 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background ${
                  isSelected ? "border-primary" : "border-transparent"
                }`}
              >
                <input
                  type="radio"
                  // Groupe de radios DISTINCT par sélecteur : partager le nom
                  // entre deux instances les ferait s'exclure mutuellement,
                  // choisir une illustration désélectionnerait la couverture.
                  name={`${name}-picker`}
                  className="sr-only"
                  checked={isSelected}
                  onChange={() => onChange(item.id)}
                />
                {/* `<img>` et non `next/image` : l'image est DÉJÀ normalisée en
                    WebP et redimensionnée par sharp au téléversement. La
                    repasser dans l'optimiseur de Next la retraiterait sans
                    gain. `width`/`height` explicites suffisent à réserver la
                    place et donc à empêcher la page de sauter (AC2). */}
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
                    // AC3 — Repère visuel dans la grille, pour repérer d'un coup
                    // d'œil les images sans texte alternatif.
                    title="Texte alternatif manquant"
                    className="absolute right-1 top-1 rounded bg-amber-500 px-1 text-xs text-white"
                  >
                    <span aria-hidden="true">⚠</span>
                    <span className="sr-only">Texte alternatif manquant</span>
                  </span>
                ) : null}
              </label>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}
