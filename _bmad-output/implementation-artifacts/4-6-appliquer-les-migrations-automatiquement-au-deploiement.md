---
baseline_commit: 220ab43cc5c937806af6409fae95d96fd1f3ed21
---

# Story 4.6: Appliquer les migrations automatiquement au déploiement

Status: review

## Story

As **Jeevons**,
I want **que la base soit mise à jour toute seule quand je déploie**,
so that **je n'aie jamais à me connecter au VPS pour lancer une migration à la main**.

## Acceptance Criteria

**AC1 — Migrations puis seed idempotent avant de servir du trafic**
**Given** le conteneur démarre en production
**When** l'application se lance
**Then** les migrations en attente sont appliquées (`prisma migrate deploy`) avant que l'application ne serve du trafic
**And** le seed idempotent s'exécute ensuite, sans jamais écraser de contenu existant

**AC2 — Échec de migration = démarrage interrompu + healthcheck rouge**
**Given** une migration échoue
**When** le conteneur démarre
**Then** le démarrage est interrompu avec un message explicite
**And** le healthcheck ne passe pas au vert, empêchant l'orchestrateur de router du trafic vers une application dont la base est incohérente

**AC3 — Rejouable sans effet de bord**
**Given** le conteneur redémarre plusieurs fois
**When** les migrations et le seed se rejouent
**Then** le résultat est identique à chaque fois, sans duplication ni effet de bord

## Contexte d'implémentation

### 🛑 Prérequis : stories 4.1 → 4.5 `done` ; dépend du socle Docker de l'Epic 2

Il faut des **migrations versionnées** (4.1-4.3) et un **seed idempotent** (4.1-4.3, source unique consolidée en 4.5) à appliquer. Le socle Docker/Coolify vient de l'**Epic 2** (Dockerfile 4 étages, `docker-compose.prod.yml`, healthcheck). Stack : `apps/web/`, Bun (build) / **`node server.js` en prod, SANS Bun**.

### 🎯 Ce que fait vraiment cette story

Au **démarrage du conteneur de production**, dans l'ordre, **avant** que le serveur n'écoute :
1. `prisma migrate deploy` (applique les migrations en attente — jamais `migrate dev` en prod).
2. Le **seed idempotent** (ne modifie rien s'il tourne sur une base déjà peuplée).
3. Puis seulement `node server.js`.
Si (1) ou (2) échoue → **arrêter** le démarrage (exit non-zéro), pour que le conteneur ne serve pas une app incohérente et que le **healthcheck reste rouge** (AC2).

### ⚠️ Piège n°1 (CENTRAL) — L'étage `production` n'a NI Bun NI la CLI Prisma
Le Dockerfile (Epic 2) : l'étage `production` part de `.next/standalone` et lance `node server.js` **sans Bun**, avec un `node_modules` **minimal** (celui du standalone). Or `prisma migrate deploy` a besoin de la **CLI `prisma`** et des **engines** Prisma, qui ne sont **pas** garantis dans le standalone. 🛑 C'est LE point dur de la story. Options — trancher avec Jeevons :
- **(a)** Copier dans l'étage production les artefacts Prisma nécessaires (binaire `prisma` + engines + `schema.prisma` + `migrations/` + le seed compilé) et invoquer `node node_modules/prisma/build/index.js migrate deploy` (ou `npx prisma` si `npx`/node dispo) au démarrage.
- **(b)** Exécuter `migrate deploy` via `@prisma/client` / l'API programmatique si disponible.
- **(c)** Un étage/entrypoint dédié qui dispose du nécessaire.
⚠️ Le seed est en TS (`seed.ts`) : en prod sans Bun, il faut une version **exécutable par node** (compilée au build, ou `.js`, ou via `prisma db seed` correctement configuré pour node). **Vérifier** que le seed 4.1-4.5 est lançable dans l'étage production. Ceci peut nécessiter d'ajuster le **build** (compiler le seed) — c'est dans le périmètre de cette story.
> Reproduire la convention Doshwork : PLAN §5 dit « Migrations Prisma au démarrage du conteneur (`prisma migrate deploy` + seed idempotent), **comme l'API Doshwork** ». S'inspirer de la façon dont Doshwork le fait (référence citée dans le PLAN).

### ⚠️ Piège n°2 — Entrypoint script, pas de migration dans `next.config`/build
La migration s'exécute au **runtime du conteneur** (démarrage), **jamais** au build (le build n'a pas accès à la DB de prod, et le `docker build` doit rester reproductible sans DB). Créer un **entrypoint** (ex. `apps/web/docker-entrypoint.sh` ou une commande) qui enchaîne migrate → seed → `node server.js`, et le câbler comme `ENTRYPOINT`/`CMD` de l'étage `production`. Aujourd'hui le Dockerfile finit par `CMD ["node", "server.js"]` : le remplacer par l'entrypoint. ⚠️ Conserver `USER nextjs`, `HOSTNAME=0.0.0.0`, `PORT=3000`, `EXPOSE 3000` (contraintes Epic 2 : sans `HOSTNAME=0.0.0.0` → 502 ; user non-root uid 1001).

