import { z } from "zod";

import { slugify } from "@/lib/schemas/project";

// Story 5.14 — SCHÉMA PARTAGÉ client/serveur d'une entrée de parcours (AC1).
//
// ⚠️ Même discipline que `schemas/project.ts` (5.8), et pour la même raison : ce
// fichier est la SOURCE UNIQUE des règles de validation d'une entrée. Il est
// importé PAR LES DEUX CÔTÉS :
//  - le formulaire client (`timeline-form.tsx`, via `zodResolver`) → refus
//    instantané dans le navigateur ;
//  - la Server Action (`actions.ts`) → revalidation serveur, SOURCE DE VÉRITÉ.
// ❌ Ne JAMAIS dupliquer une règle d'un côté ou de l'autre : une Server Action
// est un endpoint POST atteignable sans passer par le formulaire, donc la
// validation client ne protège rien à elle seule.
//
// ⚠️ Pas de `server-only` ici : ce module DOIT pouvoir être importé par un
// Client Component. Il ne contient que des règles pures — aucun accès base.
//
// `slugify` est réutilisé depuis le schéma des projets plutôt que recopié : la
// règle « comment un titre devient un identifiant » n'a aucune raison de
// diverger d'un contenu à l'autre, et deux implémentations dériveraient.

const SHORT_TEXT_MAX = 200;
const BODY_MAX = 5000;

// Même format d'identifiant que pour les projets (5.8) : minuscules, chiffres et
// tirets simples. Ici le slug ne sert pas d'URL publique mais de CLÉ NATURELLE
// du seed (`@unique`, décision 4.2) — le garder au même format évite qu'une
// entrée créée depuis l'admin soit incompatible avec un futur upsert de seed.
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Bornes des années. Volontairement larges : ce ne sont pas des règles
 * métier mais des garde-fous contre une saisie absurde (« 202 » au lieu de
 * « 2024 », ou un nombre à rallonge). Une date de naissance de parcours
 * antérieure à 1900 n'a pas de sens pour un portfolio.
 */
const YEAR_MIN = 1900;
const YEAR_MAX = 2100;

/**
 * Une année : entier borné. `z.coerce` car un `<input type="number">` poste
 * une CHAÎNE — sans coercition, toute saisie échouerait sur « attendu number,
 * reçu string », y compris une année parfaitement valide.
 */
function yearSchema(message: string) {
  return z.coerce
    .number({ message })
    .int(message)
    .min(YEAR_MIN, `L'année doit être postérieure à ${YEAR_MIN}.`)
    .max(YEAR_MAX, `L'année doit être antérieure à ${YEAR_MAX}.`);
}

/**
 * Règles d'une entrée de parcours, communes au client et au serveur (AC1).
 *
 * ⚠️ `endYear` est le cœur de l'AC1 : « une entrée toujours en cours peut être
 * enregistrée SANS année de fin ». Le champ est donc NULLABLE, et un champ vide
 * est normalisé en `null` AVANT validation — un `<input type="number">` vide
 * poste `""`, que `z.coerce.number()` transformerait silencieusement en `0`,
 * c'est-à-dire en une entrée « terminée en l'an 0 ». Ce `transform` en amont est
 * ce qui distingue « en cours » de « année invalide ».
 */
