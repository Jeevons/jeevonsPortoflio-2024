import { ProjectCard, type ProjectCardData } from "@/components/ProjectCard";
import { SectionHeader } from "@/components/SectionHeader";

// Contrat de donnée d'un projet, partagé par les deux sections.
// Sert de contrat stable pour l'Epic 4 (branchement DB) : le composant ne
// connaît que cette forme, pas la façon dont les projets ont été obtenus (AC3).
//
// Story 5.9 : la forme est désormais définie par `ProjectCard`, seul rendu de la
// carte. Le ré-export préserve les imports existants (`Projects.tsx`,
// `SelfProject.tsx`) — aucun appelant n'a eu à changer.
export type Project = ProjectCardData;

type ProjectListProps = {
  id: string; // "projects" | "side-projects" — ancres posées en Epic 1 (AC2)
  eyebrow: string;
  title: string;
  description: string;
  projects: Project[]; // données injectées, source-agnostique (AC3)
};

// Composant de présentation unique consommé par ProjectsSection et
// SelfProjectsSection. Aucune donnée ni image importée ici : tout arrive en
// props (AC3).
//
// Story 5.9 : le rendu d'UNE carte a migré dans `ProjectCard`, pour que
// l'aperçu de l'éditeur admin affiche exactement la même carte que le visiteur
// (AC3 de 5.9). Cette liste ne garde que ce qui lui est propre : l'entête de
// section et l'empilement `sticky`.
export const ProjectList = ({
  id,
  eyebrow,
  title,
  description,
  projects,
}: ProjectListProps) => {
  return (
    <section className="pb-16 lg:py-24" id={id}>
      <div className="container">
        <SectionHeader
          eyebrow={eyebrow}
          title={title}
          description={description}
        />

        <div className="mt-10 md:mt-20 flex flex-col  gap-20">
          {projects.map((project, projectIndex) => (
            <ProjectCard
              key={project.title}
              project={project}
              className="px-8 pt-8 pb-0  md:pt-12 m:px-10 lg:pt-16 lg:px-20 sticky"
              // Décalage croissant : les cartes s'empilent en défilant.
              style={{
                top: `calc(64px + ${projectIndex * 40}px)`,
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
