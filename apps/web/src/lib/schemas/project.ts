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

/** Longueur max d'un point fort — une ligne de carte, pas un paragraphe. */
const HIGHLIGHT_MAX = 300;

/**
 * Un point fort du projet (story 5.9, AC1).
 *
 * `id` est OPTIONNEL et porte toute la logique de réconciliation côté serveur :
 *  - présent  → point fort EXISTANT à mettre à jour (on préserve sa ligne, donc
 *    son identité) ;
 *  - absent   → point fort AJOUTÉ dans le formulaire, à créer.
 * Les points forts existants absents de la soumission sont supprimés. Sans cet
 * `id`, la seule stratégie possible serait « tout supprimer / tout recréer », ce
 * que le piège n°2 de la story interdit (duplication et churn d'identifiants).
 *
 * `sortOrder` n'est pas transmis par le client : le serveur le DÉRIVE de l'ordre
 * du tableau reçu (index). Une seule source de vérité pour l'ordre — la position
 * dans la liste — plutôt que deux qui pourraient diverger.
 */
export const highlightSchema = z.object({
  id: z.string().trim().min(1).optional(),
  label: z
    .string()
    .trim()
    .min(1, "Un point fort ne peut pas être vide.")
    .max(
      HIGHLIGHT_MAX,
      `Un point fort ne peut dépasser ${HIGHLIGHT_MAX} caractères.`,
    ),
});

export type HighlightInput = z.infer<typeof highlightSchema>;

/** Longueur max d'une légende — une phrase sous une image, pas un paragraphe. */
const CAPTION_MAX = 300;

/**
 * Une image de GALERIE du projet (modèle `ProjectImage`).
 *
 * ⚠️ Même logique de réconciliation que `highlightSchema` : `id` présent = ligne
 * existante à mettre à jour, absent = image ajoutée à créer. Les lignes
 * existantes absentes de la soumission sont supprimées.
 *
 * ⚠️ `mediaId` est REQUIS, contrairement au `coverId` du projet : une ligne de
 * galerie sans image n'a aucun sens (elle n'a pas d'autre contenu à porter),
 * alors qu'un projet sans couverture reste valide. L'éditeur n'ajoute d'ailleurs
 * une ligne qu'au moment où une image est choisie.
 *
 * `sortOrder` n'est pas transmis : le serveur le DÉRIVE de l'index du tableau,
 * exactement comme pour les points forts — une seule source de vérité pour
 * l'ordre.
 */
export const projectImageSchema = z.object({
  id: z.string().trim().min(1).optional(),
  mediaId: z.string().trim().min(1, "Une image de la galerie est invalide."),
  // La légende est FACULTATIVE : elle commente l'image quand c'est utile (« Écran
  // de validation des factures ») et reste vide sinon. Vide → `null`, et le site
  // public n'affiche alors aucun bloc de légende.
  caption: optionalText(
    CAPTION_MAX,
    `Une légende ne peut dépasser ${CAPTION_MAX} caractères.`,
  ),
});

export type ProjectImageInput = z.infer<typeof projectImageSchema>;

