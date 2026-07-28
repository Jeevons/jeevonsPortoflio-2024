import "server-only";

import { prisma } from "@/lib/db";
import {
  fromFragmentedEmail,
  rolesToText,
  type SettingsFormValues,
} from "@/lib/schemas/settings";
import { SETTING_DEFAULTS, SETTING_KEYS } from "@/lib/settings";

// Story 5.16 — Lecture ADMIN des réglages du site.
//
// ⚠️ SÉPARÉE de la lecture publique (`lib/settings.ts`), et pour la même raison
// qu'en 5.8/5.14/5.15 : la lecture publique est CACHÉE sous le tag `settings`.
// L'administration doit voir l'état RÉEL de la base, pas une copie qui daterait
// de la dernière invalidation — c'est justement ce qu'elle sert à vérifier après
// une modification.
//
// ⚠️ En revanche, on RÉUTILISE `SETTING_KEYS` et `SETTING_DEFAULTS` de
// `lib/settings.ts` plutôt que de les recopier. Ce sont les clés que le public
// lit : les redéclarer ici créerait deux sources de vérité, et la première
// divergence casserait le rendu public en silence.

/**
 * Résultat de la lecture. `available: false` = base injoignable, PAS « vide ».
 *
 * ⚠️ `SettingsFormValues` (= `z.input`) et NON `SettingsInput` (= `z.infer`).
 * Depuis la story 6.7, le schéma TRANSFORME : les rôles se saisissent en texte
 * (« une ligne = un rôle ») et se stockent en tableau. Ce qui alimente le
 * formulaire est donc la forme d'ENTRÉE — la forme de sortie n'apparaît qu'à
 * l'écriture, côté Server Action.
 */
export type AdminSettings =
  { available: true; values: SettingsFormValues } | { available: false };

/** Lit une chaîne, en retombant sur le défaut si la clé est absente/invalide. */
function readString(
  rows: Map<string, unknown>,
  key: string,
  fallback: string,
): string {
  const value = rows.get(key);
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

/**
 * Lit le champ « années d'expérience » POUR LE FORMULAIRE (retour Jeevons, 28/07).
 *
 * 🛑 NE PAS UTILISER `readString` CI-DESSUS. Il remplace une chaîne vide par le
 * défaut ; or ici le défaut EST la chaîne vide, et le vide est une valeur
 * signifiante (« garde le calcul automatique »). Le piège serait invisible :
 * `readString` renverrait `""` par le chemin du repli, donc le formulaire aurait
 * l'air correct — mais toute valeur non conforme (un `Json` numérique, une
 * saisie ancienne) serait silencieusement remplacée par du vide au lieu d'être
 * montrée à Jeevons pour qu'il la corrige.
 *
 * ⚠️ Tolère le nombre comme la chaîne, exactement comme `readOptionalPositiveInt`
 * côté public : les deux lectures doivent s'accorder sur ce qui est acceptable,
 * sinon l'écran afficherait autre chose que le site.
 */
function readExperienceYears(rows: Map<string, unknown>): string {
  const value = rows.get(SETTING_KEYS.statsExperienceYears);
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return String(value);
  }
  return typeof value === "string" ? value.trim() : "";
}

/** Lit une liste de chaînes, mêmes règles de repli que le public (story 6.7). */
function readStringArray(
  rows: Map<string, unknown>,
  key: string,
  fallback: readonly string[],
): string[] {
  const value = rows.get(key);
  if (!Array.isArray(value)) {
    return [...fallback];
  }
  const entries = value.filter(
    (entry): entry is string => typeof entry === "string" && entry.length > 0,
  );
  return entries.length > 0 ? entries : [...fallback];
}

/**
 * Charge les 10 clés éditables (AC1).
 *
 * ⚠️ Une clé ABSENTE n'est pas une erreur : le formulaire affiche alors le
 * DÉFAUT (`SETTING_DEFAULTS`), exactement ce que le public affiche déjà dans ce
 * cas (story 4.3). Jeevons voit donc à l'écran ce que voit le visiteur, et
 * enregistrer crée simplement la ligne manquante (d'où l'upsert côté action).
 *
 * ⚠️ L'e-mail est RECOMPOSÉ depuis sa forme fragmentée pour l'affichage : c'est
 * exactement l'opération que fait le site public au clic. La forme stockée,
 * elle, n'est jamais montrée — elle n'a pas à l'être.
 */
