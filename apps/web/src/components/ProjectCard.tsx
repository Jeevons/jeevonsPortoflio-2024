import ArrowUpRightIcon from "@/assets/icons/arrow-up-right.svg";
import CheckCircleIcon from "@/assets/icons/check-circle.svg";
import { Card } from "@/components/Card";
import Image, { type StaticImageData } from "next/image";

// Story 5.9 (AC3) — CARTE DE PROJET, extraite de `ProjectList` pour être
// réutilisable.
//
// ⚠️ POURQUOI CETTE EXTRACTION : l'AC3 exige que l'aperçu de l'éditeur admin
// « ressemble à ce que verra réellement un visiteur ». La seule façon honnête de
// le garantir est de faire rendre l'aperçu par LE MÊME composant que le site
// public — pas par une copie qui divergerait au premier changement de style.
//
// `ProjectList` restait couplée à sa section (balise `<section>`, `SectionHeader`,
// positionnement `sticky` calculé sur l'index) : inutilisable telle quelle dans
// un panneau d'aperçu. On isole donc la CARTE, et `ProjectList` la consomme.
//
// ⚠️ AUCUN `"use client"` ici, et c'est délibéré : ce fichier ne contient qu'une
// vue pure, sans état ni accès aux données (AGENTS.md §6). Il est donc rendu
// côté serveur sur le site public, ET importable par le Client Component de
// l'aperçu, qui l'alimente avec l'état non encore enregistré du formulaire.
// C'est exactement le pattern « conteneur serveur → vue bête » déjà appliqué en
// 4.2.

/**
 * Contrat de donnée d'un projet affiché. Volontairement source-agnostique : la
 * carte ignore si ces valeurs viennent de la base (site public) ou d'un
 * formulaire en cours de saisie (aperçu admin).
 */
export type ProjectCardData = {
  company: string;
  year: string;
  title: string;
  results: { title: string }[];
  /** URL du site du projet. Vide = pas de lien : le bouton n'est PAS rendu. */
  link: string;
  /**
   * Visuel du projet. Optionnel : tous les projets n'ont pas encore d'image
   * associée (la jointure par slug d'Epic 4 ne couvre pas les nouveaux projets,
   * et l'upload de couverture est la story 5.12).
   */
  image?: StaticImageData;
  /**
   * Story 5.12 (AC5) — Couverture TÉLÉVERSÉE depuis l'administration.
   *
   * ⚠️ Distincte de `image`, qui reste un import STATIQUE hérité d'Epic 4 (la
   * jointure par slug). Les deux coexistent le temps que les anciens projets
   * migrent vers une couverture téléversée ; `cover` est PRIORITAIRE, puisque
   * c'est le choix explicite de Jeevons dans l'éditeur.
   *
   * `alt` peut être `null` : l'absence de texte alternatif est signalée comme un
   * défaut en administration (AC3), sans jamais bloquer l'affichage public.
   */
  cover?: {
    url: string;
    width: number;
    height: number;
    blurDataUrl: string;
    alt: string | null;
  } | null;
  /** Story 5.9 (AC4) — résultat chiffré. Vide/absent : la section est MASQUÉE. */
  outcome?: string | null;
  /**
   * Story 5.11 (AC2) — ce projet est un BROUILLON affiché en mode aperçu.
   *
   * ⚠️ Ce drapeau n'a de sens QU'EN APERÇU : la lecture publique ne renvoie
   * jamais de brouillon, il y vaut donc toujours `false`. Il ne contrôle PAS la
   * visibilité (c'est la lecture qui le fait, côté serveur) — il ne fait
   * qu'ÉTIQUETER une carte que Jeevons est seul à voir.
   */
  draft?: boolean;
};

type ProjectCardProps = {
  project: ProjectCardData;
  className?: string;
  style?: React.CSSProperties;
};

