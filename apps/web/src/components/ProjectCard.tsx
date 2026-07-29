import ArrowUpRightIcon from "@/assets/icons/arrow-up-right.svg";
import CheckCircleIcon from "@/assets/icons/check-circle.svg";
import { Card } from "@/components/Card";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";

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
  /**
   * Story 6.10 — identifiant d'URL, pour le lien vers la fiche détaillée.
   *
   * ⚠️ Optionnel : il n'était pas transmis jusqu'ici (les sections lisaient
   * `slug` en base sans le passer à la carte). Sans lui, le lien « Voir le
   * projet » n'est simplement pas rendu.
   */
  slug?: string;
};

type ProjectCardProps = {
  project: ProjectCardData;
  className?: string;
  style?: React.CSSProperties;
  /**
   * Story 6.8 — Élément racine de la carte. Par défaut un `<div>` ordinaire.
   *
   * 🛑 CE PARAMÈTRE EXISTE POUR NE PAS AJOUTER DE NŒUD ENVELOPPANT. Les cartes
   * sont `sticky` ; un `transform` sur un ANCÊTRE casserait leur empilement.
   * L'inclinaison doit donc s'appliquer au nœud qui porte DÉJÀ `sticky` — d'où
   * la possibilité, pour l'appelant client, de faire rendre cette racine par un
   * `motion.div` plutôt que par un `div`.
   *
   * ⚠️ CELA NE REND PAS CE FICHIER CLIENT. Il ne fait que transmettre ce qu'on
   * lui donne : la vue reste pure, sans état ni effet, et `project-preview.tsx`
   * comme le site public continuent de l'utiliser sans rien passer ici — auquel
   * cas le rendu est stritement identique à avant (décision 5.9 préservée).
   */
  as?: React.ElementType;
  /**
   * Story 6.10 (AC6) — Rendre le lien « Voir le projet » vers `/projects/[slug]`.
   *
   * 🛑 OPTIONNEL, ET DÉSACTIVÉ PAR DÉFAUT — c'est le point important. Ce
   * composant est PARTAGÉ avec l'aperçu de l'éditeur admin (décision 5.9) :
   * activer le lien partout ferait pointer l'aperçu vers la fiche publique d'un
   * projet peut-être NON PUBLIÉ, donc vers un 404 en plein aperçu. Seul
   * `ProjectList` (site public) passe cette prop.
   *
   * ⚠️ Le lien est un `<a>` DISTINCT, jamais un lien couvrant en
   * `after:absolute inset-0` : la carte contient déjà le lien externe
   * « Visiter le site » (imbriquer un lien dans un lien est du HTML invalide,
   * interdit par AGENTS.md §6), et `Card` utilise déjà son pseudo-élément
   * `after:` pour le liseré de la story 1.8.
   */
  detailLink?: boolean;
} & Omit<React.ComponentPropsWithoutRef<"div">, "style" | "className">;

