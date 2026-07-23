---
baseline_commit: a270747a2c1a628c60ee36e4697aede4f6558474
---

# Story 3.1: Réorganiser le projet en monorepo

Status: review

## Story

As **Jeevons**,
I want **que le code du site vive dans `apps/web` selon la même structure que Doshwork**,
so that **je raisonne de la même façon sur mes deux projets et que la place reste libre pour d'autres applications**.

## Acceptance Criteria

**AC1 — Le code applicatif vit sous `apps/web`, historique préservé**
**Given** le code est aujourd'hui à la racine du dépôt
**When** la réorganisation est faite
**Then** le code applicatif vit sous **`apps/web`**
**And** l'**historique Git des fichiers déplacés est préservé** (`git log --follow` retrouve les commits antérieurs)

**AC2 — Build et dev fonctionnent, site identique**
**Given** le projet a été déplacé
**When** je lance la construction et le serveur de développement
**Then** les deux fonctionnent et le **site est identique à avant**
**And** les chemins de configuration du **Dockerfile** et des **fichiers de composition** ont été mis à jour en conséquence

## Contexte d'implémentation

### 🛑 Cette story est une **manipulation Git**, pas une réécriture de code

L'objectif est de **déplacer** des fichiers, pas d'en modifier le contenu applicatif. Le seul contenu qui change est celui des **fichiers d'infrastructure** qui référencent des chemins (Dockerfile, composes, `.dockerignore`, `.gitignore`, `next.config.mjs` si besoin). Aucune ligne de logique React ne doit être réécrite.

### État actuel — ce qui est à la racine aujourd'hui

Racine du dépôt (à déplacer vers `apps/web/`) :
- `src/` (app, components, sections, assets, api)
- `public/`
- `package.json`, `package-lock.json`
- `next.config.mjs`, `postcss.config.mjs`, `tailwind.config.ts`, `tsconfig.json`, `next-env.d.ts`
- `.eslintrc.json`

Racine du dépôt (**reste à la racine** — niveau monorepo) :
- `Dockerfile` → **déplacé** vers `apps/web/Dockerfile` (voir plan §2 : `apps/web/Dockerfile`)
- `docker-compose.yml`, `docker-compose.prod.yml` → **restent à la racine** (plan §2)
- `.env.production.example`, `.dockerignore` (voir piège n°4)
- `.github/`, `README.md`, `AGENTS.md`, `PLAN_REFONTE_2026.md`
- `_bmad/`, `_bmad-output/`, `design-artifacts/`, `docs/`

### Structure cible (plan §2)

```
jeevonsPortoflio-2024/
├── docker-compose.yml           # reste à la racine
├── docker-compose.prod.yml      # reste à la racine
├── .env.production.example
├── README.md
├── apps/
│   └── web/
│       ├── src/
│       ├── public/
│       ├── package.json
│       ├── package-lock.json
│       ├── next.config.mjs
│       ├── postcss.config.mjs
│       ├── tailwind.config.ts
│       ├── tsconfig.json
│       ├── next-env.d.ts
│       ├── .eslintrc.json
│       ├── Dockerfile
│       └── .dockerignore
```

> ℹ️ Le plan §2 prévoit à terme `apps/web/prisma/` et un découpage `(site)`/`(admin)` — **ce n'est PAS cette story**. On déplace l'existant tel quel, rien de plus.

### ⚠️ Piège n°1 — Préserver l'historique Git (AC1)

Utiliser **`git mv`** et non un déplacement Finder/`mv` suivi d'un `git add`. `git mv` enregistre le renommage ; Git suit alors les fichiers avec `git log --follow`.

```bash
mkdir -p apps/web
git mv src apps/web/src
git mv public apps/web/public
git mv package.json apps/web/
git mv package-lock.json apps/web/
git mv next.config.mjs apps/web/
git mv postcss.config.mjs apps/web/
git mv tailwind.config.ts apps/web/
git mv tsconfig.json apps/web/
git mv next-env.d.ts apps/web/
git mv .eslintrc.json apps/web/
git mv Dockerfile apps/web/Dockerfile
git mv .dockerignore apps/web/.dockerignore
```

✅ **Vérifier** après coup : `git log --follow apps/web/src/sections/Hero.tsx` doit remonter aux commits de l'Epic 1.

> 💡 Git détecte souvent les renommages automatiquement même avec un `mv` brut, **mais ne pas parier dessus** : `git mv` est explicite et sûr. L'AC1 en fait une exigence dure.

### ⚠️ Piège n°2 — Les alias `@/*` et le `tsconfig` (AC2)

