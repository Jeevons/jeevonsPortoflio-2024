"use client";

import smileMemoji from "@/assets/images/jeevons-avatar-smiling.webp";
import mapImage from "@/assets/images/map-tours.webp";
import { Card } from "@/components/Card";
import { CardHeader } from "@/components/CardHeader";
import { Reveal } from "@/components/Reveal";
import { SectionHeader } from "@/components/SectionHeader";
import { resolveStackIcon } from "@/components/StackIcon";
import { ToolboxItems } from "@/components/ToolboxItems";
import { motion, useReducedMotion } from "motion/react";
import { useRef } from "react";

import Image from "next/image";
import Link from "next/link";

// Vue client de la section À propos (Story 4.2). Les hobbies viennent de la base
// (props depuis le conteneur serveur). Le drag conditionné par useReducedMotion
// est conservé (pièges n°1). La map reste EN DUR.
//
// Story 5.17 — Le CV vient désormais de la base (piège n°5). `cv` est `null`
// tant qu'aucun PDF n'a été téléversé (état de départ légitime, pas une
// panne) : la carte affiche alors un état NEUTRE plutôt qu'un lien mort.
//
// Story 5.15 — La TOOLBOX vient elle aussi de la base (AC3). Elle était un
// tableau `toolboxItems` codé ici avec des imports statiques de SVG ; ce tableau
// a migré vers `src/content/stacks.ts`, où il sert désormais de REPLI quand la
// base est injoignable (4.5). Les icônes sont résolues par `resolveStackIcon`,
// qui retombe sur une icône neutre plutôt que de masquer une technologie dont la
// clé est inconnue (décision Jeevons).

export type HobbyView = {
  slug: string;
  title: string;
  emoji: string;
  posLeft: string;
  posTop: string;
};

/** Une technologie telle que la toolbox l'affiche. Volontairement minimale. */
export type StackView = {
  id: string;
  name: string;
  iconKey: string | null;
};

/** CV courant tel que le rendu public le consomme (`lib/cv.ts`, story 5.17). */
export type CvView = {
  url: string;
  thumbnailUrl: string;
  thumbnailWidth: number;
  thumbnailHeight: number;
} | null;

