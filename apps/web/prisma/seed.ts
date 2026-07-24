import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import { projectsContent } from "../src/content/projects";
import { settingsContent } from "../src/content/settings";
import { hobbiesContent, timelineContent } from "../src/content/timeline";

// Seed idempotent (Story 4.1, AC2).
//
// Story 4.5 — SOURCE UNIQUE (décision Jeevons) : les données ne vivent plus ici
// mais dans src/content/*.ts, importées ci-dessus. Le même contenu alimente le
// seed ET le repli statique servi quand la DB est injoignable → aucune dérive.
//
// Idempotence :
//  - Project : upsert par `slug` (clé naturelle stable, jamais dérivée d'un
//    champ mutable).
//  - Stack   : upsert par `name` (unique), partagé entre projets.
//  - Highlight : PAS de clé naturelle → on REMPLACE (deleteMany par projectId
//    puis recreate) à chaque seed, sinon relancer le seed les duplique.
//
// `published: true` est forcé pour les 6 projets migrés (visibles aujourd'hui) ;
// le défaut du modèle reste `false` (pour l'admin, Epic 5).

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL est absente : impossible de seeder.");
}
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// Données importées depuis src/content (source unique, story 4.5) :
//  - projectsContent : projets (highlights = string[], stacks = string[])
//  - timelineContent : parcours · hobbiesContent : centres d'intérêt
//  - settingsContent : réglages (e-mail fragmenté, anti-moisson Epic 1)
// Idempotence inchangée : upsert par slug/name/key ; highlights remplacés.
const projects = projectsContent;
const timelineEntries = timelineContent;
const hobbies = hobbiesContent;
const siteSettings = settingsContent;

async function main() {
  for (const p of projects) {
    // Stacks : upsert par `name` (dédupliqués entre projets). SkillLevel reste
    // null au seed (données d'origine ne le portent pas — piège n°3).
    const stackRecords = await Promise.all(
      p.stacks.map((name) =>
        prisma.stack.upsert({
          where: { name },
          create: { name },
          update: {},
        }),
      ),
    );

    // Project : upsert par slug. On (re)connecte les stacks à chaque passage
    // (set = état exact voulu, idempotent).
    const project = await prisma.project.upsert({
      where: { slug: p.slug },
      create: {
        slug: p.slug,
        category: p.category,
        company: p.company,
        title: p.title,
        period: p.period,
        link: p.link,
        sortOrder: p.sortOrder,
        published: true,
        stacks: { connect: stackRecords.map((s) => ({ id: s.id })) },
      },
      update: {
        category: p.category,
        company: p.company,
        title: p.title,
        period: p.period,
        link: p.link,
        sortOrder: p.sortOrder,
        published: true,
        stacks: { set: stackRecords.map((s) => ({ id: s.id })) },
      },
    });

    // Highlights : pas de clé naturelle → remplacer intégralement.
    await prisma.highlight.deleteMany({ where: { projectId: project.id } });
    await prisma.highlight.createMany({
      data: p.highlights.map((label, index) => ({
        label,
        sortOrder: index,
        projectId: project.id,
      })),
    });
  }

  // Parcours (Story 4.2) : upsert par slug (idempotent). avatarId reste null
  // (avatars = imports statiques joints par slug dans le conteneur, piège n°2).
  for (const e of timelineEntries) {
    await prisma.timelineEntry.upsert({
      where: { slug: e.slug },
      create: {
        slug: e.slug,
        title: e.title,
        place: e.place,
        body: e.body,
        startYear: e.startYear,
        endYear: e.endYear,
        sortOrder: e.sortOrder,
        published: true,
      },
      update: {
        title: e.title,
        place: e.place,
        body: e.body,
        startYear: e.startYear,
        endYear: e.endYear,
        sortOrder: e.sortOrder,
        published: true,
      },
    });
  }

  // Centres d'intérêt (Story 4.2) : upsert par slug (idempotent).
  for (const h of hobbies) {
    await prisma.hobby.upsert({
      where: { slug: h.slug },
      create: h,
      update: {
        title: h.title,
        emoji: h.emoji,
        posLeft: h.posLeft,
        posTop: h.posTop,
        sortOrder: h.sortOrder,
      },
    });
  }

  // Réglages du site (Story 4.3) : upsert par `key` (idempotent trivial).
  for (const s of siteSettings) {
    await prisma.siteSetting.upsert({
      where: { key: s.key },
      create: { key: s.key, value: s.value as Prisma.InputJsonValue },
      update: { value: s.value as Prisma.InputJsonValue },
    });
  }

  const [
    projectCount,
    highlightCount,
    stackCount,
    timelineCount,
    hobbyCount,
    settingCount,
  ] = await Promise.all([
    prisma.project.count(),
    prisma.highlight.count(),
    prisma.stack.count(),
    prisma.timelineEntry.count(),
    prisma.hobby.count(),
    prisma.siteSetting.count(),
  ]);
  console.log(
    `Seed OK — Project: ${projectCount}, Highlight: ${highlightCount}, Stack: ${stackCount}, TimelineEntry: ${timelineCount}, Hobby: ${hobbyCount}, SiteSetting: ${settingCount}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