`tsconfig.json` déclare `"paths": { "@/*": ["./src/*"] }` — chemin **relatif au tsconfig**. Comme `tsconfig.json` et `src/` se déplacent **ensemble** dans `apps/web/`, l'alias reste correct **sans modification**. Ne pas le « corriger » : `./src/*` reste juste.

### ⚠️ Piège n°3 — Chemins dans le Dockerfile (AC2)

Le `Dockerfile` déplacé dans `apps/web/` aura son **contexte de build changé**. Deux options selon la cohérence avec les composes :

- Soit le Dockerfile reste conçu pour un contexte = `apps/web` (les `COPY package.json ...` fonctionnent tels quels).
- Le `docker-compose.prod.yml` actuel contient déjà le commentaire **« Pas ./apps/web : le monorepo arrive en story 3.1 »** avec `context: .`. **C'est cette story qui lève ce commentaire.**

Mettre à jour dans **les deux composes** :
```yaml
build:
  context: ./apps/web    # au lieu de "."
  target: development     # (ou production côté prod)
  # supprimer le commentaire « Pas ./apps/web : le monorepo arrive en story 3.1 »
```

⚠️ Le `docker-compose.yml` de dev monte `.:/app` pour le hot reload → devient **`./apps/web:/app`**. Les volumes anonymes `/app/node_modules` et `/app/.next` restent inchangés.

⚠️ Le `docker-compose.prod.yml` déclare `NEXT_PUBLIC_SITE_URL` en `args` : le conserver, seul le `context` change.

### ⚠️ Piège n°4 — `.dockerignore` et son emplacement

