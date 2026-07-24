---
baseline_commit: 5c22f3a6c48914801d0a226ab5a0b15c005d8765
---

# Story 5.1: Me connecter au back-office

Status: review

## Story

As **Jeevons**,
I want **me connecter avec mon e-mail et mon mot de passe**,
so that **je puisse accéder à l'administration de mon portfolio, et personne d'autre**.

## Acceptance Criteria

**AC1 — Modèle `User` + migration + argon2id**
**Given** aucun système d'authentification n'existe
**When** cette story est terminée
**Then** le modèle `User` existe avec e-mail unique, empreinte de mot de passe et rôle, et une migration le décrit
**And** l'authentification repose sur Auth.js v5 en fournisseur par identifiants
**And** les mots de passe sont hachés en argon2id, jamais stockés en clair ni réversibles

**AC2 — Compte admin seedé, idempotent, aucune inscription**
**Given** le compte administrateur doit exister sans inscription
**When** le seed s'exécute avec les variables d'environnement d'e-mail et de mot de passe administrateur
**Then** le compte est créé s'il n'existe pas, mis à jour sinon, sans jamais être dupliqué
**And** aucune route ni écran d'inscription n'existe dans l'application

**AC3 — Session ouverte, cookie durci**
**Given** je saisis des identifiants valides
**When** je soumets le formulaire de connexion
**Then** une session est ouverte
**And** le cookie de session est `httpOnly`, `Secure` et `SameSite=Lax`

**AC4 — Échec sans oracle d'énumération**
**Given** je saisis des identifiants invalides
**When** je soumets le formulaire
**Then** la connexion échoue avec un message qui ne révèle pas si l'e-mail existe
**And** le temps de réponse ne permet pas de deviner l'existence du compte

## Contexte d'implémentation

### 🛑 Prérequis : Epic 4 `done` (Prisma 7 branché) ; PREMIÈRE story de l'Epic 5

C'est **la pierre fondatrice** de tout l'accès sécurisé (5.1 → 5.6). Rien de l'admin n'est construit avant que ce socle ne soit fini et vérifié (AGENTS.md §5 : « l'accès sécurisé complet est livré avant tout écran de gestion »). Stack : `apps/web/`, Bun, Next 16.2 / React 19, Prisma 7.9 (adapter-pg, client généré ESM). PLAN §3.1 et §9 = source de vérité.

### 🎯 Ce que fait vraiment cette story

Poser **l'authentification par identifiants** : modèle `User`, hachage argon2id, Auth.js v5 en Credentials provider, session JWT en cookie durci, compte admin seedé par variables d'environnement, **zéro inscription**. La story livre le **login qui ouvre une session** — mais PAS encore la protection des routes `/admin` (5.2) ni le 2FA (5.3-5.5). Le `User` posé ici est **volontairement minimal** ; les champs 2FA (`totpSecret`, `totpEnabledAt`, `recoveryCodes`) sont ajoutés en 5.3 par une migration additive.

### 🔑 Dépendances à ajouter (validées par le PLAN, §3.1 / §9)

- `next-auth@beta` (Auth.js v5) — Credentials provider.
- `argon2` (hachage argon2id des mots de passe).
> ✅ Ces deux dépendances sont **explicitement prévues** par le PLAN (§3.1) → autorisées par AGENTS.md §2/§9. N'en ajouter **aucune autre** dans cette story (`otplib`, `zod`, `sharp`, `dnd-kit` viennent dans leurs stories respectives).

### ⚠️ Piège n°1 (CENTRAL) — Prisma 7 : client généré ESM, adapter-pg, `db.ts` singleton [[prisma7-setup-gotchas]]

Réutiliser le socle Epic 4 **sans le refaire** :
- Import du client = `@/generated/prisma/client` (**PAS** `@prisma/client`), enums via `@/generated/prisma/enums`.
- Accès DB **exclusivement** via `src/lib/db.ts` (singleton `prisma`, `import "server-only"`, construction paresseuse par Proxy — story 4.6). Ne PAS instancier un `PrismaClient` ailleurs.
- **Après ajout du modèle `User`** : `bunx prisma migrate dev` PUIS `bunx prisma generate` AVANT de lancer le seed (sinon `prisma.user is undefined`).
- L'`enum Role { ADMIN }` (PLAN §2) accompagne `User` dans la même migration.

### ⚠️ Piège n°2 — argon2id, jamais réversible ; hachage au seed, pas de mot de passe en clair persisté

- Hacher avec **argon2id** (paramètre `type: argon2.argon2id`). Le `passwordHash` stocké n'est jamais réversible (AC1).
- Le seed lit `ADMIN_EMAIL` / `ADMIN_PASSWORD` de l'environnement, hache le mot de passe, et fait un **`upsert` par `email`** (idempotent, AC2). En `update`, réappliquer le hash (pour qu'un changement de `ADMIN_PASSWORD` se propage). ❌ Jamais écrire `ADMIN_PASSWORD` en clair en base.
- ⚠️ Le seed tourne aussi **en prod au démarrage du conteneur** (story 4.6, `seed.mjs` bundlé pour node). `argon2` est un module natif (bindings) : **vérifier qu'il se bundle/charge dans `seed.mjs`** (le `build:seed` externalise `pg` ; ajouter `argon2` aux externals si le bundling casse, et confirmer sa présence dans le standalone de production). C'est le point à éprouver concrètement.

