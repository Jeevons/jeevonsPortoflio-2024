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

  const entries: TestimonialEntry[] = timeline.map((entry) => ({
    slug: entry.slug,
    title: entry.title,
    place: entry.place,
    body: entry.body,
  }));

  return <TestimonialsClient entries={entries} />;
};
