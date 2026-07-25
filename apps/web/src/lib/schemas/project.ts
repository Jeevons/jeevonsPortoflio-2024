import { z } from "zod";

import { ProjectCategory } from "@/generated/prisma/enums";

// Story 5.8 — SCHÉMA PARTAGÉ client/serveur des projets (AC2, PLAN §3.3).
//
// ⚠️ CE FICHIER EST LA SOURCE UNIQUE des règles de validation d'un projet. Il
// est importé PAR LES DEUX CÔTÉS :
//  - le formulaire client (`project-form.tsx`, via `zodResolver`) → validation
//    instantanée dans le navigateur ;
//  - la Server Action (`actions.ts`) → revalidation côté serveur, SOURCE DE
//    VÉRITÉ finale.
// ❌ Ne JAMAIS dupliquer une règle d'un côté ou de l'autre : AC2 exige que « les
// mêmes règles s'appliquent côté navigateur et côté serveur ». Une règle ajoutée
// ici s'applique donc automatiquement aux deux.
//
// ⚠️ Pas de `server-only` ici (contrairement à `lib/db.ts` ou `lib/projects.ts`) :
// ce module DOIT pouvoir être importé par un Client Component. Il ne contient
// que des règles pures — aucun accès base, aucun secret. L'import de
// `ProjectCategory` vise `@/generated/prisma/enums`, un module d'enums pur
// (valeurs littérales), et non le client Prisma : rien de serveur ne fuit dans
// le bundle client.

/** Longueur max des champs texte courts — garde-fou contre les payloads absurdes. */
const SHORT_TEXT_MAX = 200;
const DESCRIPTION_MAX = 5000;

// Format d'un identifiant d'URL (AC3, piège n°4) : minuscules, chiffres et
// tirets simples, sans tiret en tête ni en queue. C'est ce qui rend le slug
// sûr dans une URL publique `/projects/<slug>` sans encodage.
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Transforme un titre en identifiant d'URL (AC3 — « un identifiant m'est proposé
 * automatiquement à partir du titre »).
 *
 * Fonction PURE et partagée : le client s'en sert pour la suggestion live, le
 * serveur pour retomber sur ses pieds si le champ arrive vide. Les deux côtés
 * produisent donc exactement le même slug pour un même titre.
 *
 * `normalize("NFD")` + suppression des diacritiques : « Réfonte été » → « refonte-ete ».
 * Sans cette étape, les accents disparaîtraient purement et simplement (« rfonte »).
 */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SHORT_TEXT_MAX);
}

// `z.enum` alimenté par l'OBJET d'enum Prisma (et non par `Object.values(...)`
// casté en `string[]`) : le type inféré reste l'union littérale
// `"FLAGSHIP" | "PERSONAL" | "LAB"`, directement assignable au `ProjectCategory`
// attendu par `prisma.project.create`. Un cast en `string` obligerait à
// re-caster côté Server Action — donc à réintroduire une confiance non vérifiée.
//
// Le schéma refuse toute catégorie inconnue, y compris envoyée directement à la
// Server Action (client contourné, AC2).
const categorySchema = z.enum(ProjectCategory, {
  message: "Choisissez une catégorie valide.",
});

/**
 * Champ texte optionnel : un `<input>` vide renvoie `""`, pas `undefined`.
 * On normalise donc « vide ou blanc » → `null` AVANT validation, pour que la
 * colonne nullable de Prisma reçoive bien `null` et non une chaîne vide.
 */
function optionalText(max: number, message: string) {
  return z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => (value.length === 0 ? null : value))
    .nullable();
}

/**
 * Champ URL optionnel (`link`, `repoUrl`). Vide → `null` ; sinon l'URL doit être
 * absolue et en http(s) — un `javascript:` ou un chemin relatif est refusé, car
 * ces valeurs finissent dans un `href` du site public.
 */
function optionalUrl(message: string) {
  return z
    .string()
    .trim()
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .refine((value) => value === null || /^https?:\/\/\S+$/i.test(value), {
      message,
    });
}

