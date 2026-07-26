"use client";

import { useReducedMotion } from "@/lib/motion";
import { useFinePointer } from "@/lib/pointer";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { useEffect, useRef } from "react";

// Story 6.7 (AC1, AC4) — PARALLAXE DES ORBITES AU POINTEUR.
//
// 🛑 CE COMPOSANT ENVELOPPE, IL NE MODIFIE RIEN. `HeroOrbit` compose DÉJÀ trois
// `transform` imbriqués (rotation du conteneur, `animate-spin`, rotation
// inverse de l'icône). Écrire un `transform` de parallaxe sur ces mêmes nœuds
// écraserait les rotations existantes et casserait l'animation d'orbite. Le
// décalage s'applique donc à un conteneur PARENT, et `HeroOrbit` reste
// strictement intact.
//
// 🛑 `pointer-events-none` EST CONSERVÉ SUR LE CONTENEUR ENVELOPPÉ. Les orbites
// couvrent toute la zone d'accueil, CTA compris : si elles captaient le
// pointeur, les deux boutons d'appel à l'action deviendraient incliquables. Ce
// composant n'ajoute aucun nœud interceptant, et le listener vit sur la SECTION,
// pas sur les orbites.
//
// ⚠️ « SANS DONNER LE TOURNIS » EST UN CRITÈRE D'ACCEPTATION, pas une figure de
// style. D'où une amplitude de quelques pixels, un mouvement amorti par ressort,
// aucune rotation 3D — et des amplitudes DIFFÉRENCIÉES par profondeur, qui
// suffisent à créer le relief sans jamais donner l'impression que la page bouge.

/**
 * Amplitude maximale du décalage, en pixels, pour le calque le plus mobile.
 *
 * ⚠️ Volontairement faible : au-delà, l'effet cesse d'être « subtil » (AC1) et
 * les anneaux se décollent visiblement du fond.
 */
const MAX_OFFSET = 14;

/** Ressort commun : lent et très amorti, pour un mouvement qui « suit » sans suivre. */
const SPRING = { stiffness: 90, damping: 22, mass: 0.9 } as const;

type HeroParallaxProps = {
  /**
   * Facteur de profondeur. `1` = calque le plus mobile (au premier plan),
   * les valeurs plus faibles bougent moins et paraissent donc plus loin.
   */
  depth?: number;
  className?: string;
  children: React.ReactNode;
};

/**
 * Décale ses enfants de quelques pixels en réponse au pointeur, dans le sens
 * inverse du geste.
 *
 * Ne rend qu'un `<div>` ordinaire — aucun listener, aucun `transform` — dans les
 * deux cas où l'effet n'a pas lieu d'être : **mouvement réduit** (AC4) et
 * **absence de pointeur fin** (il n'y a pas de survol sur un écran tactile).
 */
export const HeroParallax = ({
  depth = 1,
  className,
  children,
}: HeroParallaxProps) => {
  const shouldReduceMotion = useReducedMotion();
  const hasFinePointer = useFinePointer();

  const ref = useRef<HTMLDivElement>(null);

  // Position du pointeur relativement au centre de la section, dans [-1, 1].
  const ratioX = useMotionValue(0);
  const ratioY = useMotionValue(0);

  const springX = useSpring(ratioX, SPRING);
  const springY = useSpring(ratioY, SPRING);

  const amplitude = MAX_OFFSET * depth;
  // Sens INVERSE du geste : les calques semblent alors se trouver derrière la
  // page, ce qui est l'illusion de profondeur recherchée.
  const x = useTransform(springX, (value) => value * -amplitude);
  const y = useTransform(springY, (value) => value * -amplitude);

  const isActive = !shouldReduceMotion && hasFinePointer;

  useEffect(() => {
    if (!isActive) {
      return;
    }

    // 🛑 AC1 — « quand je déplace ma souris SUR LA ZONE D'ACCUEIL ». L'effet est
    // borné au hero : on écoute la section englobante, pas `window`. Un
    // mouvement de souris au niveau du pied de page ne doit pas agiter les
    // orbites restées en haut.
    const section = ref.current?.closest("section");
    if (!section) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const bounds = section.getBoundingClientRect();
      ratioX.set(
        (event.clientX - (bounds.left + bounds.width / 2)) / (bounds.width / 2),
      );
      ratioY.set(
        (event.clientY - (bounds.top + bounds.height / 2)) /
          (bounds.height / 2),
      );
    };

    // Le pointeur quitte le hero : retour au repos, amorti par le ressort.
    const handlePointerLeave = () => {
      ratioX.set(0);
      ratioY.set(0);
    };

    section.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
    section.addEventListener("pointerleave", handlePointerLeave);

    return () => {
      section.removeEventListener("pointermove", handlePointerMove);
      section.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, [isActive, ratioX, ratioY]);

  if (!isActive) {
    return (
      <div ref={ref} className={className}>
        {children}
      </div>
    );
  }

  return (
    <motion.div ref={ref} className={className} style={{ x, y }}>
      {children}
    </motion.div>
  );
};
