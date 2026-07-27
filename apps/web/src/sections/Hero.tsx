import ArrowDown from "@/assets/icons/arrow-down.svg";
import SparkleIcon from "@/assets/icons/sparkle.svg";
import StartIcon from "@/assets/icons/star.svg";
import grainImage from "@/assets/images/grain.jpg";
import memojiImage from "@/assets/images/jeevons-avatar-coding.webp";
import { HeroOrbit } from "@/components/HeroOrbit";
import { HeroParallax } from "@/components/HeroParallax";
import { HeroRoles } from "@/components/HeroRoles";
import { MagneticLink } from "@/components/MagneticLink";
import { Reveal } from "@/components/Reveal";
import { getHeroSettings } from "@/lib/settings";
import Image from "next/image";

// Server Component async (Story 4.3) : lit les textes Hero en base avec valeur
// par défaut si une clé manque (AC2/AC3). Rendu iso.
export const HeroSection = async () => {
  const { title, subtitle, statusBadge, roles } = await getHeroSettings();
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
        {/* Story 6.7 (AC1) — DEUX CALQUES, DEUX AMPLITUDES. Un décalage unique
            appliqué à tout le décor le ferait glisser d'un bloc, sans aucun
            relief. Les anneaux, plus larges et plus lointains, bougent donc
            MOINS que les icônes en orbite : c'est cet écart — et lui seul — qui
            se lit comme de la profondeur.

            🛑 `HeroOrbit` N'EST PAS TOUCHÉ. Il compose déjà trois `transform`
            imbriqués ; le décalage vit sur ces conteneurs PARENTS, jamais sur
            ses nœuds. Et le `pointer-events-none` du conteneur ci-dessus reste
            en place : les orbites couvrent les CTA, les laisser capter le
            pointeur les rendrait incliquables. */}
        {/* 🛑 `absolute inset-0` SUR LES DEUX CALQUES — NE PAS RETIRER (retour
            Jeevons, 27/07 : « la constellation se colle en haut »).

            `hero-ring` et `HeroOrbit` se placent en `absolute top-1/2 left-1/2`,
            donc relativement à leur ANCÊTRE POSITIONNÉ le plus proche. Un
            wrapper sans position ni dimension est une boîte de hauteur nulle
            collée en haut : `top-1/2` de zéro vaut zéro, et toute la
            constellation remonte au bord supérieur.

            ⚠️ Le symptôme n'apparaissait qu'au SURVOL parce que `HeroParallax`
            ne rend son `motion.div` — dont le `transform` crée un contexte de
            positionnement — qu'une fois le pointeur fin détecté, après
            hydratation. Avant cela le wrapper restait un `<div>` nu, et les
            enfants se référaient encore au conteneur `inset-0` : le décor était
            correct au chargement, puis sautait. */}
        <HeroParallax depth={0.4} className="absolute inset-0">
          <div className="size-[620px] hero-ring "></div>
          <div className="size-[820px] hero-ring "></div>
          <div className="size-[1020px] hero-ring "></div>
          <div className="size-[1220px] hero-ring "></div>
        </HeroParallax>

        <HeroParallax depth={1} className="absolute inset-0">
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
        </HeroParallax>
      </div>
      <div className="container">
        <div className="flex flex-col items-center">
          {/* Story 6.18 (AC1, AC2) — IMAGE DU HERO.
              ⚠️ PAS DE `sizes` ICI, VOLONTAIREMENT : l'image est rendue à
              `size-[100px]` — une taille FIXE à toutes les largeurs. Un `sizes`
              n'aurait aucun effet et n'ajouterait que du bruit (la story
              l'exclut explicitement pour les images à taille fixe).
              🛑 `priority` : le memoji est AU-DESSUS DE LA LIGNE DE FLOTTAISON et
              participe au LCP (cible < 2 s) ; le lazy-loading par défaut le
              retarderait. ⚠️ C'est la SEULE image du site à le porter — en
              mettre sur plusieurs saturerait la file de chargement et
              DÉGRADERAIT le LCP au lieu de l'améliorer.
              ⚠️ `placeholder="blur"` : le `blurDataURL` est généré AU BUILD par
              Next, l'import étant statique. */}
          <Image
            src={memojiImage}
            className="size-[100px]"
            alt="Person peeking from behind laptop"
            priority
            placeholder="blur"
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

          {/* Story 6.7 (AC2) — LES RÔLES, ENTRE LE BADGE ET LE TITRE (placement
              choisi par Jeevons). Bloc PUREMENT ADDITIF : ni le titre (une
              accroche longue) ni le sous-titre (un paragraphe) ne sont des
              intitulés de poste, donc rien de ce que Jeevons a rédigé n'est
              remplacé ni déplacé ici. */}
          <HeroRoles roles={roles} />
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
        {/* Story 6.6 (AC1) — LES DEUX CTA SONT LES SEULS ÉLÉMENTS MAGNÉTIQUES
            DU SITE. L'AC parle d'« un bouton d'action », pas de tout ce qui est
            cliquable : les entrées de menu relèvent de la story 6.5, les cartes
            projet de la 6.8, et l'administration n'est concernée par aucune.

            🛑 `MagneticLink` REND UN VRAI `<a href>` — mêmes ancres, mêmes
            classes qu'avant. Le décalage est un `transform` de quelques pixels,
            piloté par le seul `pointermove` : un visiteur au clavier n'en génère
            aucun, les CTA restent donc parfaitement immobiles sous le focus
            (AC5). */}
        <Reveal className="flex flex-col md:flex-row justify-center items-center mt-8 gap-4 z-30">
          <MagneticLink
            href="#projects"
            className="bg-surface inline-flex items-center gap-2 border border-white/15 px-6 h-12 rounded-control"
          >
            <span className="font-semibold">Explorez mon travail</span>
            <ArrowDown className="size-4" />
          </MagneticLink>
          <MagneticLink
            href="#about"
            className="inline-flex items-center gap-2 border border-white bg-white text-surface rounded-control h-12 px-6"
          >
            <i aria-hidden="true">👋🏾</i>
            <span className="font-semibold text-center">
              Faisons connaissance
            </span>
          </MagneticLink>
        </Reveal>
      </div>
    </section>
  );
};
