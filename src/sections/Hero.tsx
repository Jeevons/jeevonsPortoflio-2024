import ArrowDown from "@/assets/icons/arrow-down.svg";
import SparkleIcon from "@/assets/icons/sparkle.svg";
import StartIcon from "@/assets/icons/star.svg";
import grainImage from "@/assets/images/grain.jpg";
import memojiImage from "@/assets/images/jeevons-avatar-coding.webp";
import { HeroOrbit } from "@/components/HeroOrbit";
import Image from "next/image";

export const HeroSection = () => {
  return (
    <section
      className="py-32 md:py-48 lg:py-60 relative z-0 overflow-x-clip"
      id="hero"
    >
      <div className="absolute inset-0 [mask-image:linear-gradient(to_bottom,transparent,black_10%,black_70%,transparent)] pointer-events-none">
        <div
          className="absolute inset-0 -z-30 opacity-5"
          style={{
            backgroundImage: `url(${grainImage.src})`,
          }}
        ></div>
        <div className="size-[620px] hero-ring "></div>
        <div className="size-[820px] hero-ring "></div>
        <div className="size-[1020px] hero-ring "></div>
        <div className="size-[1220px] hero-ring "></div>

        <HeroOrbit
          size={570}
          rotation={-14}
          shouldOrbit
          orbitDuration="34s"
          shouldSpin
          spinDuration="3s"
        >
          <SparkleIcon className="size-8 text-emerald-300/20" />
        </HeroOrbit>
        <HeroOrbit
          size={580}
          rotation={79}
          shouldOrbit
          orbitDuration="36s"
          shouldSpin
          spinDuration="3s"
        >
          <SparkleIcon className="size-5 text-emerald-300/20" />
        </HeroOrbit>
        <HeroOrbit
          size={630}
          rotation={98}
          shouldOrbit
          orbitDuration="38s"
          shouldSpin
          spinDuration="6s"
        >
          <StartIcon className="size-8 text-emerald-300" />
        </HeroOrbit>
        <HeroOrbit
          size={650}
          rotation={180}
          shouldOrbit
          orbitDuration="40s"
          shouldSpin
          spinDuration="3s"
        >
          <SparkleIcon className="size-10 text-emerald-300/20" />
        </HeroOrbit>
        <HeroOrbit
          size={690}
          rotation={20}
          shouldOrbit
          orbitDuration="42s"
          shouldSpin
          spinDuration="6s"
        >
          <StartIcon className="size-12 text-emerald-300" />
        </HeroOrbit>
        <HeroOrbit size={700} rotation={-40} shouldOrbit orbitDuration="44s">
          <div className="size-2 rounded-full bg-emerald-300/15 "></div>
        </HeroOrbit>
        <HeroOrbit size={800} rotation={-10} shouldOrbit orbitDuration="46s">
          <div className="size-2 rounded-full bg-emerald-300/10 "></div>
        </HeroOrbit>
        <HeroOrbit size={820} rotation={140} shouldOrbit orbitDuration="48s">
          <SparkleIcon
            className="size-14 text-emerald-300/20"
            shouldSpin
            spinDuration="3s"
          />
        </HeroOrbit>
        <HeroOrbit size={820} rotation={92} shouldOrbit orbitDuration="50s">
          <div className="size-3 rounded-full bg-emerald-300/20 "></div>
        </HeroOrbit>
        <HeroOrbit
          size={860}
          rotation={-72}
          shouldOrbit
          orbitDuration="52s"
          shouldSpin
          spinDuration="6s"
        >
          <StartIcon className="size-28 text-emerald-300" />
        </HeroOrbit>
      </div>
      <div className="container">
        <div className="flex flex-col items-center">
          <Image
            src={memojiImage}
            className="size-[100px]"
            alt="Person peeking from behind laptop"
          />
          <div className="bg-gray-950 border border-gray-800 px-4 py-1.5 inline-flex items-center gap-4 rounded-lg">
            <div className="bg-green-500 size-2.5 rounded-full relative">
              <div className="bg-green-500 inset-0 rounded-full absolute animate-ping-large"></div>
            </div>
            <div className="text-sm font-medium text-center">
              En recherche d'une alternance pour 2025
            </div>
          </div>
        </div>
        <div className="md:max-w-xl lg:max-w-4xl mx-auto">
          <h1 className="font-serif text-3xl md:text-5xl lg:text-6xl text-center mt-8">
            Imaginer et construire des expériences qui donnent envie d'être
            vécues !
          </h1>
          <p className="mt-4 text-white/60 text-center md:text-lg">
            Le front-end est mon terrain de jeu, mais pour moi, c'est dans les
            coulisses que la vraie magie opère. Avec des bases solides en
            développement front, je veux explorer tout le spectre pour
            véritablement devenir "tech-savvy". Et quand je ne code pas, je
            m'amuse à donner vie à mes idées grâce à la suite Adobe.
          </p>
        </div>
        <div className="flex flex-col md:flex-row justify-center items-center mt-8 gap-4 z-30">
          <a
            href="#projects"
            className="bg-gray-900 inline-flex items-center gap-2 border border-white/15 px-6 h-12 rounded-xl"
          >
            <span className="font-semibold">Explorez mon travail</span>
            <ArrowDown className="size-4" />
          </a>
          <a
            href="#about"
            className="inline-flex items-center gap-2 border border-white bg-white text-gray-900 rounded-xl h-12 px-6"
          >
            <i aria-hidden="true">👋🏾</i>
            <span className="font-semibold text-center">
              Faisons connaissance
            </span>
          </a>
        </div>
      </div>
    </section>
  );
};
