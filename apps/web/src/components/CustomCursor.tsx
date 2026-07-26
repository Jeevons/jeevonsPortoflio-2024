"use client";

import { useReducedMotion } from "@/lib/motion";
import { useFinePointer } from "@/lib/pointer";
import { motion, useMotionValue, useSpring } from "motion/react";
import { useEffect, useState } from "react";

// Story 6.6 (AC2) — CURSEUR PERSONNALISÉ : un point qui suit le pointeur, et un
// halo qui grossit au survol des éléments interactifs.
//
// 🛑 CE FICHIER PEUT RENDRE LE SITE INUTILISABLE. Deux fautes, toutes deux
// MUETTES en développement, méritent d'être nommées avant le code :
//
// 1. **Un curseur sans `pointer-events: none` avale TOUS les clics de la page.**
//    Il est en `position: fixed` au-dessus de tout : sans cette règle, chaque
//    clic atterrit sur lui. On ne le voit pas en testant au clavier, et pas
//    davantage en regardant l'écran — la page a simplement l'air morte.
// 2. **Un `cursor: none` posé sans condition laisse des visiteurs sans
//    curseur.** Si la règle est écrite en CSS global et que le composant ne se
//    monte pas (JS en échec, appareil sans pointeur fin), le curseur système
//    reste masqué et rien ne le remplace.
//
// La réponse aux deux : `pointer-events: none` en dur ci-dessous, et un
// `cursor: none` appliqué PAR LE COMPOSANT LUI-MÊME dans un effet, retiré dans
// son nettoyage. Le masquage ne peut alors pas survivre à ce qui le justifie.
//
// ⚠️ AC4 EST PLUS FORT QU'« ANIMATION NEUTRALISÉE ». Il exige que « le curseur
// système reste inchangé » : sous mouvement réduit, ce composant ne rend RIEN
// (pas de nœud, pas de `cursor: none`). La règle CSS globale de la story 6.2
// traite les TRANSITIONS — elle ne fait pas disparaître un composant. Un
// curseur custom simplement « plus rapide » satisferait 6.2 et échouerait AC4.

/** Diamètre du point central, en pixels. */
const DOT_SIZE = 8;

/** Diamètre du halo au repos, en pixels. */
const RING_SIZE = 36;

/** Facteur d'agrandissement du halo au survol d'un élément interactif (AC2). */
const RING_HOVER_SCALE = 1.6;

/**
 * Sélecteur des éléments qui font grossir le halo.
 *
 * ⚠️ TESTÉ AVEC `closest()` SUR LA CIBLE PLUTÔT QU'AVEC UNE CLASSE DÉDIÉE : une
 * classe imposerait de retoucher chaque élément cliquable du site — des dizaines
 * de fichiers, la plupart hors du périmètre de cette story, et un oubli à chaque
 * élément ajouté plus tard. Le sélecteur, lui, couvre d'emblée ce qui existe et
 * ce qui viendra.
 */
const INTERACTIVE_SELECTOR =
  "a, button, input, textarea, select, [role='button']";

/** Ressort du point : vif, il doit coller au geste. */
const DOT_SPRING = { stiffness: 900, damping: 40, mass: 0.3 } as const;

/** Ressort du halo : plus mou, il suit le point avec une légère traîne. */
const RING_SPRING = { stiffness: 260, damping: 26, mass: 0.6 } as const;

/**
 * Curseur personnalisé du site public.
 *
 * 🛑 MONTÉ DANS `page.tsx`, PAS DANS `layout.tsx`. Le layout racine est partagé
 * avec `/admin` et `/login`, qui sont hors du périmètre de cette story (et dont
 * la discipline clavier a été posée en story 5.20). Le curseur appartient au
 * site public.
 */
export const CustomCursor = () => {
  const shouldReduceMotion = useReducedMotion();
  const hasFinePointer = useFinePointer();

  // 🛑 AC4 — SOUS MOUVEMENT RÉDUIT, LE COMPOSANT N'EXISTE PAS. Pas de nœud DOM,
  // pas de `cursor: none`, donc le curseur système est celui du navigateur avec
  // ses formes contextuelles intactes : `text` sur un paragraphe, `pointer` sur
  // un lien. AC3 — même sortie sur écran tactile.
  //
  // ⚠️ POURQUOI LA DÉCISION EST ISOLÉE DANS UN COMPOSANT PARENT. Tout l'état du
  // curseur (position, survol) vit dans `ActiveCursor` : le monter ou le
  // démonter suffit à le créer et à le détruire. Si le visiteur bascule un
  // réglage à chaud, on ne « réinitialise » rien à la main — l'état disparaît
  // avec le composant, et un retour ultérieur repart d'une ardoise propre plutôt
  // que de faire réapparaître le curseur à sa dernière position connue.
  if (shouldReduceMotion || !hasFinePointer) {
    return null;
  }

  return <ActiveCursor />;
};

/**
 * Le curseur proprement dit — monté uniquement lorsque l'effet doit s'appliquer.
 */
