import { getPublishedTimeline } from "@/lib/timeline";
import {
  TestimonialsClient,
  type TestimonialEntry,
} from "@/sections/TestimonialsClient";

// Conteneur serveur (Story 4.2, pièges n°1) : lit le parcours en base (AC2 :
// published + ordre) et passe les données en props à la vue client. page.tsx
// continue d'importer `TestimonialsSection` sans changement.
export const TestimonialsSection = async () => {
  const timeline = await getPublishedTimeline();

  // Story 6.9 (AC1, AC3) — LES ANNÉES ENTRENT ENFIN DANS LA PROJECTION.
  //
  // `startYear` et `endYear` existent en base depuis la story 5.14, sont
  // administrables, et n'ont JAMAIS été affichées : la projection ci-dessous
  // s'arrêtait à `{ slug, title, place, body }`. Or un déroulé « chronologique »
  // sans dates n'en est pas un — c'est ce qui donne son sens à la story.
  //
  // ⚠️ `endYear` est NULLABLE, et cette nullité est porteuse de sens : elle
  // exprime « poste / formation toujours en cours » (story 5.14, AC1). Elle est
  // transmise telle quelle et rendue en « aujourd'hui » par la vue.
  //
  // ❌ `lib/timeline.ts` n'est PAS modifié : le tri par `sortOrder` (l'ordre
  // défini en administration, écran de réordonnancement de la story 5.14) reste
  // le contrat d'AC3. Ce sont les années AFFICHÉES qui portent la lecture
  // chronologique demandée par AC1, pas un tri qui annulerait ce travail.
  const entries: TestimonialEntry[] = timeline.map((entry) => ({
    slug: entry.slug,
    title: entry.title,
    place: entry.place,
    body: entry.body,
    startYear: entry.startYear,
    endYear: entry.endYear,
  }));

  return <TestimonialsClient entries={entries} />;
};