### ⚠️ Piège n°3 — Cookie durci + `AUTH_SECRET`

- Auth.js v5 : session **JWT** en cookie `httpOnly` + `Secure` + `SameSite=Lax` (AC3). `Secure` implique HTTPS en prod (OK : Traefik/TLS story 2.6) ; en dev HTTP local, Auth.js gère le préfixe de cookie automatiquement — **ne pas forcer `Secure` en dur** au point de casser le dev.
- `AUTH_SECRET` (ex-`NEXTAUTH_SECRET`) **obligatoire** : ajouter à `.env` local et à `.env.production.example` (**sans valeur réelle**, AGENTS.md §2). Générer avec `openssl rand -base64 32`. Cette même clé dérive le chiffrement du secret TOTP en 5.3 → la nommer/documenter dès maintenant.

### ⚠️ Piège n°4 — Anti-énumération : réponse et timing constants (AC4)

- Message d'échec **générique** (« identifiants invalides »), identique que l'e-mail existe ou non.
- ⚠️ Timing : si l'utilisateur n'existe pas, ne **pas** court-circuiter avant le hachage — sinon le temps de réponse trahit l'absence de compte. Comparer contre un **hash factice** (dummy verify) quand l'e-mail est inconnu, pour que le coût argon2 soit payé dans tous les cas. C'est la parade standard à l'oracle temporel (AC4).

### ⚠️ Piège n°5 — Zéro inscription, structure de routes admin naissante

