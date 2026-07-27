// Story 5.15 — REGISTRE DES CLÉS D'ICÔNE (AC1, AC3).
//
// ⚠️ SOURCE UNIQUE, partagée par les deux côtés :
//  - le site public (`AboutClient.tsx`) l'utilise pour rendre l'icône d'une
//    technologie ;
//  - le formulaire d'administration l'utilise pour PROPOSER les clés connues et
//    signaler une clé inconnue.
// Deux listes séparées dériveraient : l'admin proposerait une clé que le public
// ne saurait pas rendre, ou l'inverse.
//
// ⚠️ Ce module ne contient QUE des chaînes — aucun import de SVG. C'est
// délibéré : il est importé par des composants client ET par la validation
// serveur, et y importer des composants React le rendrait inutilisable côté
// Zod. Le mapping `clé → composant SVG` vit dans `components/StackIcon.tsx`,
// qui est le seul à connaître les fichiers.
//
// ❌ AGENTS.md §9 — pas de nouveau système d'icônes : ces six clés
// correspondent EXACTEMENT aux SVG déjà présents dans `src/assets/icons/` et
// déjà affichés par la toolbox publique avant cette story.

/** Les clés d'icône rendues par le site. L'ordre est celui de la liste admin. */
export const STACK_ICON_KEYS = [
  "javascript",
  "html",
  "css",
  "react",
  "github",
  "chrome",
] as const;

export type StackIconKey = (typeof STACK_ICON_KEYS)[number];

/**
 * Libellés affichés dans le sélecteur d'icône de l'administration. Séparés des
 * clés : la clé est un identifiant technique stable stocké en base, le libellé
 * peut changer sans migration.
 */
export const STACK_ICON_LABELS: Record<StackIconKey, string> = {
  javascript: "JavaScript",
  html: "HTML",
  css: "CSS",
  react: "React",
  github: "GitHub",
  chrome: "Chrome",
};

/**
 * `true` si la clé correspond à une icône que le site sait rendre.
 *
 * ⚠️ Une clé INCONNUE n'est pas une erreur bloquante (décision Jeevons) : la
 * technologie s'affiche quand même côté public avec une icône neutre, et
 * l'administration se contente d'AVERTIR. Refuser la saisie ferait disparaître
 * la techno du site, ce qui est pire qu'une icône générique.
 */
export function isKnownStackIconKey(value: string): value is StackIconKey {
  return (STACK_ICON_KEYS as readonly string[]).includes(value);
}
