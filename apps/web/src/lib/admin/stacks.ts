import "server-only";

import type { SkillLevel } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";

// Story 5.15 — Lectures ADMIN des technologies.
//
// ⚠️ SÉPARÉES de la lecture publique (`lib/projects.ts` → `getPublicStacks`),
// et pour la même raison qu'en 5.8/5.14 : la lecture publique est CACHÉE sous le
// tag `projects`. L'administration doit voir l'état RÉEL de la base, pas une
// copie qui daterait de la dernière invalidation — c'est justement ce qu'elle
// sert à vérifier après une modification.
//
// En revanche, les deux côtés PARTAGENT le tag `CACHE_TAGS.projects` : les
// mutations invalident la lecture publique (AC3). C'est le seul point de
// contact, et il est volontaire.

/** Une ligne de la liste admin. `projectCount` porte à lui seul l'AC2. */
export type AdminStackRow = {
  id: string;
  name: string;
  iconKey: string | null;
  level: SkillLevel | null;
  /**
   * Nombre de projets associés — l'information dont dépend l'AVERTISSEMENT de
   * suppression (AC2). Comptée par la base (`_count`) et non en chargeant les
   * projets : on n'a besoin que du nombre.
   */
  projectCount: number;
};

/** Résultat de la liste. `available: false` = base injoignable, PAS « 0 techno ». */
export type AdminStackList =
  { available: true; rows: AdminStackRow[] } | { available: false };

/**
 * Liste TOUTES les technologies avec leur nombre de projets associés (AC1, AC2).
 *
 * Tri alphabétique : c'est une liste de gestion, pas la toolbox publique. Le
 * tri par niveau appartient à l'affichage public (`getPublicStacks`) ; ici,
 * Jeevons cherche une technologie par son nom.
 */
export async function listAdminStacks(): Promise<AdminStackList> {
  try {
    const rows = await prisma.stack.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        iconKey: true,
        level: true,
        _count: { select: { projects: true } },
      },
    });

    return {
      available: true,
      rows: rows.map(({ _count, ...stack }) => ({
        ...stack,
        projectCount: _count.projects,
      })),
    };
  } catch (error) {
    // Même discipline de log qu'en 5.7/5.8/5.14 : cause aplatie sur une ligne,
    // jamais de secret.
    const raw = error instanceof Error ? error.message : String(error);
    console.error(
      `[admin] Liste des technologies indisponible. Cause : ${raw.replace(/\s+/g, " ").trim()}`,
    );
    return { available: false };
  }
}

/** Une technologie complète, telle que l'éditeur la charge (AC1). */
export type AdminStack = {
  id: string;
  name: string;
  iconKey: string | null;
  level: SkillLevel | null;
  /**
   * Story 6.13 — domaine de regroupement public.
   *
   * 🛑 DOIT être lu ici : le formulaire réenvoie TOUS ses champs à chaque
   * enregistrement. Absent de cette sélection, il partirait vide et l'action
   * effacerait silencieusement le domaine à la première modification du nom.
   */
  domain: string | null;
};

/**
 * Charge UNE technologie pour l'éditeur (AC1). `null` si l'identifiant n'existe
 * pas — la page rend alors un 404.
 */
export async function getAdminStack(id: string): Promise<AdminStack | null> {
  return prisma.stack.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      iconKey: true,
      level: true,
      domain: true,
    },
  });
}

/** Les projets associés à une technologie, nommés pour l'avertissement (AC2). */
export type StackUsage = {
  count: number;
  /**
   * Titres des projets concernés. LIMITÉS : l'avertissement doit rester lisible,
   * et le nombre exact (`count`) est ce qui compte. `count > titles.length`
   * signale simplement qu'il y en a d'autres.
   */
  titles: string[];
};

/** Nombre maximal de titres cités dans l'avertissement de suppression. */
const USAGE_SAMPLE_SIZE = 5;

/**
 * Compte les projets associés à une technologie et en nomme quelques-uns (AC2).
 *
 * ⚠️ Cette lecture ne BLOQUE rien — contrairement à la garde média de 5.13, qui
 * REFUSE la suppression d'une image utilisée. Ici la suppression est autorisée :
 * on avertit, et si Jeevons confirme, l'association est retirée sans que les
 * projets soient supprimés. Ne pas confondre les deux sémantiques.
 */
export async function findStackUsage(stackId: string): Promise<StackUsage> {
  const [count, projects] = await Promise.all([
    prisma.project.count({ where: { stacks: { some: { id: stackId } } } }),
    prisma.project.findMany({
      where: { stacks: { some: { id: stackId } } },
      orderBy: { title: "asc" },
      take: USAGE_SAMPLE_SIZE,
      select: { title: true },
    }),
  ]);

  return { count, titles: projects.map((project) => project.title) };
}
