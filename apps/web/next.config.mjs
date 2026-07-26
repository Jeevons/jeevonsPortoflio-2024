/** @type {import('next').NextConfig} */
// Next 16 active Turbopack par défaut. On reste sur webpack (flag `--webpack`
// dans les scripts dev/build) car le loader @svgr/webpack ci-dessous en dépend :
// migrer le SVG vers Turbopack est un chantier hors périmètre (story 3.3).
const nextConfig = {
  output: "standalone",
  // Story 5.17 — `pdf-to-img` (vignette du CV, piège n°1) est importé
  // DYNAMIQUEMENT dans `lib/media/pdf.ts`, à dessein (dépendance lourde
  // chargée seulement à l'upload). Le traçage de fichiers du standalone ne
  // suit pas les `import()` dynamiques : sans cette inclusion explicite, le
  // paquet (et sa dépendance `pdfjs-dist`) serait absent du conteneur de
  // production, exactement le même piège que `sharp` (5.12) mais côté
  // traçage plutôt que côté libvips.
  //
  // `@napi-rs/canvas` est une DÉPENDANCE OPTIONNELLE de `pdfjs-dist` (moteur
  // de rendu réel de la page PDF côté Node — `pdf-to-img` n'est donc pas
  // "100% JS" comme supposé initialement, piège n°1 revu). Le binaire natif
  // varie par plateforme (`@napi-rs/canvas-linux-x64-musl` sous Alpine/musl,
  // `-darwin-arm64` en local) : `bun install` ne résout QUE le binaire de la
  // plateforme courante, donc chaque environnement (local, image Docker)
  // obtient le sien — mais il faut aussi le tracer explicitement, sinon le
  // build standalone ne l'embarque pas (même piège que pdf-to-img lui-même).
  outputFileTracingIncludes: {
    "/api/admin/cv": [
      "./node_modules/pdf-to-img/**",
      "./node_modules/pdfjs-dist/**",
      "./node_modules/@napi-rs/canvas/**",
      "./node_modules/@napi-rs/canvas-*/**",
    ],
  },
  // 🛑 CORRECTIF story 5.17 — SANS CECI, TOUT TÉLÉVERSEMENT DE CV ÉCHOUE EN 500.
  //
  // `outputFileTracingIncludes` ci-dessus règle la PRÉSENCE des fichiers dans
  // l'image standalone ; il ne dit rien de la façon dont ils sont CHARGÉS. Sans
  // `serverExternalPackages`, webpack tente de bundler `pdfjs-dist` — un ESM qui
  // manipule ses propres exports et charge un binaire natif (`@napi-rs/canvas`).
  // La transpilation casse alors l'objet module, et l'`await import("pdf-to-img")`
  // de `lib/media/pdf.ts:79` lève :
  //     TypeError: Object.defineProperty called on non-object
  //
  // ⚠️ Le bug est resté INVISIBLE jusqu'ici parce qu'aucun CV n'avait jamais été
  // téléversé (la clé `cv.current` n'existait pas en base) : le chemin de code
  // n'était donc jamais emprunté. Découvert en validant l'AC2 de la story 6.11.
  //
  // ⚠️ Ces trois paquets sont EXCLUSIVEMENT serveur (route `/api/admin/cv`) et
  // ne doivent jamais rejoindre un bundle : les déclarer externes les laisse
  // chargés par le `require`/`import` natif de Node, tel que le paquet l'attend.
  serverExternalPackages: ["pdf-to-img", "pdfjs-dist", "@napi-rs/canvas"],
  webpack(config) {
    // Grab the existing rule that handles SVG imports
    const fileLoaderRule = config.module.rules.find((rule) =>
      rule.test?.test?.(".svg"),
    );

    config.module.rules.push(
      // Reapply the existing rule, but only for svg imports ending in ?url
      {
        ...fileLoaderRule,
        test: /\.svg$/i,
        resourceQuery: /url/, // *.svg?url
      },
      // Convert all other *.svg imports to React components
      {
        test: /\.svg$/i,
        issuer: fileLoaderRule.issuer,
        resourceQuery: { not: [...fileLoaderRule.resourceQuery.not, /url/] }, // exclude if *.svg?url
        use: {
          loader: "@svgr/webpack",
          options: {
            svgoConfig: {
              plugins: [
                {
                  name: "preset-default",
                  params: {
                    overrides: {
                      removeViewBox: false,
                    },
                  },
                },
              ],
            },
          },
        },
      },
    );

    // Modify the file loader rule to ignore *.svg, since we have it handled now.
    fileLoaderRule.exclude = /\.svg$/i;

    return config;
  },
};

export default nextConfig;
