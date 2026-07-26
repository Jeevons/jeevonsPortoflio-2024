"use client";

import { useReducedMotion } from "@/lib/motion";
import { motion, useScroll, useSpring } from "motion/react";

// Story 6.5 (AC1, AC5) — BARRE DE PROGRESSION DE LECTURE.
//
// ⚠️ POURQUOI `useScroll` DE `motion` ET NON UN LISTENER `scroll`.
//
// Un `window.addEventListener("scroll", …)` qui lit `scrollY` à chaque évènement
// provoque du layout thrashing : c'est la cause classique d'un défilement
// saccadé, soit l'inverse exact de l'effet recherché. `useScroll` de `motion`
// (déjà installé — zéro dépendance, AGENTS.md §9) expose `scrollYProgress`, une
// valeur 0→1 appliquée en `scaleX`, donc composée par le GPU sans layout ni
// paint (piège n°4).

export const ScrollProgress = () => {
  const shouldReduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();

  // Le ressort lisse la progression : sans lui, la barre saute d'un cran à
  // chaque évènement de défilement.
  const smoothed = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    restDelta: 0.001,
  });

  // 🛑 AC5 — « la barre s'actualise SANS transition animée », et non « la barre
  // disparaît ». On retire le LISSAGE, pas la fonction : sous mouvement réduit
  // la barre suit toujours la progression, mais en prise directe, sans
  // interpolation. C'est la distinction que le socle 6.2 impose : neutraliser
  // l'animation, jamais l'information.
  const scaleX = shouldReduceMotion ? scrollYProgress : smoothed;

  return (
    <motion.div
      // `aria-hidden` assumé : la progression de lecture est une aide VISUELLE
      // redondante. Un lecteur d'écran annonce déjà sa position par la structure
      // des titres et des repères ; annoncer un pourcentage qui change en
      // continu serait un flux ininterrompu et inutilisable.
      aria-hidden="true"
      // `origin-left` : la barre grandit depuis la gauche. `z-20` la place
      // au-dessus du header (`z-10`) et des cartes `sticky` de `ProjectList`
      // (dont `Card` ne pose qu'un `z-0`) — vérifié : aucune carte ne peut la
      // recouvrir (piège n°5).
      className="bg-gradient-accent fixed inset-x-0 top-0 z-20 h-1 origin-left"
      style={{ scaleX }}
    />
  );
};
