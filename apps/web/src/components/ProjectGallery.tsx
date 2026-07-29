"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import { useReducedMotion } from "@/lib/motion";

// GALERIE D'IMAGES d'un projet, avec agrandissement en plein écran.
//
// 🛑 `<dialog>` NATIF plutôt qu'une modale maison, comme `ContactDialog` : le
// navigateur fournit alors le piégeage du focus, la fermeture par `Échap`,
// l'inertie du reste de la page pour les lecteurs d'écran et la restitution du
// focus à la fermeture. Réécrire tout cela à la main est le chemin le plus court
// vers une modale inaccessible (AGENTS.md §6).
//
// ⚠️ CLIENT, et c'est le strict nécessaire : la page de détail reste un Server
// Component qui lit la base ; seule cette vue interactive est cliente. Elle ne
// reçoit que des données déjà résolues (pattern « conteneur serveur → vue
// cliente », déjà appliqué par `ProjectDetailReveal`).
//
// ⚠️ AUCUNE dépendance ajoutée : pas de bibliothèque de lightbox. Le besoin
// (afficher une image en grand, naviguer, fermer) est entièrement couvert par
// `<dialog>` et une poignée d'états.

export type GalleryImage = {
  id: string;
  url: string;
  width: number;
  height: number;
  blurDataUrl: string;
  alt: string | null;
  caption: string | null;
};

type ProjectGalleryProps = {
  images: GalleryImage[];
  /** Titre du projet, pour construire des libellés accessibles explicites. */
  projectTitle: string;
};

