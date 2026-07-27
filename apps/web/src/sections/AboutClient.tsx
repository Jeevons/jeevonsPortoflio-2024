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
        {/* Story 6.15 (AC1) — UNE SEULE GRILLE MODULAIRE.

            🛑 Auparavant : DEUX `div` de grille indépendants, et quatre cartes
            TOUTES figées à `h-[380px]`. Deux rangées séparées ne sont pas une
            grille — les blocs ne peuvent pas se répartir librement — et une
            hauteur uniforme est l'inverse d'« une taille adaptée au contenu ».

            🛑 LA TENSION AC1 / AC2, ET SA RÉSOLUTION. « Taille adaptée au
            contenu » pousse à retirer les hauteurs fixes ; or l'aire de jeu des
            centres d'intérêt a BESOIN d'une hauteur, sans quoi `dragConstraints`
            s'effondre à 0 pixel et les vignettes deviennent indéplaçables — en
            silence, sans la moindre erreur.

            🛑 CORRECTION (retour Jeevons, capture du 27/07). Une première version
            donnait à chaque carte une hauteur LIBRE, avec `items-start`. Résultat
            constaté à l'écran : la carte CV descendait bien plus bas que la
            toolbox, les hobbies dépassaient la carte/memoji — quatre blocs qui ne
            s'alignaient plus sur rien. ❌ Ce n'est pas un bento, c'est du
            désordre.

            ✅ CE QU'EST RÉELLEMENT UN BENTO : des blocs de tailles DIFFÉRENTES
            qui S'IMBRIQUENT. Ce sont les LARGEURS qui varient (1/3 vs 2/3), les
            rangées, elles, restent alignées. La « taille adaptée au contenu »
            d'AC1 se lit donc sur la largeur — un CV étroit, une toolbox large —
            et non sur une hauteur propre à chaque carte.

            D'où : ❌ PAS de `items-start` (on garde `stretch`, le défaut), et
            `h-full` sur chaque wrapper ET sa carte, pour que les deux cartes
            d'une même rangée s'alignent. ⚠️ Le `h-full` doit être sur les DEUX :
            le wrapper s'étire via `stretch`, mais la carte ne suit pas d'
            elle-même.

            ⚠️ L'aire de jeu des hobbies conserve en plus une hauteur MINIMALE
            (`min-h-[380px]`) : elle doit exister même si sa rangée était courte.

            ⚠️ AC3 — la grille s'effondre en `grid-cols-1` sur petit écran, et
            l'ordre du DOM est l'ordre de lecture : ❌ aucun `order`, ❌ aucun
            `hidden`, ❌ aucune troncature. */}
        <div className="mt-20 grid grid-cols-1 gap-8 md:grid-cols-5 lg:grid-cols-3">
          {/* Story 6.4 (AC1) — CASCADE PAR CARTE, désormais possible.

              ⚠️ Le commentaire précédent notait, à raison, qu'envelopper une
              carte appliquerait le `col-span` au wrapper et non à la carte. La
              grille étant maintenant unique, la correction est de déplacer les
              spans SUR les `Reveal` : le wrapper EST l'élément de grille, et la
              carte porte sa propre hauteur (explicite ou libre). On gagne une
              cascade carte par carte au lieu de deux rangées en bloc. */}
          {/* CARTE CV — étroite (1/3), alignée sur la toolbox. */}
          <Reveal index={0} className="h-full md:col-span-2 lg:col-span-1">
            <Card className="flex h-full flex-col pb-6">
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
                // `my-auto` : la carte étant maintenant étirée à la hauteur de
                // sa rangée, la vignette se centre dans l'espace restant au lieu
                // de laisser un grand vide sous elle.
                <Link href="/cv" className="mx-auto my-auto flex w-40">
                  {/* Vignette déjà normalisée en WebP par sharp (5.17, comme
                      les covers 5.12) : `<img>` plutôt que `next/image`,
                      `width`/`height` explicites réservent la place (anti-CLS). */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cv.thumbnailUrl}
                    alt="Première page du CV"
                    width={cv.thumbnailWidth}
                    height={cv.thumbnailHeight}
                    /* Story 6.18 (AC3) — `loading="lazy"` : la carte CV est
                       loin sous la ligne de flottaison.
                       ⚠️ Pas de `blurDataUrl` en fond ici, contrairement aux
                       covers : `CurrentCv` (5.17) ne stocke QUE
                       `thumbnailPath` + dimensions. L'anti-CLS est assuré par
                       les `width`/`height` réels, qui suffisent à réserver la
                       place. */
                    loading="lazy"
                  />
                </Link>
              ) : (
                // État neutre : aucun CV téléversé pour l'instant (piège n°5).
                <p className="mx-auto my-auto max-w-[10rem] text-center text-sm text-muted-foreground">
                  CV bientôt disponible.
                </p>
              )}
            </Card>
          </Reveal>

          {/* CARTE TOOLBOX — hauteur LIBRE, réglée par ses deux bandes.

              ⚠️ La toolbox est CONSERVÉE : décision Jeevons prise en 6.13, où la
              nouvelle section « Stack & outils » a été ajoutée SANS la
              remplacer. Elle est décorative (deux bandes défilantes de logos) là
              où l'autre est informative (domaine + niveau) — pas de doublon.
              ❌ Hors périmètre de cette story de toute façon. */}
          <Reveal index={1} className="h-full md:col-span-3 lg:col-span-2">
            <Card className="flex h-full flex-col pb-6">
              <CardHeader
                title="Mon pack d'explorateur"
                description="Découvrez les technologies et outils qui m'accompagnent dans mes aventures, pour créer et innover dans cet univers digital."
                className=""
              />
              {/* `my-auto` : les deux bandes se centrent dans la hauteur
                  restante, la carte étant désormais étirée à celle de sa
                  rangée. ⚠️ `ToolboxItems` n'expose pas de conteneur commun —
                  d'où cette enveloppe, qui ne touche pas au composant partagé. */}
              <div className="my-auto">
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
              </div>
            </Card>
          </Reveal>
          {/* CARTE CENTRES D'INTÉRÊT — 🛑 HAUTEUR EXPLICITE, DÉLIBÉRÉMENT.

              🛑 NE JAMAIS LAISSER CETTE CARTE SANS HAUTEUR. C'est le piège
              central de la story, et son échec est SILENCIEUX. Sans hauteur,
              `flex-1` n'a plus rien à remplir : le conteneur de contrainte
              s'effondre à 0 pixel, `dragConstraints` référence une aire vide, et
              les vignettes — positionnées en `absolute` à des pourcentages —
              deviennent indéplaçables ou invisibles. Aucune erreur, aucun
              avertissement.

              ⚠️ D'où `min-h-[380px]` EN PLUS de `h-full` : `h-full` l'aligne sur
              sa rangée (bento), et le `min-h` garantit que l'aire de jeu existe
              même si cette rangée était courte. ❌ L'un sans l'autre ne suffit
              pas.

              🛑 `relative`, `flex-1` et le `ref` restent EXACTEMENT où ils sont
              (piège n°1 : les déplacer fausse les contraintes). */}
          <Reveal index={2} className="h-full md:col-span-3 lg:col-span-2">
            <Card className="flex h-full min-h-[380px] flex-col p-0">
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
          </Reveal>

          {/* CARTE / MEMOJI — étroite (1/3), alignée sur les hobbies.

              ⚠️ Son contenu est une IMAGE DE FOND en `object-cover` : elle n'a
              pas de hauteur intrinsèque à suivre, c'est le cadre qui la découpe.
              `h-full` lui donne celle de sa rangée, et l'image s'y adapte. */}
          <Reveal index={3} className="h-full md:col-span-2 lg:col-span-1">
            <Card className="relative h-full min-h-[320px] p-0">
              {/* Story 6.18 (AC1, AC2) — ✅ `sizes` JUSTIFIÉ ICI : contrairement
                  aux memojis, cette image est rendue en `w-full` dans une carte
                  dont la largeur CHANGE aux points de rupture (pleine largeur en
                  mobile, 2/3 en `md`, 1/3 en `lg`). Sans `sizes`, le navigateur
                  téléchargerait la même largeur sur un téléphone que sur un
                  écran large — précisément le « format unique » que l'AC1
                  dénonce. Valeurs calées sur les paliers DU PROJET
                  (`tailwind.config.ts` : md 768px, lg 1200px), pas sur ceux de
                  Tailwind par défaut. */}
              <Image
                src={mapImage}
                alt="Map"
                className="h-full w-full object-cover object-left-top"
                sizes="(min-width: 1200px) 33vw, (min-width: 768px) 66vw, 100vw"
                placeholder="blur"
              />
              {/* ⚠️ `top-1/2` et non `top-32` : la carte s'étire désormais à la
                  hauteur de sa rangée, un décalage fixe en pixels ne la
                  centrerait plus. */}
              <div className="absolute flex items-center justify-center top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-20 rounded-full   after:content-[''] after:absolute after:inset-0 after:outline after:outline-2 after:outline-offset-2 after:rounded-full after:outline-surface-sunken/30">
                <div className="absolute inset-0 rounded-full bg-gradient-accent -z-20 animate-ping [animation-duration:2s]"></div>
                <div className="absolute inset-0 rounded-full bg-gradient-accent -z-10"></div>
                {/* ⚠️ Taille FIXE (`size-16`) : pas de `sizes`, même raison que
                    le memoji du hero. */}
                <Image
                  src={smileMemoji}
                  alt="Smiling Memoji"
                  className="size-16"
                  placeholder="blur"
                />
              </div>
            </Card>
          </Reveal>
        </div>
      </div>
    </section>
  );
};
