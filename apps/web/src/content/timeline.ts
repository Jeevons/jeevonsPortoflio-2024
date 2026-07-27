// Story 4.5 — Contenu de repli statique du parcours et des centres d'intérêt
// (SOURCE UNIQUE). Importé par le seed (aucune dérive) ET utilisé comme repli
// quand la DB est injoignable. Pur data + types (pas de `server-only`/Prisma).
//
// Années validées par Jeevons (story 4.2).

export type ContentTimelineEntry = {
  slug: string;
  title: string;
  place: string;
  body: string;
  startYear: number;
  endYear: number | null;
  sortOrder: number;
};

export const timelineContent: ContentTimelineEntry[] = [
  {
    slug: "bac-es",
    title:
      "Baccalauréat Économique et Social (option Mathématiques appliquées)",
    place: "Lycée de la Venise Verte, Niort-79000",
    body: "J'ai obtenu mon baccalauréat ES avec mention Bien en 2020. Je n'ai pas vraiment choisi cette filière... Je voulais gagner de l'argent et je pensais que étudier l'économie et la finance était le meilleur moyen d'y arriver. J'ai vite déchanté et j'ai compris que ce n'était pas ce que je voulais faire de ma vie.",
    startYear: 2020,
    endYear: 2020,
    sortOrder: 0,
  },
  {
    slug: "licence-eco-gestion",
    title: "Licence Economie-Gestion (parcours international)",
    place: "Université de Limoges, Limoges-87000",
    body: "Après avoir obtenu mon baccalauréat, j'ai poursuivi dans la continuité en m'orientant vers une licence en économie-gestion. Bien que la formation ne m'ait pas entièrement convaincu, j'y ai tout de même acquis certaines notions que j'ai trouvées intéressantes. En parallèle, cette expérience m'a permis d'approfondir significativement mon anglais, la majorité de mes cours étant dispensée dans cette langue.",
    startYear: 2020,
    endYear: 2023,
    sortOrder: 1,
  },
  {
    slug: "but-mmi",
    title: "BUT Métiers du Multimédia et de l'Internet",
    place: "IUT de Sénart, Lieusaint-77127",
    body: "Après avoir obtenu ma licence, j'ai décidé de me réorienter vers le web. J'ai intégré le BUT MMI de l'IUT de Sénar. Cette formation m'a permis de découvrir le monde du web et de l'audiovisuel. J'ai pu y acquérir des compétences en développement web (Php), en design (Suite adobe & Ui/Ux Design), en communication et en audiovisuel. J'ai également pu y découvrir le monde de l'entrepreneuriat et de la gestion de projet.",
    startYear: 2023,
    endYear: 2024,
    sortOrder: 2,
  },
  {
    slug: "cefim-dwwm",
    title: "Formation Développeur Web & Mobile",
    place: "Cefim, Tours-37000",
    body: "J'ai tout de suite décidé de me spécialiser dans le développement web et la programmation. Malheuresement mon IUT ne proposait pas de spécialisation dans ce domaine en deuxième année. J'ai donc décidé de suivre une formation de développeur web et mobile à Cefim. Je suis actuellement entrain de suivre cette formation. Une fois le diplôme obtenue, je souhaiterais poursuivre en Concepteur développeur d'applications (CDA) en alternance.",
    startYear: 2024,
    endYear: 2025,
    sortOrder: 3,
  },
  {
    slug: "apres-le-cda",
    title: "Après le CDA...",
    place: "À venir",
    body: "Si il y a une chose qui me fascine encore plus que les autres dans l'univers de l'informatique et du digital, ce sont les IA et la perspective de l'informatique quantique. J'aimerais donc me spécialiser dans ce domaine. Obtenir un diplôme d'ingénieur et travailler dans la recherche et le développement de nouvelles technologies. C'est mon objectif à long terme.",
    startYear: 2027,
    endYear: null,
    sortOrder: 4,
  },
];

export type ContentHobby = {
  slug: string;
  title: string;
  emoji: string;
  posLeft: string;
  posTop: string;
  sortOrder: number;
};

export const hobbiesContent: ContentHobby[] = [
  {
    slug: "design",
    title: "Design",
    emoji: "🎨",
    posLeft: "5%",
    posTop: "5%",
    sortOrder: 0,
  },
  {
    slug: "sports",
    title: "Sports",
    emoji: "⚽",
    posLeft: "50%",
    posTop: "5%",
    sortOrder: 1,
  },
  {
    slug: "music",
    title: "Music",
    emoji: "🎵",
    posLeft: "10%",
    posTop: "35%",
    sortOrder: 2,
  },
  {
    slug: "geekeries",
    title: "Geekeries",
    emoji: "🕹",
    posLeft: "35%",
    posTop: "40%",
    sortOrder: 3,
  },
  {
    slug: "astronomie",
    title: "Astronomie",
    emoji: "🌌",
    posLeft: "70%",
    posTop: "45%",
    sortOrder: 4,
  },
  {
    slug: "science",
    title: "Science",
    emoji: "🔬",
    posLeft: "5%",
    posTop: "65%",
    sortOrder: 5,
  },
  {
    slug: "voyages",
    title: "Voyages",
    emoji: "🌍",
    posLeft: "45%",
    posTop: "70%",
    sortOrder: 6,
  },
];
