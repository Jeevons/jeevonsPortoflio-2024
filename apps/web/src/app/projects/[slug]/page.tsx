import ArrowUpRightIcon from "@/assets/icons/arrow-up-right.svg";
import CheckCircleIcon from "@/assets/icons/check-circle.svg";
import { Card } from "@/components/Card";
import { ProjectDetailReveal } from "@/components/ProjectDetailReveal";
import { Footer } from "@/sections/Footer";
import { Header } from "@/sections/Header";
import {
  getPublishedProjectBySlug,
  getPublishedProjectSlugs,
} from "@/lib/projects";
import { toCardCover } from "@/lib/media";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

// Story 6.10 (AC1 → AC6) — FICHE DÉTAILLÉE D'UN PROJET.
//
// « Le principal manque pour convaincre un recruteur » (PLAN §4.3) : la carte
// dit ce qu'un projet EST, cette page dit ce qu'il a demandé.
//
// 🛑 AUCUNE MIGRATION PRISMA. Vérifié champ par champ contre le schéma : `slug`,
// `description`, `repoUrl`, `stacks`, `cover`, `outcome`, `published` existent
// tous. Le seul besoin d'AC1 sans colonne dédiée est « le rôle tenu » — voir la
// décision documentée plus bas.

// Story 4.4 — même discipline que la home : rendu statique + revalidation d'1 h.
// ⚠️ Next exige un LITTÉRAL (analyse statique du segment), pas un import.
export const revalidate = 3600;

/**
 * Pré-rend une page par projet publié.
 *
 * 🛑 TOLÈRE UNE BASE INJOIGNABLE, ET C'EST DÉLIBÉRÉ. `lib/db.ts` documente que
 * « le build doit rester reproductible SANS base » (story 4.6, construction
 * paresseuse du client). `getPublishedProjectSlugs` passe par
 * `readWithFallback` : sans base, elle sert les slugs du contenu statique. Si
 * même cela échouait, on renvoie une liste vide plutôt que de casser le build —
 * les pages basculent alors en rendu à la demande, ce qui reste conforme
 * (`dynamicParams` vaut `true` par défaut, et AC4 traite l'inconnu par un 404).
 */
export async function generateStaticParams() {
  try {
    const projects = await getPublishedProjectSlugs();
    return projects.map((project) => ({ slug: project.slug }));
  } catch {
    return [];
  }
}

type ProjectPageProps = {
  // ⚠️ Next 16 — `params` est ASYNCHRONE. Une signature synchrone est une
  // erreur de type au build.
  params: Promise<{ slug: string }>;
};

/**
 * Métadonnées propres à chaque fiche (AC5).
 *
 * ⚠️ TOLÉRANTE AU `null` : elle s'exécute AVANT la page, donc aussi sur un slug
 * inconnu ou un brouillon. Elle ne doit pas planter — c'est la page qui appelle
 * `notFound()`.
 *
 * ⚠️ `metadataBase` n'est PAS redéfini ici : celui du layout racine (story 1.10)
 * s'applique, et les métadonnées de page FUSIONNENT avec celles du layout.
 * L'image de partage est donc héritée de `app/opengraph-image.tsx` — une image
 * générée par projet serait coûteuse (ImageResponse Satori à chaque build) sans
 * qu'AC5 l'exige : il demande que la page « porte son image de partage ».
 */
export async function generateMetadata({
  params,
}: ProjectPageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = await getPublishedProjectBySlug(slug);

  if (!project) {
    return { title: "Projet introuvable" };
  }

  // La description de partage retombe sur un texte construit quand le champ
  // libre est vide — la majorité des projets aujourd'hui. Un `<meta
  // description>` absent vaut moins qu'un résumé factuel.
  const description =
    project.description ??
    `${project.title} — projet réalisé pour ${project.company} (${project.period}).`;

  return {
    title: `${project.title} — ${project.company}`,
    description,
    openGraph: {
      title: `${project.title} — ${project.company}`,
      description,
      type: "article",
    },
    twitter: {
      title: `${project.title} — ${project.company}`,
      description,
    },
  };
}

