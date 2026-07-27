---
baseline_commit: 220ab43cc5c937806af6409fae95d96fd1f3ed21
---

# Story 4.1: Servir les projets depuis la base

Status: review

## Story

As **visiteur du portfolio**,
I want **voir la liste des projets de Jeevons**,
so that **je puisse juger de son travail — que ces projets viennent du code ou d'une base m'est indifférent, mais Jeevons doit pouvoir les mettre à jour sans redéployer**.

## Acceptance Criteria

**AC1 — Prisma 7 installé, connecté, avec les modèles de cette story**
**Given** Prisma n'est pas encore installé sur le projet
**When** cette story est terminée
**Then** Prisma 7 est configuré et connecté à la base `portfolio_prod` créée en Epic 2
**And** les modèles `Project`, `Highlight` et `Stack` existent, avec les énumérations `ProjectCategory` et `SkillLevel`
**And** `Project` porte l'index composé sur la catégorie et l'ordre de tri (`@@index([category, sortOrder])`)
**And** une migration versionnée décrit ces créations

**AC2 — Seed idempotent depuis le contenu codé en dur**
**Given** les projets sont aujourd'hui codés en dur dans `Projects.tsx` et `SelfProject.tsx`
**When** j'exécute le seed
**Then** chaque projet existant est présent en base avec ses points forts (`Highlight`), ses technologies (`Stack`), sa période et son lien
**And** relancer le seed ne crée aucun doublon

**AC3 — Rendu public identique, alimenté par la base, via le composant factorisé**
**Given** le contenu est désormais en base
**When** je consulte le site
**Then** les sections de projets affichent exactement les mêmes projets qu'avant, dans le même ordre
**And** le composant `ProjectList` factorisé en Epic 3 reçoit ces projets sans savoir d'où ils viennent (contrat AC3 de la story 3.7 préservé)

**AC4 — Le statut de publication filtre le site public**
**Given** les projets ont un statut de publication (`published`)
**When** un projet est marqué comme non publié
**Then** il n'apparaît pas sur le site public

## Contexte d'implémentation

### 🛑 Prérequis et cadre

- **Story pivot de l'Epic 4** : c'est ici que Prisma entre dans le dépôt. Les stories 4.2 → 4.6 s'appuient sur ce que cette story pose (client Prisma, seed idempotent, patterns de lecture). Poser des fondations propres ici évite de payer la dette 5 fois.
- **Stack en vigueur** (vérifié dans `package.json`) : monorepo Bun, code sous **`apps/web/`**, **Next 16.2.11 / React 19.2**, Bun 1.3+. Toutes les commandes en `bun`/`bunx`. Tous les chemins ci-dessous sont en `apps/web/…`.
- **Base cible** : `portfolio_prod` sur le Postgres mutualisé Coolify (créée en story 2.4, `done`). En **local**, le service `db` du `docker-compose.yml` (story 2.3) fournit un Postgres de développement — c'est **là** que la migration et le seed se jouent en dev. La base de prod n'est **pas** accessible depuis la machine de dev (voir story 2.4).
- **`DATABASE_URL`** : déjà nommée dans `.env.production.example` et injectée en Secret Coolify en prod. En local, elle pointe sur le `db` du compose. Le format exige **`?schema=public`** (Prisma 7, cf. story 2.4). ❌ Aucune valeur réelle de prod n'entre dans le dépôt.

### 📐 État actuel — ce qui existe et ce qui doit être préservé

Le composant de présentation `apps/web/src/components/ProjectList.tsx` (créé en story 3.7, `review`) est **déjà source-agnostique**. Son contrat, à **respecter strictement** :

```tsx
export type Project = {
  company: string;
  year: string;
  title: string;
  results: { title: string }[];
  link: string;
  image: StaticImageData;   // ⚠️ voir piège n°4
};

type ProjectListProps = {
  id: string;               // "projects" | "side-projects" — ancres Epic 1
  eyebrow: string;
  title: string;
  description: string;
  projects: Project[];      // ← injecté ; le composant ignore la source (AC3)
};
```

