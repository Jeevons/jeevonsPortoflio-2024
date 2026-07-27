"use server";

import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";

import type { Prisma } from "@/generated/prisma/client";
import { resolveAuditUserId, writeAudit } from "@/lib/admin/audit";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { prisma } from "@/lib/db";
import { requireAdmin, UnauthorizedError } from "@/lib/require-admin";
import {
  settingsFormDataToInput,
  settingsSchema,
  toFragmentedEmail,
  type SettingsInput,
} from "@/lib/schemas/settings";
import { SETTING_KEYS } from "@/lib/settings";

// Story 5.16 — MUTATION des réglages du site (AC1, AC2, AC3, AC4).
//
// ⚠️ Même pattern que 5.8 / 5.14 / 5.15, sans dévier :
//
//   requireAdmin()  →  settingsSchema.parse()  →  prisma.upsert()  →  revalidateTag()
//
// ⚠️ UPSERT, et pas `update` (piège n°5) : une clé peut ne PAS exister en base.
// Le public s'en accommode (il retombe sur `SETTING_DEFAULTS`), donc rien ne
// garantit que la ligne a déjà été écrite — un `update` échouerait en P2025 sur
// une base fraîche ou partiellement seedée. `upsert` crée ou met à jour, ce qui
// est exactement la sémantique d'un magasin clé → valeur.
//
// ⚠️ Le CV n'est PAS ici (piège n°5) : l'upload PDF est la story 5.17, même si
// l'écran s'appelle aussi « réglages ».
//
// ⚠️ AuditLog : story 5.19. Ne pas l'anticiper ici.

/** Retour de l'action, consommé par `useActionState`. */
export type SettingsFormState = {
  status: "idle" | "error";
  /** Message global (session expirée, panne). */
  message: string | null;
  /** Erreurs par champ, mêmes messages que côté client (schéma partagé). */
  fieldErrors: Partial<Record<keyof SettingsInput, string>>;
};

// ⚠️ Dans un module `"use server"`, TOUT export runtime doit être une fonction
// async : l'état initial vit côté client. Les `export type` sont effacés à la
// compilation — ils restent autorisés.

const SESSION_EXPIRED =
  "Session expirée. Reconnectez-vous pour enregistrer vos modifications.";
const GENERIC_ERROR = "L'enregistrement a échoué. Réessayez dans un instant.";

/**
 * Enregistre les réglages du site (AC1, AC2, AC3, AC4).
 *
 * ⚠️ `redirect()` fonctionne en LEVANT une exception spéciale : il doit rester
 * HORS de tout `try/catch` qui l'avalerait. D'où l'appel en fin de fonction.
 */
