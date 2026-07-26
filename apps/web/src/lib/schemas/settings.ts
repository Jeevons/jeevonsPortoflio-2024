import { z } from "zod";

// Story 5.16 — SCHÉMA PARTAGÉ client/serveur des réglages du site (AC1, AC3).
//
// ⚠️ Même discipline que 5.8 / 5.14 / 5.15 : source UNIQUE des règles, importée
// par le formulaire client (via `zodResolver`) ET par la Server Action (source
// de vérité). Une Server Action est un endpoint POST atteignable sans passer par
// le formulaire : la validation client ne protège rien à elle seule (AC3 exige
// explicitement que la validation soit appliquée CÔTÉ SERVEUR).
//
// ⚠️ Pas de `server-only` : ce module DOIT pouvoir être importé par un Client
// Component. Il ne contient que des règles pures — aucun accès base.
//
// ⚠️ PIÈGE n°1 — FORME JSON À PRÉSERVER. `SiteSetting` est un magasin
// clé → JSON (`key @id, value Json`), et le public lit chaque clé avec une forme
// PRÉCISE (`lib/settings.ts`, story 4.3). Réécrire une forme différente casserait
// le rendu public en silence. Le recensement (tâche 0) donne la réalité :
//
//   • 8 clés dont la valeur est une CHAÎNE NUE (pas un objet) :
//       hero.title · hero.subtitle · hero.statusBadge
//       social.twitter · social.instagram · social.linkedin · social.github
//       contact.linkedin
//   • 1 clé STRUCTURÉE : contact.email = { user: string[], host: string[] }
//
// ⚠️ Le texte de la story supposait des objets composés (`hero = {title,
// subtitle}`). C'est FAUX : les clés sont PLATES et pointées. Vérifié dans
// `lib/settings.ts` (SETTING_KEYS + les trois lecteurs typés) et dans
// `content/settings.ts` (le seed). Ne pas « regrouper » : `readString` lit
// `hero.title` directement, pas `hero` puis `.title`.

/** Longueurs maximales — bornes de saisie, pas des règles métier. */
const TITLE_MAX = 200;
const SUBTITLE_MAX = 1000;
const BADGE_MAX = 120;
const URL_MAX = 500;
const EMAIL_MAX = 254; // RFC 5321 : longueur maximale d'une adresse.

/**
 * Un lien social ou de contact (AC3).
 *
 * ⚠️ `z.url()` seul accepte `javascript:alert(1)` et `ftp://…` — ce sont des URL
 * syntaxiquement valides. On RESTREINT donc le protocole à http/https, sinon un
 * lien `javascript:` atterrirait dans un `href` du site public, ce qui est une
 * porte ouverte au XSS.
 *
 * ⚠️ AUCUN domaine imposé (décision Jeevons) : le champ GitHub n'est pas forcé
 * de pointer vers github.com. Contraindre le domaine casserait à la moindre
 * migration d'un réseau (X/Twitter en est l'exemple récent) et interdirait un
 * lien de redirection ou un domaine perso.
 */
function linkSchema(label: string) {
  return z
    .string()
    .trim()
    .min(1, `${label} est obligatoire.`)
    .max(URL_MAX, `${label} ne peut dépasser ${URL_MAX} caractères.`)
    .refine(
      (value) => {
        let parsed: URL;
        try {
          parsed = new URL(value);
        } catch {
          return false;
        }
        return parsed.protocol === "https:" || parsed.protocol === "http:";
      },
      {
        message: `${label} doit être un lien complet commençant par https://`,
      },
    );
}

/** Un texte obligatoire, borné. */
function textSchema(label: string, max: number) {
  return z
    .string()
    .trim()
    .min(1, `${label} est obligatoire.`)
    .max(max, `${label} ne peut dépasser ${max} caractères.`);
}

/**
 * Forme STOCKÉE de l'e-mail : fragmentée (`{ user, host }`).
 *
 * ⚠️ Ce fragmentement est une protection ANTI-MOISSON héritée de l'Epic 1 : la
 * chaîne complète n'existe jamais dans le HTML servi, elle n'est recomposée
 * qu'au clic, côté client (`ContactClient.tsx` : `user.join(".") + "@" +
 * host.join(".")`). La forme est donc IMPOSÉE par le public — la réécrire
 * autrement ferait retomber la lecture sur le défaut, en silence.
 */
export type FragmentedEmailValue = { user: string[]; host: string[] };