export const ProjectCard = ({
  project,
  className,
  style,
  as,
  detailLink = false,
  ...rest
}: ProjectCardProps) => {
  return (
    <Card className={className} style={style} as={as} {...rest}>
      {/* 🛑 MISE EN PAGE VERTICALE, PLUS DE COLONNE LATÉRALE (retour Jeevons,
          28/07 : « au pire au lieu de réduire la taille de l'image ou la
          manipuler n'importe comment quand y a beaucoup de points forts, mets
          l'image avec une bonne taille, au-dessus des points forts bien
          organisés horizontalement »).

          ❌ NE PAS revenir à `lg:grid lg:grid-cols-2`. C'était la cause racine :
          l'image était enfermée dans une colonne d'une demi-carte, encore
          plafonnée à 450px, pendant que les points forts s'entassaient sur une
          seule colonne étroite à gauche. Plus un projet avait de points forts,
          plus la colonne texte s'allongeait et plus la colonne image laissait
          un vide immense sous une vignette minuscule — exactement la capture du
          28/07. Les correctifs successifs (`lg:h-full` → `lg:h-auto`,
          `object-contain`) ne soignaient que les symptômes de ce couplage.

          L'ordre du DOM porte maintenant la mise en page : en-tête → image →
          points forts → actions. La hauteur de l'image ne dépend plus JAMAIS de
          la quantité de texte, et réciproquement. */}
      <div>
        {/* En-tête + résultat chiffré. */}
        <div>
          {/* Ligne supérieure : bandeau company à gauche, boutons à droite. */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-baseline gap-2 font-bold uppercase tracking-widest text-sm text-gradient-accent">
                <span>{project.company}</span>
                <span>&bull;</span>
                <span className="text-3xs md:text-sm">{project.year}</span>
              </div>

              {/* Story 5.11 (AC2) — étiquette « Brouillon » */}
              {project.draft ? (
                <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-amber-200">
                  Brouillon — non publié
                </p>
              ) : null}
            </div>

            {/* Boutons d'action — haut droite de la carte. */}
            {(detailLink && project.slug) || project.link ? (
              <div className="flex shrink-0 flex-wrap gap-2">
                {detailLink && project.slug ? (
                  <Link
                    href={`/projects/${project.slug}`}
                    aria-label={`Voir le détail du projet ${project.title}`}
                    className="rounded-control focus-visible:outline-accent-from inline-flex h-10 items-center justify-center gap-2 border border-white/20 px-4 text-sm font-semibold hover:border-white/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
                  >
                    <span>Voir le projet</span>
                    <span aria-hidden="true">&rarr;</span>
                  </Link>
                ) : null}
                {project.link ? (
                  <a
                    href={project.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Visiter le site du projet ${project.title} (nouvel onglet)`}
                    className="bg-white text-surface-sunken rounded-control inline-flex h-10 items-center justify-center gap-2 px-4 text-sm font-semibold"
                  >
                    <span>Visiter le site</span>
                    <ArrowUpRightIcon aria-hidden="true" className="size-4" />
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Story 6.3 (AC1) — échelle fluide 2xl→4xl. */}
          <h3 className="font-serif text-display-3 mt-2 md:mt-5">
            {project.title}
          </h3>
          <hr className="border-t-2 border-white/5 mt-4 md:mt-5" />

          {/* AC4 — résultat chiffré optionnel. */}
          {project.outcome ? (
            <p className="mt-4 md:mt-5 font-bold text-lg md:text-xl text-gradient-accent">
              {project.outcome}
            </p>
          ) : null}
        </div>

        {/* IMAGE — hauteur fixe, rognée sans déformation (`object-cover`).
            La boîte est toujours la même quelle que soit la taille du viewport
            ou l'empilement sticky — l'image ne rétrécit jamais à l'infini. */}
        {project.cover ? (
          <div className="mt-6 md:mt-8 h-48 md:h-56 lg:h-64 w-full overflow-hidden rounded-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="h-full w-full object-cover"
              src={project.cover.url}
              width={project.cover.width}
              height={project.cover.height}
              alt={project.cover.alt ?? ""}
              loading="lazy"
            />
          </div>
        ) : project.image ? (
          // Story 6.18 — REPLI sur un asset statique du dépôt.
          <div className="mt-6 md:mt-8 h-48 md:h-56 lg:h-64 w-full overflow-hidden rounded-lg">
            <Image
              className="h-full w-full object-cover"
              src={project.image}
              alt={`Capture d'écran du projet ${project.title}`}
              sizes="(min-width: 1200px) 900px, 100vw"
              placeholder="blur"
            />
          </div>
        ) : null}

        {/* Pied : points forts. */}
        <div>
          {/* Même règle pour les points forts : une liste vide ne rend pas de
              `<ul>` vide, que les lecteurs d'écran annonceraient tout de même
              comme « liste, 0 élément ». */}
          {project.results.length > 0 ? (
            /* 🛑 POINTS FORTS EN GRILLE HORIZONTALE (choix Jeevons : 2 colonnes,
               3 sur grand écran). ❌ Plus de `flex flex-col` : en pleine largeur
               de carte, une colonne unique produisait des lignes de texte
               démesurément longues, illisibles.

               ⚠️ `items-start` est nécessaire : sans lui, les cellules d'une
               même rangée s'étirent à la hauteur de la plus haute (`stretch` par
               défaut en grille), et la puce d'un point fort court se retrouverait
               centrée verticalement face à un voisin de trois lignes.

               La grille équilibre les rangées d'elle-même quel que soit le
               nombre de points forts : c'est ce qui rend la carte insensible à
               cette quantité, l'objet même du retour du 28/07. */
            <ul className="mt-6 md:mt-8 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              {project.results.map((result, resultIndex) => (
                <li
                  key={resultIndex}
                  className="flex items-start gap-2 text-sm md:text-base text-white/50"
                >
                  <CheckCircleIcon
                    aria-hidden="true"
                    /* `shrink-0` : sans lui, la puce est compressée par un
                       libellé long, l'icône devient un ovale. */
                    className="size-5 md:size-6 shrink-0"
                  />
                  <span>{result.title}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {/* Les boutons sont maintenant dans l'en-tête en haut à droite. */}
        </div>
      </div>
    </Card>
  );
};