Les deux conteneurs actuels (`sections/Projects.tsx`, `sections/SelfProject.tsx`) sont des **Server Components synchrones** qui importent une constante `portfolioProjects: Project[]` et la passent en prop. Ils sont rendus par `app/page.tsx` (composant `Home`, également serveur). **C'est exactement le point de branchement** : chaque conteneur devient `async` et fait un `await` de lecture DB au lieu de lire sa constante. `ProjectList.tsx` et `page.tsx` **ne changent pas de structure** (page.tsx peut devoir devenir `async` — voir piège n°6).

**Contenu à migrer (source de vérité du seed)** — relevé exact depuis les deux fichiers :

| Section | `id` | `category` cible | Projets (company / period / link) |
|---|---|---|---|
| Pro | `projects` | `FLAGSHIP` | Quantum (Janvier - 2024), Maufeb Mode (Juin - 2024) |
| Perso | `side-projects` | `PERSONAL` | Insure (Octobre - 2024), Sunnyside (Août - 2024), SleepingTime (Janvier - 2024), Gallerie (Novembre - 2023) |

Chaque projet a **3 `results`** (→ `Highlight`) et une **liste de technos** mentionnées dans le premier `result` (ex. « Php, mySQL et Javascript »). ⚠️ Voir piège n°3 sur la façon de traiter `results` vs `Stack`.

### 🗄️ Modèles Prisma à créer (et SEULEMENT ceux-ci)

Depuis `PLAN_REFONTE_2026.md` §2.1. **Découpage strict** : ne créer que `Project`, `Highlight`, `Stack` + les 2 enums. Les modèles `TimelineEntry`/`Hobby` (→ 4.2), `SiteSetting` (→ 4.3), `Media`/`User`/`AuditLog`/`ContactMessage` (→ Epic 5) **ne sont pas créés ici**.

```prisma
model Project {
  id          String   @id @default(cuid())
  slug        String   @unique
  category    ProjectCategory
  company     String
  title       String
  description String?  @db.Text
  period      String                // "Janvier - 2024"
  sortOrder   Int      @default(0)
  published   Boolean  @default(false)
  link        String?
  repoUrl     String?
  // coverId / cover : le modèle Media arrive en Epic 5. Voir piège n°4.
  highlights  Highlight[]
  stacks      Stack[]  @relation("ProjectStacks")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@index([category, sortOrder])
}

model Highlight {
  id        String  @id @default(cuid())
  label     String
  sortOrder Int     @default(0)
  projectId String
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
}

model Stack {
  id       String      @id @default(cuid())
  name     String      @unique
  iconKey  String?
  level    SkillLevel?
  projects Project[]   @relation("ProjectStacks")
}

enum ProjectCategory { FLAGSHIP PERSONAL LAB }
enum SkillLevel { LEARNING COMFORTABLE STRONG }
```

⚠️ Le schéma du PLAN §2.1 déclare `cover Media?` et `coverId` sur `Project`. **`Media` n'existe qu'en Epic 5.** Deux options — trancher avec Jeevons (piège n°4) : **(a)** omettre `coverId`/`cover` maintenant et les ajouter par migration en Epic 5 [recommandé — respecte « une table quand une story en a besoin »] ; **(b)** poser `coverId String?` sans la relation. Ne pas déclarer une relation vers un modèle inexistant : la migration échouerait.

### 🌱 Seed idempotent (AC2)

