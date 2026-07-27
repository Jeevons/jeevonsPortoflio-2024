"use server";

import { headers } from "next/headers";

import { notifyNewContactMessage } from "@/lib/contact-notification";
import {
  checkContactRateLimit,
  rateLimitMessage,
} from "@/lib/contact-rate-limit";
import { prisma } from "@/lib/db";
import { clientIpFromHeaders } from "@/lib/login-rate-limit";
import {
  contactFormDataToInput,
  contactSchema,
  HONEYPOT_FIELD,
  type ContactInput,
} from "@/lib/schemas/contact";

// Story 6.12 — Réception d'un message de contact (AC1 à AC6).
//
// 🛑 L'ORDRE DES OPÉRATIONS EST IMPOSÉ, et chaque étape a une raison :
//
//   1. champ piège rempli  → SUCCÈS SILENCIEUX, sans écriture ni notification
//   2. limitation de débit → refus AVEC un message compréhensible
//   3. validation Zod      → erreurs par champ
//   4. écriture en base    → le message est ACQUIS à partir d'ici
//   5. notification        → try/catch NON bloquant
//   6. confirmation        → quelle que soit l'issue de l'étape 5
//
// 🛑 `headers()` N'EST APPELÉ QUE DANS CETTE ACTION, jamais dans un composant de
// section. Une API dynamique lue AU RENDU basculerait `/` de `○ (Static, 1h)` à
// `ƒ (Dynamic)` et ferait perdre l'ISR de la story 4.4 à TOUS les visiteurs
// (garde-fou écrit dans `page.tsx`, constaté en 5.11). Une Server Action, elle,
// s'exécute au POST — hors du rendu statique : elle n'a aucun effet sur lui.
//
// ⚠️ Ce module vit hors de `sections/` car un fichier `"use server"` n'exporte
// que des fonctions async : il ne peut pas cohabiter avec un composant.

/** Retour de l'action, consommé par `useActionState` (motif 5.8/5.14/5.15). */
export type ContactFormState = {
  status: "idle" | "success" | "error";
  /** Message global : succès, limitation de débit, ou panne. */
  message: string | null;
  /** Erreurs par champ, mêmes messages que côté client (schéma partagé). */
  fieldErrors: Partial<Record<keyof ContactInput, string>>;
};

// ⚠️ Dans un module `"use server"`, TOUT export runtime doit être une fonction
// async : l'état initial ne peut donc PAS être exporté d'ici, il est déclaré
// côté client, dans la vue (`ContactClient.tsx`). Les `export type` sont
// effacés à la compilation — ils restent autorisés.

/**
 * Confirmation d'AC6. 🛑 C'est AUSSI la réponse rendue quand le champ piège est
 * rempli (AC3) : la réponse doit être RIGOUREUSEMENT identique à celle d'un
 * succès, sinon un robot apprend qu'il a été détecté et ajuste son tir.
 */
const SUCCESS: ContactFormState = {
  status: "success",
  message:
    "Merci pour votre message ! Il est bien arrivé, je vous répondrai dès que possible.",
  fieldErrors: {},
};

const GENERIC_ERROR =
  "L'envoi a échoué. Réessayez dans un instant, ou écrivez-moi via LinkedIn.";

/**
 * Enregistre un message de contact envoyé depuis la section `#contact`.
 *
 * ⚠️ Signature `useActionState` : le premier paramètre est l'état précédent, non
 * utilisé ici (chaque soumission est indépendante).
 */
export async function submitContactMessage(
  _previousState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  // ── 1. Champ piège (AC3) ────────────────────────────────────────────────
  // 🛑 AVANT TOUT LE RESTE, y compris avant la limitation de débit : une
  // soumission de robot ne doit consommer aucun quota (une IP peut être
  // partagée par un réseau d'entreprise — un recruteur légitime derrière la
  // même sortie NAT paierait pour le robot).
  //
  // ⚠️ On retourne le SUCCÈS, sans écrire ni notifier. Un message d'erreur, un
  // code distinct ou même un délai différent seraient autant de signaux.
  const honeypot = formData.get(HONEYPOT_FIELD);
  if (typeof honeypot === "string" && honeypot.trim() !== "") {
    return SUCCESS;
  }

  // ── 2. Limitation de débit (AC4) ────────────────────────────────────────
  // 🛑 `headers()` est CONFINÉ ici. Voir l'en-tête de fichier.
  const ip = clientIpFromHeaders(await headers());
  const rate = checkContactRateLimit(ip);
  if (!rate.allowed) {
    // ⚠️ AC4 exige un message COMPRÉHENSIBLE — pas un échec muet. C'est AC3 qui
    // est silencieux, pas AC4 : ne pas confondre les deux.
    return {
      status: "error",
      message: rateLimitMessage(rate.retryAfterSeconds),
      fieldErrors: {},
    };
  }

  // ── 3. Validation SERVEUR (AC5) ─────────────────────────────────────────
  // La validation client n'est que du confort : cette action est un endpoint
  // POST atteignable sans passer par le formulaire.
  const parsed = contactSchema.safeParse(contactFormDataToInput(formData));
  if (!parsed.success) {
    const fieldErrors: ContactFormState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (
        (field === "name" || field === "email" || field === "body") &&
        !fieldErrors[field]
      ) {
        fieldErrors[field] = issue.message;
      }
    }
    return {
      status: "error",
      message: "Votre message n'a pas pu être envoyé : vérifiez les champs.",
      fieldErrors,
    };
  }

  const { name, email, body } = parsed.data;

  // ── 4. Écriture en base — LE MESSAGE EST ACQUIS ICI (AC1) ───────────────
  // 🛑 AVANT la notification, et jamais en parallèle : un `Promise.all` ferait
  // qu'une panne d'envoi annulerait la réussite perçue.
  try {
    await prisma.contactMessage.create({
      data: { name, email, body, ip },
    });
  } catch (error) {
    // Seule vraie panne du parcours : là, le message est réellement perdu, donc
    // le visiteur DOIT le savoir (contrairement à un échec de notification).
    const raw = error instanceof Error ? error.message : String(error);
    console.error(
      `[contact] Message NON enregistré. Cause : ${raw.replace(/\s+/g, " ").trim()}`,
    );
    return { status: "error", message: GENERIC_ERROR, fieldErrors: {} };
  }

  // ── 5. Notification (AC2) — NON BLOQUANTE ───────────────────────────────
  // 🛑 La valeur de retour est délibérément IGNORÉE pour la réponse au
  // visiteur. Décision de Jeevons : l'envoi du courriel ne conditionne jamais
  // l'utilisabilité du formulaire — il lit de toute façon `/admin/messages`.
  // `notifyNewContactMessage` ne jette jamais ; le `await` sert seulement à ne
  // pas laisser une promesse orpheline dans un environnement serverless.
  await notifyNewContactMessage({ name, email, body });

  // ── 6. Confirmation (AC6) ───────────────────────────────────────────────
  return SUCCESS;
}
