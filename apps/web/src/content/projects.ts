import type { ProjectCategory } from "@/generated/prisma/enums";

// Story 4.5 — Contenu de repli statique des projets (SOURCE UNIQUE).
//
// ⚠️ Décision Jeevons : ce fichier est la SEULE source de vérité pour les
// projets. Le seed (prisma/seed.ts) l'importe → aucune dérive possible entre le
// contenu seedé en base et le repli statique servi quand la DB est injoignable.
//
// Ce module reste du PUR DATA + types : il n'importe ni `server-only`, ni le
// client Prisma. Il est donc consommable côté serveur (fallback) ET par le seed
// qui tourne en Bun standalone. Il n'importe que le type d'enum généré (const
// simple, sans effet de bord).
//
// La jointure slug → image (import statique) reste dans la section (piège n°4,
// story 4.1) : ici on ne porte que les données textuelles/structurelles.

export type ContentProject = {
  slug: string;
  category: ProjectCategory;
  company: string;
  title: string;
  period: string;
  link: string;
  sortOrder: number;
  // Ordre des highlights = ordre du tableau.
  highlights: string[];
  stacks: string[];
};

export const projectsContent: ContentProject[] = [
  // --- FLAGSHIP (section "Projets phares", id="projects") ---
  {
    slug: "quantum",
    category: "FLAGSHIP",
    company: "Quantum",
    title: "Site Web de la marque de bière Quantum",
    period: "Janvier - 2024",
    link: "https://quantum.2024.mmibut1.org/index.php",
    sortOrder: 0,
    highlights: [
      "Php, mySQL et Javascript",
      "Développement full-stack, front & back-end ",
      "Gestion de projet & travail d'équipe",
    ],
    stacks: ["Php", "mySQL", "Javascript"],
  },
  {
    slug: "maufeb-mode",
    category: "FLAGSHIP",
    company: "Maufeb Mode",
    title:
      "Création de la boutique en ligne Maufeb Mode, et de l'identité visuelle",
    period: "Juin - 2024",
    link: "https://www.maufeb-mode.com/",
    sortOrder: 1,
    highlights: [
      "Wordpress, Sumup",
      "Création logo, référencement et gestions des stocks, et des paiements",
      "Relation et service client ++",
    ],
    stacks: ["Wordpress", "Sumup"],
  },
  // --- PERSONAL (section "réalisations personnelles", id="side-projects") ---
  {
    slug: "insure",
    category: "PERSONAL",
    company: "Insure",
    title: "Landing page.",
    period: "Octobre - 2024",
    link: "https://insure-landing-page-jeevons.vercel.app/",
    sortOrder: 0,
    highlights: [
      "Html, CSs et Javascript",
      "Masterisé le responsive",
      "Notions d'ergonomie & d'accessibilité",
    ],
    stacks: ["Html", "Css", "Javascript"],
  },
  {
    slug: "sunnyside",
    category: "PERSONAL",
    company: "Sunnyside",
    title: "Landing Page.",
    period: "Août - 2024",
    link: "https://jeevons-sunnyside.vercel.app/index.html",
    sortOrder: 1,
    highlights: [
      "Html, Css, Javascript",
      "Masterisé le responsive",
      "Entraînement sur des dispositions d'interface plus complexes",
    ],
    stacks: ["Html", "Css", "Javascript"],
  },
  {
    slug: "sleeping-time",
    category: "PERSONAL",
    company: "SleepingTime",
    title: "Calculateur de temps de sommeil",
    period: "Janvier - 2024",
    link: "https://sleeping-calculator.vercel.app/",
    sortOrder: 2,
    highlights: [
      "Html, Css, Javascript",
      "Mes débuts avec javascript",
      "Script basique, responsive, manipulation du DOM",
    ],
    stacks: ["Html", "Css", "Javascript"],
  },
  {
    slug: "gallerie",
    category: "PERSONAL",
    company: "Gallerie",
    title: "Une simple gallerie d'images pour m'entrainer avec Grid.",
    period: "Novembre - 2023",
    link: "https://img-galery-psi.vercel.app/",
    sortOrder: 3,
    highlights: [
      "Html, Css, Javascript",
      "Display grid, flexbox, responsive design",
      "Composants réutilisable",
    ],
    stacks: ["Html", "Css", "Javascript"],
  },
];