- **Aucune** route/écran d'inscription (`REGISTRATION_OPEN=false` en dur, PLAN §3.1). Ne créer ni `/signup` ni handler d'inscription.
- Créer le **handler Auth.js** (`app/api/auth/[...nextauth]/route.ts` ou l'équivalent v5 `auth.ts` + route) et une **page de connexion** (`/login` ou `/admin/login` — trancher : le PLAN parle de `/admin` login ; la page de saisie peut vivre hors du groupe protégé pour éviter une boucle de redirection avec 5.2). Poser la config Auth.js dans un module réutilisable (`src/lib/auth.ts` ou `src/auth.ts`) que 5.2 (middleware) et 5.5 (2FA) étendront.
- ⚠️ Server Component vs client : la page de login a un formulaire → composant `"use client"` minimal appelant l'action `signIn`. Vue « bête », logique serveur (AGENTS.md §6).

### ⚠️ Piège n°6 — Vérification sans casser build/CI reproductible

- Le build doit rester **reproductible sans DB** (story 4.6, `db.ts` paresseux) : ne pas instancier Prisma à l'import d'un module chargé au build.
- Vérifier en local (DB du `docker-compose.yml`, `127.0.0.1:5432`) : seed crée le compte, login réussit avec les bons identifiants, échoue (message générique, timing constant) avec de mauvais, cookie de session `httpOnly`/`SameSite=Lax` présent (DevTools → Application → Cookies).

## Tasks / Subtasks

- [x] **Tâche 0 — Prérequis & dépendances** (AC: 1)
  - [x] Confirmer Epic 4 `done`. Lire `package.json` : Bun en vigueur (AGENTS.md §2).
  - [x] `bun add next-auth@beta argon2` (les seules autorisées, PLAN §3.1/§9). → `next-auth@5.0.0-beta.32`, `argon2@0.45.1`.
- [x] **Tâche 1 — Modèle `User` + migration** (AC: 1 ; piège n°1)
  - [x] Ajouter `model User` (id, email @unique, passwordHash, role Role @default(ADMIN), createdAt) + `enum Role { ADMIN }` au `schema.prisma`.
  - [x] `bunx prisma migrate dev --name add_user` puis `bunx prisma generate`. → migration `20260724175003_add_user`.
- [x] **Tâche 2 — Seed du compte admin idempotent** (AC: 2 ; pièges n°2, 5)
  - [x] Étendre `prisma/seed.ts` : `upsert` par `email` avec hash argon2id de `ADMIN_PASSWORD`. En `update`, réappliquer le hash.
  - [x] `ADMIN_EMAIL`/`ADMIN_PASSWORD`/`AUTH_SECRET` dans `.env` (local) et `.env.production.example` (déjà présents, section Epic 5). Vérifier `bun run build:seed` (argon2 chargeable par node, piège n°2).
  - [x] ❌ Aucune route/écran d'inscription (vérifié par grep).
- [x] **Tâche 3 — Auth.js v5, Credentials provider, cookie durci** (AC: 1, 3, 4 ; pièges n°3, 4, 5)
  - [x] Config Auth.js réutilisable (`src/lib/auth.ts`) + handler route (`src/app/api/auth/[...nextauth]/route.ts`). Credentials provider : lookup `User` par e-mail, `argon2.verify`.
  - [x] Session JWT, cookie `httpOnly` + `Secure` + `SameSite=Lax` (Secure ajouté par Auth.js en HTTPS ; omis en dev HTTP, piège n°3). `trustHost: true` (conteneur derrière Traefik).
  - [x] Anti-énumération : message générique + dummy-verify si e-mail inconnu (timing constant, mesuré).
  - [x] Page de connexion (`"use client"` minimal → server action `signIn`).
- [x] **Tâche 4 — Vérification locale** (AC: 1-4 ; piège n°6)
  - [x] Seed → login OK / login KO (message générique, timing comparable ~0.032s dans les deux cas). Cookie durci vérifié (httpOnly/SameSite=Lax).
  - [x] Re-seed 2× → aucun doublon de `User` (AC2). Vérifié aussi EN CONTENEUR (redémarrage → re-seed → User: 1).
- [x] **Tâche 5 — Definition of Done** (AGENTS.md §8)
  - [x] `bun run lint` (0 error ; 1 warning PRÉEXISTANT hors périmètre dans TestimonialsClient.tsx) · `bunx tsc --noEmit` (0 erreur) · `bun run build` (succès, reproductible sans DATABASE_URL).
  - [x] `git diff DEV` : schéma+migration, seed, config Auth.js, page login, api/auth, `package.json`/`bun.lock`, `Dockerfile`, `eslint.config.mjs` — rien d'autre.
  - [x] `File List` + `Completion Notes` + `Change Log` · `sprint-status.yaml` mis à jour.

## Dev Notes

### Périmètre — verrouillé

**Modèle `User` + argon2id + Auth.js Credentials + session cookie durci + seed idempotent du compte admin + zéro inscription. Le login ouvre une session.**

**Hors périmètre — ne pas faire :**
- ❌ **Protéger les routes `/admin`** (middleware/guard) → story 5.2.
- ❌ **2FA / TOTP / codes de récupération / champs `totp*`** → stories 5.3-5.5.
- ❌ **Rate-limit** sur les tentatives → story 5.2 (login) / 5.5 (code).
- ❌ **Écrans de gestion** (projets, parcours, réglages…) → 5.7+.
- ❌ **Route/écran d'inscription** — jamais (PLAN §3.1).
- ❌ **Dépendance hors `next-auth@beta` + `argon2`**.

### Le vrai enjeu

Ne jamais stocker un mot de passe réversible et ne jamais offrir d'oracle d'énumération sur un back-office **public sur Internet**. Le compte est **unique et seedé** (pas d'inscription) : c'est un choix de surface d'attaque minimale. Ce socle est réutilisé tel quel par 5.2 (middleware) et étendu par 5.3-5.5 (2FA) — le poser proprement évite de tout retoucher ensuite.

### Testing standards

Pas de test automatisé (Playwright en Epic 7). Vérification **manuelle en local** (DB `docker-compose`) : login OK/KO (AC3/AC4), cookie durci (AC3), timing anti-énumération (AC4), idempotence du seed (AC2). tsc/lint/build verts, build reproductible sans DB.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.1]
- [Source: PLAN_REFONTE_2026.md §3.1 — Auth.js v5 Credentials, argon2id, cookie httpOnly/Secure/SameSite=Lax, compte seedé par ADMIN_EMAIL/ADMIN_PASSWORD (upsert idempotent), REGISTRATION_OPEN=false ; §2.1 — model User, enum Role { ADMIN } ; §9.4 — compte seedé démarre `totpEnabledAt = null`]
- [Source: apps/web/src/lib/db.ts — singleton Prisma, `server-only`, construction paresseuse (Proxy) pour un build reproductible sans DB]
- [Source: apps/web/prisma/seed.ts — seed idempotent par upsert (clé naturelle), bundlé en `seed.mjs` (build:seed) pour node en prod (story 4.6)]
- [Source: apps/web/prisma/schema.prisma — générateur `prisma-client` (output `../src/generated/prisma`), datasource sans `url` (Prisma 7)]
- [Source: memory prisma7-setup-gotchas — import client `@/generated/prisma/client`, `migrate dev` + `generate` avant seed, adapter-pg]
- [Source: AGENTS.md §5 — accès sécurisé avant écrans de gestion ; §6 — secrets par env, logique serveur ; §9 — zéro dépendance non prévue]

## Dev Agent Record

### Implementation Plan

Socle d'authentification par identifiants posé en réutilisant le socle Epic 4 sans le refaire : modèle `User` minimal + `enum Role`, seed idempotent argon2id, config Auth.js v5 dans un module réutilisable (`src/lib/auth.ts`), page `/login` en vue « bête » branchée sur une server action.

### Completion Notes

- **AC1 (User + argon2id)** : `model User` (email @unique, passwordHash, role, createdAt) + `enum Role { ADMIN }`, migration `20260724175003_add_user`. Mots de passe hachés **argon2id** (`type: argon2.argon2id`) au seed. Vérifié en base (local ET conteneur prod) : `passwordHash` commence par `$argon2id$` — jamais réversible, jamais en clair. Auth.js v5 en Credentials provider.
- **AC2 (seed idempotent, zéro inscription)** : `prisma.user.upsert` par `email`, hash réappliqué en `update` (propage un changement de `ADMIN_PASSWORD`). Re-seed 2× en local **et** redémarrage du conteneur → `User: 1` (aucun doublon). Aucune route/écran d'inscription (grep : uniquement des commentaires).
- **AC3 (session, cookie durci)** : session **JWT** (`strategy: "jwt"`), cookie `authjs.session-token` `HttpOnly` + `SameSite=Lax` vérifié via `set-cookie` (dev local ET conteneur). `Secure` : laissé à Auth.js (ajouté en HTTPS prod via Traefik, omis en dev HTTP — piège n°3, pas forcé en dur). `AUTH_SECRET` obligatoire.
- **AC4 (anti-énumération)** : message d'échec générique unique côté page (`"Identifiants invalides."`), **identique** que l'e-mail existe ou non ; l'URL `?error=CredentialsSignin` d'Auth.js n'est pas surfacée par la page (pas de leak). Parade timing : **dummy-verify** argon2id (hash factice réel, mêmes paramètres) quand l'e-mail est inconnu → temps mesurés **identiques** (~0.032s existant-mauvais vs inconnu).
- **Piège n°2 (argon2 natif en prod) — éprouvé concrètement** : le bundle inline de `build:seed` figeait le **chemin absolu macOS** de argon2 (`node-gyp-build` via `gypBuild(__dirname)`), donc **introuvable en linux prod**. Corrigé en **externalisant argon2** (`--external argon2`) et en copiant `node_modules/argon2` (avec ses prebuilds multi-plateformes, dont `linux-x64`/`linux-arm64` musl du conteneur Alpine) dans le standalone, **à côté de `pg`** (`/app/node_modules/argon2`). Validé en construisant l'image de production et en la lançant : `migrate deploy → seed (argon2id) → server` réussissent dans le conteneur linux.
- **Config Auth.js `trustHost: true`** ajoutée : sans elle, le conteneur derrière Traefik renvoyait `UntrustedHost` (l'hôte reçu est `0.0.0.0:3000`, pas le domaine public). Découvert et corrigé lors du test conteneur.
- **DoD** : `bunx tsc --noEmit` 0 erreur ; `bun run lint` 0 erreur (1 warning **préexistant** hors périmètre dans `TestimonialsClient.tsx`) ; `bun run build` OK **sans DATABASE_URL** (reproductible, piège n°6). `prisma/seed.mjs` (bundle généré, gitignoré) ajouté aux ignores ESLint.

### Debug Log

- `prisma.user is undefined` au 1er seed → `bunx prisma generate` explicite requis après la migration avant le seed (piège n°1). Résolu.
- Build image sans `--build-arg NEXT_PUBLIC_SITE_URL` → `TypeError: Invalid URL` sur `/_not-found` (préexistant : `layout.tsx` fait `new URL("")` car `?? ` ne rattrape pas la chaîne vide). Non lié à cette story ; l'image se construit avec le build-arg (comme en prod/Coolify).

## File List

**Nouveaux :**
- `apps/web/src/lib/auth.ts` — config Auth.js v5 (Credentials, JWT, cookie durci, anti-énumération, trustHost).
- `apps/web/src/app/api/auth/[...nextauth]/route.ts` — handlers GET/POST Auth.js.
- `apps/web/src/app/login/page.tsx` — page de connexion (Server Component, noindex).
- `apps/web/src/app/login/login-form.tsx` — formulaire client minimal (`useActionState`).
- `apps/web/src/app/login/actions.ts` — server action `loginAction` (signIn + message générique).
- `apps/web/prisma/migrations/20260724175003_add_user/migration.sql` — table `User` + type `Role`.

**Modifiés :**
- `apps/web/prisma/schema.prisma` — `model User` + `enum Role { ADMIN }`.
- `apps/web/prisma/seed.ts` — upsert admin idempotent argon2id + import argon2 + compteur User.
- `apps/web/package.json` — deps `next-auth`/`argon2` ; `build:seed` avec `--external argon2`.
- `apps/web/bun.lock` — lockfile.
- `apps/web/Dockerfile` — copie `argon2` dans le standalone (à côté de `pg`) pour le seed prod.
- `apps/web/eslint.config.mjs` — ignore `prisma/seed.mjs` (bundle généré).
- `apps/web/.env` — `ADMIN_EMAIL`/`ADMIN_PASSWORD`/`AUTH_SECRET` (dev local, gitignoré).

## Change Log

- 2026-07-24 — Story 5.1 implémentée : socle d'authentification par identifiants (Auth.js v5, argon2id, session JWT en cookie durci, compte admin seedé idempotent, zéro inscription). Validé en local et en conteneur de production (migrate → seed argon2id → login). Status → review.
