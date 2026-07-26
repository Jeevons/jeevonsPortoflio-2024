import { getPublicStacks } from "@/lib/projects";
import { getHobbies } from "@/lib/timeline";
import {
  AboutClient,
  type HobbyView,
  type StackView,
} from "@/sections/AboutClient";

// Conteneur serveur (Story 4.2, pièges n°1) : lit les hobbies en base et les
// passe en props à la vue client. page.tsx importe toujours `AboutSection`.
//
// Story 5.15 — La toolbox « Mon pack d'explorateur » lit désormais elle aussi la
// base (AC3). Elle était CODÉE EN DUR dans la vue client jusqu'ici ; les niveaux
// saisis dans l'administration n'auraient donc eu aucun effet visible.
export const AboutSection = async () => {
  // Deux lectures indépendantes : aucune raison de les enchaîner.
  const [hobbies, stacks] = await Promise.all([
    getHobbies(),
    getPublicStacks(),
  ]);

  const hobbyViews: HobbyView[] = hobbies.map((hobby) => ({
    slug: hobby.slug,
    title: hobby.title,
    emoji: hobby.emoji,
    posLeft: hobby.posLeft,
    posTop: hobby.posTop,
  }));

  // ⚠️ L'ordre vient de `getPublicStacks` (niveau décroissant, puis nom) : la
  // vue client l'applique tel quel et ne retrie SURTOUT pas — sinon le tri par
  // niveau, qui est la traduction visible de l'AC3, serait perdu.
  const stackViews: StackView[] = stacks.map((stack) => ({
    id: stack.id,
    name: stack.name,
    iconKey: stack.iconKey,
  }));

  return <AboutClient hobbies={hobbyViews} stacks={stackViews} />;
};
