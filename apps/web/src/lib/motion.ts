"use client";

import { useReducedMotion } from "motion/react";

// Story 6.2 — SOCLE UNIQUE de neutralisation du mouvement (AC1, AC2).
//
// ⚠️ Ce module n'est PAS un hook maison : il ENVELOPPE `useReducedMotion` de
// `motion/react`, déjà installé et déjà utilisé (AboutClient, TestimonialsClient).
// Écrire un `matchMedia` concurrent créerait deux sources de vérité pouvant
// diverger. Le point d'entrée reste donc unique (piège n°2).
//
// Le pendant CSS de ce socle vit dans `globals.css` (`@media (prefers-reduced-motion:
// reduce)`) : il couvre toutes les animations et transitions CSS, délais inclus.
// Ce module-ci couvre ce que le CSS ne peut pas atteindre : les animations
// PILOTÉES EN JS, où l'état initial est posé par le composant lui-même.

/**
 * Vrai quand le visiteur a demandé à réduire les animations.
 *
 * Réexporté sous un nom explicite pour que le socle ait UN point d'entrée
 * nommé, sans masquer son origine (`motion/react`).
 */
export { useReducedMotion };

/**
 * Type d'une paire d'états d'animation `motion` : ce dont on part, ce vers quoi
 * on va.
 */
type MotionStates<T> = {
  /** État de départ — typiquement masquant (`opacity: 0`, `y: 24`). */
  initial: T;
  /** État final — celui qui présente réellement le contenu. */
  animate: T;
};

/**
 * 🛑 LE GARDE-FOU D'AC2 : « le contenu reste présenté dans son état final,
 * jamais masqué ».
 *
 * Le bug classique du reveal au scroll : un composant part de `opacity: 0` et
 * devient visible PAR l'animation. Sous mouvement réduit, si l'animation est
 * neutralisée mais que l'état initial reste appliqué, le contenu est
 * **invisible pour toujours**. La règle CSS ne protège pas de ce cas : l'état
 * initial est posé en JS, pas par une animation.
 *
 * La bonne réponse n'est PAS « appliquer l'état initial puis accélérer la
 * transition », mais **ne pas appliquer l'état initial du tout** : le composant
 * rend directement son état final.
 *
 * C'est ce que fait cette fonction, et c'est pourquoi les stories 6.4-6.18
 * doivent passer par elle plutôt que de tester `shouldReduceMotion` à la main —
 * un oubli redeviendrait un contenu invisible.
 *
 * @example
 * ```tsx
 * const shouldReduceMotion = useReducedMotion();
 * const reveal = resolveMotionStates(shouldReduceMotion, {
 *   initial: { opacity: 0, y: 24 },
 *   animate: { opacity: 1, y: 0 },
 * });
 * // Mouvement réduit : initial === animate === l'état final. Rien n'est masqué.
 * return <motion.div {...reveal} transition={motionTransition(shouldReduceMotion, { duration: 0.5 })} />;
 * ```
 */
export function resolveMotionStates<T>(
  shouldReduceMotion: boolean | null,
  states: MotionStates<T>,
): MotionStates<T> {
  if (shouldReduceMotion) {
    // L'état de départ EST l'état final : il n'y a plus rien à animer, et
    // surtout plus rien qui puisse masquer le contenu.
    return { initial: states.animate, animate: states.animate };
  }

  return states;
}

/**
 * Transition neutralisée sous mouvement réduit.
 *
 * `duration: 0` plutôt qu'une transition absente : `motion` applique alors
 * l'état final immédiatement tout en continuant d'émettre ses évènements de fin
 * (`onAnimationComplete`), pour la même raison que le `0.01ms` du CSS — un
 * composant qui attend la fin de l'animation pour révéler quelque chose ne doit
 * pas rester bloqué.
 */
export function motionTransition<T extends object>(
  shouldReduceMotion: boolean | null,
  transition: T,
): T | { duration: 0 } {
  return shouldReduceMotion ? { duration: 0 } : transition;
}
