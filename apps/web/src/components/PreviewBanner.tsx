import Link from "next/link";

// Story 5.11 (AC2) — REPÈRE VISUEL du mode aperçu.
//
// « un repère visuel m'indique clairement que je suis en mode aperçu » : sans
// lui, Jeevons ne pourrait pas distinguer une page contenant ses brouillons
// d'une page réellement en ligne — et croirait publié ce qui ne l'est pas.
//
// ⚠️ Rendu UNIQUEMENT quand l'aperçu est actif, donc après vérification de la
// session côté serveur (`isPreviewActive`). Ce composant n'est qu'une vue : il
// ne décide rien et ne lit ni session ni URL.
//
// Choix d'implémentation :
//  - `role="status"` : l'information est annoncée aux lecteurs d'écran sans
//    voler le focus, contrairement à `role="alert"` — ce n'est pas une erreur,
//    c'est un état de la page.
//  - `sticky top-0` + `z-50` : le repère reste visible pendant tout le
//    défilement. Un bandeau qui disparaît au premier scroll ne remplirait pas
//    son office sur une page longue comme la home.
//  - Aucune animation : rien à neutraliser sous `prefers-reduced-motion`.
export const PreviewBanner = () => {
  return (
    <div
      role="status"
      className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-amber-300/40 bg-amber-500/20 px-4 py-2 text-center text-sm font-semibold text-amber-100 backdrop-blur"
    >
      <span>Mode aperçu — les contenus non publiés sont visibles.</span>
      {/* Sortie explicite : sans elle, il faudrait éditer l'URL à la main pour
          revenir à la vue publique. Lien interne → `next/link`. */}
      <Link
        href="/"
        className="underline underline-offset-4 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200"
      >
        Quitter l&apos;aperçu
      </Link>
    </div>
  );
};