export async function getAdminSettings(): Promise<AdminSettings> {
  try {
    const rows = await prisma.siteSetting.findMany({
      select: { key: true, value: true },
    });
    const byKey = new Map<string, unknown>(
      rows.map((row) => [row.key, row.value as unknown]),
    );

    const rawEmail = byKey.get(SETTING_KEYS.contactEmail);
    const email = isFragmentedEmail(rawEmail)
      ? rawEmail
      : SETTING_DEFAULTS.contactEmail;

    return {
      available: true,
      values: {
        heroTitle: readString(
          byKey,
          SETTING_KEYS.heroTitle,
          SETTING_DEFAULTS.heroTitle,
        ),
        heroSubtitle: readString(
          byKey,
          SETTING_KEYS.heroSubtitle,
          SETTING_DEFAULTS.heroSubtitle,
        ),
        heroStatusBadge: readString(
          byKey,
          SETTING_KEYS.heroStatusBadge,
          SETTING_DEFAULTS.heroStatusBadge,
        ),
        // Story 6.7 — La forme stockée (tableau) redevient la forme saisie
        // (une ligne par rôle). Même repli défensif que côté public : un `Json`
        // mal formé affiche les défauts plutôt qu'un champ vide, sans quoi
        // enregistrer écraserait les rôles par une saisie blanche.
        heroRoles: rolesToText(
          readStringArray(
            byKey,
            SETTING_KEYS.heroRoles,
            SETTING_DEFAULTS.heroRoles,
          ),
        ),
        // Chiffres clés (retour Jeevons, 28/07).
        statsExperienceYears: readExperienceYears(byKey),
        statsExperienceLabel: readString(
          byKey,
          SETTING_KEYS.statsExperienceLabel,
          SETTING_DEFAULTS.statsExperienceLabel,
        ),
        statsProjectsLabel: readString(
          byKey,
          SETTING_KEYS.statsProjectsLabel,
          SETTING_DEFAULTS.statsProjectsLabel,
        ),
        statsStacksLabel: readString(
          byKey,
          SETTING_KEYS.statsStacksLabel,
          SETTING_DEFAULTS.statsStacksLabel,
        ),
        socialTwitter: readString(
          byKey,
          SETTING_KEYS.socialTwitter,
          SETTING_DEFAULTS.socialTwitter,
        ),
        socialInstagram: readString(
          byKey,
          SETTING_KEYS.socialInstagram,
          SETTING_DEFAULTS.socialInstagram,
        ),
        socialLinkedin: readString(
          byKey,
          SETTING_KEYS.socialLinkedin,
          SETTING_DEFAULTS.socialLinkedin,
        ),
        socialGithub: readString(
          byKey,
          SETTING_KEYS.socialGithub,
          SETTING_DEFAULTS.socialGithub,
        ),
        contactLinkedin: readString(
          byKey,
          SETTING_KEYS.contactLinkedin,
          SETTING_DEFAULTS.contactLinkedin,
        ),
        contactEmail: fromFragmentedEmail(email),
      },
    };
  } catch (error) {
    // Même discipline de log qu'en 5.7/5.8/5.14/5.15 : cause aplatie sur une
    // ligne, jamais de secret ni de `DATABASE_URL`.
    const raw = error instanceof Error ? error.message : String(error);
    console.error(
      `[admin] Lecture des réglages indisponible. Cause : ${raw.replace(/\s+/g, " ").trim()}`,
    );
    return { available: false };
  }
}

/** Reconnaît la forme stockée de l'e-mail fragmenté (mêmes règles qu'en 4.3). */
function isFragmentedEmail(
  value: unknown,
): value is { user: string[]; host: string[] } {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  const isStrings = (v: unknown): v is string[] =>
    Array.isArray(v) && v.every((item) => typeof item === "string");
  return isStrings(candidate.user) && isStrings(candidate.host);
}
