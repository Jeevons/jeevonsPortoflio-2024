import "server-only";

import { unstable_cache } from "next/cache";

import { fallbackSettingRows } from "@/content/fallbacks";
import { CACHE_TAGS, REVALIDATE_SECONDS } from "@/lib/cache-tags";
import { prisma } from "@/lib/db";
import { readWithFallback } from "@/lib/read-with-fallback";

// Story 4.3 — Lecture des réglages du site avec valeur par défaut (AC3).
//
// Règle centrale (piège n°1) : si une clé est absente OU si sa valeur Json ne
// correspond pas au type attendu, on renvoie le défaut. La page ne tombe
// JAMAIS en erreur pour une clé manquante. Les défauts = les valeurs
// actuellement codées en dur → même base vide, le site s'affiche identiquement.
//
// Périmètre 4.3 : on gère la clé absente (DB joignable). Le cas DB injoignable
// (try/catch) relève de la story 4.5 — pas ici.

// --- Contrat de clés (figé, consommé par /admin/settings en Epic 5) ---
export const SETTING_KEYS = {
  heroTitle: "hero.title",
  heroSubtitle: "hero.subtitle",
  heroStatusBadge: "hero.statusBadge",
  socialTwitter: "social.twitter",
  socialInstagram: "social.instagram",
  socialLinkedin: "social.linkedin",
  socialGithub: "social.github",
  contactLinkedin: "contact.linkedin",
  contactEmail: "contact.email",
} as const;

// E-mail stocké fragmenté (anti-moisson Epic 1, piège n°3) : la chaîne complète
// n'existe jamais dans le HTML servi, seuls les fragments transitent.
export type FragmentedEmail = { user: string[]; host: string[] };

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function isFragmentedEmail(v: unknown): v is FragmentedEmail {
  return (
    typeof v === "object" &&
    v !== null &&
    isStringArray((v as Record<string, unknown>).user) &&
    isStringArray((v as Record<string, unknown>).host)
  );
}

// Story 4.4 : la lecture Prisma est enrobée dans `unstable_cache`, tag
// `settings`. `unstable_cache` sérialise sa valeur de retour → on cache un
// tableau brut (sérialisable), PAS une Map. La Map est reconstruite ensuite.
const cachedSettingRows = unstable_cache(
  () => prisma.siteSetting.findMany({ select: { key: true, value: true } }),
  ["site-settings"],
  { tags: [CACHE_TAGS.settings], revalidate: REVALIDATE_SECONDS },
);

// Charge tous les réglages en une requête (cachée) et renvoie une Map clé → value.
// Story 4.5 : lecture résiliente. Si la lecture cachée échoue (DB injoignable),
// on retombe sur les lignes de repli statiques — la Map est identique en shape,
// et les lecteurs typés (readString/readEmail) continuent de fonctionner.
async function loadSettings(): Promise<Map<string, unknown>> {
  const rows = await readWithFallback(
    CACHE_TAGS.settings,
    () => cachedSettingRows(),
    () => fallbackSettingRows(),
  );
  return new Map(rows.map((row) => [row.key, row.value as unknown]));
}

