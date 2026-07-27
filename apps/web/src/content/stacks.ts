import type { SkillLevel } from "@/generated/prisma/enums";
// ⚠️ Import de TYPE uniquement : effacé à la compilation, donc ce module reste
// du pur data sans dépendance runtime (il est importé par le seed).
import type { StackDomain } from "@/lib/schemas/stack";

// Story 5.15 — Contenu statique des technologies (« Mon pack d'explorateur »).
//
// ⚠️ POURQUOI CE FICHIER EXISTE. Avant cette story, la toolbox publique était un
// tableau codé en dur DANS `AboutClient.tsx`, avec des imports statiques de SVG.
// La toolbox lisant désormais la base (AC3), ce tableau devient le REPLI servi
// quand la base est injoignable (story 4.5) — exactement le rôle que jouent déjà
// `projects.ts` et `timeline.ts` pour leurs domaines.
//
// Les six entrées sont celles qui s'affichaient avant, à l'identique : si la
// base tombe, le visiteur revoit le site tel qu'il le connaissait, jamais une
// section vide.
//
// ⚠️ Ce module reste du PUR DATA (aucun `server-only`, aucun import de SVG) :
// comme ses voisins, il doit rester importable par le seed comme par
// l'adaptateur de repli.

export type StackContent = {
  name: string;
  /** Clé du registre `lib/stack-icons.ts`. */
  iconKey: string;
  level: SkillLevel;
  /**
   * Story 6.13 — domaine de regroupement de la section « Stack & outils ».
   * Renseigné ici pour que le repli 4.5 reste GROUPÉ comme le site normal, au
   * lieu de verser ses six entrées dans « Autres technologies ».
   */
  domain: StackDomain;
  /** Ordre d'affichage du repli, à défaut de tri par niveau en base. */
  sortOrder: number;
};

export const stacksContent: StackContent[] = [
  {
    name: "Javascript",
    iconKey: "javascript",
    level: "STRONG",
    domain: "frontend",
    sortOrder: 0,
  },
  {
    name: "HTML",
    iconKey: "html",
    level: "STRONG",
    domain: "frontend",
    sortOrder: 1,
  },
  {
    name: "CSS",
    iconKey: "css",
    level: "STRONG",
    domain: "frontend",
    sortOrder: 2,
  },
  {
    name: "React",
    iconKey: "react",
    level: "COMFORTABLE",
    domain: "frontend",
    sortOrder: 3,
  },
  {
    name: "Github",
    iconKey: "github",
    level: "COMFORTABLE",
    domain: "tooling",
    sortOrder: 4,
  },
  {
    name: "Chrome Dev Tools",
    iconKey: "chrome",
    level: "COMFORTABLE",
    domain: "tooling",
    sortOrder: 5,
  },
];
