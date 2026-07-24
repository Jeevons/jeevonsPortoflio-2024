import gallery from "@/assets/images/gallery-mockup.webp";
import insureLandingPage from "@/assets/images/insureLanding-page.webp";
import sleepingAppMockup from "@/assets/images/sleepingApp-mockup.webp";
import sunnysideAgency from "@/assets/images/sunnyside-landingPage.webp";
import { ProjectList, type Project } from "@/components/ProjectList";

const portfolioProjects: Project[] = [
  {
    company: "Insure",
    year: "Octobre - 2024",
    title: "Landing page.",
    results: [
      { title: "Html, CSs et Javascript" },
      {
        title: "Masterisé le responsive",
      },
      { title: "Notions d'ergonomie & d'accessibilité" },
    ],
    link: "https://insure-landing-page-jeevons.vercel.app/",
    image: insureLandingPage,
  },
  {
    company: "Sunnyside",
    year: "Août - 2024",
    title: "Landing Page.",
    results: [
      { title: "Html, Css, Javascript" },
      {
        title: "Masterisé le responsive",
      },
      { title: "Entraînement sur des dispositions d'interface plus complexes" },
    ],
    link: "https://jeevons-sunnyside.vercel.app/index.html",
    image: sunnysideAgency,
  },
  {
    company: "SleepingTime",
    year: "Janvier - 2024",
    title: "Calculateur de temps de sommeil",
    results: [
      { title: "Html, Css, Javascript" },
      {
        title: "Mes débuts avec javascript",
      },
      { title: "Script basique, responsive, manipulation du DOM" },
    ],
    link: "https://sleeping-calculator.vercel.app/",
    image: sleepingAppMockup,
  },
  {
    company: "Gallerie",
    year: "Novembre - 2023",
    title: "Une simple gallerie d'images pour m'entrainer avec Grid.",
    results: [
      { title: "Html, Css, Javascript" },
      {
        title: "Display grid, flexbox, responsive design",
      },
      { title: "Composants réutilisable" },
    ],
    link: "https://img-galery-psi.vercel.app/",
    image: gallery,
  },
];

export const SelfProjectsSection = () => {
  return (
    <ProjectList
      id="side-projects"
      eyebrow="eat() explore() sleep() repeat()"
      title="Mes petites réalisations personnelles"
      description="Quoi de mieux pour apprendre que d'expérimenter soi-même ?"
      projects={portfolioProjects}
    />
  );
};
