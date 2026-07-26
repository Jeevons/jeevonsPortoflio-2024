import { z } from "zod";

import { SkillLevel } from "@/generated/prisma/enums";

// Story 5.15 — SCHÉMA PARTAGÉ client/serveur d'une technologie (AC1).
//
// ⚠️ Même discipline que `schemas/project.ts` (5.8) et `schemas/timeline.ts`
// (5.14) : source UNIQUE des règles, importée par le formulaire client (via
// `zodResolver`) ET par la Server Action (source de vérité). Une Server Action
// est un endpoint POST atteignable sans passer par le formulaire : la validation
// client ne protège rien à elle seule.
//
// ⚠️ Pas de `server-only` ici : ce module DOIT pouvoir être importé par un
// Client Component. Il ne contient que des règles pures — aucun accès base.

const NAME_MAX = 60;

/**
 * Niveaux de maîtrise — l'enum Prisma `SkillLevel` (schéma 4.1) est réutilisé
 * TEL QUEL (AGENTS.md §9 : ne pas recréer un modèle existant).
 *
 * `z.enum` sur l'objet généré plutôt qu'une liste recopiée : ajouter une valeur
 * à l'enum Prisma la rend automatiquement acceptée ici, sans divergence
 * silencieuse entre la base et la validation.
 */
export const skillLevelSchema = z.enum(SkillLevel, {
  message: "Choisissez un niveau de maîtrise.",
});

/** Libellés français des niveaux, affichés par l'administration. */
export const SKILL_LEVEL_LABELS: Record<SkillLevel, string> = {
  STRONG: "Solide",
  COMFORTABLE: "À l'aise",
  LEARNING: "En apprentissage",
};

/**
 * Règles d'une technologie (AC1 : nom, clé d'icône, niveau).
 *
 * ⚠️ L'UNICITÉ DU NOM n'est PAS vérifiable ici. Un schéma est une fonction pure :
 * il ne peut pas savoir ce que contient la base. La contrainte `name @unique`
 * (schéma 4.1) est donc la seule autorité, et la Server Action traduit son refus
 * (P2002) en message lisible — voir `actions.ts`. Ajouter ici une pré-vérification
 * par requête ne remplacerait rien : entre la lecture et l'écriture, un autre
 * appel peut insérer le même nom (course critique). La base tranche, toujours.
 *
 * ⚠️ `iconKey` n'est PAS restreint au registre connu (décision Jeevons) : une
 * clé inconnue est ACCEPTÉE et l'administration se contente d'avertir. Refuser
 * la saisie ferait disparaître la technologie du site, ce qui est pire qu'une
 * icône générique. Le repli visuel est assuré par `resolveStackIcon`.
 */
export const stackSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Le nom est obligatoire.")
    .max(NAME_MAX, `Le nom ne peut dépasser ${NAME_MAX} caractères.`),
  // Vide → `null` : une technologie sans icône reste valide (la colonne est
  // nullable depuis 4.1, et le seed ne la renseigne pas).
  iconKey: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .nullable(),
  // Vide → `null` : le niveau est optionnel en base (4.1). Les technologies sans
  // niveau passent en fin de toolbox plutôt que d'être masquées.
  level: z
    .union([z.literal(""), z.null(), z.undefined(), skillLevelSchema])
    .transform((value) => (value === "" || value === undefined ? null : value)),
});

/** Valeurs validées d'une technologie — contrat unique client ↔ serveur. */
export type StackInput = z.infer<typeof stackSchema>;

/**
 * Forme BRUTE du formulaire, avant validation. `react-hook-form` pilote des
 * `<input>`/`<select>` : ses valeurs sont des chaînes.
 */
export type StackFormValues = z.input<typeof stackSchema>;

/**
 * Traduit un `FormData` en objet brut prêt pour `stackSchema.parse`.
 *
 * Utilisée par la Server Action, qui reçoit un `FormData` et jamais un objet
 * typé : un appelant peut y poster n'importe quoi. Aucune validation ICI,
 * seulement la conversion de forme — c'est le schéma qui refuse.
 */
export function stackFormDataToInput(formData: FormData): unknown {
  const text = (name: string): string => {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
  };

  return {
    name: text("name"),
    iconKey: text("iconKey"),
    level: text("level"),
  };
}
