import ArrowUpRightIcon from "@/assets/icons/arrow-up-right.svg";
import CheckCircleIcon from "@/assets/icons/check-circle.svg";
import maufebWebsite from "@/assets/images/maufebMode-mockup.webp";
import quantumWebSite from "@/assets/images/quantumWebSite-mockup.webp";
import { Card } from "@/components/Card";
import { SectionHeader } from "@/components/SectionHeader";
import Image from "next/image";

const portfolioProjects = [
  {
    company: "Quantum",
    year: "Janvier - 2024",
    title: "Site Web de la marque de bière Quantum",
    results: [
      { title: "Php, mySQL et Javascript" },
      {
        title: "Développement full-stack, front & back-end ",
      },
      { title: "Gestion de projet & travail d'équipe" },
    ],
    link: "https://quantum.2024.mmibut1.org/index.php",
    image: quantumWebSite,
  },
  {
    company: "Maufeb Mode",
    year: "Juin - 2024",
    title:
      "Création de la boutique en ligne Maufeb Mode, et de l'identité visuelle",
    results: [
      { title: "Wordpress, Sumup" },
      {
        title:
          "Création logo, référencement et gestions des stocks, et des paiements",
      },
      { title: "Relation et service client ++" },
    ],
    link: "https://www.maufeb-mode.com/",
    image: maufebWebsite,
  },
];

export const ProjectsSection = () => {
  return (
    <section className="pb-16 lg:py-24" id="projects">
      <div className="container">
        <SectionHeader
          eyebrow="Résultats concrets"
          title="Projets phares"
          description="Créer des expériences accessibles, fluides et intuitives est au cœur
          de ce que j'aime faire."
        />

        <div className="mt-10 md:mt-20 flex flex-col  gap-20">
          {portfolioProjects.map((project, projectIndex) => (
            <Card
              key={project.title}
              className="px-8 pt-8 pb-0  md:pt-12 m:px-10 lg:pt-16 lg:px-20 sticky"
              style={{
                top: `calc(64px + ${projectIndex * 40}px)`,
              }}
            >
              <div className="lg:grid lg:grid-cols-2 lg:gap-16">
                <div className="lg:pb-16">
                  <div className="inline-flex items-baseline gap-1 font-bold uppercase tracking-widest text-sm bg-gradient-to-r from-emerald-300 to-sky-400 text-transparent bg-clip-text">
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
                  <a href={project.link} target="_blank">
                    <button className="bg-white text-gray-950 h-12 w-full md:w-auto px-6 rounded-xl font-semibold inline-flex items-center justify-center gap-2 mt-8 hover:scale-110 transform transition duration-300 ease-in-out">
                      <span>Visiter le site</span>
                      <ArrowUpRightIcon aria-hidden="true" className="size-4" />
                    </button>
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
