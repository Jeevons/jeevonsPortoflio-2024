"use client";

import { useReducedMotion } from "@/lib/motion";
import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

// Story 6.17 (AC1, AC2, AC3) — EASTER EGG : LE KONAMI CODE.
//
// 🛑 CE FICHIER A L'AIR D'ÊTRE UN AMUSEMENT. IL NE L'EST PAS. L'effet visuel est
// la partie facile ; le contrat d'AC2 est la story. Deux exigences que
// l'implémentation naïve viole TOUTES LES DEUX :
//
//   1. « jamais par accident » — un `keydown` global reçoit AUSSI ce que le
//      visiteur tape dans le formulaire de contact (`ContactDialog`, story 6.12,
//      DÉJÀ LIVRÉ : nom, adresse, message). Sans garde, écrire « ...bbaba... »
//      dans son message déclencherait la surprise en pleine saisie.
//   2. « n'interfère ni avec la navigation clavier ni avec les technologies
//      d'assistance » — d'où : aucun `preventDefault`, aucun déplacement de
//      focus, `aria-hidden`, `pointer-events-none`.

// ⚠️ SÉQUENCE LONGUE ET IMPROBABLE, délibérément : dix touches dont huit flèches.
// Le Konami code est le choix canonique du PLAN (§4.2 P3 n°15) et il est
// statistiquement indéclenchable par hasard. ❌ Une séquence courte
// (« jeevons ») serait tapée par accident.
const KONAMI_SEQUENCE = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
] as const;

// Durée bornée : l'effet « se termine de lui-même » (AC1). `Échap` l'interrompt
// en plus — les deux voies sont offertes, c'est le plus sûr.
const EFFECT_DURATION_MS = 6000;

// 🛑 NOMBRE D'ÉLÉMENTS BORNÉ. Quelques dizaines, jamais des centaines : chaque
// pièce est un calque composé, et c'est le coût de l'effet qui plafonne ici.
const PIECE_COUNT = 40;

// Positions/délais calculés UNE FOIS au chargement du module, pas à chaque
// rendu. ⚠️ Distribution DÉTERMINISTE et non `Math.random()` : une valeur
// aléatoire différerait entre le serveur et le client et provoquerait une
// divergence d'hydratation.
const PIECES = Array.from({ length: PIECE_COUNT }, (_, index) => {
  // Répartition en éventail sur la largeur, décalée par un pas premier pour ne
  // pas former de colonnes régulières.
  const left = ((index * 37) % 100) + (index % 3) - 1;
  const delay = ((index * 13) % 100) / 100;
  const duration = 2.4 + ((index * 7) % 20) / 10;
  const drift = (((index * 23) % 40) - 20) * 4;
  const rotate = ((index * 53) % 720) - 360;
  // Alternance des deux bornes du dégradé d'accent (tokens 6.1).
  const usesAccentFrom = index % 2 === 0;
  return { left, delay, duration, drift, rotate, usesAccentFrom };
});

/**
 * Détection de la séquence secrète — 🛑 SOURCE DE VÉRITÉ UNIQUE.
 *
 * ⚠️ Factorisé en hook DÉLIBÉRÉMENT : les deux rendus (animé et statique)
 * partagent exactement la même détection. Dupliquer la logique aurait fait
 * dériver les gardes d'AC2 — la version statique aurait pu, à terme, se mettre
 * à capturer la saisie des champs pendant que l'animée s'en protège.
 *
 * @param onUnlock appelé quand la séquence complète est saisie.
 */
