import { Reveal } from "@/components/Reveal";
import { SectionHeader } from "@/components/SectionHeader";
import { getPortfolioStats } from "@/lib/stats";
import { StatsClient, type StatItem } from "@/sections/StatsClient";

// Story 6.14 — Section « En quelques chiffres » (AC1, AC2, AC3).
//
// ⚠️ CONTENEUR SERVEUR. Il lit, il met en forme, il rend. Le seul îlot client est
// `StatsClient`, qui ne reçoit QUE des nombres déjà arrêtés — la frontière est
// posée au plus tard possible.
//
// ⚠️ Il consomme `getPortfolioStats()` telle quelle : déjà cachée (tags `projects`
// ET `timeline`) et protégée par `readWithFallback`. ❌ Aucune requête Prisma nue
// ici : elle contournerait cache et résilience, et casserait l'ISR de `/` (qui
// doit rester `○ (Static, 1h)`).
//
// ⚠️ PAS D'ENTRÉE DANS LE `Header` — même raison qu'en 6.13 : la section peut
// disparaître entièrement, et un lien de menu pointerait alors vers une ancre
// inexistante.

/**
 * Accord en nombre.
 *
 * ⚠️ Résolu CÔTÉ SERVEUR, pas dans la vue cliente : le libellé fait partie du
 * contenu, pas de l'animation. La vue ne décide de rien.
 */
const plural = (value: number, singular: string, pluralForm: string): string =>
  value > 1 ? pluralForm : singular;

/**
 * Passe des agrégats aux tuiles affichables.
 *
 * 🛑 UNE TUILE VIDE EST RETIRÉE, PAS AFFICHÉE À ZÉRO. « 0 projet » sur un
 * portfolio de recrutement est pire que rien : c'est un chiffre juste qui
 * dessert. Même règle que la section elle-même (« absente plutôt que vide »).
 */
const buildItems = (stats: {
  publishedProjects: number;
  stacks: number;
  experienceYears: number | null;
}): StatItem[] => {
  const items: StatItem[] = [];

  if (stats.experienceYears !== null && stats.experienceYears > 0) {
    items.push({
      key: "experience",
      value: stats.experienceYears,
      label: plural(
        stats.experienceYears,
        "an d'expérience",
        "ans d'expérience",
      ),
    });
  }

  if (stats.publishedProjects > 0) {
    items.push({
      key: "projects",
      value: stats.publishedProjects,
      label: plural(stats.publishedProjects, "projet livré", "projets livrés"),
    });
  }

  if (stats.stacks > 0) {
    items.push({
      key: "stacks",
      value: stats.stacks,
      // ⚠️ « utilisée » ET NON « maîtrisée » (décision Jeevons, juillet 2026) :
      // le compteur mesure ce que le portfolio RECENSE, pas un niveau revendiqué.
      // Le niveau, lui, se lit techno par techno dans l'administration — le
      // résumer en un mot sur un agrégat le surinterpréterait.
      label: plural(
        stats.stacks,
        "technologie utilisée",
        "technologies utilisées",
      ),
    });
  }

  return items;
};

export const StatsSection = async () => {
  const stats = await getPortfolioStats();
  const items = buildItems(stats);

  // 🛑 AC3 (volet « base vide ») — RIEN DANS LE DOM. Pas `hidden`, pas
  // `display:none` : un lecteur d'écran annoncerait un titre suivi de vide.
  if (items.length === 0) return null;

  return (
    // `id` NOUVEAU et unique (AGENTS.md §6).
    <section className="py-16 lg:py-24" id="chiffres">
      <div className="container">
        <SectionHeader
          eyebrow="En quelques chiffres"
          title="Ce que ça représente"
          description="Des repères simples, calculés directement depuis le contenu du site."
        />

        <div className="mt-12 md:mt-16">
          <Reveal>
            <StatsClient items={items} />
          </Reveal>
        </div>
      </div>
    </section>
  );
};
