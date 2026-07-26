"use client";

import schoolIcon1 from "@/assets/images/bac-icon.webp";
import schoolIcon4 from "@/assets/images/jeevons-avatar-coding.webp";
import schoolIcon5 from "@/assets/images/jeevons-avatar-lynx.webp";
import schoolIcon3 from "@/assets/images/mmi-icon.webp";
import schoolIcon2 from "@/assets/images/university-icon.webp";
import { Card } from "@/components/Card";
import { Reveal } from "@/components/Reveal";
import { SectionHeader } from "@/components/SectionHeader";
import { useReducedMotion } from "motion/react";
import Image, { type StaticImageData } from "next/image";
import { Fragment, useEffect, useRef, useState } from "react";

// Vue client du parcours (Story 4.2). Les données (titre/lieu/texte) arrivent
// en props depuis le conteneur serveur ; on ne lit PAS la base ici (Client
// Component). L'auto-scroll, useReducedMotion et la duplication infinie sont
// conservés à l'identique (pièges n°1, n°5).

// Jointure locale slug → avatar (piège n°2) : le modèle Media arrive en Epic 5.
// L'avatar reste un import statique associé au slug de l'entrée.
const avatarBySlug: Record<string, StaticImageData> = {
  "bac-es": schoolIcon1,
  "licence-eco-gestion": schoolIcon2,
  "but-mmi": schoolIcon3,
  "cefim-dwwm": schoolIcon4,
  "apres-le-cda": schoolIcon5,
};

export type TestimonialEntry = {
  slug: string;
  title: string;
  place: string;
  body: string;
};

export const TestimonialsClient = ({
  entries,
}: {
  entries: TestimonialEntry[];
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isClicked, setIsClicked] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  // Auto-scroll functio
  const autoScroll = () => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    let scrollStep = 2; // Scroll speed

    const step = () => {
      if (!isHovered && !isClicked) {
        scrollContainer.scrollLeft += scrollStep;

        // If you reach the end, reposition without returning to the visible beginning.
        if (
          scrollContainer.scrollLeft >=
          scrollContainer.scrollWidth - scrollContainer.clientWidth
        ) {
          scrollContainer.scrollLeft = 0; // Return to the beginning to complete
        }
      }
    };

    const intervalId = setInterval(step, 30); // Speed adjustment

    return () => clearInterval(intervalId);
  };

  useEffect(() => {
    // Mouvement réduit demandé : pas de défilement automatique. Les cartes
    // restent toutes atteignables par défilement manuel (overflow-x-auto).
    if (shouldReduceMotion) return;
    const cleanup = autoScroll();
    return cleanup;
  }, [isHovered, isClicked, shouldReduceMotion]);

  // When the user hovers over a map, stop auto-scrolling
  const handleMouseEnter = () => setIsHovered(true);
  const handleMouseLeave = () => setIsHovered(false);

  // When the user clicks on a card, stop auto-scrolling, and when he clicks away, resume auto-scrolling.
  const handleClick = () => setIsClicked(true);

  const handleDocumentClick = (event: MouseEvent) => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    if (!scrollContainer.contains(event.target as Node)) {
      setIsClicked(false); // Resumes auto-scroll if clicked outside
    }
  };

  useEffect(() => {
    document.addEventListener("click", handleDocumentClick);
    return () => {
      document.removeEventListener("click", handleDocumentClick);
    };
  }, []);

  return (
    <section className="py-16 lg:py-24" id="parcours">
      <div className="container">
        {/* Story 6.4 (piège n°5) — SEULE L'ENTÊTE est révélée ici.

            ⚠️ Le carrousel ci-dessous est piloté par un auto-scroll qui écrit
            dans `scrollContainerRef.current.scrollLeft`, dans un conteneur
            `overflow-x-auto`. Y ajouter une révélation ferait cohabiter deux
            mécanismes sur le même élément, et un `transform` sur un conteneur
            de défilement se combine mal avec la position de défilement. La
            story impose de « composer avec l'existant, pas le remplacer » : on
            laisse donc le carrousel intact. */}
        <Reveal>
          <SectionHeader
            eyebrow="Mon parcours"
            title="Découvrez d'où je viens"
            description="Et où j'aimerai aller !"
            indication="Survolez / Cliquez sur une carte pour l'arrêter"
          />
        </Reveal>

        <div
          className="scroll mt-12 lg:mt-20 flex overflow-x-auto [mask-image:linear-gradient(to_right,transparent,black_10%,black_95%,transparent)] py-4 -my-4"
          ref={scrollContainerRef}
        >
          {/* Card duplication to create the infinite scrolling effect */}
          <div className="flex gap-8 pr-8 flex-none">
            {[...entries, ...entries].map((entry, index) => (
              <Fragment key={index}>
                <Card
                  key={entry.title}
                  className="testimonial-card max-w-xs md:max-w-md p-6 md:p-8 hover:-rotate-3 transition duration-300"
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                  onClick={handleClick}
                >
                  <div className="flex gap-4 items-start">
                    <div className="size-14 bg-gray-700 inline-flex rounded-full items-center justify-center flex-shrink-0">
                      <Image
                        src={avatarBySlug[entry.slug]}
                        alt={entry.title}
                        className="max-h-full"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <div className="font-semibold text-sm md:text-base">
                        {entry.title}
                      </div>
                      <div className="text-sm text-white/40">{entry.place}</div>
                    </div>
                  </div>
                  <p className="mt-4 md:mt-6 font-extralight text-xs md:text-base">
                    {entry.body}
                  </p>
                </Card>
              </Fragment>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