const useKonamiSequence = (onUnlock: () => void) => {
  // 🛑 LA PROGRESSION VIT DANS UN `ref`, PAS DANS UN `useState`. Un `setState`
  // par frappe re-rendrait l'arbre à CHAQUE touche tapée sur le site — pour un
  // effet que 99 % des visiteurs ne déclencheront jamais.
  const progressRef = useRef(0);

  // L'écouteur ne doit être posé qu'UNE fois ; le `ref` évite de le reposer à
  // chaque changement d'identité du callback.
  //
  // ⚠️ La mise à jour se fait dans un effet et NON pendant le rendu : écrire
  // dans un ref au fil du rendu est une erreur signalée par
  // `react-hooks/refs` (le rendu doit rester pur, et React peut le rejouer).
  const onUnlockRef = useRef(onUnlock);
  useEffect(() => {
    onUnlockRef.current = onUnlock;
  }, [onUnlock]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // 🛑 GARDE N°1, LA DÉCISIVE — ne jamais capturer la saisie d'un champ.
      // `closest` et non une comparaison de `tagName` : un `contenteditable`
      // peut contenir des éléments imbriqués, et la cible serait alors l'enfant.
      const target = event.target as HTMLElement | null;
      if (
        target?.closest("input, textarea, select, [contenteditable='true']")
      ) {
        progressRef.current = 0;
        return;
      }

      // ⚠️ GARDE N°2 — les frappes avec modificateur sont des RACCOURCIS
      // NAVIGATEUR (⌘←, Ctrl+A…), pas une saisie de séquence.
      if (event.ctrlKey || event.metaKey || event.altKey) {
        progressRef.current = 0;
        return;
      }

      const expected = KONAMI_SEQUENCE[progressRef.current];
      // Les lettres sont comparées sans casse (« B » comme « b »), les flèches
      // gardent leur nom exact.
      const matches =
        expected.length === 1
          ? event.key.toLowerCase() === expected
          : event.key === expected;

      if (!matches) {
        // Redémarrage tolérant : une frappe ratée qui est elle-même le DÉBUT de
        // la séquence ne perd pas le coup (taper ↑↑↑↓↓… fonctionne).
        progressRef.current = event.key === KONAMI_SEQUENCE[0] ? 1 : 0;
        return;
      }

      progressRef.current += 1;

      if (progressRef.current === KONAMI_SEQUENCE.length) {
        progressRef.current = 0;
        onUnlockRef.current();
      }

      // 🛑 AUCUN `preventDefault()` — NULLE PART, ET SURTOUT PAS SUR LES FLÈCHES.
      // Intercepter les flèches casserait le défilement au clavier du site
      // ENTIER : une régression d'accessibilité majeure, précisément ce qu'AC2
      // interdit. On OBSERVE la séquence, on ne la capture pas.
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
};

/**
 * `Échap` ferme l'effet — abonné SEULEMENT pendant qu'il est actif (AC1).
 *
 * 🛑 ⚠️ ET SANS `preventDefault()`. `ContactDialog` (6.12) est un `<dialog>`
 * natif et `/admin` utilise des dialogues shadcn : tous se ferment à `Échap`.
 * Voler la touche fermerait l'easter egg AU LIEU du dialogue ouvert. En
 * laissant l'événement se propager, les deux cohabitent.
 */
const useEscapeToClose = (active: boolean, close: () => void) => {
  useEffect(() => {
    if (!active) return;

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [active, close]);
};

/**
 * 🛑 AC3 — LA NEUTRALISATION EST DÉCIDÉE EN AMONT, ET C'EST VITAL.
 *
 * ⚠️ Ici, contrairement aux autres animations de l'Epic 6, laisser faire la
 * règle CSS globale de 6.2 serait DESTRUCTEUR : `animation-duration: 0.01ms`
 * fait sauter une animation à sa DERNIÈRE frame. Pour un effet plein écran,
 * cela signifierait 40 éléments FIGÉS à l'écran que plus rien ne viendrait
 * nettoyer — un site cassé, pas un effet neutralisé.
 *
 * La décision (AC3 laisse explicitement le choix) : ✅ **VERSION STATIQUE**, pas
 * « rien ». Un curieux sensible au mouvement reste un curieux, et c'est plus
 * fidèle à l'esprit de la story ; c'est aussi cohérent avec le socle 6.2, dont
 * la règle est « neutraliser l'animation, jamais l'information ».
 *
 * La bascule est faite ICI, avant que le moindre élément animé n'existe.
 */
export const KonamiEasterEgg = () => {
  const shouldReduceMotion = useReducedMotion();

  // ⚠️ `active` est le SEUL état React, et il ne change qu'au déclenchement et à
  // l'arrêt — jamais à la frappe.
  const [active, setActive] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = useCallback(() => {
    setActive(false);
    // 🛑 Nettoyage à l'INTERRUPTION autant qu'au démontage : c'est là que les
    // `setTimeout` orphelins fuient et finissent par écrire dans l'état d'un
    // composant démonté.
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // ⚠️ PAS DE RÉ-ENTRANCE (décision documentée) : re-saisir la séquence pendant
  // que l'effet tourne ne fait rien. Empiler deux effets doublerait le coût pour
  // un gain nul ; redémarrer volerait au visiteur la fin de son animation.
  const unlock = useCallback(() => setActive(true), []);

  useKonamiSequence(unlock);
  useEscapeToClose(active, stop);

  // Fin automatique (AC1 — « se termine de lui-même »).
  // ⚠️ Sous mouvement réduit, la version statique n'expire PAS toute seule : elle
  // ne bouge pas, rien ne justifie de la faire disparaître dans le dos du
  // visiteur. Elle se ferme à `Échap` (AC1 — « ou peut être interrompu »).
  useEffect(() => {
    if (!active || shouldReduceMotion) return;

    timeoutRef.current = setTimeout(stop, EFFECT_DURATION_MS);
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [active, shouldReduceMotion, stop]);

  // 🛑 DÉMONTAGE COMPLET. L'effet SORT du DOM quand il se termine — il n'y reste
  // pas avec `opacity: 0`. C'est aussi ce qui garantit qu'aucun élément ne peut
  // rester figé à l'écran.
  // ⚠️ Au premier rendu, `active` est faux : le composant ne rend RIEN, donc
  // aucune divergence d'hydratation n'est possible.
  if (!active) return null;

  // 🛑 Les deux calques ci-dessous partagent DEUX attributs obligatoires, chacun
  // fermant une panne :
  // - sans `pointer-events-none`, un calque plein écran bloquerait TOUS les
  //   clics du site pendant toute sa durée — panne totale et silencieuse ;
  // - sans `aria-hidden`, les éléments ajoutés inonderaient le lecteur d'écran
  //   de mutations. ❌ Et JAMAIS d'`aria-live` ici (même discipline que les
  //   compteurs de la 6.14 et le texte alterné de la 6.7).
  // ⚠️ Dans les deux cas le focus n'est PAS déplacé et aucun élément focusable
  // n'est ajouté : `Tab` poursuit le parcours normal de la page (AC2).

  if (shouldReduceMotion) {
    return (
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-50 flex items-start justify-center pt-24"
      >
        {/* Rigoureusement statique : aucune animation, aucune transition. */}
        <p className="rounded-control bg-surface-raised px-6 py-3 text-sm font-semibold text-white shadow-lg ring-1 ring-white/10">
          <span className="text-gradient-accent">Konami !</span> Bien joué —
          vous êtes du genre curieux. (Échap pour fermer)
        </p>
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
    >
      {PIECES.map((piece, index) => (
        <motion.span
          key={index}
          className="absolute top-0 block size-3 rounded-sm"
          style={{
            left: `${piece.left}%`,
            // Couleurs prises sur les tokens 6.1 — le dégradé de signature.
            backgroundColor: piece.usesAccentFrom
              ? "hsl(var(--accent-from))"
              : "hsl(var(--accent-to))",
          }}
          // ⚠️ `transform` (`y`, `x`, `rotate`) et `opacity` UNIQUEMENT : les
          // seules propriétés que le compositeur gère sans repeindre.
          // ❌ Jamais `top`/`left`/`width` animés.
          initial={{ y: "-10vh", x: 0, opacity: 0, rotate: 0 }}
          animate={{
            y: "110vh",
            x: piece.drift,
            opacity: [0, 1, 1, 0],
            rotate: piece.rotate,
          }}
          transition={{
            duration: piece.duration,
            delay: piece.delay,
            ease: "linear",
            repeat: Infinity,
          }}
        />
      ))}
    </div>
  );
};
