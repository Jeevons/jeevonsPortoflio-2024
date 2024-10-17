import schoolIcon1 from "@/assets/images/bac-icon.webp";
import schoolIcon4 from "@/assets/images/jeevons-avatar-coding.webp";
import schoolIcon5 from "@/assets/images/jeevons-avatar-lynx.webp";
import schoolIcon3 from "@/assets/images/mmi-icon.webp";
import schoolIcon2 from "@/assets/images/university-icon.webp";
import { Card } from "@/components/Card";
import { SectionHeader } from "@/components/SectionHeader";
import Image from "next/image";
import { Fragment } from "react";
const testimonials = [
  {
    name: "Baccalauréat Économique et Social (option Mathématiques appliquées)",
    position: "Lycée de la Venise Verte, Niort-79000",
    text: "J'ai obtenu mon baccalauréat ES avec mention Bien en 2020. Je n'ai pas vraiment choisi cette filière... Je voulais gagner de l'argent et je pensais que étudier l'économie et la finance était le meilleur moyen d'y arriver. J'ai vite déchanté et j'ai compris que ce n'était pas ce que je voulais faire de ma vie.",
    avatar: schoolIcon1,
  },
  {
    name: "Licence Economie-Gestion (parcours international)",
    position: "Université de Limoges, Limoges-87000",
    text: "Après avoir obtenu mon baccalauréat, j'ai poursuivi dans la continuité en m'orientant vers une licence en économie-gestion. Bien que la formation ne m'ait pas entièrement convaincu, j'y ai tout de même acquis certaines notions que j'ai trouvées intéressantes. En parallèle, cette expérience m'a permis d'approfondir significativement mon anglais, la majorité de mes cours étant dispensée dans cette langue.",
    avatar: schoolIcon2,
  },
  {
    name: "BUT Métiers du Multimédia et de l'Internet",
    position: "IUT de Sénart, Lieusaint-77127",
    text: "Après avoir obtenu ma licence, j'ai décidé de me réorienter vers le web. J'ai intégré le BUT MMI de l'IUT de Sénar. Cette formation m'a permis de découvrir le monde du web et de l'audiovisuel. J'ai pu y acquérir des compétences en développement web (Php), en design (Suite adobe & Ui/Ux Design), en communication et en audiovisuel. J'ai également pu y découvrir le monde de l'entrepreneuriat et de la gestion de projet.",
    avatar: schoolIcon3,
  },
  {
    name: "Formation Développeur Web & Mobile",
    position: "Cefim, Tours-37000",
    text: "J'ai tout de suite décidé de me spécialiser dans le développement web et la programmation. Malheuresement mon IUT ne proposait pas de spécialisation dans ce domaine en deuxième année. J'ai donc décidé de suivre une formation de développeur web et mobile à Cefim. Je suis actuellement entrain de suivre cette formation. Une fois le diplôme obtenue, je souhaiterais poursuivre en Concepteur développeur d'applications (CDA) en alternance.",
    avatar: schoolIcon4,
  },
  {
    name: "Après le CDA",
    position: "À venir",
    text: "Si il y a une chose qui me fascine encore plus que les autres dans l'univers de l'informatique et du digital, ce sont les IA et la perspective de l'informatique quantique. J'aimerais donc me spécialiser dans ce domaine. Obtenir un diplôme d'ingénieur et travailler dans la recherche et le développement de nouvelles technologies. C'est mon objectif à long terme.",
    avatar: schoolIcon5,
  },
];

export const TestimonialsSection = () => {
  return (
    <section className="py-16 lg:py24">
      <div className="container">
        <SectionHeader
          eyebrow="Mon parcours"
          title="Découvrez d'où je viens"
          description="Et où j'aimerai aller !"
          indication="Survolez / Cliquez sur une carte pour l'arrêter"
        />

        <div className="mt-12 lg:mt-20 flex overflow-x-clip [mask-image:linear-gradient(to_right,transparent,black_10%,black_95%,transparent)] py-4 -my-4">
          <div className="flex gap-8 pr-8 flex-none animate-move-left [animation-duration:90s] hover:[animation-play-state:paused] ">
            {[...new Array(2)].fill(0).map((_, index) => (
              <Fragment key={index}>
                {testimonials.map((testimonial) => (
                  <Card
                    key={testimonial.name}
                    className="max-w-xs md:max-w-md p-6 md:p-8  hover:-rotate-3 transition duration-300 "
                  >
                    <div className="flex gap-4 items-start">
                      <div className="size-14 bg-gray-700 inline-flex rounded-full items-center justify-center flex-shrink-0">
                        <Image
                          src={testimonial.avatar}
                          alt={testimonial.name}
                          className="max-h-full"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <div className="font-semibold text-sm md:text-base">
                          {testimonial.name}
                        </div>
                        <div className="text-sm text-white/40">
                          {testimonial.position}
                        </div>
                      </div>
                    </div>
                    <p className="mt-4 md:mt-6 font-extralight text-xs md:text-base">
                      {testimonial.text}
                    </p>
                  </Card>
                ))}
              </Fragment>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
