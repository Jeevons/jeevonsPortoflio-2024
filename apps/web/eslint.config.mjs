// Flat config ESLint 9 — requis par Next 16 / eslint-config-next 16.
// Remplace l'ancien .eslintrc.json (`extends: next/core-web-vitals`).
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import eslintConfigPrettier from "eslint-config-prettier";

/** @type {import('eslint').Linter.Config[]} */
const config = [
  {
    // src/generated/** : client Prisma généré (gitignoré, non maintenu à la main).
    // prisma/seed.mjs : bundle du seed transpilé par build:seed (généré, gitignoré).
    ignores: [
      ".next/**",
      "node_modules/**",
      "src/generated/**",
      "prisma/seed.mjs",
    ],
  },
  ...nextCoreWebVitals,
  // En DERNIER : désactive les règles de style d'ESLint que Prettier gère,
  // pour éviter les conflits Prettier ↔ ESLint (story 3.4, piège n°5).
  // eslint-config-prettier vit à la racine du monorepo — résolu via remontée d'arbre.
  eslintConfigPrettier,
];

export default config;
