import ArrowDown from "@/assets/icons/arrow-down.svg";
import SparkleIcon from "@/assets/icons/sparkle.svg";
import StartIcon from "@/assets/icons/star.svg";
import grainImage from "@/assets/images/grain.jpg";
import memojiImage from "@/assets/images/jeevons-avatar-coding.webp";
import { HeroOrbit } from "@/components/HeroOrbit";
import { Reveal } from "@/components/Reveal";
import { getHeroSettings } from "@/lib/settings";
import Image from "next/image";

// Server Component async (Story 4.3) : lit les textes Hero en base avec valeur
// par défaut si une clé manque (AC2/AC3). Rendu iso.
export const HeroSection = async () => {
  const { title, subtitle, statusBadge } = await getHeroSettings();
  return (
    <section
      className="py-32 md:py-48 lg:py-60 relative z-0 overflow-x-clip"
      id="hero"
    >
      <div className="absolute inset-0 [mask-image:linear-gradient(to_bottom,transparent,black_10%,black_70%,transparent)] pointer-events-none">
        {/* Story 6.1 — même calque de grain que `Card` et `ContactClient`,
            désormais factorisé en `.surface-grain`. */}
        <div
          className="surface-grain -z-30"
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
          <SparkleIcon className="size-8 text-accent-from/20" />
        </HeroOrbit>
        <HeroOrbit
          size={580}
          rotation={79}
          shouldOrbit
          orbitDuration="36s"
          shouldSpin
          spinDuration="3s"
        >
          <SparkleIcon className="size-5 text-accent-from/20" />
        </HeroOrbit>
        <HeroOrbit
          size={630}
          rotation={98}
          shouldOrbit
          orbitDuration="38s"
          shouldSpin
          spinDuration="6s"
        >
          <StartIcon className="size-8 text-accent-from" />
        </HeroOrbit>
        <HeroOrbit
          size={650}
          rotation={180}
          shouldOrbit
          orbitDuration="40s"
          shouldSpin
          spinDuration="3s"
        >
          <SparkleIcon className="size-10 text-accent-from/20" />
        </HeroOrbit>
        <HeroOrbit
          size={690}
          rotation={20}
          shouldOrbit
          orbitDuration="42s"
          shouldSpin
          spinDuration="6s"
        >
          <StartIcon className="size-12 text-accent-from" />
        </HeroOrbit>
        <HeroOrbit size={700} rotation={-40} shouldOrbit orbitDuration="44s">
          <div className="size-2 rounded-full bg-accent-from/15 "></div>
        </HeroOrbit>
        <HeroOrbit size={800} rotation={-10} shouldOrbit orbitDuration="46s">
          <div className="size-2 rounded-full bg-accent-from/10 "></div>
        </HeroOrbit>
        <HeroOrbit size={820} rotation={140} shouldOrbit orbitDuration="48s">
          <SparkleIcon className="size-14 text-accent-from/20" />
        </HeroOrbit>
        <HeroOrbit size={820} rotation={92} shouldOrbit orbitDuration="50s">
          <div className="size-3 rounded-full bg-accent-from/20 "></div>
        </HeroOrbit>
        <HeroOrbit
          size={860}
          rotation={-72}
          shouldOrbit
          orbitDuration="52s"
          shouldSpin
          spinDuration="6s"
        >
          <StartIcon className="size-28 text-accent-from" />
        </HeroOrbit>
      </div>
      <div className="container">
        <div className="flex flex-col items-center">
          <Image
            src={memojiImage}
            className="size-[100px]"
            alt="Person peeking from behind laptop"
          />
          {/* Story 6.1 — surfaces et rayon par tokens (`surface-sunken` =
              gray-950, `surface-raised` = gray-800, `rounded-badge` = 0.5rem,
              valeur que `rounded-lg` rendait déjà via `--radius`). */}
          <div className="bg-surface-sunken border border-surface-raised px-4 py-1.5 inline-flex items-center gap-4 rounded-badge">
            <div className="bg-green-500 size-2.5 rounded-full relative">
              <div className="bg-green-500 inset-0 rounded-full absolute animate-ping-large"></div>
            </div>
            <div className="text-sm font-medium text-center">{statusBadge}</div>
          </div>
        </div>
        <div className="md:max-w-xl lg:max-w-4xl mx-auto">
          {/* Story 6.3 (AC1) — échelle fluide : interpole 3xl→6xl entre 375px
              et 1200px, au lieu des trois paliers précédents. */}
          <h1 className="font-serif text-display-1 text-center mt-8">
            {title}
          </h1>
          <p className="mt-4 text-white/60 text-center md:text-lg">
            {subtitle}
          </p>
        </div>
        {/* Story 6.4 (AC2) — LES CTA SONT LE SEUL BLOC RÉVÉLÉ DU HERO.

            ⚠️ Le reste du Hero (memoji, badge, titre) est AU-DESSUS DE LA LIGNE
            DE FLOTTAISON : c'est la première chose que voit un visiteur, et le
            masquer même brièvement au chargement serait un clignotement à
            l'ouverture de la page. `Reveal` s'en protège déjà (il mesure la
            position avant peinture et n'arme pas ce qui est déjà à l'écran),
            mais le plus sûr reste de ne pas l'y appliquer du tout.

            Les CTA sont eux aussi souvent visibles d'emblée ; ils bénéficient
            donc de la même protection, et se révèlent uniquement sur les écrans
            courts où ils tombent sous la ligne de flottaison. */}
        <Reveal className="flex flex-col md:flex-row justify-center items-center mt-8 gap-4 z-30">
          <a
            href="#projects"
            className="bg-surface inline-flex items-center gap-2 border border-white/15 px-6 h-12 rounded-control"
          >
            <span className="font-semibold">Explorez mon travail</span>
            <ArrowDown className="size-4" />
          </a>
          <a
            href="#about"
            className="inline-flex items-center gap-2 border border-white bg-white text-surface rounded-control h-12 px-6"
          >
            <i aria-hidden="true">👋🏾</i>
            <span className="font-semibold text-center">
              Faisons connaissance
            </span>
          </a>
        </Reveal>
      </div>
    </section>
  );
};
