import { getPublishedProjectSlugs } from "@/lib/projects";
import type { MetadataRoute } from "next";

// Story 6.10 (AC5) — Le site n'est plus une page unique : chaque projet publié
// a désormais sa fiche `/projects/[slug]`, et le plan du site doit les lister.
//
// ⚠️ CE FICHIER EST PASSÉ EN `async` pour lire la base. Il ne fait PAS d'appel
// Prisma nu : il réutilise la lecture cachée et taguée (`unstable_cache` + tag
// `projects`), sans quoi il contournerait à la fois le contrat de cache 4.4 et
// la résilience 4.5.
//
// 🛑 AUCUN BROUILLON N'EN SORT : `getPublishedProjectSlugs` filtre
// `published: true` DANS la requête, et son repli statique ne contient que du
// contenu publié. Un brouillon listé au sitemap serait une fuite de contenu non
// publié vers les moteurs.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://portfolio.doshwork.com";

  // L'accueil reste la page principale : sections ancrées, priorité maximale.
  const root: MetadataRoute.Sitemap = [
    {
      url: base,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];

  // ⚠️ DÉGRADATION PROPRE — un sitemap amputé vaut mieux qu'un sitemap en
  // erreur : un 500 ici ferait échouer l'exploration du site entier. La lecture
  // a déjà son repli statique (4.5) ; ce `catch` est le dernier filet.
  try {
    const projects = await getPublishedProjectSlugs();

    return [
      ...root,
      ...projects.map((project) => ({
        url: `${base}/projects/${project.slug}`,
        lastModified: project.updatedAt,
        changeFrequency: "monthly" as const,
        priority: 0.8,
      })),
    ];
  } catch {
    return root;
  }
}