/**
 * Adresse e-mail saisie ENTIÈRE (décision Jeevons), fragmentée à l'écriture.
 *
 * ⚠️ La protection anti-moisson vit dans le RENDU PUBLIC, pas dans la saisie
 * admin : l'écran d'administration est derrière `requireAdmin`, aucun robot n'y
 * accède. Faire saisir deux champs séparés n'aurait donc rien protégé de plus,
 * tout en offrant un moyen de casser la forme JSON par inadvertance.
 */
export const emailSchema = z
  .string()
  .trim()
  .min(1, "L'adresse e-mail est obligatoire.")
  .max(EMAIL_MAX, `L'adresse e-mail ne peut dépasser ${EMAIL_MAX} caractères.`)
  .refine((value) => z.email().safeParse(value).success, {
    message:
      "Saisissez une adresse e-mail valide (ex. : prenom.nom@exemple.fr).",
  })
  // Le découpage du public est `join(".")` : le nôtre est donc `split(".")`, son
  // exact inverse. Toute autre séparation reconstruirait une adresse fausse.
  .refine(
    (value) => {
      const [user, host] = splitEmailParts(value);
      return (
        user.length > 0 &&
        host.length > 1 &&
        [...user, ...host].every((part) => part.length > 0)
      );
    },
    {
      message:
        "Cette adresse ne peut pas être enregistrée (point en trop, ou domaine incomplet).",
    },
  );

/** Découpe une adresse en fragments, inverse exact du `join(".")` public. */
function splitEmailParts(value: string): [string[], string[]] {
  const at = value.lastIndexOf("@");
  if (at === -1) return [[], []];
  return [value.slice(0, at).split("."), value.slice(at + 1).split(".")];
}

/**
 * Traduit une adresse validée vers la forme STOCKÉE `{ user, host }`.
 *
 * ⚠️ À n'appeler QU'APRÈS validation par `emailSchema` : cette fonction ne
 * vérifie rien, elle découpe.
 */
export function toFragmentedEmail(value: string): FragmentedEmailValue {
  const [user, host] = splitEmailParts(value.trim());
  return { user, host };
}

/**
 * Recompose une adresse depuis la forme stockée, pour PRÉ-REMPLIR le formulaire.
 * Strictement la même opération que le site public au clic.
 */
export function fromFragmentedEmail(value: FragmentedEmailValue): string {
  return `${value.user.join(".")}@${value.host.join(".")}`;
}

/**
 * Règles de l'écran de réglages (AC1, AC3).
 *
 * Un champ = une clé `SiteSetting`. Les noms de champs sont volontairement
 * PLATS et alignés sur les clés, pour que le mapping vers `SETTING_KEYS` reste
 * évident et non inventif.
 */
export const settingsSchema = z.object({
  heroTitle: textSchema("Le titre de l'accroche", TITLE_MAX),
  heroSubtitle: textSchema("Le sous-titre de l'accroche", SUBTITLE_MAX),
  heroStatusBadge: textSchema("Le badge de statut", BADGE_MAX),
  socialTwitter: linkSchema("Le lien X (Twitter)"),
  socialInstagram: linkSchema("Le lien Instagram"),
  socialLinkedin: linkSchema("Le lien LinkedIn (pied de page)"),
  socialGithub: linkSchema("Le lien GitHub"),
  contactLinkedin: linkSchema("Le lien LinkedIn (contact)"),
  contactEmail: emailSchema,
});

/** Valeurs validées — contrat unique client ↔ serveur. */
export type SettingsInput = z.infer<typeof settingsSchema>;

/** Forme BRUTE du formulaire : `react-hook-form` pilote des `<input>`. */
export type SettingsFormValues = z.input<typeof settingsSchema>;

/**
 * Traduit un `FormData` en objet brut prêt pour `settingsSchema.parse`.
 *
 * Aucune validation ICI, seulement la conversion de forme — c'est le schéma qui
 * refuse. La Server Action reçoit un `FormData` et jamais un objet typé : un
 * appelant peut y poster n'importe quoi.
 */
export function settingsFormDataToInput(formData: FormData): unknown {
  const text = (name: string): string => {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
  };

  return {
    heroTitle: text("heroTitle"),
    heroSubtitle: text("heroSubtitle"),
    heroStatusBadge: text("heroStatusBadge"),
    socialTwitter: text("socialTwitter"),
    socialInstagram: text("socialInstagram"),
    socialLinkedin: text("socialLinkedin"),
    socialGithub: text("socialGithub"),
    contactLinkedin: text("contactLinkedin"),
    contactEmail: text("contactEmail"),
  };
}