const ActiveCursor = () => {
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const dotX = useSpring(x, DOT_SPRING);
  const dotY = useSpring(y, DOT_SPRING);
  const ringX = useSpring(x, RING_SPRING);
  const ringY = useSpring(y, RING_SPRING);

  const [isOverInteractive, setIsOverInteractive] = useState(false);

  // ⚠️ `hasMoved` évite le curseur « garé » dans un coin : tant que le pointeur
  // n'a pas bougé, on ne peint rien plutôt que d'afficher un point à une
  // position arbitraire (y compris juste après une bascule de réglage).
  const [hasMoved, setHasMoved] = useState(false);

  // 🛑 LE MASQUAGE DU CURSEUR SYSTÈME VIT ICI, ET NULLE PART AILLEURS.
  //
  // Posé sur l'élément racine par cet effet, retiré par son nettoyage. Trois
  // conséquences, toutes voulues : si ce composant ne se monte jamais (mouvement
  // réduit, écran tactile, JS en échec) le curseur système n'est jamais masqué ;
  // si le réglage bascule à chaud, le démontage restaure le curseur
  // immédiatement ; et si le composant disparaît pour une raison quelconque, le
  // site redevient utilisable de lui-même. Aucune règle `cursor: none` n'existe
  // dans la feuille de style globale — c'est délibéré.
  useEffect(() => {
    const root = document.documentElement;
    const previousCursor = root.style.cursor;
    root.style.cursor = "none";

    return () => {
      root.style.cursor = previousCursor;
    };
  }, []);

  useEffect(() => {
    // ⚠️ UN SEUL listener de mouvement pour tout le site, sur `window` — pas un
    // par élément. `x`/`y` sont des valeurs de mouvement : les écrire ne
    // déclenche AUCUN rendu React.
    const handlePointerMove = (event: PointerEvent) => {
      x.set(event.clientX);
      y.set(event.clientY);
      setHasMoved(true);
    };

    // AC2 — « son halo grossit au survol des éléments interactifs ». `pointerover`
    // se déclenche à chaque changement de cible : il suffit d'y tester si l'on
    // est entré dans un élément interactif (ou l'un de ses enfants, d'où
    // `closest`). C'est le seul changement d'état React de ce composant, et il
    // ne survient qu'aux franchissements, pas à chaque pixel parcouru.
    const handlePointerOver = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      setIsOverInteractive(Boolean(target.closest(INTERACTIVE_SELECTOR)));
    };

    // Le pointeur quitte la fenêtre : on remise le curseur hors champ plutôt
    // que de le laisser figé sur le dernier pixel survolé.
    const handlePointerLeaveWindow = () => {
      setHasMoved(false);
    };

    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
    window.addEventListener("pointerover", handlePointerOver, {
      passive: true,
    });
    document.addEventListener("pointerleave", handlePointerLeaveWindow);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerover", handlePointerOver);
      document.removeEventListener("pointerleave", handlePointerLeaveWindow);
    };
  }, [x, y]);

  return (
    <div
      // ✅ DÉCORATIF, DONC INEXISTANT POUR LES TECHNOLOGIES D'ASSISTANCE.
      aria-hidden="true"
      // 🛑 `pointer-events-none` — LA RÈGLE À NE JAMAIS RETIRER (voir en-tête).
      // `z-[60]` : au-dessus du header (`z-10`), de la barre de progression de la
      // story 6.5 (`z-20`) et des CTA révélés du hero (`z-30`).
      className="pointer-events-none fixed inset-0 z-[60]"
      style={{ opacity: hasMoved ? 1 : 0 }}
    >
      {/* Halo — dégradé d'accent tokenisé (story 6.1).

          ⚠️ LE CENTRAGE PASSE PAR `marginLeft`/`marginTop`, PAS PAR UN SECOND
          TRANSLATE. `x`/`y` de `motion` écrivent DÉJÀ dans `transform` : y
          ajouter un `translateX: "-50%"` reviendrait à disputer la même
          propriété à `motion`, avec un résultat dépendant de l'ordre de
          composition. Les marges décalent l'élément une fois pour toutes, sans
          jamais entrer en concurrence avec l'animation — et comme elles sont
          constantes, elles ne provoquent aucun recalcul par image. */}
      <motion.span
        className="bg-gradient-accent absolute left-0 top-0 rounded-full opacity-30 blur-[2px]"
        style={{
          width: RING_SIZE,
          height: RING_SIZE,
          marginLeft: -RING_SIZE / 2,
          marginTop: -RING_SIZE / 2,
          // 🛑 `transform` UNIQUEMENT — jamais `top`/`left`, qui déclencheraient
          // un recalcul de mise en page à chaque mouvement de souris.
          x: ringX,
          y: ringY,
        }}
        animate={{ scale: isOverInteractive ? RING_HOVER_SCALE : 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      />

      {/* Point central — centré par marges, même raison que le halo. */}
      <motion.span
        className="bg-accent-from absolute left-0 top-0 rounded-full"
        style={{
          width: DOT_SIZE,
          height: DOT_SIZE,
          marginLeft: -DOT_SIZE / 2,
          marginTop: -DOT_SIZE / 2,
          x: dotX,
          y: dotY,
        }}
      />
    </div>
  );
};
