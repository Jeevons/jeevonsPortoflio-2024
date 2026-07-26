"use client";

import { motionTransition, useReducedMotion } from "@/lib/motion";
import { motion } from "motion/react";
import { useLayoutEffect, useRef, useState } from "react";

// Story 6.4 (AC1, AC2, AC3, AC4) — RÉVÉLATION AU DÉFILEMENT, composant unique.
//
// ⚠️ POURQUOI UN SEUL COMPOSANT CLIENT, enveloppé par des sections SERVEUR.
//
// Les sections publiques sont des Server Components `async` qui lisent la base
// (`Projects.tsx`, `About.tsx`, `Contact.tsx`…). Y ajouter `"use client"`
// casserait la lecture serveur et l'ISR de la story 4.4. React permet à un
// composant serveur de passer des enfants SERVEUR à un composant client via
// `children` : les enfants restent rendus côté serveur, seule l'enveloppe est
// cliente. C'est le pattern « conteneur serveur → vue cliente » déjà en place
// (`About`/`AboutClient`), appliqué ici à l'animation.
//
// ⚠️ POURQUOI `whileInView` DE `motion` ET NON UN `IntersectionObserver` MAISON.
//
// `whileInView` encapsule `IntersectionObserver` — asynchrone et hors du thread
// de composition, l'outil prévu pour ce besoin (PLAN §4.2) — et `viewport.once`
// se charge du `unobserve` après révélation : la révélation est DÉFINITIVE, on
// ne ré-anime pas en remontant. Aucune dépendance ajoutée (AGENTS.md §9) :
// `motion` v12 est déjà utilisé par `AboutClient` et `TestimonialsClient`.
//
// ⚠️ N'ANIME QUE `opacity` ET `transform` (AC4) : seules ces deux propriétés
// sont composées par le GPU sans déclencher layout/paint. Animer `height`,
// `top`, `margin` ou `filter` sur des dizaines d'éléments est la cause directe
// d'un défilement saccadé sur appareil modeste.

/**
 * Décalage vertical de départ, en pixels. Volontairement discret : la story
 * demande « avec fluidité », pas un mouvement spectaculaire.
 */
const OFFSET_Y = 24;

/** Durée de la révélation, en secondes. */
const DURATION = 0.5;

/**
 * Pas de la cascade, en secondes (~60 ms).
 *
 * ⚠️ Volontairement court : 100 ms × 10 éléments = 1 seconde d'attente avant le
 * dernier, ce qui est perçu comme de la lenteur et non comme du raffinement.
 */
const STAGGER_STEP = 0.06;

/**
 * Plafond du retard cumulé, en secondes.
 *
 * ⚠️ Sans plafond, une liste longue rendrait ses derniers éléments après un
 * délai arbitrairement grand. Au-delà de ce seuil, tous les éléments partagent
 * le même retard.
 */
const STAGGER_MAX = 0.3;

type RevealProps = {
  children: React.ReactNode;
  /**
   * Rang de l'élément dans sa liste, pour la cascade (AC1). Absent ou `0` : pas
   * de retard. Le retard est plafonné à {@link STAGGER_MAX}.
   */
  index?: number;
  className?: string;
  style?: React.CSSProperties;
  /**
   * Balise rendue. `div` par défaut.
   *
   * ⚠️ Sert à ne pas insérer un `<div>` là où le parent attend une structure
   * précise (un `<li>` dans une `<ul>`, par exemple) : un élément intercalé
   * illégal casserait la sémantique lue par les lecteurs d'écran.
   */
  as?: "div" | "li" | "span";
  /**
   * Révéler en fondu SEUL, sans déplacement vertical.
   *
   * 🛑 EXISTE POUR LES CARTES `sticky` DE `ProjectList` (piège n°2). Vérifié à
   * la sonde : avec `y`, `motion` écrit un `transform` sur l'élément — et un
   * `transform` sur un élément `sticky` crée un containing block pour ses
   * descendants tout en se combinant mal avec le repositionnement opéré par le
   * navigateur pendant le défilement. L'empilement des cartes projet est la
   * signature visuelle de la section : on renonce au déplacement là, plutôt que
   * de risquer l'effet.
   */
  fadeOnly?: boolean;
};