Le `.dockerignore` est **résolu relativement au contexte de build**. En déplaçant le contexte vers `apps/web/`, le `.dockerignore` doit vivre dans `apps/web/` (d'où le `git mv` ci-dessus). Son contenu actuel exclut `node_modules`, `.next`, `.git`, `_bmad`, `_bmad-output`, `design-artifacts`, `docs` — **certaines de ces entrées** (`_bmad`, `design-artifacts`, `docs`, `.git`) sont désormais **au-dessus** du contexte `apps/web` et n'ont plus lieu d'y figurer. Le simplifier pour ne garder que ce qui vit sous `apps/web` :
```
node_modules
.next
.env*
!.env.production.example
```

### ⚠️ Piège n°5 — Où lancer les commandes désormais

Après migration, `npm install` / `npm run build` / `npm run lint` se lancent **depuis `apps/web/`** (le `package.json` y est). Documenter ce changement dans le README (voir tâche 5). L'AGENTS.md §1 anticipe déjà cette bascule (« Emplacement du code : racine → `apps/web/` »).

## Tasks / Subtasks

- [x] **Tâche 1 — Créer `apps/web/` et déplacer avec `git mv`** (AC: 1)
  - [x] `mkdir -p apps/web`
  - [x] `git mv` de `src`, `public`, `package.json`, `package-lock.json`, `next.config.mjs`, `postcss.config.mjs`, `tailwind.config.ts`, `tsconfig.json`, `.eslintrc.json`, `Dockerfile`, `.dockerignore` (piège n°1). `next-env.d.ts` déplacé via `mv` brut (git-ignoré, cf. Debug Log).
  - [x] ❌ **Ne pas** déplacer `docker-compose*.yml`, `README.md`, `.env.production.example`, `.github/` → restent à la racine.
  - [x] Vérifier historique : 78 renames enregistrés en `R100` (identiques). `git log --follow` remontera à l'Epic 1 dès le commit (cf. Debug Log).
- [x] **Tâche 2 — Mettre à jour les fichiers de composition** (AC: 2, piège n°3)
  - [x] `docker-compose.yml` : `context: ./apps/web`, montage `./apps/web:/app`.
  - [x] `docker-compose.prod.yml` : `context: ./apps/web`, **commentaire supprimé** « Pas ./apps/web… ».
  - [x] Conservés : `target`, `args NEXT_PUBLIC_SITE_URL`, healthcheck, réseaux, volumes anonymes.
- [x] **Tâche 3 — Adapter `.dockerignore`** (piège n°4)
  - [x] Réduit aux entrées pertinentes sous `apps/web` (`node_modules`, `.next`, `.env*`, exception `.env.production.example`).
- [x] **Tâche 4 — Vérifier build et dev** (AC: 2) — 🛑 **cœur de la story**
  - [x] Depuis `apps/web/` : `npm install`, `npm run build` → succès (8 routes générées), site identique.
  - [x] `docker compose build` puis `docker compose up` → les deux services démarrent, HTTP 200 sur `/`, `/api/health` = `ok`, titre correct, montage `./apps/web:/app` vérifié.
  - [x] `docker compose -f docker-compose.prod.yml build` → l'image de production se construit avec le nouveau contexte (avec `NEXT_PUBLIC_SITE_URL` défini ; cf. dette signalée).
  - [x] **Comparaison** : titre, health et rendu identiques à avant.
- [x] **Tâche 5 — Mettre à jour la documentation des chemins** (piège n°5)
  - [x] README : section « Démarrage » ajustée — `npm run *` depuis `apps/web/`, `docker compose up` depuis la racine.
  - [x] README non réécrit — seule la section « Démarrage » touchée.
- [x] **Tâche 6 — Definition of Done technique** (AGENTS.md §8)
  - [x] `npm run lint` (1 warning préexistant Epic 1, hors périmètre) · `npx tsc --noEmit` (0 erreur) · `npm run build` (succès) depuis `apps/web/`.
  - [x] `git status` : 78 fichiers en `renamed:` (`R100`), pas supprimés+ajoutés.
  - [x] Diff relu : uniquement déplacements + ajustements chemins (composes, `.dockerignore`, README, `.gitignore`). **Aucune modif de logique dans `src/`** (78 renames R100).
  - [x] `File List` + `Completion Notes` + `Change Log` remplis · `sprint-status.yaml` mis à jour.

## Dev Notes

### Périmètre — verrouillé

**Déplacement** de l'arborescence applicative vers `apps/web/` + **ajustement des chemins** dans `docker-compose.yml`, `docker-compose.prod.yml`, `.dockerignore` et `README.md`.

**Hors périmètre — ne pas faire :**
- ❌ **Ne pas migrer vers Bun** → story 3.2. On reste en npm, `package-lock.json` déplacé tel quel.
- ❌ **Ne pas monter Next 16 / React 19** → story 3.3. Versions inchangées.
- ❌ **Ne pas créer `apps/web/prisma/`** ni les groupes de routes `(site)`/`(admin)` → Epics 4-5. On déplace l'existant à l'identique.
- ❌ **Ne pas ajouter d'espace de travail Bun/npm workspaces** (`workspaces` dans un `package.json` racine) → non demandé par la story ; un seul `package.json` sous `apps/web` suffit. Si Doshwork en a un, le répliquer **seulement** si Jeevons le valide.
- ❌ **Ne pas toucher au contenu de `src/`** : aucune correction, aucun refactor. La factorisation `Projects`/`SelfProject` est la story 3.7.
- ❌ **Ne pas renommer de branches** → story 3.5.

### Pourquoi cette réorganisation d'abord

Le plan §2 fixe le monorepo `apps/web` comme socle : elle **précède** les montées de version (3.2, 3.3) pour que Bun, Next 16 et, plus tard, Prisma s'installent directement au bon endroit — et évite un second déplacement une fois les versions montées. AGENTS.md §1 documente déjà cette cible.

### Le piège Docker en un mot

Tout le risque de cette story est dans **le contexte de build Docker** : `context: .` (racine) devient `context: ./apps/web`. Si on oublie, l'image copie tout le monorepo (BMAD, docs, design-artifacts) au lieu du seul code applicatif, et les `COPY package.json` échouent. Les deux composes **doivent** être mis à jour ensemble.

### Testing standards

Pas de test automatisé. Vérification par **build réel** (`npm run build` + `docker compose build`) et **comparaison visuelle** avant/après du site rendu. La préservation de l'historique se vérifie par `git log --follow`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.1]
- [Source: PLAN_REFONTE_2026.md §2 — architecture cible monorepo : `apps/web/{src,Dockerfile,.dockerignore}`, `docker-compose.yml` et `docker-compose.prod.yml` à la racine]
- [Source: AGENTS.md §1 tableau de migration — « Emplacement du code : racine (`src/`) → `apps/web/` »]
- [Source: docker-compose.prod.yml — commentaire « Pas ./apps/web : le monorepo arrive en story 3.1 » à lever]
- [Source: tsconfig.json — alias `@/*` → `./src/*`, relatif au tsconfig, préservé par le déplacement conjoint]
- [Source: Dockerfile · docker-compose.yml · .dockerignore — chemins à ajuster]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code, dev-story workflow)

### Debug Log References

