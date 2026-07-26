import type { SkillLevel } from "@/generated/prisma/enums";

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
  /** Ordre d'affichage du repli, à défaut de tri par niveau en base. */
  sortOrder: number;
};

export const stacksContent: StackContent[] = [
  { name: "Javascript", iconKey: "javascript", level: "STRONG", sortOrder: 0 },
  { name: "HTML", iconKey: "html", level: "STRONG", sortOrder: 1 },
  { name: "CSS", iconKey: "css", level: "STRONG", sortOrder: 2 },
  { name: "React", iconKey: "react", level: "COMFORTABLE", sortOrder: 3 },
  { name: "Github", iconKey: "github", level: "COMFORTABLE", sortOrder: 4 },
  {
    name: "Chrome Dev Tools",
    iconKey: "chrome",
    level: "COMFORTABLE",
    sortOrder: 5,
  },
];
