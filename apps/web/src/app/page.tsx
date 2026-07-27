import { AuroraBackground } from "@/components/AuroraBackground";
import { CustomCursor } from "@/components/CustomCursor";
import { KonamiEasterEgg } from "@/components/KonamiEasterEgg";
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
      {/* Story 6.6 (AC2) — Curseur personnalisé, monté ICI et non dans
          `layout.tsx` : le layout racine est partagé avec `/admin` et `/login`,
          hors périmètre. Composant client sans props, il ne bascule pas la page
          en rendu dynamique — `/` reste `○ (Static, 1h)`, vérifié au build
          (garde-fou documenté plus haut). */}
      <CustomCursor />
      {/* Story 6.16 (AC2) — Dégradé d'ambiance animé, monté ICI et non dans
          `layout.tsx`, pour la MÊME raison que le curseur ci-dessus : le layout
          racine est partagé avec `/admin` (qui a sa propre identité, tokens
          shadcn 5.7) et `/login`. Le poser au layout aurait injecté l'aurora
          dans l'admin — un débordement sur l'Epic 5. Monté à la page, `/admin`
          est intact PAR CONSTRUCTION, sans vérification à faire.
          ⚠️ Composant SERVEUR, 100 % CSS : aucun JavaScript ajouté au bundle,
          et `/` reste `○ (Static, 1h)`. */}
      <AuroraBackground />
      {/* Story 6.17 (AC2) — Easter egg (Konami), monté ICI et NON dans
          `layout.tsx`. 🛑 Décision structurante : le layout racine couvre
          `/admin`, où TOUS les écrans sont des formulaires et où la story 5.20 a
          livré un travail spécifique de navigation au clavier. Y superposer un
          écouteur `keydown` global serait un débordement sur l'Epic 5. Monté à
          la page, `/admin` n'a AUCUN écouteur ajouté — par construction, sans
          vérification à faire.
          ⚠️ Le composant ne rend RIEN tant que la séquence n'est pas saisie :
          aucune divergence d'hydratation, et `/` reste `○ (Static, 1h)`. */}
      <KonamiEasterEgg />
      <Header />
      <HeroSection />
      <ProjectsSection />
      <SelfProjectsSection />
      {/* Story 6.14 — « En quelques chiffres », placée APRÈS les projets
          qu'elle dénombre : le visiteur vient d'en voir la matière, le chiffre
          la résume au lieu de l'annoncer à vide. Aucune entrée de menu ne la
          vise : la section disparaît si tous ses chiffres sont vides (AC3). */}
      <StatsSection />
      <TapeSection />
      {/* 🛑 PAS DE SECTION « Stack & outils » ICI — RETIRÉE, NE PAS RÉINTRODUIRE.
          Décision de Jeevons du 27/07 : elle faisait doublon avec « Mon pack
          d'explorateur » (`AboutClient`), qui montre déjà les technologies. La
          story 6.13 l'avait pourtant justifiée comme complémentaire (niveau de
          maîtrise + domaine, là où la toolbox est décorative) — à l'usage, le
          recoupement l'emporte sur l'apport. `sections/Stacks.tsx` et
          `groupStacksByDomain` sont supprimés avec elle.

          ⚠️ La colonne `Stack.domain` et son `<select>` en administration
          RESTENT (choix de Jeevons) : la donnée est conservée et éditable, prête
          à resservir si les technologies sont un jour réaffichées autrement.
          C'est donc un champ sans effet visible, pas un oubli. */}
      <TestimonialsSection />
      <AboutSection />
      <ContactSection />
      <Footer />
    </div>
  );
}
