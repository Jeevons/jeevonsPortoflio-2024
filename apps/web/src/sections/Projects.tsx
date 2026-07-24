import maufebWebsite from "@/assets/images/maufebMode-mockup.webp";
import quantumWebSite from "@/assets/images/quantumWebSite-mockup.webp";
import { ProjectList, type Project } from "@/components/ProjectList";

const portfolioProjects: Project[] = [
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
    <ProjectList
      id="projects"
      eyebrow="Résultats concrets"
      title="Projets phares"
      description="Créer des expériences accessibles, fluides et intuitives est au cœur
          de ce que j'aime faire."
      projects={portfolioProjects}
    />
  );
};
