import maufebWebsite from "@/assets/images/maufebMode-mockup.webp";
import quantumWebSite from "@/assets/images/quantumWebSite-mockup.webp";
import { ProjectList, type Project } from "@/components/ProjectList";
import { getProjectsForPreview, getPublishedProjects } from "@/lib/projects";
import type { StaticImageData } from "next/image";

// Jointure locale slug → image (piège n°4, story 4.1) : le modèle Media
// n'existe qu'en Epic 5. Les projets (texte/lien/period) viennent de la base,
// mais l'image reste un import statique associé par slug. Le contrat
// `image: StaticImageData` de ProjectList reste ainsi intact (AC3).
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
