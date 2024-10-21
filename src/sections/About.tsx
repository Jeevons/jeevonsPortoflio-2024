"use client";

import jeevonsCv from "@/assets/images/jeevons-cv-2024-1.5_resultat.webp";
import ChromeIcon from "@/assets/icons/chrome.svg";
import CssIcon from "@/assets/icons/css3.svg";
import GithubIcon from "@/assets/icons/github.svg";
import HtmlIcon from "@/assets/icons/html5.svg";
import ReactIcon from "@/assets/icons/react.svg";
import JavascripIcon from "@/assets/icons/square-js.svg";
import smileMemoji from "@/assets/images/jeevons-avatar-smiling.webp";
import mapImage from "@/assets/images/map-tours.webp";
import { Card } from "@/components/Card";
import { CardHeader } from "@/components/CardHeader";
import { SectionHeader } from "@/components/SectionHeader";
import { ToolboxItems } from "@/components/ToolboxItems";
import { motion } from "framer-motion";
import { useRef } from "react";

import Image from "next/image";

const toolboxItems = [
  {
    title: "Javascript",
    iconType: JavascripIcon,
  },
  {
    title: "HTML",
    iconType: HtmlIcon,
  },
  {
    title: "CSS",
    iconType: CssIcon,
  },
  {
    title: "Github",
    iconType: GithubIcon,
  },
  {
    title: "React",
    iconType: ReactIcon,
  },
  {
    title: "Chrome Dev Tools",
    iconType: ChromeIcon,
  },
];

const hobbies = [
  {
    title: "Design",
    emoji: "🎨",
    left: "5%",
    top: "5%",
  },
  {
    title: "Sports",
    emoji: "⚽",
    left: "50%",
    top: "5%",
  },
  {
    title: "Music",
    emoji: "🎵",
    left: "10%",
    top: "35%",
  },
  {
    title: "Geekeries",
    emoji: "🕹",
    left: "35%",
    top: "40%",
  },
  {
    title: "Astronomie",
    emoji: "🌌",
    left: "70%",
    top: "45%",
  },
  {
    title: "Science",
    emoji: "🔬",
    left: "5%",
    top: "65%",
  },

  {
    title: "Voyages",
    emoji: "🌍",
    left: "45%",
    top: "70%",
  },
];

export const AboutSection = () => {
  const constraintRef = useRef(null);
  return (
    <section className="py-20 lg:py-28" id="about">
      <div className="container">
        <SectionHeader
          eyebrow="A propos de moi"
          title="Un aperçu de mon univers"
          description="Ce que j'aime faire, et ce qui me motive."
        />
        <div className="mt-20 flex flex-col gap-8">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-5 lg:grid-cols-3">
            <Card className="h-[380px] md:col-span-2 lg:col-span-1">
              <CardHeader
                title="CV"
                description="Découvrez mon parcours, mes compétences et mes expériences."
                indication="(Cliquez sur le cv pour l'ouvrir)"
              />
              <a href="/assets/docs/jeevons-cv-2024-1.5.pdf" target="_blank" rel="noopener noreferrer" className="flex w-40 mx-auto mt-2 md:mt-0">
                <Image src={jeevonsCv} alt="CV image" />
              </a>
            </Card>
            <Card className="h-[380px] md:col-span-3 lg:col-span-2">
              <CardHeader
                title="Mon pack d'explorateur"
                description="Découvrez les technologies et outils qui m'accompagnent dans mes aventures, pour créer et innover dans cet univers digital."
                className=""
              />
              <ToolboxItems
                items={toolboxItems}
                className=""
                itemsWrapperClassName="animate-move-left [animation-duration:30s]"
              />
              <ToolboxItems
                items={toolboxItems}
                className="mt-6"
                itemsWrapperClassName="animate-move-right [animation-duration:50s]"
              />
            </Card>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8 lg:grid-cols-3">
            <Card className="h-[380px] p-0 flex flex-col md:col-span-3 lg:col-span-2">
              <CardHeader
                title="Quand je ne code pas"
                description="Toujours entrain d'explorer ! Que ce soit à travers le design,
                la création vidéo ou mes petites passions geek."
                indication="(Déplacez les vignettes)"
                className="px-6 py-6"
              />
              <div className="relative flex-1" ref={constraintRef}>
                {hobbies.map((hobby) => (
                  <motion.div
                    key={hobby.title}
                    className="inline-flex items-center gap-3 bg-gradient-to-r from-emerald-300 to-sky-400 rounded-full py-1.5 px-6 absolute"
                    style={{ left: hobby.left, top: hobby.top }}
                    drag
                    dragConstraints={constraintRef}
                  >
                    <span className="font-medium text-gray-950">
                      {hobby.title}
                    </span>
                    <span aria-hidden="true">{hobby.emoji}</span>
                  </motion.div>
                ))}
              </div>
            </Card>
            <Card className="h-[380px] p-0 relative md:col-span-2 lg:col-span-1">
              <Image
                src={mapImage}
                alt="Map"
                className="h-full w-full object-cover object-left-top"
              />
              <div className="absolute flex items-center justify-center top-32 left-1/2 -translate-x-1/2 -translate-y-1/2 size-20 rounded-full   after:content-[''] after:absolute after:inset-0 after:outline after:outline-2 after:outline-offset-2 after:rounded-full after:outline-gray-950/30">
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-300 to-sky-400 -z-20 animate-ping [animation-duration:2s]"></div>
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-300 to-sky-400 -z-10"></div>
                <Image
                  src={smileMemoji}
                  alt="Smiling Memoji"
                  className="size-16"
                />
              </div>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
};
