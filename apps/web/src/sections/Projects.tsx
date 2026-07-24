import maufebWebsite from "@/assets/images/maufebMode-mockup.webp";
import quantumWebSite from "@/assets/images/quantumWebSite-mockup.webp";
import { ProjectList, type Project } from "@/components/ProjectList";
import { getPublishedProjects } from "@/lib/projects";
import type { StaticImageData } from "next/image";

// Jointure locale slug → image (piège n°4, story 4.1) : le modèle Media
// n'existe qu'en Epic 5. Les projets (texte/lien/period) viennent de la base,
// mais l'image reste un import statique associé par slug. Le contrat
// `image: StaticImageData` de ProjectList reste ainsi intact (AC3).
const projectImagesBySlug: Record<string, StaticImageData> = {
  quantum: quantumWebSite,
  "maufeb-mode": maufebWebsite,
};

// Server Component async : lit la base (AC3) au lieu d'une constante en dur.
export const ProjectsSection = async () => {
  const dbProjects = await getPublishedProjects("FLAGSHIP");

  const projects: Project[] = dbProjects.map((project) => ({
    company: project.company,
    year: project.period,
    title: project.title,
    results: project.highlights.map((highlight) => ({
      title: highlight.label,
    })),
    link: project.link ?? "",
    image: projectImagesBySlug[project.slug],
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