- Emplacement : `apps/web/prisma/seed.ts`. Configurer le hook seed pour Prisma 7 (voir piège n°2 sur `prisma.config.ts`).
- **Idempotence par clé naturelle** : utiliser `slug` (unique) comme clé d'`upsert` pour `Project`, et `name` (unique) pour `Stack`. Générer un `slug` déterministe et stable par projet (ex. `quantum`, `maufeb-mode`, `insure`, `sunnyside`, `sleeping-time`, `gallerie`) — **le figer**, ne jamais le dériver d'un champ qui pourrait changer.
- Les `Highlight` n'ont pas de clé naturelle : à chaque seed, pour un projet donné, **remplacer** ses highlights (`deleteMany` sur `projectId` puis recréer) plutôt que d'`upsert` — sinon relancer le seed les duplique. Documenter ce choix.
- **`published`** : le seed doit poser `published: true` sur les 6 projets migrés (ils sont visibles aujourd'hui), sinon l'AC3 échoue (site vide). Le défaut du modèle est `false` (correct pour l'admin en Epic 5), mais le seed force `true`.
- `sortOrder` : reporter l'ordre d'affichage actuel (index dans le tableau), par catégorie.
- Relancer `bun run db:seed` deux fois → **exactement** le même état (AC2). Le vérifier explicitement (compter les lignes avant/après le 2ᵉ passage).

### 🔌 Branchement des sections publiques (AC3, AC4)

1. Créer un point d'accès aux données, **côté serveur uniquement** : `apps/web/src/lib/db.ts` (singleton `PrismaClient`, pattern anti-hot-reload) — cf. PLAN §2 (`lib/db.ts`). Une fonction de lecture par catégorie, ex. `getProjects(category)` dans `lib/` (ex. `lib/projects.ts` ou `lib/content.ts`), qui **filtre `published: true`** (AC4) et ordonne par `sortOrder`.
2. `sections/Projects.tsx` et `sections/SelfProject.tsx` deviennent `async` : ils `await` la lecture (`FLAGSHIP` / `PERSONAL`), **mappent** le résultat Prisma vers le type `Project` attendu par `ProjectList`, et le passent en prop. Les **textes de section** (eyebrow, title, description) restent en dur dans les conteneurs pour cette story — ils passeront en base en 4.3 (SiteSetting), **pas ici**.
3. `ProjectList.tsx` **inchangé** : il reçoit `Project[]`, il ignore la source (AC3 de la story 3.7 tenu).
4. Le filtrage `published` se fait **dans la requête Prisma** (`where: { published: true }`), pas en JS après coup.

### ⚠️ Piège n°1 — Le `GRANT ALL ON SCHEMA public` de la story 2.4
En **prod**, `prisma migrate deploy` échouera avec `permission denied for schema public` si le `GRANT` de la story 2.4 n'a pas été appliqué sur `portfolio_prod`. C'est le moment où ce `GRANT` est mis à l'épreuve pour la première fois (story 2.4 le prédisait). ⚠️ La story 2.4 est en `review`, pas `done` : **confirmer avec Jeevons** que le runbook 2.4 a bien été exécuté sur le VPS avant tout `migrate deploy` en prod. En **dev**, la base du compose n'a pas ce problème (utilisateur owner classique).

### ⚠️ Piège n°2 — Prisma 7 : configuration et emplacement du client généré
Prisma 7 change plusieurs défauts par rapport aux versions antérieures. **Vérifier la doc officielle de la version installée** avant de coder. Points d'attention connus : la configuration passe par `prisma.config.ts` (le bloc `[prisma]` de `package.json` / la config seed via `package.json` évoluent), le client peut être généré vers un chemin custom (`output` dans `generator client`) — auquel cas l'import n'est plus `@prisma/client` mais le chemin généré. **Aligner `.gitignore`** pour ne pas committer le client généré s'il tombe dans `src/`. Ne pas copier une config Prisma 5/6 de mémoire.

### ⚠️ Piège n°3 — `results` (Highlight) vs technologies (Stack)
Aujourd'hui, un projet a 3 `results` en texte libre (ex. « Php, mySQL et Javascript », « Développement full-stack », « Gestion de projet »). Le modèle sépare **`Highlight`** (points forts, texte libre → les 3 `results`) et **`Stack`** (technos normalisées, `name` unique, réutilisées entre projets). **Ne pas sur-parser** : pour cette story, mapper les 3 `results` → 3 `Highlight`, et créer les `Stack` à partir des technos **explicitement listées** dans le premier `result` de chaque projet, dédupliquées par `name`. La granularité fine de l'association Stack↔Project est un enrichissement admin (Epic 5) — **rester minimal et fidèle à l'existant**, ne pas inventer de niveaux `SkillLevel` non présents dans les données. `SkillLevel` peut rester `null` au seed.
👉 Si le mapping Stack est ambigu, **le documenter et rester conservateur** ; ce qui compte pour l'AC3 c'est que `Highlight` reproduise les 3 `results` affichés.

### ⚠️ Piège n°4 — `image: StaticImageData` vs images en base
Le type `Project` de `ProjectList.tsx` attend `image: StaticImageData` (import statique). En base, il n'y a **pas encore** d'image (le modèle `Media` arrive en Epic 5). La story 3.7 avait **anticipé** ce point : « ne pas anticiper le passage aux URLs ici ». Pour 4.1 : les **images restent des imports statiques dans les conteneurs**, associées au projet lu depuis la base par une clé stable (le `slug`). Concrètement : le conteneur lit les projets en base, puis **joint** localement chaque projet à son import d'image via une petite table de correspondance `slug → StaticImageData` gardée dans le conteneur. Ainsi `ProjectList` reçoit toujours un `image: StaticImageData` (contrat 3.7 intact), le texte/lien/period viennent de la base. **Ne pas modifier le type `Project` de `ProjectList.tsx`** dans cette story. La bascule des images vers `Media`/URLs est explicitement Epic 5.

### ⚠️ Piège n°5 — `page.tsx` doit tolérer des sections `async`
Rendre `Projects`/`SelfProject` `async` est compatible avec les Server Components de Next 16 (App Router). `page.tsx` les rend directement ; il n'a pas besoin de devenir `async` lui-même (Next attend les composants enfants async). **Vérifier** néanmoins qu'aucun composant parent n'est `"use client"` (ce n'est pas le cas : `page.tsx`, `Projects.tsx`, `SelfProject.tsx` sont serveur). ❌ **Ne pas** transformer ces sections en Client Components : la lecture DB est côté serveur (AGENTS.md §6).

### ⚠️ Piège n°6 — Rendu statique, pas de requête par visiteur
La story 4.4 traitera formellement l'ISR (`revalidate: 3600`) et le cache par tag. **Ici, ne pas** ajouter `export const dynamic = 'force-dynamic'` ni désactiver le cache : laisser Next rendre la page statiquement au build (comportement par défaut du fetch DB en Server Component au build). Si un doute apparaît sur `dynamic` vs `static`, **le laisser tel quel** — c'est le périmètre de 4.4, pas de 4.1. On veut juste que le build réussisse et que la page s'affiche.

### ⚠️ Piège n°7 — Fallback si DB injoignable = Epic 4.5, PAS ici
Ne **pas** implémenter le fallback statique `src/content/*.ts` dans cette story (c'est la story 4.5). En dev, la base du compose est disponible ; si elle ne l'est pas, il est acceptable pour 4.1 que le build/la page échoue — 4.5 rendra ça robuste. Rester dans le périmètre.

## Tasks / Subtasks

- [x] **Tâche 0 — Vérifier le terrain** (AC: 1)
  - [x] Confirmer `apps/web/`, Bun 1.3.3, Next 16.2.11 / React 19.2 (lu dans `package.json`).
  - [x] Confirmer que le `db` du `docker-compose.yml` (dev) est disponible et que `DATABASE_URL` local pointe dessus avec `?schema=public`. (DB démarrée via `docker compose up -d db` ; CLI Prisma sur l'hôte → `127.0.0.1:5432`.)
  - [x] Confirmer avec Jeevons l'état réel de la base **prod** (`GRANT` de 2.4 appliqué ?) — piège n°1. **Réponse : GRANT appliqué en prod.** Rien lancé sur la prod (hors périmètre).
- [x] **Tâche 1 — Installer et configurer Prisma 7** (AC: 1 ; pièges n°2)
  - [x] Ajouté `prisma` (dev) + `@prisma/client` + `@prisma/adapter-pg` (requis par le runtime Prisma 7) + `server-only` (garde du boundary serveur) via Bun.
  - [x] Créé `apps/web/prisma/schema.prisma`. **⚠️ Prisma 7 : `url` retiré du bloc `datasource`** → l'URL vit dans `prisma.config.ts` (Migrate) et via driver adapter au runtime. Config Prisma 7 dans `prisma.config.ts` (chargement `.env` manuel, hook seed).
  - [x] Créé le singleton `apps/web/src/lib/db.ts` (`server-only`, `PrismaPg` adapter, anti-hot-reload).
  - [x] `apps/web/.gitignore` créé pour le client généré (`output` custom `src/generated/prisma`).
- [x] **Tâche 2 — Modèles + migration** (AC: 1 ; piège n°4)
  - [x] Déclaré `Project`, `Highlight`, `Stack`, enums `ProjectCategory`/`SkillLevel`, index `@@index([category, sortOrder])`.
  - [x] **Décision Jeevons : `coverId`/`cover` omis** (ajoutés en Epic 5 avec `Media`). Aucune relation vers un modèle inexistant.
  - [x] `prisma migrate dev --name init_projects` → migration `20260724085035_init_projects` (3 tables + join `_ProjectStacks`).
- [x] **Tâche 3 — Seed idempotent** (AC: 2 ; piège n°3)
  - [x] `apps/web/prisma/seed.ts` : `upsert` par `slug` (Project) et `name` (Stack, `set` des relations) ; highlights remplacés (`deleteMany` + `createMany`).
  - [x] Les **6 projets** reportés avec `published: true`, `sortOrder` par catégorie, 3 highlights chacun ; technos → 7 `Stack` dédupliqués. `SkillLevel` null (fidèle aux données).
  - [x] Scripts `db:seed`, `db:reset`, `db:migrate`, `db:deploy`, `db:generate`, `postinstall` dans `apps/web/package.json`.
  - [x] Seed lancé **2×** → counts identiques : Project=6, Highlight=18, Stack=7, ProjectStacks=17. Aucun doublon (preuve consignée).
- [x] **Tâche 4 — Brancher les sections publiques** (AC: 3, 4 ; pièges n°4, 5, 6)
  - [x] `getPublishedProjects(category)` (`src/lib/projects.ts`) filtre `published: true` **dans la requête** et trie par `sortOrder` (+ highlights ordonnés).
  - [x] `Projects.tsx` / `SelfProject.tsx` → `async`, lecture DB, mapping vers `Project`, jointure image par `slug` (piège n°4), textes de section conservés en dur.
  - [x] `ProjectList.tsx` **non modifié** (contrat 3.7 intact) ; `page.tsx` non modifié (piège n°5).
  - [x] AC4 vérifié : `sunnyside` passé `published: false` → disparaît de la lecture PERSONAL (insure, sleeping-time, gallerie restants). État restauré par re-seed.
- [x] **Tâche 5 — Vérification & Definition of Done** (AGENTS.md §8)
  - [x] Rendu iso confirmé sur la page de prod (`bun run start` + curl) : `#projects` → Quantum, Maufeb Mode · `#side-projects` → Insure, Sunnyside, SleepingTime, Gallerie. Même ordre, mêmes liens.
  - [x] Ancres `#projects` / `#side-projects` intactes ; 6 liens sortants aux URLs d'origine, `target="_blank" rel="noopener noreferrer"` préservés (via `ProjectList` inchangé).
  - [x] `prisma validate` OK · `bun run lint` → 0 nouveau warning (seul le warning pré-existant `Testimonials.tsx`) · `tsc --noEmit` → 0 erreur · `bun run build` → succès, `/` prérendu **static** (piège n°6 tenu).
  - [x] `git status` relu : périmètre respecté (Prisma + lib + 2 conteneurs + config eslint), rien d'autre. Client généré et `.env` gitignorés.
  - [x] `File List` + `Completion Notes` + `Change Log` remplis · `sprint-status.yaml` → `review`.

## Dev Notes

### Périmètre — verrouillé

**Installer Prisma, créer 3 modèles + 2 enums + 1 migration, seeder les 6 projets existants de façon idempotente, brancher les 2 sections publiques en lecture DB en préservant le rendu.**

**Hors périmètre — ne pas faire :**
- ❌ **Modèles `TimelineEntry` / `Hobby`** → story **4.2**.
- ❌ **Modèle `SiteSetting`** (textes Hero/coordonnées) → story **4.3**. Les textes de section restent en dur ici.
- ❌ **Modèles `Media` / `User` / `AuditLog` / `ContactMessage`** → **Epic 5**.
- ❌ **ISR / `revalidate` / cache par tag** → story **4.4**.
- ❌ **Fallback statique `src/content/*.ts`** → story **4.5**.
- ❌ **Migrations automatiques au démarrage du conteneur** → story **4.6**.
- ❌ **Modifier `ProjectList.tsx`** (contrat 3.7) ni le type `image: StaticImageData`.
- ❌ **Toute UI d'admin / CRUD** → Epic 5.
- ❌ **Ajouter une dépendance** hors Prisma (prévue par le plan).

### Le vrai enjeu

La valeur n'est pas « afficher des projets » (ils s'affichent déjà) — c'est **poser Prisma proprement** (client singleton, migration propre, seed idempotent, patterns de lecture serveur) pour que 4.2 → 4.6 et l'Epic 5 s'y branchent sans dette. Le contrat source-agnostique de `ProjectList` (story 3.7) rend le branchement trivial : c'est exactement le dividende de la factorisation faite « en dernier, juste avant que l'Epic 4 n'y branche la base ».

### Testing standards

Pas de test automatisé (Playwright en Epic 7). Vérification : rendu **iso** avant/après, **idempotence** du seed prouvée (2 passages, comptage), **filtre `published`** vérifié (basculer un projet en `false`), `prisma validate` + tsc/lint/build verts. Vérification visuelle navigateur recommandée (AGENTS.md §8).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.1]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 4 — « chaque story crée les seuls modèles qu'elle utilise »]
- [Source: PLAN_REFONTE_2026.md §2.1 — schéma Prisma `Project`/`Highlight`/`Stack`, enums, `@@index([category, sortOrder])`]
- [Source: PLAN_REFONTE_2026.md §2 — `lib/db.ts`, `prisma/{schema.prisma,seed.ts,migrations/}`, fallback `src/content/`]
- [Source: PLAN_REFONTE_2026.md §3.3 — ISR + fallback (contexte, hors périmètre 4.1)]
- [Source: _bmad-output/implementation-artifacts/3-7-eliminer-la-duplication-entre-les-deux-sections-de-projets.md — contrat `ProjectList`, type `Project`, AC3 source-agnostique, `image: StaticImageData` non anticipé]
- [Source: _bmad-output/implementation-artifacts/2-4-heberger-les-donnees-du-portfolio-sur-le-postgres-mutualise.md — `portfolio_prod`, `GRANT ALL ON SCHEMA public`, `?schema=public`, base prod inaccessible depuis le dev]
- [Source: apps/web/src/components/ProjectList.tsx — type `Project`, props ; apps/web/src/sections/Projects.tsx & SelfProject.tsx — conteneurs à rendre `async`]
- [Source: apps/web/src/app/page.tsx — Server Component `Home`, ordre des sections]
- [Source: AGENTS.md §5 — ordre des epics, « Epic 5 dépend de l'Epic 4 » ; §6 — logique de données côté Server Components ; §9 — anti-scope-creep, zéro dépendance non prévue]
- [Source: docker-compose.yml — service `db` Postgres de développement]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

- **Prisma 7 — changements de défauts majeurs (piège n°2 confirmé) :**
  - Le générateur par défaut est `prisma-client` (ESM), **exige un `output` explicite** → généré vers `src/generated/prisma` et gitignoré. L'import n'est plus `@prisma/client` mais `@/generated/prisma/client`.
  - **`url` retiré du bloc `datasource`** du schéma (erreur P1012). L'URL de connexion vit désormais dans `prisma.config.ts` (`datasource.url`) pour Migrate, et au **runtime via un driver adapter** (`@prisma/adapter-pg`, `PrismaPg`) passé au constructeur `PrismaClient`.
  - `prisma.config.ts` **ne charge plus `.env` automatiquement** → chargement manuel en tête du fichier (évite d'ajouter `dotenv`). Hook seed déclaré sous `migrations.seed`.
- CLI Prisma exécutée sur l'hôte macOS → `DATABASE_URL` local pointe sur `127.0.0.1:5432` (Postgres exposé par le compose), pas sur le hostname Docker `db`.
- ESLint linte le client généré → `src/generated/**` ajouté aux `ignores` de `eslint.config.mjs`.

### Completion Notes List

- **AC1** ✅ Prisma 7.9.0 installé et connecté à Postgres. Modèles `Project`/`Highlight`/`Stack` + enums `ProjectCategory`/`SkillLevel`, index `@@index([category, sortOrder])`. Migration `20260724085035_init_projects` versionnée et appliquée. `coverId`/`cover` **omis** (décision Jeevons → Epic 5 avec `Media`).
- **AC2** ✅ Seed idempotent (`upsert` par `slug`/`name`, highlights remplacés). Double passage → counts identiques (6/18/7/17), zéro doublon.
- **AC3** ✅ Rendu iso vérifié sur la page de production : mêmes 6 projets, même ordre, mêmes liens. `ProjectList.tsx` inchangé (contrat 3.7 tenu) — les conteneurs `async` mappent le résultat DB vers le type `Project`, images jointes par `slug` (piège n°4).
- **AC4** ✅ Filtre `published: true` **dans la requête** Prisma. Bascule d'un projet en `false` → il disparaît de la lecture.
- **Prod (piège n°1)** : `GRANT ALL ON SCHEMA public` confirmé appliqué sur `portfolio_prod` par Jeevons. Rien lancé sur la prod (hors périmètre — le `migrate deploy` prod relève de 4.6).
- **Hors périmètre respecté** : pas d'ISR/cache (4.4), pas de fallback DB-down (4.5), pas de migrations au démarrage (4.6), pas de `TimelineEntry`/`Hobby`/`SiteSetting`/`Media` (4.2/4.3/Epic 5), pas d'UI admin.
- **Dépendances ajoutées** (toutes au service du branchement Prisma prévu par le plan) : `prisma`, `@prisma/client`, `@prisma/adapter-pg` (requis par le runtime Prisma 7), `server-only` (garde du boundary serveur).
- **Vérifications** : `prisma validate` OK · `tsc --noEmit` 0 erreur · `bun run lint` 0 nouveau warning · `bun run build` succès (`/` prérendu static).

### File List

**Nouveaux fichiers :**
- `apps/web/prisma/schema.prisma`
- `apps/web/prisma/migrations/20260724085035_init_projects/migration.sql`
- `apps/web/prisma/migrations/migration_lock.toml`
- `apps/web/prisma/seed.ts`
- `apps/web/prisma.config.ts`
- `apps/web/src/lib/db.ts`
- `apps/web/src/lib/projects.ts`
- `apps/web/.gitignore`
- `apps/web/.env` *(gitignoré — dev local uniquement, aucune valeur de prod)*

**Fichiers modifiés :**
- `apps/web/src/sections/Projects.tsx` *(→ `async`, lecture DB FLAGSHIP)*
- `apps/web/src/sections/SelfProject.tsx` *(→ `async`, lecture DB PERSONAL)*
- `apps/web/package.json` *(deps Prisma + scripts `db:*` + `postinstall`)*
- `apps/web/bun.lock`
- `apps/web/eslint.config.mjs` *(ignore `src/generated/**`)*

**Non modifiés (contrat préservé) :** `apps/web/src/components/ProjectList.tsx`, `apps/web/src/app/page.tsx`.

**Généré, gitignoré (non committé) :** `apps/web/src/generated/prisma/**`.

### Change Log

| Date | Description |
|------|-------------|
| 2026-07-24 | Story 4.1 créée — installation Prisma 7, modèles `Project`/`Highlight`/`Stack`, seed idempotent des 6 projets, branchement des sections publiques en lecture DB. |
| 2026-07-24 | Implémentation 4.1 — Prisma 7.9.0 (generator ESM, driver adapter pg, config `prisma.config.ts`), migration `init_projects`, seed idempotent (2× → 6/18/7/17), `getPublishedProjects` filtrant `published`, `Projects`/`SelfProject` en Server Components `async`. AC1–AC4 vérifiés. Statut → review. |
