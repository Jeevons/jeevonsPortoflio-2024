import { getHobbies } from "@/lib/timeline";
import { AboutClient, type HobbyView } from "@/sections/AboutClient";

// Conteneur serveur (Story 4.2, pièges n°1) : lit les hobbies en base et les
// passe en props à la vue client. page.tsx importe toujours `AboutSection`.
export const AboutSection = async () => {
  const hobbies = await getHobbies();

  const hobbyViews: HobbyView[] = hobbies.map((hobby) => ({
    slug: hobby.slug,
    title: hobby.title,
    emoji: hobby.emoji,
    posLeft: hobby.posLeft,
    posTop: hobby.posTop,
  }));

  return <AboutClient hobbies={hobbyViews} />;
};
