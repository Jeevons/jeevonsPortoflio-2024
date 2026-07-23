---
baseline_commit: a270747a2c1a628c60ee36e4697aede4f6558474
---

# Story 3.6: Vérifier automatiquement chaque contribution

Status: ready-for-dev

## Story

As **Jeevons**,
I want **qu'une intégration continue valide mon code à chaque poussée**,
so that **je détecte une régression avant qu'elle n'atteigne la production**.

## Acceptance Criteria

**AC1 — CI avec jobs `lint` et `build-web`, Bun et cache**
**Given** aucune intégration continue n'existe aujourd'hui
**When** **`.github/workflows/ci.yml`** est en place
**Then** les jobs **`lint`** et **`build-web`** s'exécutent sur **chaque poussée et chaque pull request visant `DEV` et `PROD`**
**And** **Bun 1.3** est installé via **`setup-bun@v2`**
**And** les dépendances sont **mises en cache** sur l'empreinte de **`apps/web/bun.lock`**

**AC2 — Un échec bloque la fusion et reste lisible**
**Given** un job échoue
**When** je consulte la pull request
**Then** la **fusion est bloquée** et la **cause de l'échec est lisible** dans le rapport

**AC3 — Aucun secret de déploiement côté GitHub**
**Given** la convention Doshwork exclut tout secret de déploiement côté GitHub
**When** j'inspecte les workflows
**Then** **aucun `deploy.yml` n'existe** et **aucun secret SSH n'est déclaré**
**And** le déploiement reste déclenché par le **webhook natif de Coolify**

> Le job `test-e2e` avec Playwright et l'audit d'accessibilité rejoignent ce workflow en Epic 7, une fois les tests écrits.

## Contexte d'implémentation

### 🛑 Prérequis : stories 3.1, 3.2 `done` ; idéalement 3.5

- Code sous `apps/web/`, gestionnaire = **Bun**, lockfile `apps/web/bun.lock`.
- La CI cible les branches **`DEV`** et **`PROD`** (AC1) — ce sont les noms **post-3.5**. Si 3.5 n'est **pas** encore faite (branches encore `develop`/`Production`), deux options : (a) faire 3.5 d'abord (recommandé, ordre epics.md) ; (b) écrire le workflow avec `DEV`/`PROD` et le rendre effectif au renommage — mais alors la CI ne se déclenchera pas tant que les branches n'existent pas. **Recommandation : 3.5 avant 3.6.**

### État actuel

- `.github/` contient uniquement des `agents/*.agent.md` (agents BMAD) — **aucun `workflows/`**, aucune CI.
- Aucun secret GitHub, aucun `deploy.yml` (et il doit le rester — AC3).
- Le déploiement se fait par **webhook Coolify** (stories 2.5/2.6) — inchangé (AC3).

### Cible (plan §5.5) — calquée sur Doshwork

`ci.yml` : jobs **`lint`** et **`build-web`**, `setup-bun@v2` (Bun **1.3**), cache `node_modules` sur `hashFiles('apps/web/bun.lock')`, déclenché sur `push` et `pull_request` vers `DEV` et `PROD`. **Pas de `deploy.yml`** (décision D8 : aucun secret SSH côté GitHub).

### Squelette de `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [DEV, PROD]
  pull_request:
    branches: [DEV, PROD]

jobs:
  lint:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: apps/web          # ⚠️ le code vit sous apps/web
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2            # AC1
        with:
          bun-version: "1.3"                  # AC1 — Bun 1.3
      - uses: actions/cache@v4                # AC1 — cache
        with:
          path: apps/web/node_modules
          key: bun-${{ hashFiles('apps/web/bun.lock') }}
      - run: bun install --frozen-lockfile
      - run: bun run lint

  build-web:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: apps/web
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: "1.3"
      - uses: actions/cache@v4
        with:
          path: apps/web/node_modules
          key: bun-${{ hashFiles('apps/web/bun.lock') }}
      - run: bun install --frozen-lockfile
      - run: bun run build
