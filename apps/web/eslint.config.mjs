// Flat config ESLint 9 — requis par Next 16 / eslint-config-next 16.
// Remplace l'ancien .eslintrc.json (`extends: next/core-web-vitals`).
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

/** @type {import('eslint').Linter.Config[]} */
const config = [
  {
    ignores: [".next/**", "node_modules/**"],
  },
  ...nextCoreWebVitals,
];

export default config;
