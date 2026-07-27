import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "prisma/config";

// Prisma 7 ne charge plus automatiquement les fichiers .env : on peuple
// process.env nous-mêmes avant que la CLI ne lise DATABASE_URL. On évite
// d'ajouter la dépendance `dotenv` (périmètre : zéro dépendance non prévue).
const envPath = path.join(__dirname, ".env");
if (existsSync(envPath)) {
  for (const rawLine of readFileSync(envPath, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  // Prisma 7 : Migrate/introspection lisent l'URL ici (plus dans le schéma).
  datasource: {
    url: process.env.DATABASE_URL,
  },
  migrations: {
    // Le seed s'exécute avec Bun (runtime du monorepo).
    seed: "bun run prisma/seed.ts",
  },
});
