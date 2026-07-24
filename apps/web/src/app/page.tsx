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

export default function Home() {
  return (
    <div>
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
