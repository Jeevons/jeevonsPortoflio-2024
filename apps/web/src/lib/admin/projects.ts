import "server-only";

import { prisma } from "@/lib/db";
import { ProjectCategory } from "@/generated/prisma/enums";

// Story 5.8 — Lectures ADMIN des projets (AC1).
//
// ⚠️ PIÈGE CENTRAL (n°1) — NE PAS réutiliser `lib/projects.ts` ici.
// La lecture publique est `unstable_cache` + `readWithFallback` + filtre
// `published: true`. Trois raisons de ne pas la réutiliser côté admin :
//  - CACHE : l'admin doit voir l'état RÉEL. Une liste cachée une heure
//    n'afficherait pas le projet qui vient d'être créé ;
//  - FILTRE : l'admin gère AUSSI ses brouillons (AC1 « tous mes projets ») ;
//  - REPLI : le fallback statique (4.5) MENTIRAIT sur un écran de gestion — on
//    éditerait un contenu figé sans écrire nulle part. Ici, une base injoignable
//    doit se voir (même discipline que `lib/admin/dashboard.ts`, story 5.7).
//
// En revanche, les deux côtés PARTAGENT le tag `CACHE_TAGS.projects` : les
// mutations de `actions.ts` invalident la lecture publique (AC4). C'est le seul
// point de contact, et il est volontaire.

/** Colonnes triables exposées par la liste (AC1). Liste FERMÉE : voir `parseProjectFilters`. */
const SORTABLE = ["title", "category", "published", "updatedAt"] as const;
export type ProjectSortKey = (typeof SORTABLE)[number];

/** Statut de publication utilisé comme filtre (AC1). */
export type ProjectStatusFilter = "all" | "published" | "draft";

/** Critères de liste, déjà validés — sûrs à passer à Prisma. */
export type ProjectFilters = {
  /** Recherche libre sur le titre et l'entreprise. */
  q: string;
  category: ProjectCategory | "all";
  status: ProjectStatusFilter;
  sort: ProjectSortKey;
  dir: "asc" | "desc";
};

export const DEFAULT_PROJECT_FILTERS: ProjectFilters = {
  q: "",
  category: "all",
  status: "all",
  sort: "updatedAt",
  dir: "desc",
};

/**
 * Valide les `searchParams` de l'URL en critères sûrs (AC1).
 *
 * ⚠️ Les paramètres d'URL sont une entrée UTILISATEUR arbitraire. `sort` finit
 * dans un `orderBy` Prisma : accepter une chaîne libre exposerait un tri sur une
 * colonne non prévue, voire une erreur 500 sur un nom inconnu. On ne fait donc
 * PAS confiance à la valeur reçue — on la cherche dans une liste FERMÉE et on
 * retombe silencieusement sur le défaut. Même discipline pour `category` (enum
 * Prisma), `status` et `dir`.
 *
 * Un paramètre invalide ne produit ni erreur ni message : il est simplement
 * ignoré. La liste reste utilisable, ce qui est le comportement attendu d'un
 * filtre bookmarké devenu obsolète.
 */
export function parseProjectFilters(
  searchParams: Record<string, string | string[] | undefined>,
): ProjectFilters {
  // Un même paramètre peut arriver en double (`?sort=a&sort=b`) : Next le donne
  // alors en tableau. On ne garde que la première occurrence.
  const single = (key: string): string => {
    const value = searchParams[key];
    if (Array.isArray(value)) return value[0] ?? "";
    return value ?? "";
  };

  const rawCategory = single("category");
  const category = (Object.values(ProjectCategory) as string[]).includes(
    rawCategory,
  )
    ? (rawCategory as ProjectCategory)
    : "all";

  const rawStatus = single("status");
  const status: ProjectStatusFilter =
    rawStatus === "published" || rawStatus === "draft" ? rawStatus : "all";

  const rawSort = single("sort");
  const sort = (SORTABLE as readonly string[]).includes(rawSort)
    ? (rawSort as ProjectSortKey)
    : DEFAULT_PROJECT_FILTERS.sort;

  const dir = single("dir") === "asc" ? "asc" : "desc";

  return {
    // `slice` : borne la longueur de la recherche, un `contains` sur une chaîne
    // démesurée n'a aucun intérêt fonctionnel.
    q: single("q").trim().slice(0, 200),
    category,
    status,
    sort,
    dir,
  };
}

