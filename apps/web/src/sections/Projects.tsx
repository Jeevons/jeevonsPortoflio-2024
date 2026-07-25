import maufebWebsite from "@/assets/images/maufebMode-mockup.webp";
import quantumWebSite from "@/assets/images/quantumWebSite-mockup.webp";
import { ProjectList, type Project } from "@/components/ProjectList";
import { toCardCover } from "@/lib/media";
import { getProjectsForPreview, getPublishedProjects } from "@/lib/projects";
import type { StaticImageData } from "next/image";

// Jointure locale slug → image, HÉRITÉE de la story 4.1 (le modèle Media
// n'existait pas encore). Conservée en REPLI pour les projets historiques qui
// n'ont pas encore reçu de couverture téléversée : la story 5.12 ajoute
// `cover`, qui est prioritaire dès qu'il est renseigné. Cette table pourra
// disparaître une fois tous les projets illustrés depuis l'administration.
const projectImagesBySlug: Record<string, StaticImageData> = {
  quantum: quantumWebSite,
  "maufeb-mode": maufebWebsite,
};

// Story 5.11 — `preview` est décidé par la PAGE (page.tsx → `isPreviewActive`),
// après vérification de la session côté serveur. La section ne fait que
// choisir la lecture correspondante : elle ne lit ni l'URL ni la session, et ne
// peut donc pas activer l'aperçu d'elle-même.
type ProjectsSectionProps = { preview?: boolean };

// Server Component async : lit la base (AC3) au lieu d'une constante en dur.
export const ProjectsSection = async ({
  preview = false,
}: ProjectsSectionProps) => {
  const dbProjects = preview
    ? await getProjectsForPreview("FLAGSHIP")
    : await getPublishedProjects("FLAGSHIP");

  const projects: Project[] = dbProjects.map((project) => ({
    company: project.company,
    year: project.period,
    title: project.title,
    results: project.highlights.map((highlight) => ({
      title: highlight.label,
    })),
    link: project.link ?? "",
    image: projectImagesBySlug[project.slug],
    // Story 5.12 (AC5) — couverture téléversée. PRIORITAIRE sur l'import
    // statique ci-dessus (voir ProjectCard) : c'est le choix explicite fait
    // dans l'éditeur.
    cover: toCardCover(project.cover),
    // Story 5.9 (AC4) : vide → la carte masque la section correspondante.
    outcome: project.outcome,
    // Story 5.11 (AC2) — en aperçu, distinguer les brouillons des projets déjà
    // publiés : sans ce repère, Jeevons ne saurait pas lesquelles des cartes
    // affichées sont réellement en ligne. Hors aperçu, la lecture ne renvoie
    // que du publié : le drapeau est donc toujours `false`.
    draft: preview && !project.published,
  }));

  return (
    <ProjectList
      id="projects"
      eyebrow="Résultats concrets"
      title="Projets phares"
      description="Créer des expériences accessibles, fluides et intuitives est au cœur
          de ce que j'aime faire."
      projects={projects}
    />
  );
};
