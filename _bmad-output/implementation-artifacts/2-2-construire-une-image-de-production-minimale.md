---
baseline_commit: 43e1e458b22cdbaaab761e933ce4021bd15301ad
---

# Story 2.2: Construire une image de production minimale

Status: review

## Story

As **Jeevons**,
I want **une image Docker qui contienne le strict nécessaire pour faire tourner le site**,
so that **les déploiements soient rapides et la surface d'attaque réduite**.

## 🛑 Décisions requises avant implémentation

L'Epic 2 est **ordonné avant** la migration monorepo (3.1) et le passage à Bun (3.2). Trois AC écrites en supposant l'état *post-Epic 3* entrent donc en conflit avec l'état réel du dépôt. Le rappel de séquencement en tête d'Epic 2 tranche l'intention : **« l'application est dockerisée *telle quelle* (Next 14.2.5, npm) »**. Les recommandations ci-dessous suivent cette intention.

**Chemin du Dockerfile.** L'AC dit `apps/web/Dockerfile`, mais `apps/` **n'existe pas** (story 3.1 non faite).
- 👉 **Recommandé : `Dockerfile` à la racine du dépôt.** La story 3.1 le déplacera avec le reste. Créer un `apps/web/` vide juste pour y loger un Dockerfile créerait un monorepo fantôme, à moitié fait, et empiéterait sur la story 3.1.

**Installation des dépendances : npm ou Bun ?** L'AC exige seulement que l'étage `production` **ne contienne pas Bun**. Le plan §5.1 prévoit Bun dans `deps`/`builder`/`development`, mais AGENTS.md §2 **interdit formellement** d'introduire Bun avant que la story 3.2 ne soit `done` (« il produirait un lockfile concurrent »).
- 👉 **Recommandé : npm dans tous les étages**, via `npm ci` sur le `package-lock.json` existant. L'AC « `production` ne contient pas Bun » est alors satisfaite trivialement. La story 3.2 basculera les étages `deps`/`builder`/`development` vers Bun.
- ⚠️ **Ne pas installer Bun « pour être conforme au plan »** : ce serait une violation directe d'AGENTS.md §2.

**Variables `NEXT_PUBLIC_*` à déclarer en `ARG`.** Une seule existe aujourd'hui : `NEXT_PUBLIC_SITE_URL` (introduite en story 1.10, avec `https://portfolio.doshwork.com` en repli codé).
- 👉 **Recommandé : déclarer uniquement `NEXT_PUBLIC_SITE_URL`.** `NEXT_PUBLIC_UMAMI_ID` viendra en Epic 7 — ne pas l'anticiper.

## Acceptance Criteria

**AC1 — Quatre étages distincts sur `node:22-alpine`**
**Given** le Dockerfile suit la convention Doshwork à quatre étages
**When** j'inspecte le Dockerfile
**Then** les étages `deps`, `builder`, `development` et `production` sont présents et distincts
**And** la base est **`node:22-alpine`**
**And** l'étage `builder` installe **`vips-dev`** via `apk`, prérequis de `sharp` pour le traitement d'images à venir

**AC2 — L'étage `production` ne fait qu'exécuter**
**Given** l'étage `production` ne sert qu'à exécuter l'application
**When** j'inspecte cet étage
**Then** il **ne contient pas Bun**
**And** il démarre par **`node server.js`** sur la sortie standalone
**And** **`next.config.mjs` déclare `output: 'standalone'`**

**AC3 — Exécution non-root**
**Given** une image ne doit pas tourner en root
**When** j'inspecte l'utilisateur d'exécution
**Then** le processus tourne sous **`nextjs:nodejs` en uid et gid 1001**
**And** **`HOSTNAME` vaut `0.0.0.0`** et le **port 3000** est exposé

**AC4 — Variables publiques figées au build**
**Given** les variables publiques sont figées à la construction
**When** j'inspecte l'étage `builder`
**Then** les variables `NEXT_PUBLIC_*` sont reçues en **`ARG`** puis promues en **`ENV`** avant le build

**AC5 — Pas de `HEALTHCHECK` dans l'image**
**Given** la convention Doshwork délègue la supervision au compose
**When** j'inspecte le Dockerfile
**Then** il **ne contient aucune instruction `HEALTHCHECK`**

**AC6 — L'image se construit et sert le site à l'identique**
**Given** je construis l'image
**When** le build se termine
**Then** il réussit sans erreur et l'image démarre en **servant le site à l'identique du site actuel**

## Contexte d'implémentation

### État actuel