```

### ⚠️ Piège n°1 — `working-directory: apps/web` partout (monorepo)

Le `package.json` et `bun.lock` sont sous `apps/web/`. Sans `working-directory` (ou `--cwd`), `bun install` / `bun run` échouent à la racine. Le mettre sur **chaque job** via `defaults.run.working-directory`.

⚠️ **Le chemin du cache et du `hashFiles`** est en revanche **relatif à la racine du dépôt** (`apps/web/bun.lock`, `apps/web/node_modules`), **pas** au `working-directory`. Ne pas préfixer deux fois.

### ⚠️ Piège n°2 — `hashFiles('apps/web/bun.lock')` (AC1)

La clé de cache doit être l'**empreinte de `apps/web/bun.lock`** (AC1 littéral). Si le chemin est faux, `hashFiles` renvoie vide → clé de cache constante → cache jamais invalidé, ou toujours manquant. Vérifier que le chemin depuis la racine est exact.

### ⚠️ Piège n°3 — `setup-bun@v2` et la version « 1.3 » (AC1)

L'action officielle est **`oven-sh/setup-bun@v2`**. `bun-version: "1.3"` prend la dernière 1.3.x. AC1 dit « Bun 1.3 » (pas 1.3.3 précis ici, contrairement au Dockerfile) — `"1.3"` convient. Mettre les guillemets (sinon YAML interprète `1.3` comme un float et peut tronquer).

### ⚠️ Piège n°4 — Le lint ne doit pas échouer sur un warning pré-existant

`Testimonials.tsx` a un warning ESLint connu et **pré-existant** (documenté dans la story 2.3). Si `bun run lint` (= `next lint`) renvoie 0 sur les warnings mais non-zéro sur les erreurs, la CI passera. **Vérifier** le comportement : si un warning fait échouer le job, soit corriger le warning (hors périmètre strict → signaler), soit configurer le seuil. AGENTS.md §8 vise **0 warning** ; idéalement le warning est déjà traité par une story antérieure. **Documenter l'état** en Completion Notes.

### ⚠️ Piège n°5 — La CI bloquante = protection de branche, pas le workflow seul (AC2)

Le workflow **rapporte** un statut ; c'est la **protection de branche** (story 3.5) qui **bloque la fusion** quand le statut est rouge. Pour satisfaire l'AC2 « la fusion est bloquée » :
- Le workflow doit exister et produire un statut nommé (`lint`, `build-web`).
- Dans la protection de `PROD` (et `DEV`), cocher ces checks comme **requis** — action **[HUMAIN] GitHub** (recouvre l'AC3 de la story 3.5).
- ⚠️ Un check ne devient sélectionnable dans la protection **qu'après** s'être exécuté au moins une fois. Ordre : merger le workflow → laisser tourner une fois → cocher les checks requis.

### ⚠️ Piège n°6 — AC3 : ne rien ajouter d'interdit

- ❌ Aucun `deploy.yml`.
- ❌ Aucun secret dans le workflow (pas de `secrets.SSH_*`, pas de `DATABASE_URL`, etc.). Le build CI n'a **pas besoin** de secret : il ne déploie pas et `NEXT_PUBLIC_SITE_URL` peut être absent en CI (le build compile, le domaine réel est injecté au build Docker de prod, pas ici).
- Vérifier après coup : `grep -ri "secret\|ssh\|deploy" .github/workflows/` → rien de suspect.

## Tasks / Subtasks

- [ ] **Tâche 1 — Vérifier prérequis** (3.1, 3.2 `done` ; 3.5 recommandée)
  - [ ] Code sous `apps/web/`, `apps/web/bun.lock` présent. Confirmer les noms de branches cibles (`DEV`/`PROD`).
- [ ] **Tâche 2 — Écrire `.github/workflows/ci.yml`** (AC: 1, 3 ; pièges n°1, 2, 3, 6)
  - [ ] Déclencheurs `push` + `pull_request` sur `DEV` et `PROD`.
  - [ ] Jobs `lint` et `build-web`, `working-directory: apps/web`.
  - [ ] `oven-sh/setup-bun@v2` avec `bun-version: "1.3"`.
  - [ ] Cache sur `hashFiles('apps/web/bun.lock')`.
  - [ ] `bun install --frozen-lockfile` puis `bun run lint` / `bun run build`.
  - [ ] ❌ Aucun `deploy.yml`, aucun secret (AC3, piège n°6).
- [ ] **Tâche 3 — Vérifier le déclenchement et la lisibilité** (AC: 1, 2) — 🛑 **cœur de la story**
  - [ ] Ouvrir une PR de test vers `DEV` → les deux jobs se lancent et passent.
  - [ ] Introduire volontairement une erreur (lint ou build) → le job **échoue**, la cause est **lisible** dans le rapport de la PR (AC2). Puis annuler.
  - [ ] Vérifier que le **cache** est utilisé au 2ᵉ run (log « Cache restored »).
- [ ] **Tâche 4 — [HUMAIN] Rendre les checks bloquants** (AC: 2, piège n°5)
  - [ ] Jeevons : dans la protection de `PROD`/`DEV`, cocher `lint` et `build-web` comme checks requis (après un premier run). Recoupe la story 3.5.
- [ ] **Tâche 5 — Vérifier l'absence de secret/deploy** (AC: 3, piège n°6)
  - [ ] `ls .github/workflows/` → seul `ci.yml`. `grep -ri "ssh\|secret\|deploy" .github/workflows/` → rien.
  - [ ] Confirmer que le déploiement reste le **webhook Coolify** (inchangé).
- [ ] **Tâche 6 — Definition of Done** (AGENTS.md §8)
  - [ ] `bun run lint` · `bunx tsc --noEmit` · `bun run build` en local → verts (miroir de la CI).
  - [ ] `git diff` : uniquement `.github/workflows/ci.yml` (+ README si mention CI ajoutée).
  - [ ] `File List` + `Completion Notes` + `Change Log` remplis · `sprint-status.yaml` mis à jour.

## Dev Notes

### Périmètre — verrouillé

**Un fichier créé** : `.github/workflows/ci.yml` avec les jobs `lint` et `build-web`.

**Hors périmètre — ne pas faire :**
- ❌ **Ne pas ajouter `test-e2e` / Playwright / axe** → **Epic 7** (note explicite de l'epics.md sous la story 3.6).
- ❌ **Ne pas créer de `deploy.yml`** ni aucun secret (AC3). Le déploiement est et reste le webhook Coolify.
- ❌ **Ne pas ajouter de job de tests unitaires** : il n'y en a pas dans le projet, aucun n'est demandé.
- ❌ **Ne pas configurer la protection de branche dans le code** : c'est côté GitHub, [HUMAIN], et cela relève aussi de la story 3.5.
- ❌ **Ne pas toucher au code applicatif** — sauf, éventuellement, corriger le warning ESLint pré-existant s'il fait échouer la CI, et alors **le signaler** (piège n°4).

### Pourquoi `lint` + `build-web` seulement (pas de tests)

Le projet n'a pas encore de tests automatisés — ils arrivent en Epic 7 avec Playwright. À ce stade, la CI garantit ce qui est vérifiable : le **style/lint** et la **compilation**. C'est déjà le filet qui empêche une régression de build ou une faute de lint d'atteindre `PROD`. L'epics.md acte que `test-e2e` rejoindra ce workflow plus tard.

### La subtilité « bloquer la fusion »

Le workflow ne bloque rien à lui seul : il produit un statut. C'est la **protection de branche** qui transforme un statut rouge en fusion bloquée (AC2). D'où le chevauchement assumé avec la story 3.5, et l'étape [HUMAIN] de cochage des checks — impossible avant le premier run du workflow.

### Testing standards

Pas de test unitaire à écrire. La story se **teste elle-même** : ouvrir une PR, voir les jobs passer, casser volontairement un job pour vérifier l'échec lisible et le blocage, restaurer, confirmer le cache au run suivant.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.6 — jobs `lint`/`build-web`, `setup-bun@v2` Bun 1.3, cache sur `apps/web/bun.lock`, push/PR vers `DEV`/`PROD` ; note « test-e2e … en Epic 7 »]
- [Source: PLAN_REFONTE_2026.md §5.5 — « ci.yml calqué sur Doshwork : jobs lint, build-web, test-e2e … setup-bun@v2 (1.3), cache node_modules sur hashFiles('apps/web/bun.lock') … Pas de deploy.yml — webhook Coolify natif (D8 : aucun secret SSH côté GitHub) »]
- [Source: AGENTS.md §4 — « CI verte obligatoire dès que .github/workflows/ci.yml existe (story 3.6) » ; §8 — 0 warning lint, build succès]
- [Source: .github/ — aujourd'hui uniquement `agents/*.agent.md`, aucun `workflows/`]
- [Source: story 2.3 — warning ESLint pré-existant sur `Testimonials.tsx`]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

### Change Log

| Date | Description |
|------|-------------|
| 2026-07-23 | Story 3.6 créée — CI GitHub Actions (`lint`, `build-web`), Bun 1.3, cache bun.lock. |
