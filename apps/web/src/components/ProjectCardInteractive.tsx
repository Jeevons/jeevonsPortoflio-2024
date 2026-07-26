"use client";

import { ProjectCard, type ProjectCardData } from "@/components/ProjectCard";
import { useReducedMotion } from "@/lib/motion";
import { useFinePointer } from "@/lib/pointer";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { useRef } from "react";

// Story 6.8 (AC1, AC2, AC4) — INCLINAISON 3D ET HALO SUIVANT LE POINTEUR.
//
// 🛑 LA RÉGRESSION LA PLUS PROBABLE DE CETTE STORY NE SE VOIT PAS AU SURVOL.
//
// Les cartes sont `sticky` et s'empilent en défilant : c'est la signature
// visuelle de la section. Or `transform` (et `perspective`) sur un ANCÊTRE d'un
// élément `sticky` en change le bloc englobant et NEUTRALISE l'adhérence. Un
// test de survol ne révèle rien — il faut faire défiler pour s'en apercevoir.
//
// ✅ D'OÙ LA STRUCTURE RETENUE : ce composant n'ajoute AUCUN nœud enveloppant.
// Il transmet ses `transform` au nœud QUI PORTE DÉJÀ `sticky` (la racine de
// `Card`, à qui `ProjectList` passe la classe). Un élément peut parfaitement
// être `sticky` ET porter un `transform` : ce qui casse l'adhérence, c'est un
// `transform` sur un ANCÊTRE, jamais sur l'élément lui-même. La `perspective`
// est donc exprimée DANS la même déclaration `transform` que les rotations,
// plutôt que sur un parent qui n'existe pas.
//
// ⚠️ LES DEUX OPTIONS PROPOSÉES PAR LA STORY ONT ÉTÉ ÉCARTÉES, chacune parce
// qu'elle sacrifie une décision déjà prise :
//   1. « Envelopper dans un conteneur client » — l'enveloppe devient l'ancêtre
//      du `sticky` et porte la `perspective` : empilement cassé. Déplacer
//      `sticky` sur l'enveloppe est l'autre voie, mais la story 6.4 l'a
//      explicitement écartée par écrit (`ProjectList.tsx`, cas (b)) : cela
//      insère un niveau d'empilement entre le conteneur et le `relative z-0` de
//      `Card`, et l'ordre de superposition des cartes qui se chevauchent peut
//      changer.
//   2. « Rendre `ProjectCard` client » — casse la décision 5.9, écrite noir sur
//      blanc dans le fichier (« AUCUN `"use client"` ici, et c'est délibéré »),
//      et ferait basculer le rendu de la carte côté client sur le site public.
//
// ✅ `ProjectCard` reste donc une VUE PURE SERVEUR, et l'aperçu admin
// (`project-preview.tsx`) continue de l'importer NU — sans tilt ni halo, ce qui
// est cohérent : un aperçu statique n'a pas à s'incliner.

/** Inclinaison maximale sur chaque axe, en degrés. */
const MAX_TILT = 6;

/**
 * Distance de perspective, en pixels.
 *
 * ⚠️ Exprimée dans la fonction `transform` (et non en propriété `perspective`
 * sur un parent) : voir l'en-tête. Plus la valeur est GRANDE, plus l'effet est
 * discret — 1000px donne du relief sans déformer les angles de la carte.
 */
const PERSPECTIVE = 1000;

/** Ressort du retour au repos — AC2 : « revient sans à-coup ». */
const SPRING = { stiffness: 150, damping: 20, mass: 0.8 } as const;

type ProjectCardInteractiveProps = {
  project: ProjectCardData;
  className?: string;
  style?: React.CSSProperties;
};

/**
 * Enrobe `ProjectCard` d'une inclinaison 3D et d'un halo suivant le pointeur.
 *
 * Rend la carte STRICTEMENT telle quelle — mêmes classes, même style, aucun
 * nœud supplémentaire — dans les deux cas où l'effet n'a pas lieu d'être :
 * **mouvement réduit** (AC4) et **absence de pointeur fin** (sur tactile, c'est
 * l'état permanent d'AC3 qui prend le relais).
 */