/**
 * Révèle ses enfants (fondu + léger déplacement) à leur entrée dans la zone
 * visible.
 *
 * 🛑 AMÉLIORATION PROGRESSIVE — la règle qui gouverne tout ce fichier : si quoi
 * que ce soit échoue, le contenu doit rester VISIBLE. Une révélation ratée ne
 * dégrade pas l'expérience, elle SUPPRIME le contenu. Trois chemins mènent à la
 * page blanche, tous traités ici :
 *
 * 1. **JavaScript absent ou en échec** — vérifié à la sonde : un
 *    `initial={{ opacity: 0 }}` est SÉRIALISÉ DANS LE HTML
 *    (`style="opacity:0;transform:translateY(24px)"`). Le site étant en SSR/ISR,
 *    le HTML est servi complet : le masquer par défaut le rendrait invisible
 *    pour toujours sans JS. D'où `initial={false}` au rendu serveur — le HTML
 *    part propre, sans style masquant.
 * 2. **Mouvement réduit** (AC3) — la règle CSS de la story 6.2 accélère les
 *    animations mais ne retire pas un état initial posé en JS. On n'applique
 *    donc PAS l'état masquant du tout : le contenu est rendu directement dans
 *    son état final (voir `src/lib/motion.ts`).
 * 3. **Arrivée directe sur une ancre** (AC2) — traité par `hasEntered`
 *    ci-dessous.
 */
export const Reveal = ({
  children,
  index = 0,
  className,
  style,
  as = "div",
  fadeOnly = false,
}: RevealProps) => {
  const shouldReduceMotion = useReducedMotion();
  const ref = useRef<HTMLElement>(null);

  // `armed` : l'état masquant est-il autorisé ? Faux au rendu serveur ET au
  // premier rendu client (l'hydratation doit produire le MÊME html, sinon React
  // signale une divergence). Il ne passe à vrai qu'après la mesure ci-dessous.
  const [armed, setArmed] = useState(false);

  // AC2 — « le contenu visible est déjà révélé, sans attendre un défilement ».
  //
  // ⚠️ POURQUOI CE N'EST PAS GRATUIT. `whileInView` révèle bien un élément déjà
  // intersectant, mais seulement après hydratation : entre-temps, l'état
  // masquant nouvellement appliqué ferait DISPARAÎTRE puis réapparaître un
  // contenu déjà lu par le visiteur. Sur une arrivée en `#about`, c'est un
  // clignotement sur tout l'écran.
  //
  // On mesure donc la position AVANT peinture (`useLayoutEffect`) : ce qui est
  // déjà à l'écran ne sera jamais masqué, et n'a plus rien à animer.
  const hasEntered = useRef(false);

  useLayoutEffect(() => {
    // Sous mouvement réduit, rien ne doit être masqué : on n'arme pas.
    if (shouldReduceMotion) {
      return;
    }

    const node = ref.current;
    if (node) {
      const { top } = node.getBoundingClientRect();
      // Déjà dans la zone visible (ou au-dessus) : on le laisse tel quel.
      if (top < window.innerHeight) {
        hasEntered.current = true;
        return;
      }
    }

    setArmed(true);
  }, [shouldReduceMotion]);

  const MotionTag = motion[as];

  // La cascade s'ajoute au retard, plafonnée (AC1, « légèrement décalés »).
  const delay = Math.min(index * STAGGER_STEP, STAGGER_MAX);

  return (
    <MotionTag
      // `as` est contraint aux trois balises ci-dessus ; le `ref` de `motion`
      // est typé par balise, d'où cette réconciliation locale.
      ref={ref as React.Ref<never>}
      className={className}
      style={style}
      // 🛑 LE POINT CRITIQUE : `false` tant qu'on n'est pas armé. `motion`
      // n'émet alors AUCUN style inline (sonde : `<div>CONTENU</div>`), donc
      // rien ne peut masquer le contenu — ni sans JS, ni sous mouvement réduit,
      // ni sur une arrivée en milieu de page.
      initial={
        armed
          ? fadeOnly
            ? { opacity: 0 }
            : { opacity: 0, y: OFFSET_Y }
          : false
      }
      whileInView={fadeOnly ? { opacity: 1 } : { opacity: 1, y: 0 }}
      // `once` : la révélation est définitive et l'observation est libérée
      // derrière (AC4). La marge négative attend que l'élément soit franchement
      // entré, plutôt que de se déclencher sur son premier pixel.
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={motionTransition(shouldReduceMotion, {
        duration: DURATION,
        delay,
        // `as const` : sans lui, `ease` est inféré comme `string`, que le type
        // `Easing` de `motion` refuse.
        ease: "easeOut" as const,
      })}
    >
      {children}
    </MotionTag>
  );
};
