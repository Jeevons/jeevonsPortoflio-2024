"use client";

import schoolIcon1 from "@/assets/images/bac-icon.webp";
import schoolIcon4 from "@/assets/images/jeevons-avatar-coding.webp";
import schoolIcon5 from "@/assets/images/jeevons-avatar-lynx.webp";
import schoolIcon3 from "@/assets/images/mmi-icon.webp";
import schoolIcon2 from "@/assets/images/university-icon.webp";
import { Card } from "@/components/Card";
import { Reveal } from "@/components/Reveal";
import { SectionHeader } from "@/components/SectionHeader";
import { useReducedMotion } from "@/lib/motion";
import { motion, useScroll, useSpring } from "motion/react";
import Image, { type StaticImageData } from "next/image";
import { useRef } from "react";

// Story 6.9 (AC1 → AC5) — LE CARROUSEL HORIZONTAL EST REMPLACÉ PAR UN DÉROULÉ
// VERTICAL.
//
// C'est la story de l'Epic 6 où l'on RETIRE le plus de code. Ont disparu ici :
// le `setInterval` d'auto-défilement et son `useEffect`, les états
// `isHovered` / `isClicked` et leurs gestionnaires, le listener `document.click`,
// le conteneur `overflow-x-auto` avec son `mask-image` horizontal, le
// `hover:-rotate-3` des cartes, et — le plus important — la DUPLICATION
// `[...entries, ...entries]`.
//
// 🛑 POURQUOI LA DUPLICATION DEVAIT PARTIR. Elle n'existait que pour donner
// l'illusion d'un carrousel infini : le défilement revenait à zéro sans que la
// couture se voie. Conservée dans un déroulé vertical, elle afficherait
// simplement CHAQUE FORMATION DEUX FOIS — bug immédiatement visible.
//
// ⚠️ LE NOM DU FICHIER MENT, ET C'EST ASSUMÉ. La section « parcours » vit dans
// `Testimonials*.tsx` par héritage. Le renommer toucherait `page.tsx` et
// `preview/page.tsx` et brouillerait un diff déjà lourd : le périmètre de cette
// story est le CONTENU, pas le nom.
//
// 🛑 `id="parcours"` EST CONSERVÉ SUR LA `<section>`. Le perdre casserait à la
// fois la navigation (story 1.1, `Header.tsx`) et le scroll-spy (story 6.5,
// `lib/use-active-section.ts`), qui s'adossent tous deux à cet identifiant.

// Jointure locale slug → avatar (héritée de la story 4.2) : l'avatar reste un
// import statique associé au slug de l'entrée.
//
// ⚠️ ELLE NE COUVRE QUE CINQ SLUGS EN DUR. Une entrée créée depuis
// l'administration avec un autre slug n'y trouve rien. Le rendu de l'avatar est
// donc CONDITIONNEL plus bas : avant cette story, `<Image src={undefined}>`
// faisait planter le rendu. Le bug préexiste ; le déroulé vertical l'aurait
// rendu plus visible, on le referme au passage.
//
// ⚠️ Brancher la vraie relation `avatar` (modèle `Media`, story 5.14) serait la
// correction de fond, mais elle est hors du périmètre verrouillé de cette story.
const avatarBySlug: Record<string, StaticImageData> = {
  "bac-es": schoolIcon1,
  "licence-eco-gestion": schoolIcon2,
  "but-mmi": schoolIcon3,
  "cefim-dwwm": schoolIcon4,
  "apres-le-cda": schoolIcon5,
};

export type TestimonialEntry = {
  slug: string;
  title: string;
  place: string;
  body: string;
  /** Story 6.9 — année de début, affichée sur le jalon. */
  startYear: number;
  /**
   * Année de fin. `null` exprime « toujours en cours » (story 5.14, AC1) et est
   * rendu « aujourd'hui » — 🛑 jamais `null`, jamais une année inventée.
   */
  endYear: number | null;
};

/** Ressort du remplissage de la ligne — suit le défilement sans saccade. */
const SPRING = { stiffness: 120, damping: 30, restDelta: 0.001 } as const;

/**
 * Rend la période d'une entrée.
 *
 * 🛑 Le cas `endYear === null` est le seul qui compte vraiment ici : c'est lui
 * qui dit « en cours ». Une seule année s'affiche seule (2021), pas « 2021 —
 * 2021 ».
 */
const formatPeriod = (startYear: number, endYear: number | null) => {
  if (endYear === null) {
    return `${startYear} — aujourd'hui`;
  }
  if (endYear === startYear) {
    return `${startYear}`;
  }
  return `${startYear} — ${endYear}`;
};