export const ProjectCardInteractive = ({
  project,
  className,
  style,
}: ProjectCardInteractiveProps) => {
  const shouldReduceMotion = useReducedMotion();
  const hasFinePointer = useFinePointer();

  // Position du pointeur sur la carte, dans [-0.5, 0.5] depuis son centre.
  const ratioX = useMotionValue(0);
  const ratioY = useMotionValue(0);

  // Position du halo, en pourcentage de la carte. 50/50 = centre au repos.
  const glowX = useMotionValue(50);
  const glowY = useMotionValue(50);
  const glowOpacity = useMotionValue(0);

  const springX = useSpring(ratioX, SPRING);
  const springY = useSpring(ratioY, SPRING);
  const springGlow = useSpring(glowOpacity, SPRING);

  // ⚠️ L'axe est INVERSÉ entre les deux rotations : pousser le pointeur vers le
  // bas doit faire basculer le HAUT de la carte vers l'arrière (`rotateX`
  // négatif), tandis qu'un déplacement vers la droite fait avancer le bord droit
  // (`rotateY` positif). Sans cette inversion, la carte « fuit » le curseur au
  // lieu de s'incliner vers lui.
  const rotateX = useTransform(springY, (value) => value * -MAX_TILT);
  const rotateY = useTransform(springX, (value) => value * MAX_TILT);

  // 🛑 TOUS LES HOOKS SONT APPELÉS AVANT LE MOINDRE RETOUR CONDITIONNEL. Sous
  // mouvement réduit, ce composant rend une carte nue — mais il doit malgré tout
  // exécuter exactement la même séquence de hooks, sinon React lève à la
  // première bascule de réglage. Ces deux `useTransform` servent au halo ; ils
  // vivent donc ici, et non dans le JSX plus bas.
  const glowXPercent = useTransform(glowX, (value) => `${value}%`);
  const glowYPercent = useTransform(glowY, (value) => `${value}%`);

  // ⚠️ MESURE PRISE AU `pointerenter`, ET RETENUE POUR LE SURVOL EN COURS.
  // Deux raisons, et la seconde est propre à cette story : mesurer à chaque
  // mouvement provoquerait un recalcul de mise en page par image ; mais mesurer
  // une seule fois AU MONTAGE serait faux, car les cartes sont `sticky` — leur
  // position à l'écran change à chaque défilement. `pointerenter` survient
  // forcément après le défilement qui a amené la carte sous le curseur.
  const boundsRef = useRef<DOMRect | null>(null);

  const isActive = !shouldReduceMotion && hasFinePointer;

  if (!isActive) {
    // 🛑 AC4 — AUCUN `transform`, AUCUN listener, AUCUNE variable de halo. La
    // règle CSS globale de la story 6.2 ne traite que les TRANSITIONS : elle
    // n'empêcherait pas un `transform` piloté en JavaScript de s'appliquer.
    // C'est donc ce test explicite, et lui seul, qui satisfait AC4.
    return (
      <ProjectCard project={project} className={className} style={style} />
    );
  }

  const handlePointerEnter = (event: React.PointerEvent<HTMLDivElement>) => {
    boundsRef.current = event.currentTarget.getBoundingClientRect();
    glowOpacity.set(1);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = boundsRef.current;
    if (!bounds) {
      return;
    }

    const offsetX = (event.clientX - bounds.left) / bounds.width;
    const offsetY = (event.clientY - bounds.top) / bounds.height;

    // Les valeurs de mouvement s'écrivent SANS déclencher de rendu React : un
    // `setState` par `pointermove` produirait un rendu par pixel parcouru.
    ratioX.set(offsetX - 0.5);
    ratioY.set(offsetY - 0.5);
    glowX.set(offsetX * 100);
    glowY.set(offsetY * 100);
  };

  const handlePointerLeave = () => {
    boundsRef.current = null;
    // AC2 — le retour au repos est porté par le RESSORT, pas par une
    // transition : remettre les valeurs à zéro suffit, l'amortissement fait le
    // reste et la carte ne « claque » pas à plat.
    ratioX.set(0);
    ratioY.set(0);
    glowOpacity.set(0);
  };

  return (
    <ProjectCard
      project={project}
      className={className}
      as={motion.div}
      onPointerEnter={handlePointerEnter}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={
        {
          ...style,
          rotateX,
          rotateY,
          transformPerspective: PERSPECTIVE,
          // Variables consommées par le halo, à l'intérieur de `Card`. Passer par
          // des variables CSS évite d'ajouter un nœud DOM et tout re-rendu : la
          // valeur change, le dégradé suit.
          "--glow-x": glowXPercent,
          "--glow-y": glowYPercent,
          "--glow-opacity": springGlow,
        } as React.CSSProperties
      }
    />
  );
};