### ⚠️ Piège n°3 — « Avant de servir du trafic » + healthcheck rouge (AC2)
- **Séquencement** : l'entrypoint bloque sur migrate/seed ; `node server.js` n'est lancé **qu'après** leur succès. Donc tant que la migration tourne (ou a échoué), aucun port n'écoute → le healthcheck (`wget http://127.0.0.1:3000/api/health`, cf. `docker-compose.prod.yml`) **échoue** naturellement. C'est le comportement voulu (AC2).
- Si migrate/seed **échoue**, l'entrypoint fait `exit 1` → le conteneur s'arrête (ou redémarre en boucle via `restart: unless-stopped`), le healthcheck ne passe **jamais** au vert, l'orchestrateur ne route pas de trafic. ✅ AC2 satisfait **sans** modifier la route `/api/health` (elle n'a pas à tester la DB — le simple fait que le serveur n'écoute pas suffit). ❌ **Ne pas** transformer `/api/health` en check de DB : ce serait un sur-périmètre risqué (un hoquet DB transitoire ferait tomber un conteneur sain). Le gating vient de l'**ordre de démarrage**, pas du contenu du healthcheck.
- ⚠️ `start_period: 30s` du healthcheck (compose prod) : si les migrations sont longues, le healthcheck pourrait tester trop tôt. Vérifier que `start_period` couvre le temps de migration, ou l'ajuster (dans `docker-compose.prod.yml`, périmètre acceptable).

### ⚠️ Piège n°4 — `migrate deploy`, jamais `migrate dev` ; et le `GRANT` de 2.4
- En prod : **`prisma migrate deploy`** (applique les migrations existantes sans en générer). ❌ Jamais `migrate dev` (il génère/réinitialise — destructeur en prod).
- Rappel 4.1 piège n°1 : `migrate deploy` échouera avec `permission denied for schema public` si le `GRANT ALL ON SCHEMA public` de la story 2.4 n'a pas été appliqué sur `portfolio_prod`. 🛑 Confirmer que 2.4 a bien été exécutée sur le VPS avant le premier déploiement avec migrations auto. C'est **exactement** le moment que la story 2.4 prédisait.

### ⚠️ Piège n°5 — Idempotence au redémarrage (AC3)
`migrate deploy` est idempotent par nature (ne rejoue pas une migration déjà appliquée — table `_prisma_migrations`). Le **seed** doit l'être aussi (garanti par 4.1-4.5 : `upsert` par clé naturelle / source unique). Au redémarrage répété du conteneur : migrate = no-op, seed = no-op sur contenu existant → état identique (AC3). ⚠️ Vérifier explicitement : redémarrer 2-3 fois le conteneur et comparer les comptes de lignes / l'absence de doublon.

### ⚠️ Piège n°6 — Concurrence si plusieurs instances (à noter)
Si un jour plusieurs réplicas démarrent en parallèle, deux entrypoints pourraient lancer migrate/seed simultanément. Le portfolio est **mono-conteneur** (PLAN §2 : « un seul service `web` ») → risque nul aujourd'hui. **Le noter** en Completion Notes sans sur-ingénierer un verrou (hors périmètre tant qu'on est à une instance). `prisma migrate deploy` gère par ailleurs un verrou d'avis.

### ⚠️ Piège n°7 — Vérification locale sans toucher la prod
🛑 L'agent n'a pas accès au VPS (comme 2.4/2.6). La vérification se fait **en local** : construire l'étage `production` et le lancer contre le `db` du `docker-compose.yml` (ou un Postgres jetable), pour prouver migrate→seed→serveur, l'échec bloquant, et l'idempotence au redémarrage. ❌ Ne pas tenter de déployer sur Coolify (déclenché par Jeevons). Documenter la procédure de vérification (cohérent avec le style runbook `docs/` des stories d'exploitation).

## Tasks / Subtasks