// Lecture typée d'une chaîne : renvoie le défaut si absente/invalide.
function readString(
  settings: Map<string, unknown>,
  key: string,
  fallback: string,
): string {
  const value = settings.get(key);
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function readEmail(
  settings: Map<string, unknown>,
  fallback: FragmentedEmail,
): FragmentedEmail {
  const value = settings.get(SETTING_KEYS.contactEmail);
  return isFragmentedEmail(value) ? value : fallback;
}

// --- Défauts = valeurs actuellement codées en dur (fallbacks intrinsèques) ---
export const SETTING_DEFAULTS = {
  heroTitle:
    "Imaginer et construire des expériences qui donnent envie d'être vécues !",
  heroSubtitle:
    "Le front-end est mon terrain de jeu, mais pour moi, c'est dans les coulisses que la vraie magie opère. Avec des bases solides en développement front, je veux explorer tout le spectre pour véritablement devenir \"tech-savvy\". Et quand je ne code pas, je m'amuse à donner vie à mes idées grâce à la suite Adobe.",
  heroStatusBadge: "En recherche d'une alternance pour 2026-2027",
  socialTwitter: "https://x.com/Jeevons__",
  socialInstagram:
    "https://www.instagram.com/jeevons_/profilecard/?igsh=eGE4YnBtazhobmk0",
  socialLinkedin:
    "https://www.linkedin.com/in/jeevons-eya-3660a7297/?locale=fr_FR",
  socialGithub: "https://github.com/Jeevons",
  contactLinkedin:
    "https://www.linkedin.com/in/jeevons-eya-3660a7297/?locale=fr_FR",
  contactEmail: {
    user: ["jeevons", "eya", "jr"],
    host: ["gmail", "com"],
  } as FragmentedEmail,
} as const;

// --- Garde de cohérence (story 4.5) : SETTING_DEFAULTS (fallback par clé
// manquante, DB joignable) DOIT rester aligné avec settingsContent (fallback
// DB injoignable, source unique). Vérifié au chargement du module : toute dérive
// jette immédiatement (échec de build/rendu explicite plutôt que repli obsolète).
{
  const contentByKey = new Map(
    fallbackSettingRows().map((r) => [r.key, r.value]),
  );
  const expected: Record<string, unknown> = {
    [SETTING_KEYS.heroTitle]: SETTING_DEFAULTS.heroTitle,
    [SETTING_KEYS.heroSubtitle]: SETTING_DEFAULTS.heroSubtitle,
    [SETTING_KEYS.heroStatusBadge]: SETTING_DEFAULTS.heroStatusBadge,
    [SETTING_KEYS.socialTwitter]: SETTING_DEFAULTS.socialTwitter,
    [SETTING_KEYS.socialInstagram]: SETTING_DEFAULTS.socialInstagram,
    [SETTING_KEYS.socialLinkedin]: SETTING_DEFAULTS.socialLinkedin,
    [SETTING_KEYS.socialGithub]: SETTING_DEFAULTS.socialGithub,
    [SETTING_KEYS.contactLinkedin]: SETTING_DEFAULTS.contactLinkedin,
    [SETTING_KEYS.contactEmail]: SETTING_DEFAULTS.contactEmail,
  };
  for (const [key, value] of Object.entries(expected)) {
    if (JSON.stringify(contentByKey.get(key)) !== JSON.stringify(value)) {
      throw new Error(
        `Incohérence de réglage "${key}" entre SETTING_DEFAULTS et src/content/settings.ts. Alignez les deux (source unique, story 4.5).`,
      );
    }
  }
}

export type HeroSettings = {
  title: string;
  subtitle: string;
  statusBadge: string;
};

export async function getHeroSettings(): Promise<HeroSettings> {
  const settings = await loadSettings();
  return {
    title: readString(
      settings,
      SETTING_KEYS.heroTitle,
      SETTING_DEFAULTS.heroTitle,
    ),
    subtitle: readString(
      settings,
      SETTING_KEYS.heroSubtitle,
      SETTING_DEFAULTS.heroSubtitle,
    ),
    statusBadge: readString(
      settings,
      SETTING_KEYS.heroStatusBadge,
      SETTING_DEFAULTS.heroStatusBadge,
    ),
  };
}

export type SocialSettings = {
  twitter: string;
  instagram: string;
  linkedin: string;
  github: string;
};

export async function getSocialSettings(): Promise<SocialSettings> {
  const settings = await loadSettings();
  return {
    twitter: readString(
      settings,
      SETTING_KEYS.socialTwitter,
      SETTING_DEFAULTS.socialTwitter,
    ),
    instagram: readString(
      settings,
      SETTING_KEYS.socialInstagram,
      SETTING_DEFAULTS.socialInstagram,
    ),
    linkedin: readString(
      settings,
      SETTING_KEYS.socialLinkedin,
      SETTING_DEFAULTS.socialLinkedin,
    ),
    github: readString(
      settings,
      SETTING_KEYS.socialGithub,
      SETTING_DEFAULTS.socialGithub,
    ),
  };
}

export type ContactSettings = {
  linkedin: string;
  email: FragmentedEmail;
};

export async function getContactSettings(): Promise<ContactSettings> {
  const settings = await loadSettings();
  return {
    linkedin: readString(
      settings,
      SETTING_KEYS.contactLinkedin,
      SETTING_DEFAULTS.contactLinkedin,
    ),
    email: readEmail(settings, SETTING_DEFAULTS.contactEmail),
  };
}
