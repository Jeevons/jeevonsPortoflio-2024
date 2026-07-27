import { twMerge } from "tailwind-merge";

// Story 6.16 (AC2, AC3, AC4) — DÉGRADÉ D'AMBIANCE ANIMÉ.
//
// ⚠️ COMPOSANT SERVEUR, DÉLIBÉRÉMENT. Tout est en CSS pur (`@keyframes` dans
// `globals.css`) : aucun état, aucun hook, aucun JavaScript envoyé au client.
// ❌ Pas de canvas ni de WebGL — un coût de calcul disproportionné pour un effet
// d'ambiance (AC3), et une dépendance là où le PLAN §4.2 demande du « CSS pur ».
//
// 🛑 AC4 EST GRATUIT ICI, ET C'EST VOULU. L'animation étant CSS, la règle globale
// de 6.2 (`animation-duration: 0.01ms`) la fait sauter à sa dernière frame. Les
// keyframes sont donc écrites pour que CET ÉTAT FINAL SOIT PRÉSENTABLE : chaque
// blob revient à `100%` exactement sur sa position et son opacité de départ
// (cycle fermé). Le fond figé est identique au fond au repos — jamais une
// position extrême, jamais une opacité nulle.
//
// 🛑 LES TROIS GARDE-FOUS D'AC2, tous obligatoires :
//   - `pointer-events-none` : sans lui, un fond en position fixe intercepte
//     TOUS les clics du site. Panne totale et silencieuse.
//   - `aria-hidden` : purement décoratif, il ne doit pas exister pour un
//     lecteur d'écran.
//   - `-z-50` + `fixed` : derrière tout le contenu et HORS DU FLUX (aucun
//     décalage de mise en page, donc aucun impact CLS).

type AuroraBackgroundProps = {
  className?: string;
};

export const AuroraBackground = ({ className }: AuroraBackgroundProps) => {
  return (
    <div
      aria-hidden="true"
      className={twMerge(
        // `fixed inset-0` : le fond accompagne le défilement sans jamais entrer
        // dans le flux. `overflow-hidden` empêche les blobs (plus larges que le
        // viewport) de créer un défilement horizontal.
        "pointer-events-none fixed inset-0 -z-50 overflow-hidden",
        className,
      )}
    >
      {/* ⚠️ SEULS `transform` ET `opacity` SONT ANIMÉS — les deux propriétés que
          le compositeur gère sans repeindre. ❌ Jamais `background-position` ni
          les stops du dégradé (repeinture de toute la surface à chaque frame),
          ❌ jamais `filter`/`box-shadow` animés (AC3, piège n°4).
          Le `blur` est STATIQUE : peint une fois, puis seulement composé.

          ⚠️ Opacités volontairement basses (0.07 / 0.06 / 0.05, cf. les
          keyframes). Le texte du site est blanc sur `--surface` (gray-900,
          contraste 16,1:1) : une teinte d'accent CLAIRE à ≤ 7 % ÉCLAIRCIT
          légèrement le fond, ce qui ne peut qu'AUGMENTER le contraste d'un texte
          blanc. Le point le plus défavorable reste donc très au-dessus du 4,5:1
          exigé en AA (AGENTS.md §6).

          ⚠️ `will-change` N'EST POSÉ SUR AUCUN BLOB : en abuser (trois calques
          promus en permanence) consomme de la mémoire GPU et dégrade au lieu
          d'améliorer. Une animation de `transform` est de toute façon promue
          d'office par les navigateurs. */}
      <div className="aurora-blob aurora-blob-1" />
      <div className="aurora-blob aurora-blob-2" />
      <div className="aurora-blob aurora-blob-3" />
    </div>
  );
};