export const ProjectGallery = ({
  images,
  projectTitle,
}: ProjectGalleryProps) => {
  // Index de l'image agrandie, ou `null` quand la visionneuse est fermée.
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  // Image plein écran décodée : pilote le fondu d'apparition. Remise à `false` à
  // chaque changement d'image (voir `show` et `step`), sinon la suivante
  // apparaîtrait d'un coup, déjà opaque.
  const [loaded, setLoaded] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const headingId = useId();

  const isOpen = openIndex !== null;
  const current = openIndex === null ? null : (images[openIndex] ?? null);

  // 🛑 `showModal()` et NON l'attribut `open` : seule cette méthode active le
  // comportement modal (focus piégé, `Échap`, inertie de l'arrière-plan). Un
  // `<dialog open>` rendu en JSX n'est qu'une boîte ordinaire.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
      document.documentElement.style.overflow = "hidden";
    } else if (!isOpen && dialog.open) {
      dialog.close();
      document.documentElement.style.overflow = "";
    }
  }, [isOpen]);

  const close = useCallback(() => setOpenIndex(null), []);

  /** Ouvre la visionneuse sur une image donnée. */
  const show = useCallback((index: number) => {
    setLoaded(false);
    setOpenIndex(index);
  }, []);

  /**
   * Navigue dans la visionneuse. L'index BOUCLE : après la dernière image on
   * revient à la première, ce qui évite un cul-de-sac au clavier.
   */
  const step = useCallback(
    (delta: number) => {
      setLoaded(false);
      setOpenIndex((index) => {
        if (index === null) return null;
        return (index + delta + images.length) % images.length;
      });
    },
    [images.length],
  );

  // Navigation au clavier. `Échap` n'est PAS géré ici : `<dialog>` le fait
  // nativement (via l'évènement `close`, écouté plus bas).
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        step(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        step(-1);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, step]);

  if (images.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className="mt-12">
      <h2 id={headingId} className="font-serif text-2xl">
        Galerie
      </h2>

      {/* Grille responsive. Les vignettes gardent un ratio FIXE (`aspect-video`
          + `object-cover`) : c'est ce qui donne une grille régulière malgré des
          images de proportions différentes. L'image entière reste consultable
          en plein écran, où elle n'est jamais rognée. */}
      <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {images.map((image, index) => (
          <li key={image.id} className="flex">
            <button
              type="button"
              onClick={() => show(index)}
              aria-label={`Agrandir l'image ${index + 1} sur ${images.length}${
                image.caption ? ` : ${image.caption}` : ""
              }`}
              className={[
                "group rounded-card focus-visible:outline-accent-from flex w-full flex-col overflow-hidden border border-white/10",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4",
                "transition-colors hover:border-white/25",
              ].join(" ")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.url}
                width={image.width}
                height={image.height}
                alt={image.alt ?? ""}
                loading="lazy"
                className="aspect-video w-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-105"
                style={{
                  backgroundImage: `url(${image.blurDataUrl})`,
                  backgroundSize: "cover",
                }}
              />
              <span className="block flex-1 px-4 py-3 text-left text-sm text-white/60">
                {image.caption ?? "\u00A0"}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {/* VISIONNEUSE. `onClose` couvre TOUTES les fermetures, y compris `Échap`
          géré par le navigateur : sans lui, l'état React resterait « ouvert »
          alors que la boîte est fermée, et un second clic ne rouvrirait rien. */}
      <dialog
        ref={dialogRef}
        onClose={close}
        aria-label={`Galerie du projet ${projectTitle}`}
        // Clic sur l'arrière-plan : `<dialog>` reçoit l'évènement quand on
        // clique en dehors de son contenu (même geste que `ContactDialog`).
        onClick={(event) => {
          if (event.target === dialogRef.current) close();
        }}
        className="bg-surface-sunken/95 fixed inset-0 m-0 h-full max-h-none w-full max-w-none overflow-hidden p-0 text-white backdrop:bg-black/80"
      >
        {current ? (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
              <p className="text-sm text-white/60">
                {/* `openIndex` est non-nul ici (garde `current`). */}
                Image {(openIndex ?? 0) + 1} sur {images.length}
              </p>
              <button
                type="button"
                onClick={close}
                aria-label="Fermer la galerie"
                className="rounded-control focus-visible:outline-accent-from inline-flex size-10 items-center justify-center border border-white/20 text-lg hover:border-white/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>

            <div className="flex min-h-0 flex-1 items-center gap-2 overflow-hidden px-2 sm:gap-4 sm:px-6">
              {images.length > 1 ? (
                <button
                  type="button"
                  onClick={() => step(-1)}
                  aria-label="Image précédente"
                  className="rounded-control focus-visible:outline-accent-from inline-flex size-11 shrink-0 items-center justify-center border border-white/20 text-xl hover:border-white/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
                >
                  <span aria-hidden="true">←</span>
                </button>
              ) : null}

              {/* Conteneur centré qui contraint l'image à ne jamais dépasser
                  la zone disponible : `min-w-0 min-h-0` empêche flex de
                  l'étirer au-delà du viewport. L'image elle-même est limitée
                  à 100 % de ce conteneur dans les deux axes. */}
              <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={current.url}
                  src={current.url}
                  width={current.width}
                  height={current.height}
                  alt={current.alt ?? ""}
                  onLoad={() => setLoaded(true)}
                  className={[
                    "max-h-full max-w-full object-contain",
                    shouldReduceMotion
                      ? ""
                      : `transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`,
                  ].join(" ")}
                  style={{ height: "100%", width: "auto" }}
                />
              </div>

              {images.length > 1 ? (
                <button
                  type="button"
                  onClick={() => step(1)}
                  aria-label="Image suivante"
                  className="rounded-control focus-visible:outline-accent-from inline-flex size-11 shrink-0 items-center justify-center border border-white/20 text-xl hover:border-white/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
                >
                  <span aria-hidden="true">→</span>
                </button>
              ) : null}
            </div>

            {/* La légende est annoncée aux lecteurs d'écran à chaque changement
                d'image (`aria-live`), car seule l'image visible change. */}
            <p
              aria-live="polite"
              className="min-h-12 px-4 py-4 text-center text-sm text-white/70 sm:px-6"
            >
              {current.caption ?? ""}
            </p>
          </div>
        ) : null}
      </dialog>
    </section>
  );
};