export const AboutClient = ({
  hobbies,
  stacks,
  cv,
}: {
  hobbies: HobbyView[];
  stacks: StackView[];
  cv: CvView;
}) => {
  const constraintRef = useRef(null);
  const shouldReduceMotion = useReducedMotion();

  // ⚠️ L'ORDRE EST CELUI DU SERVEUR (niveau décroissant, puis nom) : on ne
  // retrie pas ici, sous peine de perdre la seule traduction visible de l'AC3.
  const toolboxItems = stacks.map((stack) => ({
    title: stack.name,
    iconType: resolveStackIcon(stack.iconKey),
  }));
  return (
    <section className="py-20 lg:py-28" id="about">
      <div className="container">
        {/* Story 6.4 — révélation de l'entête. */}
        <Reveal>
          <SectionHeader
            eyebrow="A propos de moi"
            title="Un aperçu de mon univers"
            description="Ce que j'aime faire, et ce qui me motive."
          />
        </Reveal>
        <div className="mt-20 flex flex-col gap-8">
          {/* Story 6.4 (AC1, piège n°5) — CASCADE SUR LES DEUX RANGÉES, pas sur
              chaque carte.

              ⚠️ Les `Card` portent des `md:col-span-*` : les envelopper
              individuellement appliquerait le span au wrapper et non à la
              carte, ce qui casserait la grille. On révèle donc les rangées,
              décalées l'une par rapport à l'autre (`index`). */}
          <Reveal
            index={0}
            className="grid grid-cols-1 gap-8 md:grid-cols-5 lg:grid-cols-3"
          >
            <Card className="h-[380px] md:col-span-2 lg:col-span-1">
              <CardHeader
                title="CV"
                description="Découvrez mon parcours, mes compétences et mes expériences."
                indication="(Cliquez sur le cv pour l'ouvrir)"
              />
              {cv ? (
                // Story 6.11 — la carte ne pointe PLUS le PDF brut mais la page
                // `/cv`, qui l'affiche dans le site avec un bouton de
                // téléchargement (PLAN §4.3, « au lieu du lien brut actuel »).
                //
                // 🛑 `target="_blank"` et `rel="noopener noreferrer"` ONT DISPARU,
                // et c'est délibéré : `/cv` est une page INTERNE, pas un lien
                // sortant — la règle AGENTS.md §6 ne s'y applique pas. Et
                // `next/link` plutôt qu'un `<a>` nu, pour une navigation
                // client interne.
                //
                // ⚠️ `cv.url` (= `/api/cv`) reste consommé par la page `/cv`
                // elle-même ; ici seul le lien de la carte change. Le texte
                // « (Cliquez sur le cv pour l'ouvrir) » du `CardHeader` reste
                // juste : le CV s'ouvre toujours, simplement dans le site.
                <Link href="/cv" className="flex w-40 mx-auto mt-2 md:mt-0">
                  {/* Vignette déjà normalisée en WebP par sharp (5.17, comme
                      les covers 5.12) : `<img>` plutôt que `next/image`,
                      `width`/`height` explicites réservent la place (anti-CLS). */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cv.thumbnailUrl}
                    alt="Première page du CV"
                    width={cv.thumbnailWidth}
                    height={cv.thumbnailHeight}
                  />
                </Link>
              ) : (
                // État neutre : aucun CV téléversé pour l'instant (piège n°5).
                <p className="mx-auto mt-2 max-w-[10rem] text-center text-sm text-muted-foreground md:mt-0">
                  CV bientôt disponible.
                </p>
              )}
            </Card>
            <Card className="h-[380px] md:col-span-3 lg:col-span-2">
              <CardHeader
                title="Mon pack d'explorateur"
                description="Découvrez les technologies et outils qui m'accompagnent dans mes aventures, pour créer et innover dans cet univers digital."
                className=""
              />
              <ToolboxItems
                items={toolboxItems}
                className=""
                itemsWrapperClassName="animate-move-left [animation-duration:30s]"
              />
              <ToolboxItems
                items={toolboxItems}
                className="mt-6"
                itemsWrapperClassName="animate-move-right [animation-duration:50s]"
              />
            </Card>
          </Reveal>
          <Reveal
            index={1}
            className="grid grid-cols-1 md:grid-cols-5 gap-8 lg:grid-cols-3"
          >
            <Card className="h-[380px] p-0 flex flex-col md:col-span-3 lg:col-span-2">
              <CardHeader
                title="Quand je ne code pas"
                description="Toujours entrain d'explorer ! Que ce soit à travers le design,
                la création vidéo ou mes petites passions geek."
                indication="(Déplacez les vignettes)"
                className="px-6 py-6"
              />
              <div className="relative flex-1" ref={constraintRef}>
                {hobbies.map((hobby) => (
                  <motion.div
                    key={hobby.title}
                    className="inline-flex items-center gap-3 bg-gradient-accent rounded-full py-1.5 px-6 absolute"
                    style={{ left: hobby.posLeft, top: hobby.posTop }}
                    drag={!shouldReduceMotion}
                    dragConstraints={constraintRef}
                    transition={
                      shouldReduceMotion ? { duration: 0 } : undefined
                    }
                  >
                    <span className="font-medium text-surface-sunken">
                      {hobby.title}
                    </span>
                    <span aria-hidden="true">{hobby.emoji}</span>
                  </motion.div>
                ))}
              </div>
            </Card>
            <Card className="h-[380px] p-0 relative md:col-span-2 lg:col-span-1">
              <Image
                src={mapImage}
                alt="Map"
                className="h-full w-full object-cover object-left-top"
              />
              <div className="absolute flex items-center justify-center top-32 left-1/2 -translate-x-1/2 -translate-y-1/2 size-20 rounded-full   after:content-[''] after:absolute after:inset-0 after:outline after:outline-2 after:outline-offset-2 after:rounded-full after:outline-surface-sunken/30">
                <div className="absolute inset-0 rounded-full bg-gradient-accent -z-20 animate-ping [animation-duration:2s]"></div>
                <div className="absolute inset-0 rounded-full bg-gradient-accent -z-10"></div>
                <Image
                  src={smileMemoji}
                  alt="Smiling Memoji"
                  className="size-16"
                />
              </div>
            </Card>
          </Reveal>
        </div>
      </div>
    </section>
  );
};
