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
// ❌ AGENTS.md §9 — pas de nouveau système d'icônes : toutes les clés
// correspondent à des SVG Font Awesome Free 6.6.0 déjà présents dans
// `src/assets/icons/`, dans le format des six d'origine (`fill="currentColor"`,
// viewBox carré, attribution conservée dans le fichier).
//
// ⚠️ ÉTENDU (juillet 2026, décision Jeevons) : les six clés d'origine ne
// couvraient pas la pile réellement employée sur ce portfolio, et toute techno
// hors liste retombait sur l'icône neutre. Le registre passe à 20 entrées.
//
// 🛑 CINQ CLÉS N'ONT PAS D'ICÔNE DE MARQUE, ET C'EST ASSUMÉ. Font Awesome Free
// ne publie pas de logo pour TypeScript, Next.js, Tailwind, Prisma ni
// PostgreSQL (vérifié contre le CDN 6.6.0). Plutôt que d'introduire un second
// jeu d'icônes — ce qu'AGENTS.md §9 interdit — elles réutilisent une icône
// `solid` évocatrice : `code`, `bolt`, `wind`, `layer-group`, `database`. Le
// LIBELLÉ, lui, reste exact ; c'est lui que l'administration affiche.

/**
 * Les clés d'icône rendues par le site.
 *
 * ⚠️ L'ORDRE EST CELUI DU SÉLECTEUR ADMIN, et il est groupé — langages, front,
 * back & données, outils. Avec 20 entrées, une liste alphabétique obligerait à
 * balayer tout le menu pour trouver « React ». Ne pas trier ce tableau.
 */
export const STACK_ICON_KEYS = [
  // Langages
  "javascript",
  "typescript",
  "python",
  "php",
  // Front
  "html",
  "css",
  "sass",
  "tailwind",
  "react",
  "nextjs",
  // Back & données
  "node",
  "prisma",
  "postgresql",
  // Outils
  "git",
  "github",
  "docker",
  "linux",
  "npm",
  "figma",
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
  typescript: "TypeScript",
  python: "Python",
  php: "PHP",
  html: "HTML",
  css: "CSS",
  sass: "Sass",
  tailwind: "Tailwind CSS",
  react: "React",
  nextjs: "Next.js",
  node: "Node.js",
  prisma: "Prisma",
  postgresql: "PostgreSQL",
  git: "Git",
  github: "GitHub",
  docker: "Docker",
  linux: "Linux",
  npm: "npm",
  figma: "Figma",
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
