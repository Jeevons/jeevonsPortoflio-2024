"use client";

import StartIcon from "@/assets/icons/star.svg";
import { useReducedMotion } from "@/lib/motion";
import {
  useAnimationFrame,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
  motion,
  wrap,
} from "motion/react";
import { Fragment, useRef } from "react";

// Story 6.16 (AC1, AC4) — BANDEAU PILOTÉ PAR LA VITESSE DE DÉFILEMENT.
//
// ⚠️ CE COMPOSANT ÉTAIT UN COMPOSANT SERVEUR. Le `"use client"` est ajouté ICI
// plutôt que par extraction d'une vue cliente : le bandeau ne lit AUCUNE donnée
// (les mots sont en dur ci-dessous, et le rendre administrable est explicitement
// hors périmètre), il n'a donc rien à garder côté serveur. Une enveloppe cliente
// n'aurait ajouté qu'un fichier et un nœud pour un gain nul.
// 🛑 Garde-fou vérifié au build : `/` reste `○ (Static, 1h)` — un composant
// client ne bascule pas la page en rendu dynamique.
//
// ⚠️ POURQUOI PAS UN LISTENER `scroll`.
// Réécrire `animation-duration` (ou `transform`) depuis un handler `scroll`
// force un recalcul de style + layout sur le fil principal PENDANT le
// défilement : c'est exactement le jank qu'AC3 interdit. `useScroll` +
// `useVelocity` de `motion` (déjà installé — zéro dépendance, AGENTS.md §9)
// exposent une vélocité SIGNÉE, d'où l'inversion de sens gratuite, et l'écriture
// se fait sur le compositeur via `transform`.

const words = [
  "Performant",
  "Accessible",
  "Secure",
  "Interactif",
  "Scalable",
  "User Friendly",
  "Maintenable",
  "SEO",
  "Responsive",
  "Intuitif",
  "Modulaire",
  "Fiable",
  "Optimisé",
  "Personnalisable",
  "Ergonomique",
  "Compatible",
  "Innovant",
  "Dynamique",
  "Flexible",
  "Automatisé",
];

// Vitesse de croisière, en pourcentage de la piste par seconde.
//
// 🛑 LA BANDE NE S'ARRÊTE PAS À L'ARRÊT DU DÉFILEMENT. AC1 dit que la vitesse
// « suit » le défilement, pas que la bande s'immobilise : une bande figée serait
// une RÉGRESSION par rapport à l'existant, qui tourne en continu.
// Valeur calée sur l'ancien `[animation-duration:30s]` : l'animation CSS
// parcourait -50 % (une copie des mots) en 30 s, soit ~1,667 %/s.
const BASE_SPEED = 50 / 30;

// Plafond de l'accélération : au maximum ~5× la vitesse de croisière. Sans lui,
// un défilement brutal (molette, `scroll-behavior: smooth` d'une ancre) rendrait
// la bande illisible en la propulsant à plusieurs tours par seconde.
const MAX_SPEED_FACTOR = 5;

// Vélocité de défilement (px/s) au-delà de laquelle le facteur est plafonné.
const VELOCITY_AT_MAX = 2000;

