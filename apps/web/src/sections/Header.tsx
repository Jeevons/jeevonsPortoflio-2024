"use client";

import { MobileNavDialog } from "@/components/MobileNavDialog";
import { ScrollProgress } from "@/components/ScrollProgress";
import { useActiveSection } from "@/lib/use-active-section";
import { useMotionValueEvent, useScroll } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
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
  const [isMobileNavOpen, setMobileNavOpen] = useState(false);
  const mobileNavId = useId();
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

  // 🛑 FERMER LE MENU MOBILE DÈS QUE L'ÉCRAN REDEVIENT LARGE. Sans cela, une
  // rotation de tablette ou un redimensionnement de fenêtre laisse le panneau
  // ouvert PAR-DESSUS la page alors que le bouton qui l'a ouvert vient de
  // disparaître (`sm:hidden`) : plus rien à l'écran ne permet de le refermer,
  // sinon `Échap`. Le seuil `640px` est celui de `sm` — ⚠️ le changer ici sans
  // changer les classes `sm:` (ou l'inverse) recrée exactement ce piège.
  useEffect(() => {
    if (!isMobileNavOpen) return;

    const wide = window.matchMedia("(min-width: 640px)");
    const close = () => {
      if (wide.matches) setMobileNavOpen(false);
    };

    close();
    wide.addEventListener("change", close);
    return () => wide.removeEventListener("change", close);
  }, [isMobileNavOpen]);

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
        {/* 🛑 BOUTON D'OUVERTURE DU MENU, SOUS `sm` UNIQUEMENT (retour Jeevons,
            27/07 : la pilule à cinq entrées ne tient pas sur une ligne à 375 px
            — « À propos » passait à la ligne et déformait toute la barre).

            ⚠️ C'est un VRAI `<button type="button">` : focusable nativement,
            actionné à l'Entrée comme à l'Espace, annoncé comme bouton. Un `<div
            onClick>` aurait tout cela à réimplémenter.

            ⚠️ `aria-expanded` est ce qui rend l'état AUDIBLE : sans lui, un
            lecteur d'écran annonce « Menu, bouton » sans jamais dire si le
            panneau est ouvert ou fermé. `aria-controls` le relie au panneau. */}
        <button
          type="button"
          className="sm:hidden inline-flex size-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur transition-colors duration-200 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          aria-expanded={isMobileNavOpen}
          aria-controls={mobileNavId}
          aria-label="Ouvrir le menu de navigation"
          onClick={() => setMobileNavOpen(true)}
        >
          {/* Décoratif : `aria-label` ci-dessus porte déjà le sens. */}
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="size-5"
          >
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>

        {/* ⚠️ `hidden sm:flex` — LA PILULE NE VIT QU'À PARTIR DE `sm`. Le seuil
            est le même que celui du `matchMedia` ci-dessus : les deux doivent
            changer ENSEMBLE, sinon le menu mobile peut rester ouvert sans bouton
            pour le fermer.

            ⚠️ `whitespace-nowrap` : c'est le retour à la ligne de « À propos »
            qui déformait les pastilles en ovales et faisait déborder « Contact »
            du bord arrondi. Une entrée de menu ne se coupe jamais. */}
        <nav
          aria-label="Navigation principale"
          className={twMerge(
            "hidden sm:flex whitespace-nowrap border border-white/15 rounded-full bg-white/10 transition-all duration-300",
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

      {/* 🛑 LE PANNEAU EST MONTÉ HORS DU `<header>`, ET C'EST NÉCESSAIRE. Une
          `<dialog>` modale est promue dans le TOP LAYER, mais un ancêtre portant
          un `transform`, un `filter` ou un `backdrop-filter` crée un CONTEXTE DE
          POSITIONNEMENT qui la ramène de force dans le flux — le panneau se
          retrouverait alors coincé dans la pilule. Le même piège avait imposé de
          sortir `ContactDialog` du `Reveal` (transformé) en 6.12.

          ⚠️ Les `href` sont calculés ICI avec la même règle que la pilule : hors
          d'une page ancrée, le fragment est préfixé par `/`, sinon le clic ne
          fait rien (voir `ANCHORED_PAGES`). ❌ Ne pas passer `NAV_ITEMS` brut. */}
      <MobileNavDialog
        id={mobileNavId}
        open={isMobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        activeNavId={activeNavId}
        items={NAV_ITEMS.map((item) => ({
          ...item,
          href: isOnAnchoredPage ? item.href : `/${item.href}`,
        }))}
      />
    </>
  );
};