const ProjectPage = async ({ params }: ProjectPageProps) => {
  const { slug } = await params;
  const project = await getPublishedProjectBySlug(slug);

  // 🛑 AC3/AC4 — brouillon ou slug inconnu : un VRAI 404. La lecture renvoie
  // `null` dans les deux cas (le filtre `published` vit dans la requête), et
  // `notFound()` est appelé côté serveur, avant tout rendu.
  //
  // ❌ AUCUN accès session ici : AC3 dit « sans être connecté », et construire
  // un mode aperçu sur cette route dupliquerait la mécanique de `/preview`
  // (story 5.11), qui existe précisément pour ne pas rendre les pages
  // publiques dynamiques. Brouillon = 404, point.
  if (!project) {
    notFound();
  }

  const cover = toCardCover(project.cover);

  return (
    <div className="site-public">
      <Header />

      <main className="container py-24 lg:py-32">
        <ProjectDetailReveal>
          {/* Chemin de retour, en plus du menu : on arrive souvent ici depuis
              un moteur de recherche, sans être passé par l'accueil.

              🛑 `flex` ET NON `inline-flex` : en inline, ce lien partageait la
              ligne du bloc société • période qui le suit, les deux textes se
              touchaient et la marge de l'eyebrow restait sans effet (une marge
              verticale ne pousse pas un élément inline). `w-fit` évite que la
              zone cliquable ne s'étende sur toute la largeur du conteneur. */}
          <Link
            href="/#projects"
            className="rounded-control focus-visible:outline-accent-from flex w-fit items-center gap-2 border border-white/15 px-4 py-2 text-sm text-white/70 transition-colors hover:border-white/30 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
          >
            <span aria-hidden="true">&larr;</span>
            <span>Retour aux projets</span>
          </Link>

          <p className="text-gradient-accent mt-10 flex flex-wrap items-baseline gap-2 text-sm font-bold uppercase tracking-widest">
            <span>{project.company}</span>
            <span aria-hidden="true">&bull;</span>
            <span>{project.period}</span>
          </p>

          <h1 className="font-serif text-display-1 mt-4">{project.title}</h1>

          {/* AC1 — LE « RÔLE TENU » ET LE CONTEXTE PASSENT PAR `description`.
              🛑 DÉCISION DOCUMENTÉE : aucun champ ne porte le rôle, et la story
              interdit d'en ajouter un. `description` est un texte libre
              `@db.Text` déjà administrable (story 5.9) : contexte et rôle s'y
              écrivent ensemble. ❌ Pas de colonne `role`, donc pas de migration,
              pas de second champ à remplir en administration.
              ⚠️ AC2 — vide, la section est ABSENTE (c'est aujourd'hui le cas de
              tous les projets en base : le champ n'a jamais été rempli). */}
          {project.description ? (
            <div className="mt-10">
              <h2 className="font-serif text-2xl">Contexte et rôle</h2>
              <p className="mt-4 max-w-3xl text-white/70 md:text-lg">
                {project.description}
              </p>
            </div>
          ) : null}

          {/* AC2 — le résultat chiffré est optionnel par nature (story 5.9). */}
          {project.outcome ? (
            <p className="text-gradient-accent mt-10 text-xl font-bold md:text-2xl">
              {project.outcome}
            </p>
          ) : null}

          {/* Illustration. Même pattern que `ProjectCard` : `<img>` natif et NON
              `next/image` — le fichier est déjà normalisé en WebP et
              redimensionné par sharp au téléversement (story 5.12).
              ⚠️ `width`/`height` explicites + `blurDataUrl` en fond : le
              navigateur connaît le ratio AVANT le chargement et réserve la
              place, donc la page ne saute pas. */}
          {cover ? (
            <div className="mt-12">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="rounded-card w-full"
                src={cover.url}
                width={cover.width}
                height={cover.height}
                alt={cover.alt ?? ""}
                style={{
                  backgroundImage: `url(${cover.blurDataUrl})`,
                  backgroundSize: "cover",
                }}
              />
            </div>
          ) : null}

          {/* AC2 — une liste vide ne rend AUCUN `<ul>` : les lecteurs d'écran
              annonceraient tout de même « liste, 0 élément ». Standard repris
              de `ProjectCard`. */}
          {project.highlights.length > 0 ? (
            <div className="mt-12">
              <h2 className="font-serif text-2xl">Ce que j&apos;en retiens</h2>
              <ul className="mt-4 flex flex-col gap-4">
                {project.highlights.map((highlight) => (
                  <li
                    key={highlight.id}
                    className="flex gap-2 text-white/60 md:text-lg"
                  >
                    <CheckCircleIcon
                      aria-hidden="true"
                      className="size-6 flex-shrink-0"
                    />
                    <span>{highlight.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {project.stacks.length > 0 ? (
            <div className="mt-12">
              <h2 className="font-serif text-2xl">Technologies employées</h2>
              <ul className="mt-4 flex flex-wrap gap-3">
                {project.stacks.map((stack) => (
                  <li
                    key={stack.id}
                    className="bg-surface-raised rounded-badge border border-white/10 px-4 py-2 text-sm"
                  >
                    {stack.name}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* AC2 — les deux liens sont optionnels et indépendants. Aucun des
              deux : aucun bloc, pas même un conteneur vide. */}
          {project.link || project.repoUrl ? (
            <div className="mt-12 flex flex-col gap-4 md:flex-row">
              {project.link ? (
                <a
                  href={project.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Visiter le site du projet ${project.title} (nouvel onglet)`}
                  className="text-surface-sunken rounded-control inline-flex h-12 items-center justify-center gap-2 bg-white px-6 font-semibold"
                >
                  <span>Visiter le site</span>
                  <ArrowUpRightIcon aria-hidden="true" className="size-4" />
                </a>
              ) : null}

              {/* ⚠️ Lien SORTANT : `target="_blank"` impose
                  `rel="noopener noreferrer"` (AGENTS.md §6, story 1.3), et
                  l'`aria-label` mentionne explicitement le nouvel onglet. */}
              {project.repoUrl ? (
                <a
                  href={project.repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Voir le dépôt de code du projet ${project.title} (nouvel onglet)`}
                  className="rounded-control inline-flex h-12 items-center justify-center gap-2 border border-white/20 px-6 font-semibold hover:border-white/40"
                >
                  <span>Voir le dépôt</span>
                  <ArrowUpRightIcon aria-hidden="true" className="size-4" />
                </a>
              ) : null}
            </div>
          ) : null}

          {/* ⚠️ FILET DE SÉCURITÉ D'AC2 — « la page doit rester présentable, pas
              un titre isolé sur fond vide ».
              🛑 CE N'EST PAS UN CAS THÉORIQUE : en base, les 6 projets publiés
              ont `description`, `outcome` et `repoUrl` à `null`. Un projet sans
              highlights, sans stacks, sans couverture et sans lien afficherait
              donc son seul titre. Ce bloc n'est rendu QUE dans ce cas. */}
          {!project.description &&
          !project.outcome &&
          !cover &&
          project.highlights.length === 0 &&
          project.stacks.length === 0 &&
          !project.link &&
          !project.repoUrl ? (
            <Card className="mt-12 p-8">
              <p className="text-white/60">
                La fiche détaillée de ce projet est en cours de rédaction.
              </p>
            </Card>
          ) : null}
        </ProjectDetailReveal>
      </main>

      <Footer />
    </div>
  );
};

export default ProjectPage;
