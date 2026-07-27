import { Reveal } from "@/components/Reveal";
import { SectionHeader } from "@/components/SectionHeader";
import { resolveStackIcon } from "@/components/StackIcon";
import { getPublicStacks, groupStacksByDomain } from "@/lib/projects";
import { SKILL_LEVEL_LABELS } from "@/lib/schemas/stack";

// Story 6.13 — Section publique « Stack & outils » (AC1, AC2, AC3).
//
// PLAN §4.3 : « Section « Stack & outils » enrichie : niveau de maîtrise par
// techno, groupée par domaine ».
//
// ⚠️ COMPOSANT SERVEUR PUR — pas de `"use client"`. La section n'a AUCUNE
// interactivité : elle lit, elle groupe, elle rend. L'animation d'entrée passe
// par `Reveal` (socle 6.2/6.4), qui est le seul îlot client et accepte des
// enfants rendus côté serveur.
//
// ⚠️ ELLE CONSOMME `getPublicStacks()` telle quelle — déjà cachée sous le tag
// `projects` et protégée par `readWithFallback` (4.4/4.5). ❌ Aucune requête
// Prisma nue ici : elle contournerait le cache ET la résilience, et casserait
// l'ISR de `/` (qui doit rester `○ (Static, 1h)`).
//
// ⚠️ PAS D'ENTRÉE DANS LE `Header`. Le menu d'ancres est le socle du repérage de
// section de la story 6.5, et cette section PEUT DISPARAÎTRE (AC3) : un lien de
// menu pointerait alors vers une ancre inexistante.
//
// ⚠️ La toolbox « Mon pack d'explorateur » (`AboutClient`) reste en place
// (décision Jeevons) : elle est décorative — deux bandes défilantes qui montrent
// des logos — là où cette section-ci est informative. Elle n'affiche ni niveau
// ni domaine, il n'y a donc pas de doublon d'information.

/**
 * Badge de niveau de maîtrise (AC2).
 *
 * 🛑 LE LIBELLÉ EST DU TEXTE VISIBLE, pas une couleur, pas un `title`, pas trois
 * points colorés. C'est ce qui satisfait les DEUX moitiés d'AC2 d'un coup :
 * compréhensible en niveaux de gris, et annoncé tel quel par un lecteur d'écran.
 * L'intensité de fond n'est qu'un renfort — retirez toute couleur, l'information
 * reste entière.
 *
 * ⚠️ Les libellés viennent de `SKILL_LEVEL_LABELS` (`lib/schemas/stack.ts`),
 * IMPORTÉS et jamais recopiés : deux listes séparées finissent par diverger.
 */
const LEVEL_BADGE_CLASS: Record<string, string> = {
  STRONG: "bg-white/20 text-white",
  COMFORTABLE: "bg-white/10 text-white",
  LEARNING: "bg-white/5 text-white",
};

export const StacksSection = async () => {
  const stacks = await getPublicStacks();
  const groups = groupStacksByDomain(stacks);

  // 🛑 AC3 — RIEN DANS LE DOM. Pas `hidden`, pas `display:none`, pas `sr-only` :
  // un lecteur d'écran annoncerait tout de même un titre suivi de vide, et le
  // document porterait une section fantôme. `groupStacksByDomain` applique la
  // même règle à l'échelle du groupe (aucun groupe vide n'est renvoyé).
  if (groups.length === 0) return null;

  return (
    // `id` NOUVEAU et unique (AGENTS.md §6) — ❌ surtout pas `#about`.
    <section className="py-16 lg:py-24" id="stack">
      <div className="container">
        <SectionHeader
          eyebrow="Stack & outils"
          title="Ce avec quoi je travaille"
          description="Les technologies que j'utilise, regroupées par domaine, avec mon niveau de maîtrise sur chacune."
        />

        <div className="mt-12 flex flex-col gap-10 md:mt-16">
          {groups.map((group) => (
            <Reveal key={group.key}>
              {/* `h3` : le `h2` de la page appartient au `SectionHeader`
                  ci-dessus. ❌ Ne pas casser l'ordre des niveaux de titre. */}
              <h3 className="font-serif text-display-4">{group.label}</h3>

              {/* Une liste de technologies EST une liste : `<ul>`/`<li>`, pour
                  qu'un lecteur d'écran en annonce le nombre et permette d'en
                  sortir. */}
              <ul className="mt-5 flex flex-wrap gap-3">
                {/* ⚠️ L'ordre est celui reçu de `getPublicStacks` (niveau
                    décroissant, puis nom) : on ne retrie SURTOUT pas ici. */}
                {group.stacks.map((stack) => {
                  const Icon = resolveStackIcon(stack.iconKey);
                  return (
                    <li
                      key={stack.id}
                      className="inline-flex items-center gap-3 rounded-control border border-white/15 bg-surface-raised/60 px-4 py-2.5"
                    >
                      {/* Décorative : le nom juste à côté porte déjà
                          l'information. */}
                      <Icon className="size-6 shrink-0" aria-hidden="true" />
                      <span className="font-semibold text-white">
                        {stack.name}
                      </span>
                      {/* ⚠️ Technologie SANS niveau : affichée, simplement sans
                          badge (décision Jeevons). ❌ Jamais masquée, ❌ jamais
                          un niveau par défaut inventé — la colonne est nullable
                          par construction. */}
                      {stack.level ? (
                        <span
                          className={`rounded-badge px-2.5 py-1 text-xs font-semibold ${
                            LEVEL_BADGE_CLASS[stack.level] ?? "bg-white/10"
                          }`}
                        >
                          {/* Le contexte est explicite pour un lecteur d'écran,
                              qui entend « React, niveau Solide » et non un
                              « Solide » orphelin. */}
                          <span className="sr-only">Niveau&nbsp;: </span>
                          {SKILL_LEVEL_LABELS[stack.level]}
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};
