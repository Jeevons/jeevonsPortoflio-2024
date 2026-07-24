// Configuration Prisma pour le conteneur de PRODUCTION (Story 4.6).
//
// Pourquoi un fichier séparé, en JS (et pas le prisma.config.ts du dépôt) :
//  - L'étage `production` lance `node` SANS Bun ni loader TypeScript → il ne
//    peut pas charger un prisma.config.ts. Ce fichier est donc en CommonJS pur.
//  - Le Dockerfile le copie DANS l'image sous le nom `prisma.config.js`
//    (auto-découvert par la CLI Prisma). Il ne doit JAMAIS coexister avec
//    prisma.config.ts dans l'arbre source : si les deux sont présents, la CLI
//    charge le .js et casserait le dev (qui dépend du .ts chargeant .env).
//    D'où ce nom distinct `prod.config.js`, renommé seulement dans l'image.
//
// En prod, DATABASE_URL est déjà injectée dans l'environnement par le compose
// (aucun .env à charger, aucun secret écrit dans l'image).

const path = require("node:path");

module.exports = {
  schema: path.join("prisma", "schema.prisma"),
  // Prisma 7 : migrate deploy exige datasource.url dans la config (plus dans le schéma).
  datasource: {
    url: process.env.DATABASE_URL,
  },
};