export const TapeSection = () => {
  const shouldReduceMotion = useReducedMotion();

  // Position de la piste, en POURCENTAGE de sa propre largeur.
  //
  // 🛑 L'INVARIANT DE LA BOUCLE. Les mots sont dupliqués ×2 (plus bas) et la
  // piste est donc deux fois plus large que le contenu utile ; parcourir -50 %
  // ramène exactement la seconde copie là où était la première. C'est ce qui
  // rend le raccord INVISIBLE. `wrap(-50, 0, …)` reproduit exactement cette
  // invariance de l'ancienne keyframe `move-left` (0 % → -50 %).
  // ❌ Retirer la duplication ou changer le -50 % produit un saut à chaque cycle.
  const trackPercent = useMotionValue(0);

  const { scrollY } = useScroll();
  const scrollVelocity = useVelocity(scrollY);

  // 🛑 LE LISSAGE N'EST PAS UN RAFFINEMENT, IL EST OBLIGATOIRE. Une vélocité
  // brute oscille autour de zéro quand le défilement s'arrête : sans ressort, la
  // bande VIBRERAIT (accélérations et inversions à chaque frame). Le ressort
  // absorbe ces oscillations et rend l'inversion de sens progressive.
  const smoothVelocity = useSpring(scrollVelocity, {
    damping: 50,
    stiffness: 300,
    restDelta: 0.001,
  });

  // Facteur de vitesse SIGNÉ : -MAX en défilement vers le haut, +MAX vers le
  // bas, ±1 (la croisière) à l'arrêt. C'est le signe qui porte l'inversion de
  // sens exigée par AC1 — elle est obtenue sans aucune logique conditionnelle.
  const speedFactor = useTransform(
    smoothVelocity,
    [-VELOCITY_AT_MAX, 0, VELOCITY_AT_MAX],
    [-MAX_SPEED_FACTOR, 1, MAX_SPEED_FACTOR],
    { clamp: true },
  );

  // Sens de marche, mémorisé HORS du rendu React.
  //
  // ⚠️ `useRef` et non `useState` : ceci est relu à chaque frame. Un `setState`
  // par frame re-rendrait tout l'arbre à 60 Hz — la violation d'AC3 la plus
  // directe (piège n°1, voie ❌).
  const directionRef = useRef(-1);

  useAnimationFrame((_, delta) => {
    // 🛑 AC4 — Sous mouvement réduit, la piste ne bouge PAS et l'abonnement à la
    // frame ne fait rien. `trackPercent` reste à 0, sa valeur initiale : la
    // bande est donc figée dans un état LISIBLE, aucun mot coupé au milieu.
    // ⚠️ La règle CSS globale de 6.2 ne couvre PAS cette animation : elle neutralise
    // les animations CSS, or celle-ci est pilotée en JS. La neutralisation est
    // donc explicite ici — c'est le piège central de la story.
    if (shouldReduceMotion) return;

    const factor = speedFactor.get();

    // Le sens ne s'inverse que lorsque la vélocité lissée traverse zéro
    // franchement. La zone morte (|factor| < 1) préserve le sens courant : sans
    // elle, la bande hésiterait autour de l'arrêt.
    if (factor < -1) {
      directionRef.current = 1;
    } else if (factor > 1) {
      directionRef.current = -1;
    }

    // `delta` est en millisecondes ; `Math.abs(factor)` module l'amplitude, le
    // sens vient de `directionRef`. Le minimum de 1 garantit la croisière.
    const moveBy =
      directionRef.current *
      BASE_SPEED *
      Math.max(1, Math.abs(factor)) *
      (delta / 1000);

    trackPercent.set(trackPercent.get() + moveBy);
  });

  // `wrap` replie la valeur dans [-50, 0[ : la boucle est infinie et sans saut.
  //
  // 🛑 LA BORNE HAUTE EST EXCLUSIVE — vérifié : `wrap(-50, 0, 0)` retourne `-50`,
  // et NON `0`. Sans le court-circuit ci-dessous, la bande serait donc figée à
  // `-50%` sous mouvement réduit alors qu'AC4 exige `x = 0`. Le rendu resterait
  // lisible par coïncidence (à -50 % on voit la seconde copie, identique à la
  // première), mais dépendre de cette coïncidence est fragile : elle disparaît
  // au moindre changement de la duplication.
  // ⚠️ `value === 0` est traité à part pour la même raison, côté SSR : au premier
  // rendu `trackPercent` vaut 0 et le HTML porterait `translateX(-50%)`, d'où un
  // saut visible d'une demi-piste à l'hydratation. La piste démarre donc bien à
  // `0%`, exactement comme le faisait l'ancienne keyframe `move-left`.
  const x = useTransform(trackPercent, (value) =>
    shouldReduceMotion || value === 0 ? "0%" : `${wrap(-50, 0, value)}%`,
  );

  return (
    <div className="py-16 lg:py-24 overflow-x-clip">
      {/* Story 6.1 — `.bg-gradient-accent` : le dégradé de signature en fond. */}
      <div className="bg-gradient-accent  -rotate-3 -mx-1">
        <div className="flex [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
          {/* ⚠️ `animate-move-left [animation-duration:30s]` est REMPLACÉ par ce
              `x` piloté : les deux coexisteraient en se contredisant sur la même
              propriété `transform`. La keyframe `move-left` reste définie dans
              `tailwind.config.ts` — elle sert encore à `move-right` et n'est pas
              du périmètre de cette story. */}
          <motion.div className="flex flex-none gap-4 pr-4 py-3" style={{ x }}>
            {[...new Array(2)].fill(0).map((_, idx) => (
              <Fragment key={idx}>
                {words.map((word) => (
                  <div key={word} className="inline-flex gap-4 items-center">
                    <span className="text-surface uppercase font-extrabold text-sm">
                      {word}
                    </span>
                    <StartIcon className="size-6 text-surface -rotate-12" />
                  </div>
                ))}
              </Fragment>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
};
