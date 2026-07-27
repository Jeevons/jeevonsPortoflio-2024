"use client";

import { useEffect } from "react";

/**
 * Gèle le défilement de la page tant que `locked` est vrai.
 *
 * 🛑 POURQUOI CE HOOK EXISTE ALORS QUE `showModal()` EST DÉJÀ UTILISÉ. Une
 * `<dialog>` modale rend l'arrière-plan INERTE — plus aucun clic ni focus ne
 * l'atteint — mais elle ne bloque PAS la molette : la page continue de défiler
 * derrière. C'est le comportement natif, à corriger à la main.
 *
 * ⚠️ `overflow: hidden` SEUL DÉCALE TOUTE LA PAGE. Là où la barre de défilement
 * occupe de la place (Windows, Linux, macOS réglé pour l'afficher en
 * permanence), la masquer élargit la page de sa largeur : tout saute
 * latéralement à l'ouverture. La largeur réelle est donc mesurée puis compensée
 * en padding — et vaut 0 là où la barre est en superposition (macOS par défaut).
 *
 * ⚠️ LES ÉLÉMENTS `fixed` NE SONT PAS COUVERTS PAR CE PADDING : ils se
 * dimensionnent sur le VIEWPORT, pas sur le `body`. D'où `--scrollbar-compensation`,
 * posée sur `<html>` le temps du verrou, que le `Header` (`fixed w-full`)
 * consomme — sans elle il serait le seul élément à sauter, d'autant plus visible
 * qu'il est en haut de l'écran.
 *
 * Extrait de `ContactDialog` (27/07) pour être partagé avec le menu mobile du
 * `Header` : deux implémentations du même verrou finiraient par diverger, et
 * surtout par se marcher dessus si les deux venaient à s'ouvrir.
 */
export function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;

    const { body, documentElement } = document;
    const scrollbarWidth = window.innerWidth - documentElement.clientWidth;

    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;

    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      // ⚠️ On ADDITIONNE au padding calculé plutôt que d'écraser : le `body`
      // pourrait en porter un venant de la feuille de style.
      const currentPadding = parseFloat(
        window.getComputedStyle(body).paddingRight,
      );
      body.style.paddingRight = `${currentPadding + scrollbarWidth}px`;
      documentElement.style.setProperty(
        "--scrollbar-compensation",
        `${scrollbarWidth}px`,
      );
    }

    // Le nettoyage restaure les valeurs EN LIGNE d'origine — une chaîne vide
    // rendant simplement la main à la feuille de style.
    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
      documentElement.style.removeProperty("--scrollbar-compensation");
    };
  }, [locked]);
}
