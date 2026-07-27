"use client";

import { useCallback, useSyncExternalStore } from "react";

// Story 6.6 (AC3) — DÉTECTION DE LA CAPACITÉ DE POINTAGE, point d'entrée unique.
//
// 🛑 POURQUOI PAS UNE DÉTECTION PAR LARGEUR D'ÉCRAN (`md:`). AC3 parle d'écran
// TACTILE, pas de petit écran : un laptop tactile est large, une tablette en
// paysage aussi. Un point d'arrêt Tailwind répondrait à la mauvaise question.
// La seule question pertinente est « ce visiteur dispose-t-il d'un pointeur
// précis capable de survoler ? », et le média `(hover: hover) and (pointer:
// fine)` la pose exactement.
//
// ⚠️ CE MODULE EST LE PENDANT DE `lib/motion.ts` POUR LE POINTEUR : un seul
// `matchMedia` pour tout le site, plutôt qu'une copie par composant qui
// finirait par diverger.

/** Le média qui décrit « un pointeur précis, capable de survoler ». */
const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)";

/**
 * Vrai quand le visiteur dispose d'un pointeur précis capable de survoler
 * (souris, trackpad), faux sur écran tactile.
 *
 * 🛑 LE DÉFAUT EST `false`, ET C'EST LE CŒUR D'AC3.
 *
 * Au rendu serveur, aucune media query n'est évaluable — il n'y a pas de
 * fenêtre. Partir de `true` puis corriger après hydratation ferait apparaître un
 * curseur fantôme pendant une fraction de seconde sur chaque mobile, avant
 * qu'il ne disparaisse. On part donc de « effet désactivé » et on n'active
 * qu'après montage : le pire cas est un effet décoratif qui arrive une frame
 * plus tard, jamais un artefact visible là où il ne devrait pas être.
 *
 * ⚠️ RÉACTIF, comme `useReducedMotion` : brancher une souris sur une tablette
 * (ou basculer en émulation tactile dans les outils de développement) met la
 * valeur à jour sans rechargement.
 *
 * ⚠️ POURQUOI `useSyncExternalStore` ET NON `useState` + `useEffect`. Une media
 * query EST un système externe : `useSyncExternalStore` est l'outil prévu pour
 * s'y abonner. Il évite surtout le rendu en cascade d'un `setState` appelé
 * pendant l'effet de montage (règle `react-hooks/set-state-in-effect`), et son
 * instantané serveur dédié rend le défaut `false` explicite au lieu d'être un
 * état initial qu'un effet vient corriger juste après.
 */
export function useFinePointer(): boolean {
  const subscribe = useCallback((onStoreChange: () => void) => {
    const query = window.matchMedia(FINE_POINTER_QUERY);
    query.addEventListener("change", onStoreChange);
    return () => query.removeEventListener("change", onStoreChange);
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Valeur courante côté navigateur. */
function getSnapshot(): boolean {
  return window.matchMedia(FINE_POINTER_QUERY).matches;
}

/**
 * Valeur au rendu serveur : toujours `false`.
 *
 * 🛑 C'est le « défaut désactivé » d'AC3, ici rendu structurel : React utilise
 * cet instantané pour le HTML serveur ET pour le premier rendu client, ce qui
 * garantit l'absence de divergence d'hydratation en même temps que l'absence de
 * curseur fantôme.
 */
function getServerSnapshot(): boolean {
  return false;
}
