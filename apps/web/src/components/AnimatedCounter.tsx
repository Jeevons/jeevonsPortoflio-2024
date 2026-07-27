"use client";

import { useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { useReducedMotion } from "@/lib/motion";

// Story 6.14 — COMPTEUR ANIMÉ (AC2, AC3).
//
// 🛑 LE HTML SERVI PORTE DÉJÀ LA VALEUR FINALE, et c'est structurant. L'état
// initial est `value`, pas `0` : le rendu serveur, les moteurs de recherche, les
// aperçus de partage et toute la phase d'hydratation affichent le vrai chiffre.
// L'animation ne fait que le PARCOURIR ensuite, côté client.
//
// 🛑 AC3 PASSE PAR L'ÉTAT INITIAL, PAS PAR LA DURÉE. C'est le piège que le socle
// 6.2 formalise : si l'on partait de `0` en neutralisant seulement la durée, la
// règle CSS globale (`animation-duration: 0.01ms`) laisserait un compteur
// **bloqué à zéro** — un contenu FAUX affiché en permanence, bien pire qu'une
// animation. Ici, sous mouvement réduit, `display` vaut `value` dès le premier
// rendu et l'effet d'animation ne démarre jamais.
//
// 🛑 AC2 — `once: true` sur `useInView` : l'observation se termine au premier
// franchissement. Descendre, remonter, redescendre ne relance donc RIEN. ❌ Un
// `whileInView` sans `once` rejouerait à chaque entrée dans la zone visible.
//
// ⚠️ « une seule fois par visite » est ici entendu comme « une seule fois par
// affichage de la page ». Survivre à une navigation vers `/projects/[slug]` puis
// retour demanderait un `sessionStorage` — écarté (décision documentée) : il
// introduit un état persistant et un risque de divergence d'hydratation, pour un
// bénéfice que personne ne remarque.
//
// 🛑 ACCESSIBILITÉ — ❌ AUCUN `aria-live` ICI, JAMAIS. Un nombre qui défile
// produit des dizaines de mutations textuelles par seconde ; dans une région
// live, un lecteur d'écran les annoncerait TOUTES. Le nombre animé est donc
// `aria-hidden` et la valeur finale est exposée à côté, en texte accessible —
// c'est l'appelant (`StatsClient`) qui pose cette paire.

/** Durée du défilement. Assez court pour ne pas retenir, assez long pour se voir. */
const DURATION_MS = 1400;

type AnimatedCounterProps = {
  /** Valeur finale — celle qui est rendue côté serveur. */
  value: number;
  /**
   * Formateur, fourni par l'appelant. ⚠️ IL DOIT ÊTRE LE MÊME côté serveur et
   * côté client, sinon l'hydratation diverge.
   */
  format: (value: number) => string;
  className?: string;
};

export function AnimatedCounter({
  value,
  format,
  className,
}: AnimatedCounterProps) {
  const shouldReduceMotion = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);

  // `once: true` — cf. AC2 ci-dessus. `amount: 0.4` : le compteur démarre quand
  // la tuile est franchement visible, pas au premier pixel.
  const inView = useInView(ref, { once: true, amount: 0.4 });

  // 🛑 L'état initial EST la valeur finale. Voir AC3 ci-dessus.
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    // Mouvement réduit : on ne touche à rien, `display` vaut déjà `value`.
    if (shouldReduceMotion) return;
    if (!inView) return;

    // Le compteur part de zéro SEULEMENT ici — c'est-à-dire uniquement quand une
    // animation va effectivement se jouer, côté client, après hydratation.
    let frame = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - start) / DURATION_MS, 1);
      // Décélération : le nombre ralentit en approchant de sa valeur, ce qui rend
      // l'arrivée lisible plutôt que brutale.
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased));

      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        // Fin exacte : l'interpolation pourrait s'arrêter à 127 au lieu de 128.
        setDisplay(value);
      }
    };

    // ⚠️ PAS de `setDisplay(0)` ici. Un `setState` synchrone dans le corps d'un
    // effet déclenche un rendu en cascade (règle `react-hooks/set-state-in-effect`),
    // et il serait de toute façon redondant : la première frame de `tick` s'exécute
    // à `progress ≈ 0` et écrit donc `0` d'elle-même. Le départ à zéro est produit
    // par l'animation, pas posé avant elle.
    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [inView, shouldReduceMotion, value]);

  return (
    // `tabular-nums` : tous les chiffres ont la même largeur, donc le bloc ne
    // change PAS de taille pendant le défilement (anti-CLS, cible PLAN §4.4).
    <span ref={ref} className={`tabular-nums ${className ?? ""}`}>
      {format(display)}
    </span>
  );
}
