import { PreviewBanner } from "@/components/PreviewBanner";
import { isPreviewAllowed } from "@/lib/preview";
import { AboutSection } from "@/sections/About";
import { ContactSection } from "@/sections/Contact";
import { Footer } from "@/sections/Footer";
import { Header } from "@/sections/Header";
import { HeroSection } from "@/sections/Hero";
import { ProjectsSection } from "@/sections/Projects";
import { SelfProjectsSection } from "@/sections/SelfProject";
import { StatsSection } from "@/sections/Stats";
import { TapeSection } from "@/sections/Tape";
import { TestimonialsSection } from "@/sections/Testimonials";
import type { Metadata } from "next";

// Story 5.11 — SURFACE D'APERÇU des brouillons (AC2, AC3).
//
// ⚠️ POURQUOI UNE ROUTE DÉDIÉE plutôt que `/?preview=1` (décision Jeevons).
//
// Le PLAN §3.3 décrivait un paramètre d'URL sur le site. À l'implémentation, la
// mesure a tranché autrement : lire un `searchParams` dans `app/page.tsx` — même
// consommé dans un sous-arbre `<Suspense>` — bascule la home ENTIÈRE en rendu
// dynamique. Vérifié au build : `/` passait de `○ (Static, 1h)` à `ƒ (Dynamic)`.
// C'était annuler l'ISR de la story 4.4 pour TOUS les visiteurs au bénéfice
// d'une fonction que seul l'administrateur utilise.
//
// Cette route porte donc le coût dynamique, là où il est légitime : elle n'est
// atteinte que par Jeevons. La home reste strictement statique. Le rendu, lui,
// est IDENTIQUE : ce fichier compose exactement les mêmes sections que
// `app/page.tsx`, avec le seul drapeau `preview` en plus — l'AC2 (« le brouillon
// m'est affiché comme il le serait une fois publié ») est donc vraie par
// construction, et non par une copie qui divergerait.
//
// ⚠️ Cette route est PUBLIQUEMENT ATTEIGNABLE, et c'est voulu : l'AC3 exige que,
// sans session, le site « se comporte comme pour un visiteur ordinaire » — pas
// qu'il renvoie une erreur. Un 404 ou un 403 divulguerait d'ailleurs l'existence
// de la surface d'aperçu. Sans session, on rend donc la page publique normale,
// sans bandeau et sans le moindre brouillon.

// Rendu à la demande : un aperçu est une vue TEMPS RÉEL de l'état de la base
// (contenu non publié, susceptible de changer à chaque enregistrement). Le
// mettre en cache n'aurait aucun sens — et risquerait de faire fuiter un
// brouillon dans un cache partagé.
export const dynamic = "force-dynamic";

// ⚠️ Ne JAMAIS indexer cette route : elle n'a aucune valeur pour un moteur, et
// son référencement exposerait l'existence des brouillons. `robots.ts` (story
// 1.10) couvre le site public ; on est ici explicite au niveau de la page.
export const metadata: Metadata = {
  title: "Aperçu — contenu non publié",
  robots: { index: false, follow: false },
};

export default async function PreviewPage() {
  // AC2/AC3 — LA décision, côté serveur, sur la session. Sans elle, `preview`
  // reste `false` et toutes les sections lisent le contenu publié via leur
  // chemin caché habituel : la page rendue est celle d'un visiteur.
  const preview = await isPreviewAllowed();

  return (
    // Story 6.3 — même marqueur typographique que la home : l'aperçu doit
    // rendre exactement ce que verra un visiteur.
    <div className="site-public">
      {preview ? <PreviewBanner /> : null}
      <Header />
      <HeroSection />
      <ProjectsSection preview={preview} />
      <SelfProjectsSection preview={preview} />
      {/* Story 6.14 — même composition et même ordre que la home.
          ⚠️ AUCUN drapeau `preview` : les chiffres décrivent le site PUBLIÉ.
          Les gonfler avec les brouillons donnerait à Jeevons un aperçu de
          chiffres que ses visiteurs ne verront pas — l'inverse du but d'AC2. */}
      <StatsSection />
      <TapeSection />
      {/* 🛑 PAS DE SECTION « Stack & outils » — retirée du site le 27/07 (voir
          `app/page.tsx` pour le motif). L'aperçu doit rendre EXACTEMENT ce que
          verra un visiteur : la réintroduire ici seule mentirait à Jeevons sur
          l'état de sa page. */}
      <TestimonialsSection />
      <AboutSection />
      <ContactSection />
      <Footer />
    </div>
  );
}
