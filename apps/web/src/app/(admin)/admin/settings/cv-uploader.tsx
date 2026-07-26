"use client";

import { useRef, useState } from "react";

// Story 5.17 — TÉLÉVERSEMENT du CV (AC1, AC2, AC3), sur l'écran des réglages.
//
// ⚠️ Contrairement à `MediaSelector` (5.12/5.14, formulaire de texte piloté par
// `useActionState`), le CV n'a ni bibliothèque à choisir ni formulaire texte
// parent : un seul CV existe à la fois (« courant »), l'upload PRODUIT son
// effet immédiatement (nouvelle référence enregistrée en base, `revalidateTag`
// côté serveur), il n'attend pas un « Enregistrer » global. D'où un composant
// dédié, plus simple que `MediaSelector`, plutôt qu'une réutilisation forcée.

export type CurrentCvView = {
  thumbnailUrl: string;
  thumbnailWidth: number;
  thumbnailHeight: number;
} | null;

export function CvUploader({
  initialCv,
  cvUrl,
}: {
  initialCv: CurrentCvView;
  /** URL PUBLIQUE stable du CV (AC2) — jamais recalculée après upload. */
  cvUrl: string;
}) {
  const [current, setCurrent] = useState(initialCv);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justUploaded, setJustUploaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File) {
    setUploading(true);
    setError(null);
    setJustUploaded(false);

    const body = new FormData();
    body.append("file", file);

    try {
      const response = await fetch("/api/admin/cv", { method: "POST", body });
      const data = (await response.json()) as {
        cv?: {
          thumbnailPath: string;
          thumbnailWidth: number;
          thumbnailHeight: number;
        };
        error?: string;
      };

      if (!response.ok || !data.cv) {
        // AC3 — message SERVEUR, qui nomme la cause réelle (non-PDF, trop lourd).
        setError(data.error ?? "Le téléversement a échoué.");
        return;
      }

      // Nouveau chemin de vignette (piège n°2 : chaque upload produit un
      // fichier neuf) : on affiche directement la réponse du serveur, jamais
      // l'ancienne vignette en cache.
      setCurrent({
        thumbnailUrl: `/api/media/${data.cv.thumbnailPath}`,
        thumbnailWidth: data.cv.thumbnailWidth,
        thumbnailHeight: data.cv.thumbnailHeight,
      });
      setJustUploaded(true);
    } catch {
      setError("Le téléversement a échoué. Vérifiez votre connexion.");
    } finally {
      setUploading(false);
      // Sans cette réinitialisation, re-choisir LE MÊME fichier après une
      // erreur ne déclencherait aucun évènement `change` (même piège que 5.12).
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <legend className="px-1 text-sm font-medium">CV</legend>

      <p className="text-xs text-muted-foreground">
        Téléversez un PDF pour qu&apos;il devienne la version affichée aux
        visiteurs. Le lien de téléchargement ne change jamais, quel que soit le
        nombre de mises à jour.
      </p>

      <div className="flex flex-wrap items-center gap-3 rounded-md border border-dashed border-border p-4">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
          <input
            ref={fileInputRef}
            type="file"
            // Confort de sélection seulement — la validation qui fait foi est
            // côté serveur (AC3, magic bytes `%PDF-`).
            accept="application/pdf"
            className="sr-only"
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleUpload(file);
            }}
          />
          <span>
            {uploading
              ? "Téléversement…"
              : current
                ? "Remplacer le CV"
                : "Téléverser un CV"}
          </span>
        </label>

        {current ? (
          <a
            href={cvUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm underline underline-offset-4 hover:text-foreground"
          >
            Voir le CV actuel
          </a>
        ) : (
          <span className="text-sm text-muted-foreground">
            Aucun CV en ligne pour le moment.
          </span>
        )}
      </div>

      <p role="status" className="sr-only">
        {uploading ? "Téléversement en cours" : ""}
      </p>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {justUploaded && !error ? (
        <p role="status" className="text-sm text-foreground">
          CV mis à jour. Déjà visible sur le site public.
        </p>
      ) : null}

      {current ? (
        // `<img>` : la vignette est déjà normalisée en WebP par sharp au
        // téléversement (comme les covers, 5.12) — la repasser dans
        // l'optimiseur de Next la retraiterait sans gain.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={current.thumbnailUrl}
          alt="Aperçu de la première page du CV"
          width={current.thumbnailWidth}
          height={current.thumbnailHeight}
          className="h-40 w-auto rounded-md border border-border object-contain"
        />
      ) : null}
    </fieldset>
  );
}
