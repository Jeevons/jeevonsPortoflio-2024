import { z } from "zod";

// Story 6.12 — SCHÉMA PARTAGÉ client/serveur du formulaire de contact (AC5).
//
// ⚠️ Même discipline que `schemas/stack.ts` (5.15) et `schemas/project.ts`
// (5.8) : source UNIQUE des règles, importée par le formulaire client (via
// `zodResolver`) ET par la Server Action (source de vérité). Une Server Action
// est un endpoint POST atteignable sans passer par le formulaire : la
// validation client ne protège rien à elle seule — c'est tout le fondement
// d'AC5 (« la validation est appliquée côté serveur »).
//
// ⚠️ Pas de `server-only` ici : ce module DOIT pouvoir être importé par un
// Client Component. Il ne contient que des règles pures — aucun accès base.

const NAME_MAX = 80;
const EMAIL_MAX = 200;
const BODY_MIN = 10;
const BODY_MAX = 4000;

/** Nom du champ piège (AC3). Volontairement plausible — voir `contactSchema`. */
export const HONEYPOT_FIELD = "website";

/**
 * Règles d'un message de contact (AC1 : nom, adresse, message).
 *
 * 🛑 `body` porte un MAXIMUM, et ce n'est pas cosmétique : la colonne est un
 * `@db.Text` (schéma 4.1), donc sans borne un robot y écrirait des mégaoctets.
 * Le minimum, lui, écarte les envois vides d'un seul caractère sans gêner un
 * message court légitime.
 *
 * ⚠️ `z.email()` (Zod 4, plus `z.string().email()`) : validation de forme
 * uniquement. Elle ne prouve pas que l'adresse existe — rien ne le peut côté
 * serveur — mais elle écarte les saisies manifestement fautives, ce que demande
 * AC5. L'adresse sert de `Reply-To` à la notification (AC2).
 *
 * ⚠️ Le champ piège n'est PAS validé ici. Il ne fait pas partie du contrat
 * métier : la Server Action le lit AVANT toute validation et sort en succès
 * silencieux s'il est rempli (AC3). L'inclure au schéma reviendrait à le
 * traiter comme une donnée, alors que c'est un signal.
 */
export const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Merci d'indiquer votre nom.")
    .max(NAME_MAX, `Le nom ne peut dépasser ${NAME_MAX} caractères.`),
  email: z
    .email("Cette adresse e-mail ne semble pas valide.")
    .trim()
    .max(EMAIL_MAX, `L'adresse ne peut dépasser ${EMAIL_MAX} caractères.`),
  body: z
    .string()
    .trim()
    .min(BODY_MIN, `Votre message doit faire au moins ${BODY_MIN} caractères.`)
    .max(BODY_MAX, `Votre message ne peut dépasser ${BODY_MAX} caractères.`),
});

/** Valeurs validées d'un message — contrat unique client ↔ serveur. */
export type ContactInput = z.infer<typeof contactSchema>;

/** Forme BRUTE du formulaire, avant validation (les `<input>` rendent des chaînes). */
export type ContactFormValues = z.input<typeof contactSchema>;

/** Limites exposées à la vue (compteur de caractères, `maxLength`). */
export const CONTACT_LIMITS = {
  nameMax: NAME_MAX,
  emailMax: EMAIL_MAX,
  bodyMin: BODY_MIN,
  bodyMax: BODY_MAX,
} as const;

/**
 * Traduit un `FormData` en objet brut prêt pour `contactSchema.parse`.
 *
 * Utilisée par la Server Action, qui reçoit un `FormData` et jamais un objet
 * typé : un appelant peut y poster n'importe quoi. Aucune validation ICI,
 * seulement la conversion de forme — c'est le schéma qui refuse.
 */
export function contactFormDataToInput(formData: FormData): unknown {
  const text = (name: string): string => {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
  };

  return {
    name: text("name"),
    email: text("email"),
    body: text("body"),
  };
}
