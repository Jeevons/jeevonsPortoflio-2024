import gallery from "@/assets/images/gallery-mockup.webp";
import insureLandingPage from "@/assets/images/insureLanding-page.webp";
import sleepingAppMockup from "@/assets/images/sleepingApp-mockup.webp";
import sunnysideAgency from "@/assets/images/sunnyside-landingPage.webp";
import { ProjectList, type Project } from "@/components/ProjectList";
import { toCardCover } from "@/lib/media";
import { getProjectsForPreview, getPublishedProjects } from "@/lib/projects";
import type { StaticImageData } from "next/image";

// Jointure locale slug → image, repli hérité de 4.1 : cf. Projects.tsx.
const projectImagesBySlug: Record<string, StaticImageData> = {
  insure: insureLandingPage,
  sunnyside: sunnysideAgency,
  "sleeping-time": sleepingAppMockup,
  gallerie: gallery,
};

// Story 5.11 — cf. `Projects.tsx` : `preview` est décidé par la page, jamais
// par la section elle-même.
type SelfProjectsSectionProps = { preview?: boolean };

// Server Component async : lit la base (AC3).
export const SelfProjectsSection = async ({
  preview = false,
}: SelfProjectsSectionProps) => {
  const dbProjects = preview
    ? await getProjectsForPreview("PERSONAL")
    : await getPublishedProjects("PERSONAL");

  const projects: Project[] = dbProjects.map((project) => ({
    // Story 6.10 — slug transmis pour le lien vers la fiche (cf. Projects.tsx).
    slug: project.slug,
    company: project.company,
    year: project.period,
    title: project.title,
    results: project.highlights.map((highlight) => ({
      title: highlight.label,
    })),
    link: project.link ?? "",
    image: projectImagesBySlug[project.slug],
    // Story 5.12 (AC5) — couverture téléversée, prioritaire (cf. Projects.tsx).
    cover: toCardCover(project.cover),
    // Story 5.9 (AC4) : vide → la carte masque la section correspondante.
    outcome: project.outcome,
    // Story 5.11 (AC2) — repère « brouillon » en aperçu (cf. Projects.tsx).
    draft: preview && !project.published,
  }));

  return (
    <ProjectList
      id="side-projects"
      eyebrow="eat() explore() sleep() repeat()"
      title="Mes petites réalisations personnelles"
      description="Quoi de mieux pour apprendre que d'expérimenter soi-même ?"
      projects={projects}
    />
  );
};
