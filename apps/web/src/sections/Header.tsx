"use client";

import { ScrollProgress } from "@/components/ScrollProgress";
import { useActiveSection } from "@/lib/use-active-section";
import { useMotionValueEvent, useScroll } from "motion/react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { twMerge } from "tailwind-merge";

// Story 6.5 — NAVIGATION VIVANTE : progression (AC1), compactage au défilement
// (AC2), scroll-spy (AC3), accessible au clavier (AC4), neutralisée sous
// mouvement réduit (AC5).
//
// ⚠️ POURQUOI `"use client"` EST ACCEPTABLE ICI, alors que la story 6.4
// l'interdisait aux sections.
//
// Ce composant ne lit AUCUNE donnée : ni appel base, ni `await`. Il n'y a donc
// pas de lecture serveur à casser, contrairement aux sections `async`. Le
// garde-fou à vérifier est ailleurs : `/` doit rester `○ (Static, 1h)` au build
// et ne pas basculer en `ƒ (Dynamic)` — c'est la régression que `page.tsx`
// documente depuis la story 5.11. Contrôlé au build (voir Completion Notes).

/**
 * Les CINQ entrées du menu. Volontairement **pas six** : `#side-projects` n'a
 * pas de lien dédié, par décision de la story 1.1 (AC3). Le scroll-spy replie
 * cette section sur « Projets » (voir `use-active-section.ts`).
 */
const NAV_ITEMS = [
  { id: "hero", href: "#hero", label: "Home" },
  { id: "projects", href: "#projects", label: "Projets" },
  { id: "parcours", href: "#parcours", label: "Parcours" },
  { id: "about", href: "#about", label: "À propos" },
  { id: "contact", href: "#contact", label: "Contact" },
];

/** Défilement (en px) au-delà duquel la nav passe en état compact (AC2). */
const COMPACT_THRESHOLD = 80;

/**
 * Les pages qui PORTENT les sections ancrées.
 *
 * 🛑 Ailleurs, un `href="#projects"` ne désigne RIEN : le navigateur ne trouve
 * pas la cible et le clic reste sans effet — c'est exactement ce qui se
 * produisait sur `/projects/[slug]` depuis la story 6.10, qui a introduit la
 * première page publique n'étant pas la page d'accueil. La nav doit alors
 * pointer vers `/#ancre`, ce qui ramène à l'accueil PUIS défile.
 */
const ANCHORED_PAGES = ["/", "/preview"];

