"use client";

import { useReducedMotion } from "@/lib/motion";
import { useFinePointer } from "@/lib/pointer";
import { motion, useMotionValue, useSpring } from "motion/react";
import { useRef } from "react";

// Story 6.6 (AC1, AC5) — LIEN MAGNÉTIQUE : le lien se déplace de quelques
// pixels vers le curseur qui l'approche, et revient à sa place dès qu'il
// s'éloigne.
//
// 🛑 CE COMPOSANT RESTE UN `<a>`, ET C'EST NON NÉGOCIABLE. Les CTA du hero sont
// des liens d'ancre (`#projects`, `#about`) dont dépend la navigation de la
// story 1.1. Le réflexe « je le passe en <button>/<div> pour pouvoir l'animer »
// casserait à la fois l'activation à `Entrée`, le clic-milieu, le menu
// contextuel et l'ancre elle-même. `motion.a` anime un vrai `<a>` : il n'y a
// aucune raison d'y renoncer.
//
// ⚠️ POURQUOI `useMotionValue`/`useSpring` ET NON UN `useState`. `pointermove`
// émet des centaines d'évènements par seconde. Écrire dans un state React à
// chaque évènement, c'est autant de rendus React — saccades garanties. Les
// valeurs de mouvement de `motion` écrivent directement dans le style, HORS du
// cycle de rendu React ; `useSpring` fournit en prime le retour élastique que
// demande l'AC1 (« il retrouve sa position »).

/**
 * Amplitude maximale du décalage, en pixels (PLAN §4.2, P1 n°4 : ~8 px).
 *
 * 🛑 VOLONTAIREMENT MINUSCULE, et c'est une exigence d'AC1 (« de quelques
 * pixels seulement ») autant qu'une exigence d'AC5 : un décalage ample
 * éloignerait la zone cliquable du curseur qui l'a provoqué, rendant le lien
 * difficile à atteindre — l'effet se retournerait contre l'utilisabilité qu'il
 * prétend soigner.
 */
const MAX_OFFSET = 8;

/**
 * Raideur du ressort. Assez vif pour que le lien colle au geste, assez amorti
 * pour qu'il n'oscille pas en revenant au repos.
 */
const SPRING = { stiffness: 260, damping: 20, mass: 0.6 } as const;

type MagneticLinkProps = {
  href: string;
  className?: string;
  children: React.ReactNode;
};

/**
 * Lien d'ancre attiré par le curseur.
 *
 * Dégradation en un `<a>` strictement ordinaire — mêmes `href`, mêmes classes,
 * mêmes enfants — dans les deux cas où l'effet n'a pas lieu d'être :
 *
 * - **mouvement réduit** (AC4) : aucun `transform` n'est jamais appliqué, le
 *   lien garde sa position d'origine ;
 * - **absence de pointeur fin** (AC3) : sur écran tactile il n'y a pas de
 *   survol, donc rien à suivre.
 *
 * 🛑 DANS LES DEUX CAS ON REND UN `<a>` NU PLUTÔT QU'UN `motion.a` FIGÉ : pas
 * de listener attaché, pas de ressort qui tourne à vide, et surtout aucun
 * `transform` résiduel susceptible de créer un containing block inattendu.
 */
export const MagneticLink = ({
  href,
  className,
  children,
}: MagneticLinkProps) => {
  const shouldReduceMotion = useReducedMotion();
  const hasFinePointer = useFinePointer();

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, SPRING);
  const springY = useSpring(y, SPRING);

  // ⚠️ Mesuré à l'ENTRÉE du pointeur, pas à chaque mouvement : appeler
  // `getBoundingClientRect()` dans un `pointermove` force le navigateur à
  // recalculer la mise en page à chaque image (layout thrashing). L'entrée du
  // pointeur est le bon moment — elle survient après tout défilement pertinent,
  // donc la mesure est fraîche.
  const rect = useRef<DOMRect | null>(null);

  const isActive = !shouldReduceMotion && hasFinePointer;

  if (!isActive) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }

  const handlePointerEnter = (event: React.PointerEvent<HTMLAnchorElement>) => {
    rect.current = event.currentTarget.getBoundingClientRect();
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLAnchorElement>) => {
    const bounds = rect.current;
    if (!bounds) {
      return;
    }

    // Position du curseur relativement au CENTRE du lien, normalisée dans
    // [-1, 1] : le décalage est donc proportionnel à l'écart au centre, et
    // maximal quand le curseur atteint un bord.
    const ratioX =
      (event.clientX - (bounds.left + bounds.width / 2)) / (bounds.width / 2);
    const ratioY =
      (event.clientY - (bounds.top + bounds.height / 2)) / (bounds.height / 2);

    x.set(clamp(ratioX) * MAX_OFFSET);
    y.set(clamp(ratioY) * MAX_OFFSET);
  };

  const handlePointerLeave = () => {
    rect.current = null;
    // Le ressort ramène le lien à sa place : c'est le « il retrouve sa
    // position » de l'AC1.
    x.set(0);
    y.set(0);
  };

  return (
    <motion.a
      href={href}
      className={className}
      style={{ x: springX, y: springY }}
      // ⚠️ Listeners portés par React sur l'élément lui-même : ils vivent et
      // meurent avec lui, sans `useEffect` à nettoyer. `pointermove` n'est actif
      // que pendant le survol (React le rattache au nœud, et `pointerleave`
      // remet les valeurs à zéro) — pas de listener global qui tournerait en
      // permanence pour chaque CTA.
      onPointerEnter={handlePointerEnter}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      // 🛑 AUCUN `preventDefault`, AUCUN `touch-action` (AC3) : sur un appareil
      // hybride (laptop tactile satisfaisant `hover: hover`), le tap doit
      // continuer de se comporter exactement comme sur n'importe quel lien.
    >
      {children}
    </motion.a>
  );
};

/** Borne une valeur dans [-1, 1]. */
function clamp(value: number): number {
  return Math.min(1, Math.max(-1, value));
}