/** Une ligne de la liste admin — seulement ce que le tableau affiche. */
export type AdminProjectRow = {
  id: string;
  slug: string;
  title: string;
  company: string;
  category: ProjectCategory;
  published: boolean;
  updatedAt: Date;
};

/** Résultat de la liste. `available: false` = base injoignable, PAS « 0 projet ». */
export type AdminProjectList =
  | { available: true; rows: AdminProjectRow[]; total: number }
  | { available: false };

/**
 * Liste les projets de l'admin : TOUS statuts, filtrés et triés (AC1).
 *
 * Le filtrage et le tri se font EN BASE (`where` / `orderBy`), pas en JS après
 * coup — décision Jeevons : l'état de la liste vit dans l'URL et la page reste
 * un Server Component.
 *
 * `total` compte les projets SANS filtre : il permet de distinguer « aucun
 * projet du tout » (état d'accueil) de « aucun résultat pour ce filtre » (il
 * faut alors proposer de réinitialiser). Les deux affichent zéro ligne mais
 * appellent des messages différents.
 */
export async function listAdminProjects(
  filters: ProjectFilters,
): Promise<AdminProjectList> {
  const where = {
    ...(filters.category === "all" ? {} : { category: filters.category }),
    ...(filters.status === "all"
      ? {}
      : { published: filters.status === "published" }),
    ...(filters.q
      ? {
          // `mode: "insensitive"` : la recherche ne doit pas dépendre de la
          // casse saisie. Porte sur le titre ET l'entreprise, les deux repères
          // par lesquels Jeevons identifie un projet dans sa liste.
          OR: [
            { title: { contains: filters.q, mode: "insensitive" as const } },
            { company: { contains: filters.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  try {
    const [rows, total] = await Promise.all([
      prisma.project.findMany({
        where,
        // Tri secondaire par `title` : sur `category` ou `published` (peu de
        // valeurs distinctes), l'ordre interne serait sinon non déterministe
        // d'un rendu à l'autre — la liste « sauterait » sans raison visible.
        orderBy: [{ [filters.sort]: filters.dir }, { title: "asc" }],
        select: {
          id: true,
          slug: true,
          title: true,
          company: true,
          category: true,
          published: true,
          updatedAt: true,
        },
      }),
      prisma.project.count(),
    ]);

    return { available: true, rows, total };
  } catch (error) {
    // Même discipline de log que `lib/admin/dashboard.ts` : cause aplatie sur
    // une ligne, jamais de secret.
    const raw = error instanceof Error ? error.message : String(error);
    console.error(
      `[admin] Liste des projets indisponible. Cause : ${raw.replace(/\s+/g, " ").trim()}`,
    );
    return { available: false };
  }
}

/** Un projet complet, tel que l'éditeur le charge (champs scalaires — 5.8). */
export type AdminProject = {
  id: string;
  slug: string;
  title: string;
  company: string;
  category: ProjectCategory;
  description: string | null;
  period: string;
  link: string | null;
  repoUrl: string | null;
  published: boolean;
};

/**
 * Charge UN projet pour l'éditeur (AC4). `null` si l'identifiant n'existe pas —
 * la page rend alors un 404.
 *
 * ⚠️ Ne sélectionne QUE les champs scalaires édités par cette story. Les
 * highlights et les stacks sont chargés par la story 5.9 : les inclure ici
 * transporterait des données que l'écran n'affiche pas.
 */
export async function getAdminProject(
  id: string,
): Promise<AdminProject | null> {
  return prisma.project.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      title: true,
      company: true,
      category: true,
      description: true,
      period: true,
      link: true,
      repoUrl: true,
      published: true,
    },
  });
}
