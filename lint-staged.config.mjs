// Config lint-staged racine du monorepo.
// lint-staged fournit les chemins des fichiers stagés RELATIFS À LA RACINE
// (ex. "apps/web/src/sections/Hero.tsx"). On ne relint/reformate QUE ces
// fichiers-là (AC1 : « les seuls fichiers modifiés »).
//
// Subtilité monorepo : la config ESLint (flat config) vit dans apps/web/.
// On lance donc eslint depuis apps/web/ en lui passant les chemins débarrassés
// du préfixe "apps/web/". Prettier, lui, tourne depuis la racine sans souci.

/** Retire le préfixe apps/web/ pour repasser en chemins relatifs à apps/web. */
const stripAppPrefix = (file) => file.replace(/^apps\/web\//, "");

const config = {
  "apps/web/**/*.{ts,tsx,js,jsx,mjs,cjs,json,css,md}": (files) => [
    `prettier --write ${files.map((f) => `"${f}"`).join(" ")}`,
  ],
  "apps/web/**/*.{ts,tsx,js,jsx,mjs,cjs}": (files) => {
    const relative = files.map((f) => `"${stripAppPrefix(f)}"`).join(" ");
    return [`bash -c 'cd apps/web && bunx eslint --no-warn-ignored ${relative}'`];
  },
};

export default config;