- **`next-env.d.ts` git-ignoré** : `.gitignore` ignore `next-env.d.ts` et `*.tsbuildinfo`. Le `git mv next-env.d.ts` prévu par la story aurait échoué → déplacé via `mv` brut. Sans impact sur l'historique (fichier généré par Next au build).
- **`git log --follow` et le commit** : Git ne traverse un renommage avec `--follow` qu'**une fois le renommage committé**. Avant commit, l'index enregistre bien les 78 renames en `R100` (`git diff --cached --name-status -M`), et l'historique antérieur reste accessible via l'ancien chemin (`git log -- src/sections/Hero.tsx` remonte à `43e1e45`, `49eee0a`). L'AC1 sera donc satisfaite dès le commit.
- **Faux négatif build prod** : `docker compose -f docker-compose.prod.yml build` a d'abord échoué (`TypeError: Invalid URL` dans `layout.tsx:21`) car mon shell ne définissait pas `NEXT_PUBLIC_SITE_URL` → le compose la passait vide, et `new URL("")` lève. Avec `NEXT_PUBLIC_SITE_URL=https://portfolio.doshwork.com` (cas réel Coolify), l'image se construit. **Bug préexistant du code Epic 1, indépendant de cette story** (le fallback `?? "..."` ne couvre pas la chaîne vide, seulement `undefined`). Voir dette ci-dessous.
- **Résidus racine** : `node_modules/` et `tsconfig.tsbuildinfo` (git-ignorés) restaient à la racine après le déplacement → supprimés. Recréés sous `apps/web/` par `npm install`.

### Completion Notes List

- Arborescence applicative déplacée sous `apps/web/` via `git mv` (78 fichiers, tous `R100` — aucune modification de contenu). Historique Git préservé.
- Contexte de build Docker migré de `.` vers `./apps/web` dans les deux composes ; montage dev `./apps/web:/app` ; volumes anonymes `/app/node_modules` et `/app/.next` conservés. Le `Dockerfile` (déplacé dans `apps/web/`) fonctionne sans modification (ses `COPY` sont relatifs au contexte).
- `.dockerignore` déplacé dans `apps/web/` et réduit aux entrées vivant sous ce contexte.
- **`.gitignore` racine ajusté** (hors liste explicite de la story, mais requis) : les patterns ancrés `/node_modules` et `/.next/` ne couvraient plus les sous-dossiers du monorepo → dé-ancrés en `node_modules` / `.next/` pour ignorer aussi `apps/web/`. Sans ce correctif, `apps/web/node_modules` et `apps/web/.next` seraient devenus committables (régression grave évitée).
- Validations : `npm run build` OK (8 routes), `npx tsc --noEmit` 0 erreur, `npm run lint` 1 warning préexistant. `docker compose up` → site en HTTP 200, `/api/health` = `ok`. `docker compose -f docker-compose.prod.yml build` OK avec `NEXT_PUBLIC_SITE_URL` défini.
- **🧾 Dette technique signalée (hors périmètre 3.1)** : `apps/web/src/app/layout.tsx:21` fait `new URL(siteUrl)` où `siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://..."`. Le fallback ne se déclenche pas sur chaîne vide → build prod cassé si la variable est définie mais vide. À traiter dans une story dédiée (durcir le fallback : `|| "https://..."` ou validation). N'a pas été corrigé ici car la story verrouille toute modification de `src/`.

### File List

**Renommés (git mv, R100 — extraits représentatifs des 78) :**
- `src/` → `apps/web/src/` (tout le code applicatif : app, components, sections, assets, api)
- `public/` → `apps/web/public/`
- `package.json`, `package-lock.json` → `apps/web/`
- `next.config.mjs`, `postcss.config.mjs`, `tailwind.config.ts`, `tsconfig.json`, `.eslintrc.json` → `apps/web/`
- `Dockerfile` → `apps/web/Dockerfile`
- `.dockerignore` → `apps/web/.dockerignore`

**Déplacé hors Git (mv brut, git-ignoré) :**
- `next-env.d.ts` → `apps/web/next-env.d.ts`

**Modifiés (contenu) :**
- `docker-compose.yml` — `context: ./apps/web`, montage `./apps/web:/app`
- `docker-compose.prod.yml` — `context: ./apps/web`, commentaire « Pas ./apps/web… » supprimé
- `apps/web/.dockerignore` — réduit aux entrées sous `apps/web`
- `README.md` — section « Démarrage » : chemins `apps/web/`
- `.gitignore` — patterns dépendances/build dé-ancrés pour le monorepo

### Change Log

| Date | Description |
|------|-------------|
| 2026-07-23 | Story 3.1 créée — réorganisation en monorepo `apps/web`. |
| 2026-07-23 | Code applicatif déplacé sous `apps/web/` via `git mv` (78 renames R100, historique préservé). Contexte Docker migré vers `./apps/web` dans les deux composes ; `.dockerignore` et README ajustés ; `.gitignore` dé-ancré pour le monorepo. Build dev + prod et rendu du site validés. Dette signalée : `new URL()` sur `NEXT_PUBLIC_SITE_URL` vide dans `layout.tsx`. |
