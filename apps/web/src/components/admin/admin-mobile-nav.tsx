"use client";

import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";

import { AdminNav } from "@/components/admin/admin-nav";
import { useScrollLock } from "@/lib/use-scroll-lock";
import { cn } from "@/lib/utils";

// Menu MOBILE du back-office (retour Jeevons, 28/07 : « en format petit écran
// au lieu de passer dans un menu mobile tous les liens de la sidebar admin se
// mettent en haut de l'écran »).
//
// ⚠️ LE PROBLÈME EXACT : la coquille 5.7 empilait la barre latérale AU-DESSUS du
// contenu sous `lg` (`flex-col lg:flex-row`), en assumant explicitement ce choix
// (« sans introduire un menu burger, hors périmètre de cette story »). Avec neuf
// entrées, cela pousse le contenu réel de la page hors de l'écran : sur un
// téléphone, on arrive sur une page admin et on ne voit QUE la navigation.
//
// 🛑 BÂTI SUR `<dialog>` + `showModal()`, comme `MobileNavDialog` et
// `ContactDialog`. Même raisonnement, non négociable : le natif fournit le piège
// à focus, la fermeture à `Échap`, l'inertie de l'arrière-plan et la promotion
// en top layer. Un `<div>` conditionnel perdrait les quatre, dont deux sont des
// exigences d'accessibilité (AGENTS.md §6).
//
// ❌ Ne pas rendre `<dialog open>` en JSX : l'attribut seul donne une boîte
// ordinaire, SANS ces comportements. Seule la méthode `showModal()` compte.

export function AdminMobileNav() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  // `showModal()` rend l'arrière-plan inerte mais ne bloque PAS la molette :
  // le verrou est à poser à la main (hook partagé avec le site public).
  useScrollLock(open);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="admin-mobile-nav"
        className={cn(
          "inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium",
          "transition-colors hover:bg-accent/50",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
      >
        <Menu aria-hidden className="size-4 shrink-0" />
        Menu
      </button>

      <dialog
        ref={dialogRef}
        id="admin-mobile-nav"
        aria-label="Navigation de l'administration"
        // 🛑 `onClose` couvre TOUTES les fermetures, y compris `Échap` géré par
        // le navigateur : sans cette remontée l'état React resterait bloqué sur
        // « ouvert » et le bouton ne rouvrirait plus rien.
        onClose={() => setOpen(false)}
        // Clic sur le fond. La cible testée est le `<dialog>` LUI-MÊME (son
        // `::backdrop` ne reçoit pas d'évènement) : on ne ferme donc que si le
        // clic n'a pas atterri sur le panneau intérieur.
        onClick={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}
        className="m-0 h-full max-h-none w-full max-w-none border-0 bg-transparent p-0 backdrop:bg-black/70"
      >
        {/* Tiroir calé à gauche, comme la barre latérale qu'il remplace :
            l'ouverture se lit comme un dépliage de cette barre, et non comme une
            apparition sans origine. `h-full` + `overflow-y-auto` : neuf entrées
            défilent DANS le tiroir plutôt que d'en déborder sur un écran bas. */}
        <div className="flex h-full w-[min(18rem,calc(100vw-3rem))] flex-col gap-6 overflow-y-auto border-r border-border bg-card p-4 shadow-2xl shadow-black/50">
          <div className="flex items-start justify-between gap-4">
            <span className="text-sm font-semibold">Administration</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={cn(
                "-mr-1 -mt-1 rounded-md p-1 text-muted-foreground",
                "transition-colors hover:bg-accent/50 hover:text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              )}
            >
              <X aria-hidden className="size-5 shrink-0" />
              <span className="sr-only">Fermer le menu</span>
            </button>
          </div>

          <AdminNav onNavigate={() => setOpen(false)} />
        </div>
      </dialog>
    </>
  );
}