/**
 * Règles d'un projet, communes au client et au serveur (AC2).
 *
 * Périmètre VERROUILLÉ aux champs scalaires du modèle `Project` : highlights et
 * stacks détaillés sont la story 5.9, le tri est 5.10, la cover est 5.12.
 * `sortOrder` n'est pas exposé ici (5.10) — la création laisse le défaut `0`.
 */
export const projectSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1, "L'identifiant d'URL est obligatoire.")
    .max(
      SHORT_TEXT_MAX,
      `L'identifiant ne peut dépasser ${SHORT_TEXT_MAX} caractères.`,
    )
    .regex(
      SLUG_PATTERN,
      "L'identifiant ne peut contenir que des minuscules, des chiffres et des tirets (ex. mon-projet).",
    ),
  category: categorySchema,
  company: z
    .string()
    .trim()
    .min(1, "L'entreprise est obligatoire.")
    .max(
      SHORT_TEXT_MAX,
      `L'entreprise ne peut dépasser ${SHORT_TEXT_MAX} caractères.`,
    ),
  title: z
    .string()
    .trim()
    .min(1, "Le titre est obligatoire.")
    .max(
      SHORT_TEXT_MAX,
      `Le titre ne peut dépasser ${SHORT_TEXT_MAX} caractères.`,
    ),
  period: z
    .string()
    .trim()
    .min(1, "La période est obligatoire.")
    .max(
      SHORT_TEXT_MAX,
      `La période ne peut dépasser ${SHORT_TEXT_MAX} caractères.`,
    ),
  description: optionalText(
    DESCRIPTION_MAX,
    `La description ne peut dépasser ${DESCRIPTION_MAX} caractères.`,
  ),
  link: optionalUrl("Le lien doit être une URL complète (https://…)."),
  repoUrl: optionalUrl("Le dépôt doit être une URL complète (https://…)."),
  // `published` est exposé en lecture/écriture SIMPLE ici (piège n°6) : la
  // gestion brouillon/preview (`?preview=1`, visibilité conditionnelle) est la
  // story 5.11. Une case à cocher absente du POST vaut `false`.
  published: z.boolean(),
});

/** Valeurs validées d'un projet — contrat unique client ↔ serveur. */
export type ProjectInput = z.infer<typeof projectSchema>;

/**
 * Forme BRUTE du formulaire, avant validation. `react-hook-form` pilote des
 * `<input>` : toutes ses valeurs sont des chaînes (ou un booléen pour la case à
 * cocher). C'est le type d'ENTRÉE du schéma, distinct du type de SORTIE
 * (`ProjectInput`) où les champs optionnels sont déjà normalisés en `null`.
 */
export type ProjectFormValues = z.input<typeof projectSchema>;

/**
 * Traduit un `FormData` en objet brut prêt pour `projectSchema.parse`.
 *
 * Utilisée par la Server Action : elle reçoit un `FormData`, jamais un objet
 * typé — un appelant malveillant peut poster n'importe quoi. On ne fait ICI
 * aucune validation, seulement la conversion de forme ; c'est `projectSchema`
 * qui refuse (AC2 : « une saisie invalide étant refusée dans les deux cas »).
 *
 * `formData.get()` renvoie `string | File | null` : on force en chaîne pour que
 * même un champ absent ou un fichier posté à la place d'un texte tombe sur une
 * valeur inoffensive que le schéma rejettera proprement.
 */
export function projectFormDataToInput(formData: FormData): unknown {
  const text = (name: string): string => {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
  };

  return {
    slug: text("slug"),
    category: text("category"),
    company: text("company"),
    title: text("title"),
    period: text("period"),
    description: text("description"),
    link: text("link"),
    repoUrl: text("repoUrl"),
    // Une case NON cochée n'est pas envoyée du tout : absence = `false`.
    published: formData.get("published") === "on",
  };
}
