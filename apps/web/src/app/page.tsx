import { AboutSection } from "@/sections/About";
import { ContactSection } from "@/sections/Contact";
import { Footer } from "@/sections/Footer";
import { Header } from "@/sections/Header";
import { HeroSection } from "@/sections/Hero";
import { ProjectsSection } from "@/sections/Projects";
import { SelfProjectsSection } from "@/sections/SelfProject";
import { TapeSection } from "@/sections/Tape";
import { TestimonialsSection } from "@/sections/Testimonials";

// Story 4.4 (AC1) — Rendu statique + revalidation périodique d'1 h. La page est
// pré-rendue ; un visiteur sert la version statique sans requête DB à chaque
// chargement. Les lectures sont en plus cachées/taguées (lib/*), permettant une
// revalidation ciblée à la demande (voir /api/revalidate).
//
// ⚠️ Next exige un LITTÉRAL ici (analyse statique du segment) — pas d'import.
// Valeur alignée sur REVALIDATE_SECONDS de lib/cache-tags.ts (3600 = 1 h).
export const revalidate = 3600;

// ⚠️ Story 5.11 — CETTE PAGE NE CONNAÎT PAS LE MODE APERÇU, délibérément.
//
// Lire un `searchParams` ici — même consommé dans un sous-arbre `<Suspense>` —
// bascule la home ENTIÈRE en rendu dynamique : vérifié au build, `/` passait de
// `○ (Static, 1h)` à `ƒ (Dynamic)`. Ce serait annuler l'ISR de la story 4.4 pour
// TOUS les visiteurs au profit d'une fonction que seul l'administrateur utilise.
//
// L'aperçu des brouillons vit donc sur une route DÉDIÉE, `/preview` (décision
// Jeevons, story 5.11), qui réutilise exactement les mêmes sections avec le
// drapeau `preview`. Cette page-ci reste strictement publique et statique.
export default function Home() {
  return (
    // Story 6.3 — `site-public` porte les règles typographiques du site public
    // (`text-wrap: balance` sur les titres, `pretty` sur les paragraphes). Posé
    // ici et non sur `body` : l'admin partage le même layout racine.
    <div className="site-public">
      <Header />
      <HeroSection />
      <ProjectsSection />
      <SelfProjectsSection />
      <TapeSection />
      <TestimonialsSection />
      <AboutSection />
      <ContactSection />
      <Footer />
    </div>
  );
}
