import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Singleton PrismaClient — accès aux données CÔTÉ SERVEUR uniquement
// (import "server-only" : toute fuite dans un Client Component casse le build).
// Prisma 7 : le runtime passe par un driver adapter (query compiler), l'URL
// n'est plus dans le schéma mais fournie ici via DATABASE_URL.
//
// Pattern anti-hot-reload : en dev, Next recharge les modules à chaque édition ;
// sans ce cache global, chaque reload ouvrirait un nouveau pool de connexions.
const createPrismaClient = () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL est absente : impossible de créer le client Prisma.",
    );
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
};

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
};

// Construction PARESSEUSE (story 4.6) : le client n'est instancié qu'au premier
// accès réel, jamais au simple import du module. Sinon `next build` échoue en
// collectant les pages (import de page.tsx → db.ts) là où aucune DATABASE_URL
// n'est fournie — alors que le build doit rester reproductible SANS base. Une
// fois différée, l'éventuelle absence d'URL survient pendant une lecture, donc
// à l'intérieur de `readWithFallback` (story 4.5) qui sert alors le repli.
function getPrismaClient(): ReturnType<typeof createPrismaClient> {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

// Proxy : `prisma.project.findMany(...)` déclenche la construction au 1er accès
// de propriété, pas à l'import. L'API publique reste identique aux appelants.
export const prisma = new Proxy({} as ReturnType<typeof createPrismaClient>, {
  get(_target, prop, receiver) {
    return Reflect.get(getPrismaClient(), prop, receiver);
  },
});