export async function saveSettingsAction(
  _prevState: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  let email: string | null | undefined;
  try {
    const session = await requireAdmin();
    email = session.user?.email;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { status: "error", message: SESSION_EXPIRED, fieldErrors: {} };
    }
    throw error;
  }

  // AC3 — « la validation est appliquée côté serveur ». Le client valide déjà
  // via `zodResolver`, mais cette action est un endpoint POST atteignable sans
  // passer par le formulaire : c'est CE parse qui fait foi.
  const parsed = settingsSchema.safeParse(settingsFormDataToInput(formData));

  if (!parsed.success) {
    const fieldErrors: SettingsFormState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === "string" && !(field in fieldErrors)) {
        fieldErrors[field as keyof SettingsInput] = issue.message;
      }
    }
    return {
      status: "error",
      // AC3 — « refusée avec une explication » : le détail est SOUS le champ
      // fautif, ce message ne fait qu'orienter le regard.
      message: "Certains champs sont invalides. Corrigez-les puis réessayez.",
      fieldErrors,
    };
  }

  const values = parsed.data;

  // ⚠️ PIÈGE n°1 — FORME JSON. Chaque entrée réécrit EXACTEMENT la forme que le
  // public lit (`lib/settings.ts`, story 4.3) : huit chaînes nues, le TABLEAU de
  // rôles de la story 6.7, et l'e-mail seul sous forme fragmentée
  // `{ user, host }`. Écrire un objet là où le public
  // attend une chaîne ne lèverait AUCUNE erreur — `readString` retomberait
  // simplement sur le défaut, et le texte saisi disparaîtrait sans un mot.
  // `InputJsonValue` est le type que Prisma attend pour une colonne `Json` :
  // le déclarer ici évite un cast aveugle au moment de l'écriture, et fait
  // vérifier par TypeScript que chaque valeur est bien sérialisable.
  const entries: { key: string; value: Prisma.InputJsonValue }[] = [
    { key: SETTING_KEYS.heroTitle, value: values.heroTitle },
    { key: SETTING_KEYS.heroSubtitle, value: values.heroSubtitle },
    { key: SETTING_KEYS.heroStatusBadge, value: values.heroStatusBadge },
    // Story 6.7 — SEULE valeur non scalaire hors e-mail : un TABLEAU de chaînes,
    // exactement ce que `readStringArray` attend côté public. Le découpage
    // « une ligne = un rôle » a déjà eu lieu dans `rolesSchema` : `values` porte
    // ici la forme stockée, pas la saisie.
    { key: SETTING_KEYS.heroRoles, value: values.heroRoles },
    { key: SETTING_KEYS.socialTwitter, value: values.socialTwitter },
    { key: SETTING_KEYS.socialInstagram, value: values.socialInstagram },
    { key: SETTING_KEYS.socialLinkedin, value: values.socialLinkedin },
    { key: SETTING_KEYS.socialGithub, value: values.socialGithub },
    { key: SETTING_KEYS.contactLinkedin, value: values.contactLinkedin },
    {
      key: SETTING_KEYS.contactEmail,
      value: toFragmentedEmail(values.contactEmail),
    },
  ];

  try {
    // ⚠️ TRANSACTION, ici justifiée (contrairement à 5.15) : ce sont DIX
    // écritures distinctes. Sans elle, une panne au milieu laisserait le site
    // avec une accroche à jour et des liens périmés — un état incohérent que
    // Jeevons ne pourrait pas diagnostiquer depuis l'écran.
    await prisma.$transaction(
      entries.map((entry) =>
        prisma.siteSetting.upsert({
          where: { key: entry.key },
          create: { key: entry.key, value: entry.value },
          update: { value: entry.value },
          select: { key: true },
        }),
      ),
    );

    // Story 5.19 — UNE entrée résume les 9 clés (piège n°2 : `SiteSetting` n'a
    // que `key` dans l'allow-list, jamais les valeurs textuelles) : la liste
    // des clés touchées suffit à savoir CE QUI a changé, sans exposer le texte.
    const userId = await resolveAuditUserId(email);
    if (userId) {
      await writeAudit({
        userId,
        action: "UPDATE",
        entity: "SiteSetting",
        diff: { keys: entries.map((entry) => entry.key) },
      });
    }
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    console.error(
      `[admin] Enregistrement des réglages échoué. Cause : ${raw.replace(/\s+/g, " ").trim()}`,
    );
    return { status: "error", message: GENERIC_ERROR, fieldErrors: {} };
  }

  // AC2/AC4 — SANS cette invalidation, le nouveau texte n'apparaîtrait qu'à
  // l'expiration de l'ISR (1 h), et l'écran donnerait l'illusion d'un
  // changement sans effet. C'est ce tag qui rend la correction possible « sans
  // commit ni redéploiement ».
  //
  // ⚠️ Un seul tag suffit pour les TROIS surfaces publiques concernées (Hero,
  // Footer, Contact) : toutes lisent via `loadSettings()`, qui est cachée sous
  // `settings`. Vérifié (piège n°3), pas supposé.
  revalidateTag(CACHE_TAGS.settings, { expire: 0 });

  redirect("/admin/settings?saved=1");
}
