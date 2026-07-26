"use client";

import { motionTransition, useReducedMotion } from "@/lib/motion";
import { motion } from "motion/react";

// Story 6.10 (AC6) — TRANSITION D'ENTRÉE DE LA FICHE PROJET.
//
// 🛑 POURQUOI PAS `ViewTransition` DE NEXT 16. L'API React est derrière
// `experimental.viewTransition`, qui vaut `false` par défaut : l'utiliser
// imposerait de modifier `next.config.mjs` — un fichier sensible qui porte le
// loader `@svgr/webpack` (le projet reste délibérément sur webpack, story 3.3)
// et `outputFileTracingIncludes` pour `pdf-to-img` (story 5.17). Une régression
// y casse le build de production ou l'upload de CV.
//
// ✅ AC6 est QUALITATIF : « fluide plutôt qu'abrupte », sans exigence de
// technologie. Une transition d'entrée sobre le satisfait sans toucher à la
// configuration, et sans dépendre d'un drapeau expérimental ni du support
// inégal de la CSS View Transitions API.
//
// 🛑 SOUS MOUVEMENT RÉDUIT, LA NAVIGATION DOIT ÊTRE « IMMÉDIATE », pas
// « plus rapide ». On ne rend alors AUCUN `motion.div` : le contenu est là,
// dans son état final, sans animation à neutraliser. La règle CSS globale de la
// story 6.2 ne suffirait pas seule — elle ne traite que les transitions et
// animations CSS, pas un état initial posé en JavaScript.
//
// ⚠️ Ce composant enveloppe des enfants SERVEUR : la page reste un Server
// Component `async` qui lit la base, seule l'enveloppe est cliente (pattern
// « conteneur serveur → vue cliente », déjà en place avec `Reveal`).

/** Décalage vertical de départ, en pixels. Volontairement discret. */
const OFFSET_Y = 16;

/** Durée de la transition, en secondes. */
const DURATION = 0.4;

export const ProjectDetailReveal = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <>{children}</>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: OFFSET_Y }}
      animate={{ opacity: 1, y: 0 }}
      transition={motionTransition(shouldReduceMotion, {
        duration: DURATION,
        ease: "easeOut" as const,
      })}
    >
      {children}
    </motion.div>
  );
};
