import ArrowUpRightIcon from "@/assets/icons/arrow-up-right.svg";
import CheckCircleIcon from "@/assets/icons/check-circle.svg";
import { Card } from "@/components/Card";
import { SectionHeader } from "@/components/SectionHeader";
import Image, { type StaticImageData } from "next/image";

// Contrat de donnée d'un projet, partagé par les deux sections.
// Sert de contrat stable pour l'Epic 4 (branchement DB) : le composant ne
// connaît que cette forme, pas la façon dont les projets ont été obtenus (AC3).
export type Project = {
  company: string;
  year: string;
  title: string;
  results: { title: string }[];
  link: string;
  image: StaticImageData;
};

type ProjectListProps = {
  id: string; // "projects" | "side-projects" — ancres posées en Epic 1 (AC2)
  eyebrow: string;
  title: string;
  description: string;
  projects: Project[]; // données injectées, source-agnostique (AC3)
};

// Composant de présentation unique consommé par ProjectsSection et
// SelfProjectsSection. Aucune donnée ni image importée ici : tout arrive en
// props (AC3). Rendu strictement identique à l'existant (AC2).
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
            <Card
              key={project.title}
              className="px-8 pt-8 pb-0  md:pt-12 m:px-10 lg:pt-16 lg:px-20 sticky"
              style={{
                top: `calc(64px + ${projectIndex * 40}px)`,
              }}
            >
              <div className="lg:grid lg:grid-cols-2 lg:gap-16">
                <div className="lg:pb-16">
                  <div className="inline-flex items-baseline gap-2 font-bold uppercase tracking-widest text-sm bg-gradient-to-r from-emerald-300 to-sky-400 text-transparent bg-clip-text">
                    <span>{project.company}</span>
                    <span>&bull;</span>
                    <span className="text-3xs md:text-sm">{project.year}</span>
                  </div>

                  <h3 className="font-serif text-2xl mt-2 md:text-4xl md:mt-5">
                    {project.title}
                  </h3>
                  <hr className="border-t-2 border-white/5 mt-4 md:mt-5" />
                  <ul className="flex flex-col gap-4 mt-4 md:mt-5">
                    {project.results.map((result, resultIndex) => (
                      <li
                        key={resultIndex} // Ajout de la clé ici
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
                  <a
                    href={project.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Visiter le site du projet ${project.title} (nouvel onglet)`}
                    className="bg-white text-gray-950 h-12 w-full md:w-auto px-6 rounded-xl font-semibold inline-flex items-center justify-center gap-2 mt-8 hover:scale-110 transform transition duration-300 ease-in-out"
                  >
                    <span>Visiter le site</span>
                    <ArrowUpRightIcon aria-hidden="true" className="size-4" />
                  </a>
                </div>
                <div className="relative">
                  <Image
                    className="mt-8 -mb-4 md:mb-0 lg:mt-0 lg:absolute lg:h-full lg:w-auto lg:max-w-[450px]"
                    src={project.image}
                    alt={`Capture d'écran du projet ${project.title}`}
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