/**
 * Règles d'un projet, communes au client et au serveur (AC2 de 5.8).
 *
 * Story 5.9 : le schéma s'étend à `outcome` (résultat chiffré optionnel, AC4),
 * `highlights` (AC1) et `stackIds` (AC2). Le tri des projets est 5.10, la cover
 * est 5.12. `sortOrder` du projet n'est pas exposé ici (5.10).
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
  // AC4 — « un projet peut ne pas avoir de résultat chiffré ». Le champ est donc
  // optionnel : vide → `null`, l'enregistrement est ACCEPTÉ, et le site public
  // masque la section correspondante (jamais de bloc vide).
  outcome: optionalText(
    SHORT_TEXT_MAX,
    `Le résultat ne peut dépasser ${SHORT_TEXT_MAX} caractères.`,
  ),
  // AC1 — Points forts, SANS LIMITE ARBITRAIRE de nombre : aucun `.max()` sur le
  // tableau, c'est explicitement ce que l'AC demande. L'ordre du tableau EST
  // l'ordre d'affichage (il devient `sortOrder` côté serveur).
  highlights: z.array(highlightSchema),
  // AC2 — Technologies associées, par identifiant. Le formulaire ne propose que
  // des `Stack` EXISTANTES (la création de technologies est la story 5.15) ; le
  // serveur vérifie de son côté que chaque identifiant existe réellement, car
  // cette liste reste une entrée utilisateur.
  stackIds: z.array(z.string().trim().min(1)),
  // `published` est exposé en lecture/écriture SIMPLE ici : la gestion
  // brouillon/aperçu (route dédiée `/preview`, visibilité conditionnelle) a été
  // livrée par la story 5.11. Une case à cocher absente du POST vaut `false`.
  published: z.boolean(),
  // Story 5.12 (AC5) — Image de couverture, par identifiant de `Media`.
  //
  // OPTIONNELLE : un projet sans illustration reste parfaitement valide, et le
  // site public se contente alors de ne rien afficher. Vide → `null`, comme les
  // autres champs facultatifs.
  //
  // Le sélecteur ne propose que des médias EXISTANTS, mais cette valeur reste
  // une entrée utilisateur : la Server Action vérifie de son côté que
  // l'identifiant correspond à un média réel, exactement comme pour `stackIds`.
  coverId: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .nullable(),
  // GALERIE — images secondaires du projet, sans limite arbitraire de nombre
  // (même parti pris que les points forts). L'ordre du tableau EST l'ordre
  // d'affichage sur la fiche publique.
  //
  // ⚠️ Le `refine` fait respecter, CÔTÉ APPLICATIF, la contrainte d'unicité
  // `@@unique([projectId, mediaId])` de la base. Sans lui, ajouter deux fois la
  // même image ferait remonter une erreur Prisma brute (P2002) au lieu d'un
  // message compréhensible rattaché au champ.
  images: z
    .array(projectImageSchema)
    .refine(
      (images) =>
        new Set(images.map((image) => image.mediaId)).size === images.length,
      { message: "La même image est ajoutée plusieurs fois à la galerie." },
    ),
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
    outcome: text("outcome"),
    // Story 5.12 — Couverture. Champ caché piloté par le sélecteur d'images :
    // absent ou vide → `null`, c'est-à-dire « ce projet n'a pas d'illustration ».
    coverId: text("coverId"),
    // Une case NON cochée n'est pas envoyée du tout : absence = `false`. On teste
    // la PRÉSENCE de la clé plutôt que l'égalité à « on », qui est une convention
    // de navigateur : la seule chose qui fasse sens ici est « la case était-elle
    // cochée ».
    published: formData.has("published"),
    highlights: formDataToHighlights(formData),
    images: formDataToImages(formData),
    // `getAll` : les cases à cocher de technologies partagent le même nom, une
    // ligne par technologie sélectionnée. Aucune coché → tableau vide, donc
    // « le projet n'a aucune technologie », ce qui est un état légitime.
    stackIds: formData
      .getAll("stackIds")
      .filter((value): value is string => typeof value === "string"),
  };
}

/**
 * Reconstruit le tableau ordonné des images de galerie depuis le `FormData`.
 *
 * Même mécanique indexée que `formDataToHighlights` (voir son commentaire pour
 * le détail) : `images[0].id`, `images[0].mediaId`, `images[0].caption`…
 *
 * ⚠️ Une ligne SANS `mediaId` est écartée en silence : elle ne désigne aucune
 * image, il n'y a donc rien à persister. C'est le pendant exact du filtre des
 * points forts vides — une ligne résiduelle ne doit pas faire échouer
 * l'enregistrement du projet entier.
 */
function formDataToImages(formData: FormData): unknown[] {
  const byIndex = new Map<
    number,
    { id?: string; mediaId: string; caption: string }
  >();

  for (const [key, value] of formData.entries()) {
    const match = /^images\[(\d+)\]\.(id|mediaId|caption)$/.exec(key);
    if (!match || typeof value !== "string") continue;

    const index = Number(match[1]);
    const entry = byIndex.get(index) ?? { mediaId: "", caption: "" };
    if (match[2] === "id") {
      // Ligne nouvellement ajoutée : `id` vide, qu'on ne conserve pas — sinon le
      // serveur croirait devoir mettre à jour une ligne existante.
      if (value.trim().length > 0) entry.id = value;
    } else if (match[2] === "mediaId") {
      entry.mediaId = value;
    } else {
      entry.caption = value;
    }
    byIndex.set(index, entry);
  }

  return [...byIndex.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, entry]) => entry)
    .filter((entry) => entry.mediaId.trim().length > 0);
}

/**
 * Reconstruit le tableau ordonné des points forts depuis le `FormData` (AC1).
 *
 * ⚠️ Un `FormData` est PLAT : il n'a pas de notion de tableau d'objets. Les
 * champs sont donc émis par paires indexées — `highlights[0].id`,
 * `highlights[0].label`, `highlights[1].label`… — et reconstitués ici.
 *
 * L'index sert UNIQUEMENT à regrouper id et label d'une même ligne ; il ne fixe
 * pas l'ordre final. On trie explicitement par index numérique avant de produire
 * le tableau, car `FormData` ne garantit pas que « 10 » vienne après « 9 » si
 * l'on se fiait à l'ordre lexicographique des clés. C'est la POSITION dans le
 * tableau résultant qui devient le `sortOrder` persisté.
 *
 * Les lignes entièrement vides (label blanc et pas d'identifiant) sont écartées
 * en silence : une ligne ajoutée puis laissée vide ne doit pas faire échouer
 * l'enregistrement du projet entier.
 */
function formDataToHighlights(formData: FormData): unknown[] {
  const byIndex = new Map<number, { id?: string; label: string }>();

  for (const [key, value] of formData.entries()) {
    const match = /^highlights\[(\d+)\]\.(id|label)$/.exec(key);
    if (!match || typeof value !== "string") continue;

    const index = Number(match[1]);
    const entry = byIndex.get(index) ?? { label: "" };
    if (match[2] === "id") {
      // Une ligne nouvellement ajoutée poste un `id` vide : on ne le conserve
      // pas, sinon le serveur croirait devoir mettre à jour une ligne existante.
      if (value.trim().length > 0) entry.id = value;
    } else {
      entry.label = value;
    }
    byIndex.set(index, entry);
  }

  return [...byIndex.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, entry]) => entry)
    .filter((entry) => entry.label.trim().length > 0 || entry.id !== undefined);
}
