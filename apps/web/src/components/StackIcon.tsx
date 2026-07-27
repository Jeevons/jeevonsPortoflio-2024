import ChromeIcon from "@/assets/icons/chrome.svg";
import CssIcon from "@/assets/icons/css3.svg";
import DockerIcon from "@/assets/icons/docker.svg";
import FigmaIcon from "@/assets/icons/figma.svg";
import GitIcon from "@/assets/icons/git.svg";
import GithubIcon from "@/assets/icons/github.svg";
import HtmlIcon from "@/assets/icons/html5.svg";
import LinuxIcon from "@/assets/icons/linux.svg";
import NextjsIcon from "@/assets/icons/nextjs.svg";
import NodeIcon from "@/assets/icons/node.svg";
import NpmIcon from "@/assets/icons/npm.svg";
import PhpIcon from "@/assets/icons/php.svg";
import PostgresqlIcon from "@/assets/icons/postgresql.svg";
import PrismaIcon from "@/assets/icons/prisma.svg";
import PythonIcon from "@/assets/icons/python.svg";
import ReactIcon from "@/assets/icons/react.svg";
import SassIcon from "@/assets/icons/sass.svg";
import SparkleIcon from "@/assets/icons/sparkle.svg";
import JavascriptIcon from "@/assets/icons/square-js.svg";
import TailwindIcon from "@/assets/icons/tailwind.svg";
import TypescriptIcon from "@/assets/icons/typescript.svg";
import { isKnownStackIconKey, type StackIconKey } from "@/lib/stack-icons";

// Story 5.15 — Résolution `iconKey` → composant SVG (AC3).
//
// ⚠️ SEUL module à connaître les FICHIERS d'icônes. Le registre de clés
// (`lib/stack-icons.ts`) n'en importe aucun, pour rester utilisable côté
// validation serveur ; c'est ici que les deux se rejoignent.
//
// Toutes les icônes viennent de Font Awesome Free 6.6.0, comme les six
// d'origine — aucun nouveau jeu d'icônes (AGENTS.md §9).
//
// ⚠️ `Record<StackIconKey, …>` est le GARDE-FOU : ajouter une clé au registre
// sans l'icône correspondante ici est une ERREUR DE COMPILATION, pas un carré
// vide découvert en production. Ne jamais relâcher ce type.

const ICONS: Record<StackIconKey, React.ElementType> = {
  javascript: JavascriptIcon,
  // ⚠️ Icônes `solid` GÉNÉRIQUES et non des logos : Font Awesome Free n'en
  // publie pas pour ces cinq technos (voir `lib/stack-icons.ts`).
  typescript: TypescriptIcon,
  python: PythonIcon,
  php: PhpIcon,
  html: HtmlIcon,
  css: CssIcon,
  sass: SassIcon,
  tailwind: TailwindIcon,
  react: ReactIcon,
  nextjs: NextjsIcon,
  node: NodeIcon,
  prisma: PrismaIcon,
  postgresql: PostgresqlIcon,
  git: GitIcon,
  github: GithubIcon,
  docker: DockerIcon,
  linux: LinuxIcon,
  npm: NpmIcon,
  figma: FigmaIcon,
  chrome: ChromeIcon,
};

/**
 * Icône de repli (décision Jeevons) : une technologie dont la clé est inconnue
 * — ou absente — s'affiche QUAND MÊME, avec cette icône neutre.
 *
 * ⚠️ Ne jamais la masquer : une techno saisie qui disparaîtrait du site sans
 * rien dire serait un bug silencieux. L'administration signale la clé inconnue
 * de son côté, c'est là que la correction se fait.
 */
const FALLBACK_ICON: React.ElementType = SparkleIcon;

/**
 * Composant SVG correspondant à une clé, ou l'icône de repli.
 *
 * `iconKey` est `string | null` et non `StackIconKey` : la valeur vient de la
 * base, où rien ne garantit qu'elle appartienne au registre — une clé peut
 * avoir été saisie avant l'ajout d'un SVG, ou l'icône avoir été retirée.
 */
export function resolveStackIcon(iconKey: string | null): React.ElementType {
  if (iconKey === null || !isKnownStackIconKey(iconKey)) {
    return FALLBACK_ICON;
  }
  return ICONS[iconKey];
}