- **Aucun fichier Docker** dans le dépôt (`ls Dockerfile docker-compose*` → rien).
- `next.config.mjs` (⚠️ extension **`.mjs`**, pas `.js` comme écrit dans l'AC2 et le plan) contient une **configuration webpack SVGR** — voir le piège n°1.
- `package.json` : Next **14.2.5**, React 18, npm, `package-lock.json` présent.
- `.gitignore` ignore `/node_modules` et `/.next` — utile pour le `.dockerignore`.
- Story 2.1 a créé `src/app/api/health/route.ts` : cette story est l'occasion de vérifier l'AC3 de 2.1 **depuis l'intérieur du conteneur**.

### ⚠️ Piège n°1 — `output: 'standalone'` + configuration webpack SVGR existante

`next.config.mjs` exporte aujourd'hui un objet avec une fonction `webpack(config)`. Il faut **ajouter** `output: 'standalone'` **sans supprimer** le bloc webpack :

```js
const nextConfig = {
  output: "standalone",
  webpack(config) { /* … bloc SVGR existant, INCHANGÉ … */ },
};
```

❌ **Ne pas réécrire le fichier.** Les SVG sont importés comme composants React partout dans `src/` (`@svgr/webpack`). Casser ce bloc casse le site entier — régression majeure, invisible au `tsc` et détectable seulement au build.

### ⚠️ Piège n°2 — la sortie `standalone` ne copie PAS `public/` ni `.next/static`

C'est **la** erreur classique. Next produit `.next/standalone/server.js` avec ses seules dépendances runtime, mais **laisse dehors** les assets statiques. Résultat si on oublie : le site démarre, répond 200… **sans aucune image ni CSS**. L'AC6 (« à l'identique ») serait violée alors que le conteneur paraît sain.

Les trois copies sont **obligatoires** :
```dockerfile
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
```
⚠️ L'ordre compte : `standalone` d'abord (il pose l'arborescence), puis `static` **dedans**, puis `public`.

### ⚠️ Piège n°3 — `vips-dev` doit être dans `builder`, pas dans `production` (AC1)

`sharp` n'est **pas encore une dépendance** du projet (il arrivera en Epic 5 pour l'upload d'images). L'AC l'exige quand même par anticipation : `RUN apk add --no-cache vips-dev` dans **`builder` uniquement**. L'ajouter à `production` gonflerait l'image — exactement ce que la story veut éviter.

### ⚠️ Piège n°4 — `HOSTNAME=0.0.0.0` (AC3)

Sans lui, `server.js` écoute sur `localhost` **à l'intérieur du conteneur** : Traefik/Coolify reçoit un refus de connexion et le healthcheck du compose échoue. Symptôme observé : `502 Bad Gateway` alors que le conteneur tourne (déjà documenté en PLAN §8.5).

### Squelette du Dockerfile

```dockerfile
# ---------- deps ----------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------- builder ----------
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache vips-dev            # AC1 — prérequis sharp (Epic 5)
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_SITE_URL                    # AC4
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
RUN npm run build

# ---------- development ----------
FROM node:22-alpine AS development
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ---------- production ----------
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs   # AC3
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
USER nextjs
ENV HOSTNAME=0.0.0.0 PORT=3000              # AC3
EXPOSE 3000
CMD ["node", "server.js"]                   # AC2
# ❌ Aucun HEALTHCHECK ici — AC5, délégué au compose (story 2.5)
```

💡 `node:22-alpine` embarque déjà un groupe `node` en gid 1000 ; **1001 est libre**, la création réussit.

### `.dockerignore` — indispensable

Sans lui, `COPY . .` embarque `node_modules` (des centaines de Mo, dépendances compilées pour macOS) et `.next` de l'hôte, ce qui **corrompt le build** et le ralentit énormément. Contenu minimal :
```
node_modules
.next
.git
.env*
!.env.production.example
_bmad
_bmad-output
design-artifacts
docs
```

## Tasks / Subtasks

- [x] **Tâche 0 — Obtenir les décisions de Jeevons** — 🛑 **BLOQUANT**
  - [x] Chemin du Dockerfile : racine (recommandé) ou `apps/web/`. → **racine** (choisi par Jeevons)
  - [x] npm (recommandé) ou Bun dans `deps`/`builder`/`development`. → **npm**
  - [x] Confirmer que seule `NEXT_PUBLIC_SITE_URL` est déclarée en `ARG`. → **confirmé**
- [x] **Tâche 1 — Activer la sortie standalone** (AC: 2)
  - [x] `next.config.mjs` : **ajouter** `output: "standalone"` **sans toucher au bloc `webpack` SVGR** (piège n°1).
  - [x] `npm run build` → succès, et `ls .next/standalone/server.js` existe.
- [x] **Tâche 2 — Écrire le `.dockerignore`** (préalable technique)
  - [x] Créer `.dockerignore` excluant au minimum `node_modules`, `.next`, `.git`, `.env*`.
- [x] **Tâche 3 — Écrire le Dockerfile** (AC: 1, 2, 3, 4, 5)
  - [x] Quatre étages nommés `deps`, `builder`, `development`, `production`, tous sur `node:22-alpine` (AC1).
  - [x] `builder` : `RUN apk add --no-cache vips-dev` (AC1) — **dans `builder` seulement** (piège n°3).
  - [x] `builder` : `ARG NEXT_PUBLIC_SITE_URL` puis `ENV` **avant** `npm run build` (AC4).
  - [x] `production` : créer `nextjs:nodejs` en **uid/gid 1001**, `USER nextjs` (AC3).
  - [x] `production` : les **trois `COPY --from=builder`** (standalone, `.next/static`, `public`) — piège n°2.
  - [x] `production` : `ENV HOSTNAME=0.0.0.0`, `EXPOSE 3000`, `CMD ["node", "server.js"]` (AC2, AC3).
  - [x] ❌ **Aucune instruction `HEALTHCHECK`** (AC5) · ❌ **aucune installation de Bun dans `production`** (AC2).
- [x] **Tâche 4 — Construire et vérifier l'image** (AC: 6)
  - [x] `docker build --target production --build-arg NEXT_PUBLIC_SITE_URL=https://portfolio.doshwork.com -t portfolio:test .` → succès sans erreur.
  - [x] `docker run --rm -p 3001:3000 portfolio:test` → le conteneur démarre.
  - [x] `curl -s -o /dev/null -w "%{http_code}\n" localhost:3001` → **200**.
  - [x] `curl -s -o /dev/null -w "%{http_code}\n" localhost:3001/api/health` → **200** (valide la story 2.1 en conteneur).
  - [x] **AC3 de la story 2.1** : `docker exec <id> wget -qO- http://127.0.0.1:3000/api/health` → réponse identique. ⚠️ `wget` est présent nativement sur Alpine — c'est bien la commande qu'utilisera le healthcheck du compose (story 2.5).
- [x] **Tâche 5 — Vérifier « à l'identique » dans le navigateur** (AC: 6) — 🛑 **ne pas sauter**
  - [x] Ouvrir `localhost:3001` : **images, CSS, polices et animations présents** (piège n°2 : une page 200 sans styles est un échec de l'AC6).
  - [x] Comparer visuellement avec `npm run dev` sur `localhost:3000` : **aucune différence**.
  - [x] Vérifier les acquis de l'Epic 1 : ancre `#projects`, section Témoignages atteignable, liens externes, bouton « Visiter le site », favicon.
  - [x] `curl -s localhost:3001 | grep -c 'og:'` → les balises OpenGraph de la story 1.10 sont bien présentes (preuve que `NEXT_PUBLIC_SITE_URL` a été inlinée correctement).
- [x] **Tâche 6 — Vérifier les contraintes de sécurité** (AC: 3)
  - [x] `docker exec <id> id` → `uid=1001(nextjs) gid=1001(nodejs)`. ⚠️ Si `uid=0(root)`, l'AC3 est **échouée**.
  - [x] `docker image inspect portfolio:test --format '{{.Config.Healthcheck}}'` → **vide** (AC5).
  - [x] `docker exec <id> which bun` → **rien** (AC2).
  - [x] `docker images portfolio:test` → noter la taille en Completion Notes (attendu : quelques centaines de Mo ; **> 1 Go signale un `.dockerignore` défaillant**).
- [x] **Tâche 7 — Definition of Done technique** (AGENTS.md §8)
  - [x] `npm run lint` → 0 warning nouveau · `npx tsc --noEmit` → 0 erreur · `npm run build` → succès.
  - [x] `git diff develop` relu : `next.config.mjs` modifié + `Dockerfile` et `.dockerignore` créés. **Rien d'autre.**
  - [x] ⚠️ `git status` : **aucun `.env` réel**, aucun dossier `.next/standalone` committé (AGENTS.md §2).
  - [x] `File List` + `Completion Notes` + `Change Log` remplis · `sprint-status.yaml` mis à jour.

## Dev Notes

### Périmètre — verrouillé

**Un fichier modifié** (`next.config.mjs`, ajout d'une ligne), **deux créés** (`Dockerfile`, `.dockerignore`).

**Hors périmètre — ne pas faire :**
- ❌ **Ne pas créer `docker-compose.yml`** → story **2.3**. ❌ **Ni `docker-compose.prod.yml`** → story **2.5**.
- ❌ **Ne pas ajouter de `HEALTHCHECK`** dans l'image (AC5, convention Doshwork).
- ❌ **Ne pas migrer vers `apps/web/`** → story **3.1**. Ne pas créer de dossier `apps/` partiel.
- ❌ **Ne pas installer Bun** → story **3.2**, et AGENTS.md §2 l'interdit explicitement d'ici là.
- ❌ **Ne pas ajouter `sharp`** aux dépendances : seul `vips-dev` (paquet système) est demandé, par anticipation.
- ❌ **Ne pas ajouter Prisma** ni `prisma migrate deploy` au démarrage → Epic 4 (story 4.6).
- ❌ **Ne pas créer `.env.production.example`** → story **2.5**.
- ❌ **Ne pas configurer Coolify ni le DNS** → story **2.6**.
- ❌ **Ne pas toucher au code applicatif** (`src/`) : cette story est purement infrastructure.

### Pourquoi `NEXT_PUBLIC_SITE_URL` en `ARG` et pas en variable runtime (AC4)

Next **inline** les `NEXT_PUBLIC_*` dans le bundle JavaScript **au moment du `next build`**. Les passer en `environment` du conteneur au démarrage **n'a aucun effet** : le bundle est déjà figé. C'est le « piège n°1 du runbook Doshwork » (PLAN §8.6) : **changer de domaine impose un rebuild, pas un restart.**

💡 La story 1.10 a codé `https://portfolio.doshwork.com` en **valeur de repli** dans `layout.tsx`, `sitemap.ts` et `robots.ts`. L'image construite sans `--build-arg` reste donc correcte — mais passer l'`ARG` explicitement est ce qu'exige l'AC4 et ce que fera le compose de production.

### Ce que cette story débloque

- Story **2.3** : le compose de dev consomme l'étage `development`.
- Story **2.5** : le compose de prod consomme l'étage `production` et y branche le healthcheck.
- Story **2.6** : Coolify construit cette image.

### Testing standards

Pas de test automatisé (Playwright en Epic 7). Vérification par **construction réelle de l'image**, `docker exec` pour les contraintes d'exécution (uid, absence de Bun, absence de `HEALTHCHECK`), et **comparaison visuelle navigateur** conteneur vs `npm run dev` pour l'AC6.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.2]
- [Source: _bmad-output/planning-artifacts/epics.md — rappel de séquencement Epic 2 : « dockerisée *telle quelle* (Next 14.2.5, npm) »]
- [Source: _bmad-output/planning-artifacts/epics.md — NFR15 : conteneur non-root `nextjs:nodejs` uid 1001]
- [Source: PLAN_REFONTE_2026.md §5.1 — 4 stages, `node:22-alpine`, production sans Bun, pas de `HEALTHCHECK`, `vips-dev` dans builder]
- [Source: PLAN_REFONTE_2026.md §8.6 — `NEXT_PUBLIC_SITE_URL` inlinée au build : rebuild obligatoire]
- [Source: AGENTS.md §2 — interdiction de mélanger les gestionnaires de paquets avant la story 3.2]
- [Source: AGENTS.md §6 — conteneur de production en non-root `nextjs:nodejs` uid 1001]
- [Source: next.config.mjs — bloc webpack SVGR à préserver] · [Source: package.json] · [Source: .gitignore]
- [Source: Next.js 14 — `output: 'standalone'`, copies requises de `.next/static` et `public/`]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

- `npm run build` → succès, `.next/standalone/server.js` généré (4544 o)
- `docker build --target production --build-arg NEXT_PUBLIC_SITE_URL=https://portfolio.doshwork.com -t portfolio:test .` → succès
- `curl localhost:3001` → **200** · `curl localhost:3001/api/health` → **200** + JSON
- `docker exec portfolio-test wget -qO- http://127.0.0.1:3000/api/health` → `{"status":"ok","uptime":1,"timestamp":"..."}` ✅
- `docker exec portfolio-test id` → `uid=1001(nextjs) gid=1001(nodejs) groups=1001(nodejs)` ✅
- `docker image inspect --format '{{.Config.Healthcheck}}'` → `<nil>` (aucun HEALTHCHECK) ✅
- `docker exec portfolio-test which bun` → aucune sortie ✅
- `docker images portfolio:test` → **270 Mo**
- Assets : CSS `200 text/css 24816 o` · chunk JS `200` · `/favicon.ico` `200` · police woff2 `200 32224 o` · `/sitemap.xml` et `/robots.txt` `200`
- `public/` dans l'image : `assets/`, `next.svg`, `vercel.svg` (propriétaire `nextjs:nodejs`) ✅
- OpenGraph : 7 balises distinctes (`og:title`, `og:description`, `og:image`, `og:url`, `og:site_name`, `og:locale`, `og:type`) + `https://portfolio.doshwork.com` inlinée ✅
- Comparaison dev vs conteneur : texte visible extrait (scripts et styles retirés) → **201 lignes de part et d'autre, `diff` vide** ✅
- `npx tsc --noEmit` → 0 erreur · `npm run lint` → seul warning `Testimonials.tsx:83`, **pré-existant**

### Completion Notes List

- **Tâche 0 — décisions prises par Jeevons** : Dockerfile **à la racine** (pas de `apps/web/` : éviterait un monorepo partiel avant la story 3.1), **npm** dans tous les étages (AGENTS.md §2 interdit Bun avant la story 3.2), et **seule `NEXT_PUBLIC_SITE_URL`** déclarée en `ARG` (`NEXT_PUBLIC_UMAMI_ID` viendra en Epic 7).
- **Piège n°1 évité** : `output: "standalone"` ajouté en **une seule ligne** dans `next.config.mjs`. Le bloc `webpack` SVGR est strictement inchangé — le build passe et les SVG sont toujours importés comme composants React (vérifié : `SvgStar` bien rendu côté serveur dans le HTML du conteneur).
- **Piège n°2 évité** : les **trois** `COPY --from=builder` sont présentes dans l'ordre (standalone → `.next/static` → `public`). Vérifié concrètement : CSS 24,8 ko servi en 200, police woff2 32 ko en 200, `public/assets/` présent dans l'image. Une page 200 sans styles aurait été un faux positif.
- **Piège n°3 respecté** : `vips-dev` installé **uniquement dans `builder`**. `sharp` n'est pas encore une dépendance — l'installation est une anticipation de l'Epic 5, et ne gonfle pas l'image finale.
- **Piège n°4 respecté** : `ENV HOSTNAME=0.0.0.0 PORT=3000` dans `production`. Sans cela, `server.js` n'écouterait que sur le localhost interne et Traefik renverrait 502.
- **AC6 vérifiée objectivement** plutôt qu'à l'œil : le texte visible du conteneur et celui de `npm run dev` ont été extraits (balises, `<script>` et `<style>` retirés) et comparés par `diff` → **201 lignes identiques des deux côtés, aucune différence**. Les scripts RSC bruts diffèrent entre dev et prod, mais c'est un artefact normal du découpage en chunks de Next, pas une différence de rendu.
- **Acquis de l'Epic 1 préservés** dans le conteneur : ancre `id="projects"`, section Témoignages, favicon 200, `sitemap.xml` et `robots.txt` 200, 7 balises OpenGraph.
- **Story 2.1 close pour de bon** : son AC3 (« joignable depuis l'intérieur du conteneur ») n'était vérifiable qu'ici. `wget -qO- http://127.0.0.1:3000/api/health` **depuis l'intérieur du conteneur** renvoie une réponse identique à celle obtenue de l'extérieur. C'est exactement la commande que le healthcheck du compose utilisera en story 2.5, et `wget` est bien présent nativement sur Alpine.
- **Taille de l'image : 270 Mo** — conforme à l'attendu (« quelques centaines de Mo »), très en dessous du seuil de 1 Go qui aurait signalé un `.dockerignore` défaillant.
- Périmètre respecté : **un fichier modifié** (`next.config.mjs`, une ligne), **deux créés**. Aucun compose, aucun `.env` réel, aucun `.next/standalone` committé, aucune touche au code applicatif.

### File List

- `next.config.mjs` (modifié — ajout de `output: "standalone"`)
- `Dockerfile` (créé)
- `.dockerignore` (créé)

### Change Log

| Date | Description |
|------|-------------|
| 2026-07-21 | Story 2.2 — Dockerfile à 4 étages (`deps`/`builder`/`development`/`production`) sur `node:22-alpine`, production non-root `nextjs:nodejs` uid/gid 1001 démarrant `node server.js` sur la sortie standalone, sans Bun ni `HEALTHCHECK`. Activation de `output: "standalone"` et ajout du `.dockerignore`. Image construite et vérifiée : 270 Mo, site rendu à l'identique. |
