import ArrowUpRightIcon from "@/assets/icons/arrow-up-right.svg";
import CheckCircleIcon from "@/assets/icons/check-circle.svg";
import gallery from "@/assets/images/gallery-mockup.webp";
import sunnysideAgency from "@/assets/images/sunnyside-landingPage.webp";
import insureLandingPage from "@/assets/images/insureLanding-page.webp";
import sleepingAppMockup from "@/assets/images/sleepingApp-mockup.webp";
import { Card } from "@/components/Card";
import { SectionHeader } from "@/components/SectionHeader";
import Image from "next/image";

const portfolioProjects = [
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
    company: "Sunnyside Agency ",
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
    <section className="pb-16 lg:py-24" id="projects">
      <div className="container">
        <SectionHeader
          eyebrow="eat() explore() sleep() repeat()"
          title="Mes petites réalisations personnelles"
          description="Quoi de mieux pour apprendre que d'expérimenter soi-même ?"
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
                  <div className="inline-flex items-center gap-2 font-bold uppercase tracking-widest text-sm bg-gradient-to-r from-emerald-300 to-sky-400 text-transparent bg-clip-text">
                    <span>{project.company}</span>
                    <span>&bull;</span>
                    <span className="text-xs md:text-sm">{project.year}</span>
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
