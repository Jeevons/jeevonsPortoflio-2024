import * as argon2 from "argon2";
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
// 🛑 AMORÇAGE, PAS SYNCHRONISATION (retour Jeevons, 28/07). Le contenu
// éditorial n'est écrit QUE si la table `Project` est vide. Sur une base qui
// contient déjà des projets, `src/content/*.ts` n'est plus appliqué du tout :
// la BASE fait foi, puisque l'Epic 5 l'a rendue éditable depuis l'admin.
// Voir `main()` pour le détail de ce que le rejeu détruisait.
//
// Mécanique interne, quand l'amorçage a bien lieu :
//  - Project : upsert par `slug` (clé naturelle stable, jamais dérivée d'un
//    champ mutable).
//  - Stack   : upsert par `name` (unique), partagé entre projets.
//  - Highlight : PAS de clé naturelle → remplacés intégralement.
// Ces upserts restent utiles : ils rendent le seed rejouable sans erreur si
// l'amorçage échoue à mi-parcours (une base partiellement remplie, mais sans
// projet, est reprise proprement).
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

/**
 * Injecte le contenu éditorial d'origine. N'est appelé QUE sur une base vide
 * (voir `main`).
 */
async function seedEditorialContent() {
  for (const p of projects) {
    // Stacks : upsert par `name` (dédupliqués entre projets). SkillLevel reste
    // null au seed (données d'origine ne le portent pas — piège n°3).
    //
    // ⚠️ Story 6.13 — `domain` reste null lui aussi, et pour la MÊME raison : les
    // technologies viennent des projets (`projectsContent`), qui ne portent que
    // des noms. Inventer un domaine ici serait fabriquer de la donnée. Elles
    // s'affichent donc dans « Autres technologies » tant que Jeevons ne leur en
    // attribue pas un depuis `/admin/stacks` — jamais masquées.
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
}

async function main() {
  // 🛑 LE CONTENU ÉDITORIAL N'EST SEEDÉ QUE SI LA BASE EST VIERGE (retour
  // Jeevons, 28/07 : « à chaque fois que je redéploie il y a des anciens projets
  // qui reviennent »).
  //
  // ⚠️ CE SEED EST REJOUÉ À CHAQUE DÉMARRAGE DU CONTENEUR (docker-entrypoint.sh :
  // migrate deploy → seed → server.js). Tant que la base était en lecture seule
  // pour Jeevons, réappliquer `src/content/*.ts` était inoffensif — c'était même
  // l'intérêt de l'idempotence de la story 4.1. Depuis l'Epic 5, la BASE est la
  // source de vérité éditable, et rejouer le contenu statique par-dessus
  // DÉTRUISAIT du travail :
  //   • un projet seedé supprimé en admin était RECRÉÉ par l'upsert ;
  //   • `title`, `period`, `link`, `sortOrder` et `published: true` étaient
  //     réécrits — un projet dépublié se retrouvait REPUBLIÉ ;
  //   • `stacks: { set: … }` remplaçait les technologies associées à la main ;
  //   • les points forts étaient `deleteMany` + `createMany`, donc PERDUS.
  //
  // Le compteur porte sur `Project` : c'est la table que `seedEditorialContent`
  // peut écraser, et la première que l'admin remplit. ❌ Ne pas se fier à
  // `SiteSetting` ni à `Stack` : les réglages sont créés par d'autres chemins et
  // une technologie peut exister sans aucun projet — la base paraîtrait « non
  // vierge » avant même le premier seed, et un déploiement neuf resterait vide.
  const existingProjects = await prisma.project.count();
  if (existingProjects === 0) {
    await seedEditorialContent();
  } else {
    console.log(
      `Seed — contenu éditorial IGNORÉ : ${existingProjects} projet(s) déjà en base. ` +
        `Le contenu de src/content/*.ts ne sert qu'à amorcer une base vierge ; ` +
        `la base fait foi. Pour réamorcer, videz la table Project.`,
    );
  }

  // 🛑 LE COMPTE ADMIN RESTE HORS DU GARDE-FOU, DÉLIBÉRÉMENT. C'est le
  // mécanisme ANTI-LOCK-OUT : il réapplique `ADMIN_PASSWORD` à chaque
  // démarrage, seul moyen de reprendre la main après un mot de passe perdu
  // (runbook 5.6). Le placer derrière la condition ci-dessus le neutraliserait
  // précisément quand la base contient des données, c'est-à-dire toujours en
  // production. Il n'écrase aucun contenu : il ne touche que `passwordHash`.
  await seedAdminAccount();

  await logCounts();
}

async function seedAdminAccount() {
  // Compte admin (Story 5.1, AC2) : UNIQUE et seedé — aucune inscription.
  // Upsert par `email` (clé naturelle) → idempotent, jamais dupliqué.
  // Le mot de passe est haché en argon2id ; on RÉAPPLIQUE le hash en `update`
  // pour qu'un changement de ADMIN_PASSWORD se propage. On ne stocke JAMAIS le
  // mot de passe en clair. `email`/`role`/`createdAt` ne sont pas retouchés en
  // update (role reste ADMIN par défaut, createdAt figé à la première création).
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error(
      "ADMIN_EMAIL / ADMIN_PASSWORD sont absents : impossible de seeder le compte admin.",
    );
  }
  const passwordHash = await argon2.hash(adminPassword, {
    type: argon2.argon2id,
  });
  await prisma.user.upsert({
    where: { email: adminEmail },
    create: { email: adminEmail, passwordHash },
    update: { passwordHash },
  });
}

async function logCounts() {
  const [
    projectCount,
    highlightCount,
    stackCount,
    timelineCount,
    hobbyCount,
    settingCount,
    userCount,
  ] = await Promise.all([
    prisma.project.count(),
    prisma.highlight.count(),
    prisma.stack.count(),
    prisma.timelineEntry.count(),
    prisma.hobby.count(),
    prisma.siteSetting.count(),
    prisma.user.count(),
  ]);
  console.log(
    `Seed OK — Project: ${projectCount}, Highlight: ${highlightCount}, Stack: ${stackCount}, TimelineEntry: ${timelineCount}, Hobby: ${hobbyCount}, SiteSetting: ${settingCount}, User: ${userCount}`,
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
