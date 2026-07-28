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
  // Story 6.7 — Rôles défilants du hero. SEULE clé dont la valeur est un
  // TABLEAU de chaînes : `SiteSetting.value` est un `Json`, on s'en sert donc
  // tel quel plutôt que d'encoder une liste dans une chaîne à séparateur, qui
  // rendrait toute virgule d'un intitulé ambiguë.
  {
    key: "hero.roles",
    value: ["Développeur Full-Stack", "UI Engineer", "Créatif"],
  },
  // Retour Jeevons, 28/07 : « il faut changer le "6 ans d'expérience" aussi, ou
  // au moins que je puisse le modifier ». Les trois chiffres clés (section « En
  // quelques chiffres ») deviennent administrables.
  //
  // ⚠️ `stats.experienceYears` est une CHAÎNE VIDE par défaut, et c'est le cœur
  // du réglage : vide = on garde le calcul automatique (année courante − plus
  // ancienne année de début du parcours). Une valeur ne l'écrase que si elle est
  // saisie. ❌ Surtout pas `0` ni un nombre par défaut : ce serait figer le
  // chiffre et neutraliser silencieusement la dérivation.
  { key: "stats.experienceYears", value: "" },
  { key: "stats.experienceLabel", value: "ans d'expérience" },
  { key: "stats.projectsLabel", value: "projets livrés" },
  { key: "stats.stacksLabel", value: "technologies utilisées" },
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