- [x] **Tâche 0 — Prérequis** (AC: 1)
  - [x] Confirmer 4.1→4.5 `done` (migrations versionnées + seed idempotent consolidé).
  - [x] 🛑 Confirmer avec Jeevons que 2.4 (`GRANT`) est appliquée sur `portfolio_prod` (piège n°4). → **Confirmé appliqué** (AskUserQuestion).
  - [x] Étudier comment Doshwork applique migrate+seed au démarrage (référence PLAN §5). → entrypoint migrate→seed→serveur.
- [x] **Tâche 1 — Rendre Prisma exécutable dans l'étage production** (AC: 1 ; piège n°1)
  - [x] Copier CLI `prisma` + engines + `schema.prisma` + `migrations/` dans l'étage `production`. → via étage `migrator` (toolchain isolé `/app/prisma-tools`, schema-engine `linux-musl`).
  - [x] Rendre le seed exécutable par **node** (sans Bun) — compiler au build si nécessaire. → `bun run build:seed` → bundle `prisma/seed.mjs` (pg externe).
- [x] **Tâche 2 — Entrypoint de démarrage** (AC: 1, 2 ; pièges n°2, 3, 4)
  - [x] Script entrypoint : `prisma migrate deploy` → seed → `node server.js`.
  - [x] `set -e` / propagation d'erreur : tout échec migrate/seed → `exit 1`, serveur non démarré.
  - [x] Câbler comme `ENTRYPOINT` de l'étage `production` ; conserver `USER nextjs`, `HOSTNAME=0.0.0.0`, `PORT=3000`.
  - [x] Ajuster `start_period` du healthcheck (`docker-compose.prod.yml`) si besoin. → migrations courtes (~1–2 s) < `30s` : aucun changement, noté dans le runbook.
  - [x] ❌ Ne pas modifier `/api/health` pour tester la DB (gating par ordre de démarrage). → inchangé.
- [x] **Tâche 3 — Vérification locale** (AC: 1, 2, 3 ; pièges n°5, 7)
  - [x] Build + run de l'étage `production` contre un Postgres local : migrate→seed→serveur OK, `/api/health` vert **après** migration.
  - [x] Simuler un échec de migration → démarrage interrompu, message explicite, healthcheck **jamais** vert.
  - [x] Redémarrer 2-3× → aucun doublon, état identique (AC3).
  - [x] Documenter la procédure (runbook `docs/`), sans secret.
- [x] **Tâche 4 — Definition of Done** (AGENTS.md §8)
  - [x] `bun run lint` (0 nouveau warning) · `bunx tsc --noEmit` (0 erreur) · `bun run build` (succès) · `docker build`/run production OK.
  - [x] `git diff DEV` : Dockerfile + entrypoint + build seed + prod config + db.ts (lazy) + .gitignore + runbook, rien d'autre.
  - [x] `File List` + `Completion Notes` + `Change Log` · `sprint-status.yaml` mis à jour.

## Dev Notes

### Périmètre — verrouillé

**Faire tourner `prisma migrate deploy` + seed idempotent au démarrage du conteneur de production, avant de servir du trafic ; interrompre le démarrage (healthcheck rouge) si la migration échoue ; garantir la rejouabilité sans effet de bord ; vérifier en local.**

