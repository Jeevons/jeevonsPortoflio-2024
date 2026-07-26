import ChromeIcon from "@/assets/icons/chrome.svg";
import CssIcon from "@/assets/icons/css3.svg";
import GithubIcon from "@/assets/icons/github.svg";
import HtmlIcon from "@/assets/icons/html5.svg";
import ReactIcon from "@/assets/icons/react.svg";
import SparkleIcon from "@/assets/icons/sparkle.svg";
import JavascriptIcon from "@/assets/icons/square-js.svg";
import { isKnownStackIconKey, type StackIconKey } from "@/lib/stack-icons";

// Story 5.15 — Résolution `iconKey` → composant SVG (AC3).
//
// ⚠️ SEUL module à connaître les FICHIERS d'icônes. Le registre de clés
// (`lib/stack-icons.ts`) n'en importe aucun, pour rester utilisable côté
// validation serveur ; c'est ici que les deux se rejoignent.
//
// Les six composants sont exactement ceux que la toolbox publique importait en
// dur avant cette story — aucun nouveau jeu d'icônes (AGENTS.md §9).

const ICONS: Record<StackIconKey, React.ElementType> = {
  javascript: JavascriptIcon,
  html: HtmlIcon,
  css: CssIcon,
  react: ReactIcon,
  github: GithubIcon,
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
