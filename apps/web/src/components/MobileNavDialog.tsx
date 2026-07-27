"use client";

import { useScrollLock } from "@/lib/use-scroll-lock";
import { useEffect, useRef } from "react";
import { twMerge } from "tailwind-merge";

// Menu de navigation MOBILE (retour Jeevons, 27/07 : « faut trouver une solution
// pour le header quand on est format petit écran, c'est pas propre du tout »).
//
// ⚠️ LE PROBLÈME EXACT, tel que la capture le montre : la pilule de navigation
// est `w-full`, donc elle s'étire sur toute la largeur ; « À propos » passe sur
// deux lignes, ce qui déforme les pastilles d'état en ovales et fait déborder
// « Contact » du bord arrondi. Cinq entrées ne tiennent pas sur une ligne à
// 375 px — aucun ajustement d'espacement ne rattrape cela, il fallait changer de
// forme sous ce seuil.
//
// 🛑 CE COMPOSANT EST BÂTI SUR `<dialog>` + `showModal()`, EXACTEMENT COMME
// `ContactDialog`, ET C'EST LE CŒUR DE LA DÉCISION. Un menu mobile fait main
// impose de réimplémenter, correctement, quatre choses que le natif donne
// gratuitement :
//
//   1. le PIÈGE À FOCUS (le Tab ne doit pas s'échapper vers la page derrière) ;
//   2. la fermeture à `Échap` ;
//   3. l'INERTIE de l'arrière-plan (rien derrière ne reste cliquable) ;
//   4. la promotion en TOP LAYER — le panneau passe au-dessus de TOUT, y
//      compris des `z-index` élevés, sans entrer dans une course aux valeurs.
//
// ❌ Ne pas remplacer par un `<div>` conditionnel avec `useState` : ce serait
// perdre les quatre d'un coup, dont deux sont des exigences d'accessibilité.
// ❌ Ne pas non plus rendre `<dialog open>` en JSX : l'attribut seul donne une
// boîte ordinaire, SANS aucun de ces comportements. Seule la méthode compte.

export type MobileNavItem = {
  id: string;
  href: string;
  label: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  items: MobileNavItem[];
  activeNavId: string | null;
  /** `aria-controls` du bouton qui ouvre ce panneau. */
  id: string;
};

export const MobileNavDialog = ({
  open,
  onClose,
  items,
  activeNavId,
  id,
}: Props) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  // Le défilement de la page est gelé pendant l'ouverture — `showModal()` ne
  // s'en charge pas (voir le hook, partagé avec `ContactDialog`).
  useScrollLock(open);

  return (
    <dialog
      ref={dialogRef}
      id={id}
      aria-label="Navigation principale"
      // 🛑 `onClose` COUVRE TOUTES LES FERMETURES, y compris celles que ce
      // composant ne déclenche pas lui-même : `Échap` est géré par le
      // navigateur, et sans cette remontée l'état React resterait bloqué sur
      // « ouvert » — le bouton ne rouvrirait plus rien.
      onClose={onClose}
      // Fermeture au clic sur le fond. La cible est le `<dialog>` LUI-MÊME
      // (son `::backdrop` ne reçoit pas d'évènement) : on ne ferme donc que si
      // le clic n'a pas atterri sur le panneau intérieur.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className={twMerge(
        "m-0 w-full max-w-none border-0 bg-transparent p-0",
        "backdrop:bg-black/80 backdrop:backdrop-blur-sm",
      )}
    >
      {/* Le panneau. `mt-3` l'aligne sur la position du header fermé, pour que
          l'ouverture se lise comme un dépliage et non comme une apparition. */}
      <div className="mx-3 mt-3 rounded-card border border-white/15 bg-surface-raised/95 p-2 shadow-2xl shadow-black/60 backdrop-blur-xl">
        <nav aria-label="Navigation principale">
          <ul className="flex flex-col gap-1">
            {items.map((item) => {
              const isActive = activeNavId === item.id;
              const isCta = item.id === "contact";

              return (
                <li key={item.id}>
                  <a
                    href={item.href}
                    // 🛑 FERMER AU CLIC SUR UN LIEN. Ces liens sont des ancres :
                    // la page ne se recharge pas, donc rien ne démonterait le
                    // panneau — il resterait ouvert PAR-DESSUS la section qu'on
                    // vient de demander, en masquant précisément ce qu'on
                    // voulait voir.
                    onClick={onClose}
                    aria-current={isActive ? "location" : undefined}
                    className={twMerge(
                      // Cible tactile confortable : `py-3` + `text-base` place
                      // la hauteur au-delà des 44 px recommandés, alors que la
                      // pilule de bureau vise la compacité.
                      "block rounded-control px-4 py-3 text-base font-semibold transition-colors duration-200",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                      isCta
                        ? "bg-white text-surface hover:bg-white/80"
                        : "text-white/70 hover:bg-white/10 hover:text-white",
                      // Même règle qu'au format bureau : l'état actif ne repose
                      // PAS sur la seule couleur (fond + graisse survivent à un
                      // rendu en niveaux de gris).
                      !isCta && isActive && "bg-white/20 font-bold text-white",
                    )}
                  >
                    {item.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </dialog>
  );
};