**Hors périmètre — ne pas faire :**
- ❌ **Transformer `/api/health` en check de DB** (le gating vient de l'ordre de démarrage).
- ❌ **Déployer sur Coolify / toucher le VPS** → déclenché par Jeevons (l'agent n'a pas accès).
- ❌ **`migrate dev` en prod** (destructeur) ; jamais.
- ❌ **Verrou multi-instances** (mono-conteneur ; simplement noté).
- ❌ **Modifier les modèles, le contenu ou les fonctions de lecture** (4.1-4.5).
- ❌ **Ajouter une dépendance** hors ce qu'exige l'exécution de Prisma en prod (prévu par le plan).

### Le vrai enjeu

C'est la **clôture opérationnelle de l'Epic 4** et la **reproduction stricte du process Doshwork** (PLAN §5 : « migrations au démarrage, comme l'API Doshwork »). Le point qui casse le plus souvent : Prisma **absent de l'étage production sans Bun** (piège n°1) — c'est là que se joue la story. Le gating healthcheck (AC2) protège la prod : jamais de trafic vers une app dont la base est incohérente. Après cette story, un `git push` → Coolify rebuild → migrations + seed automatiques : Jeevons ne touche plus jamais le VPS pour la base.

### Testing standards

Pas de test automatisé (Playwright en Epic 7). Vérification **manuelle en local** (build + run de l'étage production contre un Postgres) : séquence migrate→seed→serveur (AC1), échec bloquant + healthcheck rouge (AC2), rejouabilité sans doublon (AC3). Runbook documenté. tsc/lint/build + docker build verts.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.6]
- [Source: PLAN_REFONTE_2026.md §5 — « Migrations Prisma au démarrage du conteneur (`prisma migrate deploy` + seed idempotent), comme l'API Doshwork » ; §5.1 — étage production `node server.js` sans Bun, user non-root 1001, `HOSTNAME=0.0.0.0`]
- [Source: apps/web/Dockerfile — étages `deps`/`builder`/`development`/`production` ; production : standalone + `CMD ["node","server.js"]`, sans Bun, `USER nextjs`]
- [Source: docker-compose.prod.yml — healthcheck `wget /api/health`, `start_period: 30s`, `restart: unless-stopped`, `DATABASE_URL` en env]
- [Source: apps/web/src/app/api/health/route.ts — `force-dynamic`, ne teste PAS la DB (à conserver)]
- [Source: _bmad-output/implementation-artifacts/4-1-servir-les-projets-depuis-la-base.md — migrations versionnées, seed idempotent, `GRANT` de 2.4 mis à l'épreuve par `migrate deploy` (piège n°4)]
- [Source: _bmad-output/implementation-artifacts/2-4-heberger-les-donnees-du-portfolio-sur-le-postgres-mutualise.md — `GRANT ALL ON SCHEMA public` requis, sinon `migrate deploy` échoue]
- [Source: AGENTS.md §5 — reproduction du process Doshwork ; §6 — user non-root, secrets par env ; §9 — anti-scope-creep, zéro dépendance non prévue]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code)

### Debug Log References

Vérification locale : build de l'étage `production` (`docker build --network=host --target production --build-arg NEXT_PUBLIC_SITE_URL=…`) + run contre un Postgres jetable **vide** (`portfolio_test`).

- **AC1 (migrate → seed → serveur)** — sur base vide (0 table) :
  ```
  [entrypoint] 1/3 — Application des migrations (prisma migrate deploy)…
  Applying migration `20260724085035_init_projects` (+ add_timeline_hobby, + add_site_setting)
  All migrations have been successfully applied.
  [entrypoint] 2/3 — Seed idempotent…
  Seed OK — Project: 6, Highlight: 18, Stack: 7, TimelineEntry: 5, Hobby: 7, SiteSetting: 9
  [entrypoint] 3/3 — Démarrage du serveur Next (node server.js)…
  ✓ Ready in 0ms
  ```
  Puis `/api/health` = **200** (serveur UP **après** migrate+seed), base peuplée (Project=6, SiteSetting=9, _prisma_migrations=3), page d'accueil = contenu réel, **0** e-mail clair / **0** `DATABASE_URL` dans le HTML.
- **AC2 (échec migration = démarrage interrompu + healthcheck rouge)** — `DATABASE_URL` vers un hôte injoignable :
  `Error: P1001: Can't reach database server at ...` → conteneur **`Exited (1)`** → `/api/health` = `000` (personne n'écoute, healthcheck jamais vert). **Aucun secret** dans les logs (0 `DATABASE_URL`, 0 identifiant — au plus l'hôte:port).
- **AC3 (rejouabilité)** — 3 redémarrages : comptes **stables** (Project=6, Highlight=18, SiteSetting=9, migrations=3). `migrate deploy` = no-op (`No pending migrations`), seed = `upsert` sans doublon.
- **Chemin dev/CI inchangé** : `tsc` 0 erreur, `lint` 0 nouveau warning, `bun run build` (hôte, DB up) exit 0 (ISR 4.4 intact), `bun run build:seed` OK. `prisma.config.js` **absent** de l'arbre source (pas de collision avec `prisma.config.ts`).

### Completion Notes List

- **Piège n°1 (le point dur) résolu par un étage `migrator`** (décision Jeevons) : le générateur Prisma 7 `prisma-client` + adapter `@prisma/adapter-pg` produit un client **sans query-engine**, et le standalone Next **ne contient ni CLI `prisma` ni schema-engine**. L'étage `migrator` installe la CLI dans un préfixe isolé (`bun add prisma@7.9.0`) → fetch du **`schema-engine-linux-musl`** + toutes les dépendances transitives (dont `effect`, requis par `@prisma/config`). `production` copie ce toolchain sous `/app/prisma-tools` **sans clobber** le `node_modules` du standalone.
- **Seed exécutable par node sans Bun** : `bun run build:seed` bundle `prisma/seed.ts` en `prisma/seed.mjs` (ESM node). `@prisma/adapter-pg` est **bundlé** (non tracé par Next car le seed n'est pas dans le graphe du build) ; seul `pg` reste externe (présent dans le standalone). Artefact gitignoré, produit au build du conteneur.
- **Config prod dédiée** : `prisma/prod.config.js` (CJS, node-loadable) copié dans l'image **sous le nom `prisma.config.js`**. Prisma 7 exige `datasource.url` dans la config pour `migrate deploy` ; elle lit `process.env.DATABASE_URL` (fournie par le compose, jamais écrite dans l'image). Nom distinct pour ne **jamais** coexister avec `prisma.config.ts` dans le dépôt (sinon la CLI charge le `.js` et casse le dev).
- **Construction paresseuse du client Prisma** (`src/lib/db.ts`) : le client était instancié à l'import du module → `next build` échouait en collectant les pages là où aucune `DATABASE_URL` n'est fournie (le build doit rester reproductible **sans** DB, piège n°2). Passé en Proxy à construction différée : l'absence d'URL survient désormais pendant une **lecture**, donc capturée par `readWithFallback` (4.5). Le build ne dépend plus d'une base.
- **Piège n°3 (gating)** : `/api/health` **inchangé** (ne teste pas la DB). Le gating vient de l'ordre de démarrage (serveur lancé seulement après migrate+seed OK). `start_period: 30s` conservé (migrations ~1–2 s).
- **Piège n°4** : `migrate deploy` (jamais `migrate dev`). `GRANT ALL ON SCHEMA public` sur `portfolio_prod` **confirmé appliqué** par Jeevons — prérequis rappelé dans le runbook.
- **Piège n°6 (concurrence)** : portfolio **mono-conteneur** → pas de course entre entrypoints ; aucun verrou applicatif ajouté (hors périmètre). Noté dans le runbook.
- **Hors-4.6 rencontrés et corrigés au passage** (nécessaires pour que `docker build` aboutisse) : (a) l'étage `deps` lançait `prisma generate` (postinstall) sans le schéma → schéma + config copiés avant `bun install` ; (b) `NEXT_PUBLIC_SITE_URL` doit être passé en `--build-arg` (sinon `new URL("")` sur `/`). Le build Docker exige aussi `--network=host` (récupération des polices Google par `next/font`).

### File List

**Nouveaux fichiers**
- `apps/web/docker-entrypoint.sh` — entrypoint prod : `migrate deploy` → seed → `node server.js`, `set -e` (échec = `exit 1`).
- `apps/web/prisma/prod.config.js` — config Prisma prod (CJS), lit `DATABASE_URL` de l'env ; copiée en `prisma.config.js` dans l'image.
- `apps/web/.gitignore` — ignore `/prisma/seed.mjs` (bundle régénérable) en plus de `/src/generated/`.
- `docs/runbook-4-6-migrations-au-demarrage.md` — procédure de vérification locale (AC1/AC2/AC3), sans secret.

**Fichiers modifiés**
- `apps/web/Dockerfile` — `deps` copie schéma+config avant install ; `builder` produit le bundle seed (`build:seed`) ; nouvel étage `migrator` (toolchain Prisma isolé) ; `production` copie le toolchain + seed + entrypoint et passe de `CMD ["node","server.js"]` à `ENTRYPOINT ["./docker-entrypoint.sh"]` (contraintes Epic 2 conservées : `USER nextjs`, `HOSTNAME=0.0.0.0`, `PORT=3000`).
- `apps/web/package.json` — script `build:seed` (bundle du seed pour node).
- `apps/web/src/lib/db.ts` — client Prisma à construction paresseuse (Proxy) pour un build reproductible sans DB.

### Change Log

| Date | Description |
|------|-------------|
| 2026-07-24 | Story 4.6 créée — entrypoint de production appliquant `migrate deploy` + seed idempotent avant le serveur, gating du healthcheck sur échec, rejouabilité vérifiée en local. |
| 2026-07-24 | Implémentation 4.6 : étage Docker `migrator` (toolchain Prisma isolé, schema-engine linux-musl) + entrypoint migrate→seed→serveur (`set -e`) + bundle seed node (`build:seed`) + `prod.config.js` + client Prisma paresseux (`db.ts`). AC1/AC2/AC3 prouvés en local (base vide → migrate+seed+serveur ; DB injoignable → Exited(1)+health rouge ; 3 redémarrages → comptes stables). Sans secret. Status → review. |
