// Story 4.5 — Contenu de repli statique des réglages du site (SOURCE UNIQUE).
// Importé par le seed ET utilisé comme repli DB-injoignable. Pur data.
//
// Valeurs EXACTES (Hero/Footer/Contact). L'e-mail est FRAGMENTÉ (anti-moisson
// Epic 1) : la chaîne complète n'existe jamais telle quelle.
//
// ⚠️ Ces valeurs doivent rester alignées avec SETTING_DEFAULTS de
// src/lib/settings.ts (fallback par clé manquante). settings.ts est `server-only`
// et ne peut pas importer ce module côté seed ; l'alignement est vérifié par un
// test de cohérence au build (voir settings.ts).

export type ContentSetting = { key: string; value: unknown };

export const settingsContent: ContentSetting[] = [
  {
    key: "hero.title",
    value:
      "Imaginer et construire des expériences qui donnent envie d'être vécues !",
  },
  {
    key: "hero.subtitle",
    value:
      "Le front-end est mon terrain de jeu, mais pour moi, c'est dans les coulisses que la vraie magie opère. Avec des bases solides en développement front, je veux explorer tout le spectre pour véritablement devenir \"tech-savvy\". Et quand je ne code pas, je m'amuse à donner vie à mes idées grâce à la suite Adobe.",
  },
  {
    key: "hero.statusBadge",
    value: "En recherche d'une alternance pour 2026-2027",
  },
  { key: "social.twitter", value: "https://x.com/Jeevons__" },
  {
    key: "social.instagram",
    value:
      "https://www.instagram.com/jeevons_/profilecard/?igsh=eGE4YnBtazhobmk0",
  },
  {
    key: "social.linkedin",
    value: "https://www.linkedin.com/in/jeevons-eya-3660a7297/?locale=fr_FR",
  },
  { key: "social.github", value: "https://github.com/Jeevons" },
  {
    key: "contact.linkedin",
    value: "https://www.linkedin.com/in/jeevons-eya-3660a7297/?locale=fr_FR",
  },
  {
    key: "contact.email",
    value: { user: ["jeevons", "eya", "jr"], host: ["gmail", "com"] },
  },
];