export const ProjectCard = ({
  project,
  className,
  style,
}: ProjectCardProps) => {
  return (
    <Card className={className} style={style}>
      <div className="lg:grid lg:grid-cols-2 lg:gap-16">
        <div className="lg:pb-16">
          <div className="inline-flex items-baseline gap-2 font-bold uppercase tracking-widest text-sm text-gradient-accent">
            <span>{project.company}</span>
            <span>&bull;</span>
            <span className="text-3xs md:text-sm">{project.year}</span>
          </div>

          {/* Story 5.11 (AC2) — étiquette « Brouillon » sur les cartes non
              publiées, visibles uniquement en mode aperçu. Contraste AA sur le
              fond sombre des cartes (ambre 200 sur ambre 500/15) et texte réel
              plutôt qu'une pastille de couleur seule : l'information ne repose
              pas sur la couleur (AGENTS.md §6). */}
          {project.draft ? (
            <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-amber-200">
              Brouillon — non publié
            </p>
          ) : null}

          {/* Story 6.3 (AC1) — échelle fluide 2xl→4xl. Les marges restent par
              palier : la story ne porte que sur la typographie. */}
          <h3 className="font-serif text-display-3 mt-2 md:mt-5">
            {project.title}
          </h3>
          <hr className="border-t-2 border-white/5 mt-4 md:mt-5" />

          {/* AC4 — « la page publique masque simplement la section
              correspondante ». Un résultat absent ne rend donc AUCUN élément :
              ni bloc vide, ni libellé orphelin. */}
          {project.outcome ? (
            <p className="mt-4 md:mt-5 font-bold text-lg md:text-xl text-gradient-accent">
              {project.outcome}
            </p>
          ) : null}

          {/* Même règle pour les points forts : une liste vide ne rend pas de
              `<ul>` vide, que les lecteurs d'écran annonceraient tout de même
              comme « liste, 0 élément ». */}
          {project.results.length > 0 ? (
            <ul className="flex flex-col gap-4 mt-4 md:mt-5">
              {project.results.map((result, resultIndex) => (
                <li
                  key={resultIndex}
                  className="flex gap-2 text-sm md:text-base text-white/50"
                >
                  <CheckCircleIcon
                    aria-hidden="true"
                    className="size-5 md:size-6"
                  />
                  <span>{result.title}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {/* AC4 — le lien est optionnel : sans URL, on ne rend pas un bouton
              qui pointerait vers la page courante (`href=""`), ce qui était le
              comportement du code d'origine quand `project.link` valait `""`. */}
          {project.link ? (
            <a
              href={project.link}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Visiter le site du projet ${project.title} (nouvel onglet)`}
              className="bg-white text-surface-sunken h-12 w-full md:w-auto px-6 rounded-control font-semibold inline-flex items-center justify-center gap-2 mt-8 hover:scale-110 transform transition duration-300 ease-in-out"
            >
              <span>Visiter le site</span>
              <ArrowUpRightIcon aria-hidden="true" className="size-4" />
            </a>
          ) : null}
        </div>
        <div className="relative">
          {project.cover ? (
            /* Story 5.12 — `<img>` et NON `next/image` : le fichier est déjà
               normalisé en WebP et redimensionné par sharp au téléversement, le
               repasser dans l'optimiseur de Next le retraiterait sans gain.

               ⚠️ `width`/`height` explicites + `blurDataUrl` en fond : le
               navigateur connaît le ratio AVANT le chargement et réserve la
               place, ce qui empêche la page de sauter (AC2). C'est la raison
               d'être des colonnes `width`/`height` du modèle `Media`. */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="mt-8 -mb-4 md:mb-0 lg:mt-0 lg:absolute lg:h-full lg:w-auto lg:max-w-[450px]"
              src={project.cover.url}
              width={project.cover.width}
              height={project.cover.height}
              /* `alt=""` quand le texte manque : une image DÉCORATIVE est
                 ignorée par les lecteurs d'écran, ce qui vaut mieux qu'un nom
                 de fichier lu à voix haute. Le défaut est signalé côté
                 administration (AC3), là où il peut être corrigé. */
              alt={project.cover.alt ?? ""}
              loading="lazy"
              style={{
                backgroundImage: `url(${project.cover.blurDataUrl})`,
                backgroundSize: "cover",
              }}
            />
          ) : project.image ? (
            <Image
              className="mt-8 -mb-4 md:mb-0 lg:mt-0 lg:absolute lg:h-full lg:w-auto lg:max-w-[450px]"
              src={project.image}
              alt={`Capture d'écran du projet ${project.title}`}
            />
          ) : null}
        </div>
      </div>
    </Card>
  );
};