export const timelineEntrySchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(1, "L'identifiant est obligatoire.")
      .max(
        SHORT_TEXT_MAX,
        `L'identifiant ne peut dépasser ${SHORT_TEXT_MAX} caractères.`,
      )
      .regex(
        SLUG_PATTERN,
        "L'identifiant ne peut contenir que des minuscules, des chiffres et des tirets (ex. but-mmi).",
      ),
    title: z
      .string()
      .trim()
      .min(1, "L'intitulé est obligatoire.")
      .max(
        SHORT_TEXT_MAX,
        `L'intitulé ne peut dépasser ${SHORT_TEXT_MAX} caractères.`,
      ),
    place: z
      .string()
      .trim()
      .min(1, "Le lieu est obligatoire.")
      .max(
        SHORT_TEXT_MAX,
        `Le lieu ne peut dépasser ${SHORT_TEXT_MAX} caractères.`,
      ),
    body: z
      .string()
      .trim()
      .min(1, "Le texte est obligatoire.")
      .max(BODY_MAX, `Le texte ne peut dépasser ${BODY_MAX} caractères.`),
    startYear: yearSchema("L'année de début est obligatoire."),
    // AC1 — « toujours en cours » = pas d'année de fin. Vide → `null`, ACCEPTÉ.
    //
    // ⚠️ `z.preprocess` et non `.transform().pipe()` : `z.coerce.number()` a un
    // type d'ENTRÉE `unknown`, que `.pipe()` refuse de chaîner derrière un
    // transform typé (erreur TS2345). `preprocess` normalise en AMONT — le vide
    // devient `null`, tout le reste part vers `yearSchema` — et accepte
    // naturellement une entrée non typée, qui est bien ce qu'un `FormData`
    // fournit.
    endYear: z.preprocess((value) => {
      if (value === null || value === undefined) return null;
      if (typeof value === "string" && value.trim() === "") return null;
      return value;
    }, yearSchema("L'année de fin doit être une année valide.").nullable()),
    // Illustration (AC1). Story 5.14 : `avatarId` est désormais une VRAIE
    // relation vers `Media` (migration `add_timeline_avatar_relation`).
    // OPTIONNELLE — une entrée sans illustration reste parfaitement valide.
    // Le sélecteur ne propose que des médias existants, mais cette valeur reste
    // une entrée utilisateur : la base la vérifie par la clé étrangère, et la
    // Server Action traduit le refus (P2003).
    avatarId: z
      .string()
      .trim()
      .transform((value) => (value === "" ? null : value))
      .nullable(),
    // AC3 — Une entrée non publiée n'apparaît pas sur le site public. Une case
    // à cocher absente du POST vaut `false`.
    published: z.boolean(),
  })
  // ⚠️ AC1 — COHÉRENCE des deux années, vérifiée APRÈS le parsing des champs
  // (`superRefine` sur l'objet) : la règle porte sur DEUX champs à la fois, elle
  // ne peut pas vivre sur l'un d'eux. Une entrée « 2024 → 2020 » est un lapsus
  // de saisie courant que rien d'autre n'attraperait.
  //
  // `endYear === null` (en cours) passe évidemment : c'est le cas nominal de
  // l'AC1, surtout pas une erreur.
  .superRefine((value, ctx) => {
    if (value.endYear !== null && value.endYear < value.startYear) {
      ctx.addIssue({
        code: "custom",
        // Erreur portée par `endYear` : le message et le focus vont sur le
        // champ à corriger, pas dans un bandeau global.
        path: ["endYear"],
        message:
          "L'année de fin ne peut pas être antérieure à l'année de début.",
      });
    }
  });

/** Valeurs validées d'une entrée — contrat unique client ↔ serveur. */
export type TimelineEntryInput = z.infer<typeof timelineEntrySchema>;

/**
 * Forme BRUTE du formulaire, avant validation. `react-hook-form` pilote des
 * `<input>` : ses valeurs sont des chaînes (ou un booléen pour la case).
 */
export type TimelineEntryFormValues = z.input<typeof timelineEntrySchema>;

/**
 * Traduit un `FormData` en objet brut prêt pour `timelineEntrySchema.parse`.
 *
 * Utilisée par la Server Action, qui reçoit un `FormData` et jamais un objet
 * typé : un appelant peut y poster n'importe quoi. On ne fait ICI aucune
 * validation, seulement la conversion de forme — c'est le schéma qui refuse.
 */
export function timelineFormDataToInput(formData: FormData): unknown {
  const text = (name: string): string => {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
  };

  return {
    slug: text("slug"),
    title: text("title"),
    place: text("place"),
    body: text("body"),
    startYear: text("startYear"),
    // Vide → le schéma normalise en `null`, c'est-à-dire « toujours en cours ».
    endYear: text("endYear"),
    avatarId: text("avatarId"),
    // Une case NON cochée n'est pas envoyée du tout : absence = `false`. On
    // teste la PRÉSENCE de la clé plutôt que l'égalité à « on », qui n'est
    // qu'une convention de navigateur.
    published: formData.has("published"),
  };
}

export { slugify };
