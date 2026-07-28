import { Reveal } from "@/components/Reveal";
import { SectionHeader } from "@/components/SectionHeader";
import { getStatsSettings, type StatsSettings } from "@/lib/settings";
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
 * Accorde un libellé ADMINISTRÉ, stocké au pluriel (retour Jeevons, 28/07).
 *
 * 🛑 POURQUOI DÉRIVER PLUTÔT QUE DEMANDER DEUX CHAMPS. Faire saisir le singulier
 * ET le pluriel de trois libellés, c'est six champs pour un cas qui ne se produit
 * qu'à 1 (« 1 projet livré »). On stocke donc la forme courante — le pluriel — et
 * on retire les « s » finaux de chaque mot quand la valeur vaut 1.
 *
 * ⚠️ HEURISTIQUE ASSUMÉE, ET SES LIMITES SONT CONNUES. Elle est juste pour les
 * libellés du portfolio (« projets livrés » → « projet livré », « ans
 * d'expérience » → « an d'expérience », « technologies utilisées » →
 * « technologie utilisée »). Elle se trompera sur un pluriel irrégulier (« -aux »)
 * ou sur un mot terminant par « s » au singulier (« un mois »).
 *
 * ✅ C'est acceptable ici parce que le dommage est plafonné : un « s » en trop ou
 * en moins dans une tuile, uniquement quand le compteur vaut exactement 1 — jamais
 * une donnée fausse. ❌ Ne pas généraliser cette fonction à du contenu libre.
 */
const singularize = (label: string): string =>
  label
    .split(" ")
    .map((word) =>
      word.length > 2 && word.endsWith("s") ? word.slice(0, -1) : word,
    )
    .join(" ");

/** Accord d'un libellé administré : le pluriel tel quel, le singulier dérivé. */
const accord = (value: number, pluralLabel: string): string =>
  plural(value, singularize(pluralLabel), pluralLabel);

/**
 * Passe des agrégats aux tuiles affichables.
 *
 * 🛑 UNE TUILE VIDE EST RETIRÉE, PAS AFFICHÉE À ZÉRO. « 0 projet » sur un
 * portfolio de recrutement est pire que rien : c'est un chiffre juste qui
 * dessert. Même règle que la section elle-même (« absente plutôt que vide »).
 */
const buildItems = (
  stats: {
    publishedProjects: number;
    stacks: number;
    experienceYears: number | null;
  },
  settings: StatsSettings,
): StatItem[] => {
  const items: StatItem[] = [];

  // 🛑 LA VALEUR ADMINISTRÉE PRIME SUR LE CALCUL (retour Jeevons, 28/07). Le
  // chiffre restait autrement dérivé de `année courante − plus ancienne
  // `startYear` publiée`, sans aucun moyen de le corriger depuis l'admin.
  //
  // ⚠️ `?? ` et non `||` : `getStatsSettings` garantit `null` ou un entier > 0,
  // mais `||` traiterait aussi `0` comme « non renseigné ». L'intention est de
  // ne basculer sur le calcul QUE lorsque rien n'est saisi.
  const experienceYears =
    settings.experienceYears ?? stats.experienceYears ?? null;

  if (experienceYears !== null && experienceYears > 0) {
    items.push({
      key: "experience",
      value: experienceYears,
      label: accord(experienceYears, settings.experienceLabel),
    });
  }

  if (stats.publishedProjects > 0) {
    items.push({
      key: "projects",
      value: stats.publishedProjects,
      label: accord(stats.publishedProjects, settings.projectsLabel),
    });
  }

  if (stats.stacks > 0) {
    items.push({
      key: "stacks",
      value: stats.stacks,
      label: accord(stats.stacks, settings.stacksLabel),
    });
  }

  return items;
};

export const StatsSection = async () => {
  // ⚠️ DEUX LECTURES CACHÉES SÉPARÉMENT, et c'est voulu : `getPortfolioStats`
  // est taguée `projects`+`timeline`, `getStatsSettings` est taguée `settings`.
  // Enregistrer les réglages invalide donc bien cette section (l'action
  // `saveSettingsAction` appelle `revalidateTag(settings)`), sans avoir à
  // élargir les tags de `getPortfolioStats` — ce qui aurait fait recompter la
  // base à chaque édition de réglage sans rapport.
  const [stats, statsSettings] = await Promise.all([
    getPortfolioStats(),
    getStatsSettings(),
  ]);
  const items = buildItems(stats, statsSettings);

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