export const Header = () => {
  const activeNavId = useActiveSection();
  const [isCompact, setIsCompact] = useState(false);
  const { scrollY } = useScroll();

  // ⚠️ `usePathname` plutôt qu'une prop à passer depuis chaque page : les trois
  // appelants (`/`, `/preview`, `/projects/[slug]`) n'ont pas à se souvenir de
  // la renseigner, et toute route publique future est couverte d'office. Le
  // composant est déjà client (voir l'en-tête), le hook ne coûte donc rien.
  const pathname = usePathname();
  const isOnAnchoredPage = ANCHORED_PAGES.includes(pathname);

  // ⚠️ `useMotionValueEvent` et non un listener `scroll` maison : `motion`
  // s'abonne à sa propre valeur de défilement, déjà mutualisée, au lieu
  // d'ajouter un second écouteur qui lirait le DOM à chaque évènement (piège
  // n°4). L'état React ne change qu'au FRANCHISSEMENT du seuil, pas à chaque
  // pixel défilé — sans quoi on provoquerait un rendu par évènement.
  useMotionValueEvent(scrollY, "change", (latest) => {
    const next = latest > COMPACT_THRESHOLD;
    setIsCompact((current) => (current === next ? current : next));
  });

  return (
    <>
      {/* AC1 — hors du `<header>` : la barre couvre toute la largeur de l'écran,
          alors que le header est une pilule centrée. */}
      <ScrollProgress />

      {/* ⚠️ `--scrollbar-compensation` est posée par `ContactDialog` le temps de
          la modale, qui gèle le défilement de la page. Comme ce header est
          `fixed w-full`, il se dimensionne sur le VIEWPORT et non sur le `body` :
          la compensation appliquée à ce dernier ne l'atteint pas, et sans cette
          règle il serait le seul élément à sauter à l'ouverture — d'autant plus
          visible qu'il est en haut de l'écran. Vaut 0 le reste du temps, et là
          où la barre de défilement est en superposition (macOS par défaut). */}
      <header
        className="flex justify-center items-center fixed top-3 w-full z-10"
        style={{ paddingRight: "var(--scrollbar-compensation, 0px)" }}
      >
        {/* AC2 — « se compacte et se floute pour se faire discrète SANS
            DISPARAÎTRE ».

            🛑 Rien ici ne touche à l'opacité de la nav et rien ne la masque :
            elle reste présente et cliquable en permanence. Ce qui change, c'est
            son AMPLEUR (espacements) et l'intensité du flou — `backdrop-blur`
            était déjà présent avant cette story, on l'ACCENTUE en
            `backdrop-blur-xl` plutôt que de l'introduire (piège n°5).

            ⚠️ Cibles tactiles ≥ 44 px préservées : le compactage ne joue que sur
            l'espacement EXTÉRIEUR (`gap`, `p` de la pilule). `.nav-item` garde
            son `px-4 py-1.5`, donc la hauteur des liens eux-mêmes est
            inchangée.

            La transition CSS est couverte par la règle globale reduced-motion de
            la story 6.2 (durées ET délais neutralisés) : AC5 est satisfait pour
            le header sans code conditionnel ici. */}
        <nav
          aria-label="Navigation principale"
          className={twMerge(
            "flex border border-white/15 rounded-full bg-white/10 transition-all duration-300",
            isCompact
              ? "gap-0.5 p-0 backdrop-blur-xl"
              : "gap-1 p-0.5 backdrop-blur",
          )}
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeNavId === item.id;
            // « Contact » est un bouton plein depuis l'origine : lui appliquer
            // en plus le traitement d'état actif serait redondant et abîmerait
            // son contraste.
            const isCta = item.id === "contact";

            return (
              <a
                key={item.id}
                // Hors d'une page ancrée, le fragment est PRÉFIXÉ par `/` :
                // sans cela le clic ne fait rien (voir `ANCHORED_PAGES`).
                href={isOnAnchoredPage ? item.href : `/${item.href}`}
                // AC4 — signal SÉMANTIQUE, pour qui la couleur n'existe pas.
                // `aria-current="location"` est la valeur prévue pour « l'endroit
                // courant dans un ensemble », ce qu'est exactement une section.
                aria-current={isActive ? "location" : undefined}
                className={twMerge(
                  "nav-item",
                  // AC4 — focus visible contrasté, pattern harmonisé en story
                  // 5.20. Les entrées restent des `<a href>` : focusables
                  // nativement, atteignables au Tab, rien à réimplémenter. Un
                  // `<div onClick>` aurait cassé cela.
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                  isCta
                    ? "bg-white text-surface hover:bg-white/70 hover:text-surface"
                    : "font-light",
                  // 🛑 AC4 — L'ÉTAT ACTIF NE REPOSE PAS SUR LA SEULE COULEUR.
                  //
                  // Trois signaux cumulés, dont deux survivent à un rendu en
                  // NIVEAUX DE GRIS (le test décisif) : un FOND plein, une
                  // GRAISSE renforcée, et seulement en troisième lieu la
                  // couleur du texte. `.nav-item` seul ne jouait que sur la
                  // couleur (`text-white/70` → `text-white`) : s'en contenter
                  // aurait échoué l'AC4 et WCAG 1.4.1.
                  !isCta && isActive && "bg-white/20 font-semibold text-white",
                )}
              >
                {item.label}
              </a>
            );
          })}
        </nav>
      </header>
    </>
  );
};