export const TestimonialsClient = ({
  entries,
}: {
  entries: TestimonialEntry[];
}) => {
  const shouldReduceMotion = useReducedMotion();
  const listRef = useRef<HTMLOListElement>(null);

  // AC2 — LA LIGNE SE REMPLIT AU DÉFILEMENT.
  //
  // `useScroll` avec `target` + `offset` donne une progression RELATIVE à la
  // liste, et non à la page entière : la ligne commence à se remplir quand le
  // haut de la liste atteint le bas de l'écran, et est pleine quand son bas
  // atteint le bas de l'écran. Aucun listener `scroll` maison — il faudrait
  // recalculer des offsets à chaque image, c'est le layout thrashing garanti que
  // le piège n°4 de la story interdit.
  const { scrollYProgress } = useScroll({
    target: listRef,
    offset: ["start end", "end end"],
  });

  const smoothProgress = useSpring(scrollYProgress, SPRING);

  return (
    <section className="py-16 lg:py-24" id="parcours">
      <div className="container">
        {/* Story 6.4 — la révélation de l'entête est conservée telle quelle.
            ⚠️ La prop `indication="Survolez / Cliquez sur une carte pour
            l'arrêter"` a été RETIRÉE : elle décrivait le carrousel qui vient
            d'être supprimé. La laisser serait mentir au visiteur. */}
        <Reveal>
          <SectionHeader
            eyebrow="Mon parcours"
            title="Découvrez d'où je viens"
            description="Et où j'aimerai aller !"
          />
        </Reveal>

        {/* AC1 / AC4 — DÉROULÉ VERTICAL, UNE SEULE COLONNE, À TOUTES LES
            TAILLES.
            🛑 Pas d'alternance gauche/droite : sur téléphone elle réduirait
            chaque carte à une demi-largeur illisible, et AC4 exige la lisibilité
            à 375 px. La ligne reste à gauche, toutes les cartes du même côté.
            Le `relative` porte le positionnement absolu de la ligne ; le
            `padding-left` réserve la gouttière qu'elle occupe. */}
        <ol
          ref={listRef}
          className="relative mt-12 flex list-none flex-col gap-8 pl-10 md:gap-12 md:pl-16 lg:mt-20"
        >
          {/* Rail de la ligne — le tracé « vide », toujours visible : sans lui,
              rien ne relierait les jalons tant que la progression est à zéro. */}
          <div
            aria-hidden="true"
            className="absolute bottom-0 left-[7px] top-0 w-px bg-white/10 md:left-[11px]"
          >
            {/* AC2 — LE REMPLISSAGE. N'anime QUE `transform` (`scaleY`), composé
                par le GPU. ❌ Jamais `height` : ce serait un recalcul de mise en
                page à chaque image.
                ⚠️ `transform-origin: top` est indispensable — sans lui la ligne
                se remplirait depuis son centre, dans les deux directions.

                🛑 AC5 — « COMPLET ET REMPLI », pas seulement « sans animation ».
                Sous mouvement réduit on court-circuite `useScroll` par un
                `scaleY(1)` EN DUR : une ligne figée à `scaleY(0)` afficherait un
                déroulé vide, ce qui échoue l'AC et fait perdre de
                l'information. */}
            <motion.div
              className="bg-gradient-accent h-full w-full origin-top"
              style={
                shouldReduceMotion ? { scaleY: 1 } : { scaleY: smoothProgress }
              }
            />
          </div>

          {entries.map((entry, index) => {
            const avatar = avatarBySlug[entry.slug];

            return (
              // AC2 — « les jalons s'illuminent à mesure ».
              //
              // ⚠️ C'est le composant `Reveal` de la story 6.4 qui porte cette
              // entrée en scène, et non un second `IntersectionObserver` maison :
              // il en encapsule déjà un (`whileInView` + `viewport.once`), et le
              // piège n°4 avertit que deux couches d'animation d'entrée
              // superposées donnent un rendu confus. Il gère aussi le mouvement
              // réduit (état final direct) et l'arrivée sur une ancre.
              <Reveal
                as="li"
                key={entry.slug}
                index={index}
                className="relative"
              >
                {/* Jalon. Posé sur la ligne, centré dessus par sa position
                    négative. `pointer-events-none` : purement décoratif, il ne
                    doit rien intercepter. */}
                <span
                  aria-hidden="true"
                  className="bg-gradient-accent pointer-events-none absolute -left-10 top-6 size-[15px] rounded-full ring-4 ring-gray-900 md:-left-16 md:size-[23px]"
                />

                <Card className="p-6 md:p-8">
                  <div className="flex items-start gap-4">
                    {/* ⚠️ RENDU CONDITIONNEL — voir `avatarBySlug` plus haut :
                        une entrée administrée hors des cinq slugs en dur n'a pas
                        d'avatar, et `<Image src={undefined}>` plantait. */}
                    {avatar ? (
                      <div className="inline-flex size-14 flex-shrink-0 items-center justify-center rounded-full bg-gray-700">
                        <Image
                          src={avatar}
                          alt={entry.title}
                          className="max-h-full"
                        />
                      </div>
                    ) : null}

                    <div className="flex flex-col gap-1">
                      {/* AC1 / AC3 — LES ANNÉES, enfin visibles. C'est ce qui
                          rend le déroulé chronologique à la lecture, le tri
                          restant celui de l'administration (`sortOrder`). */}
                      <div className="text-gradient-accent text-sm font-bold uppercase tracking-widest">
                        {formatPeriod(entry.startYear, entry.endYear)}
                      </div>
                      <div className="text-sm font-semibold md:text-base">
                        {entry.title}
                      </div>
                      <div className="text-sm text-white/40">{entry.place}</div>
                    </div>
                  </div>
                  <p className="mt-4 text-xs font-extralight md:mt-6 md:text-base">
                    {entry.body}
                  </p>
                </Card>
              </Reveal>
            );
          })}
        </ol>
      </div>
    </section>
  );
};
