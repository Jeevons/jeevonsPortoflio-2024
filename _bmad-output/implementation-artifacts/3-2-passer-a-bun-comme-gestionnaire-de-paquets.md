---
baseline_commit: a270747a2c1a628c60ee36e4697aede4f6558474
---

# Story 3.2: Passer à Bun comme gestionnaire de paquets

Status: review

## Story

As **Jeevons**,
I want **gérer les dépendances avec Bun comme sur Doshwork**,
so that **j'aie un seul outil à connaître et des installations nettement plus rapides**.

## Acceptance Criteria

**AC1 — Bun remplace npm, lockfile versionné**
**Given** le projet utilise aujourd'hui npm et `package-lock.json`
**When** la migration est faite
**Then** **`apps/web/bun.lock` est versionné** et **`package-lock.json` supprimé**
**And** l'**installation, la construction, le lint et le démarrage passent tous par Bun**

**AC2 — Bun dans les étages Docker de build, absent en production**
**Given** le conteneur doit construire le projet
**When** j'inspecte le Dockerfile
**Then** **Bun 1.3.3** est installé dans les étages **`deps`**, **`builder`** et **`development`**
**And** l'étage **`production` reste dépourvu de Bun**

**AC3 — Image de production servie à l'identique**
**Given** l'image de production a changé de chaîne de construction
**When** je construis et démarre le conteneur
**Then** le **site est servi à l'identique** et le **healthcheck répond**

## Contexte d'implémentation

### 🛑 Prérequis : la story 3.1 doit être `done`

Cette story suppose le code déjà sous **`apps/web/`** et le Dockerfile déplacé dans **`apps/web/Dockerfile`**. Vérifier d'abord la présence de `apps/web/package.json`. Si le monorepo n'est pas en place → **s'arrêter**, la 3.1 vient d'abord (séquencement plan §6.4 : « migration monorepo → npm → Bun »).

### 🛑 Point de bascule critique de l'AGENTS.md

AGENTS.md §2 : **« Tant que l'Epic 3.2 n'est pas `done`, c'est npm et rien d'autre. »** Cette story est **l'événement** qui autorise Bun. Une fois `done`, tout le tooling bascule (`bun install`, `bun run build`, `bunx tsc`). Le tableau de migration AGENTS.md §1/§2 doit être cohérent après coup — mais **ne pas réécrire AGENTS.md ici** (hors périmètre), il décrit déjà l'état cible.

### État actuel

- `apps/web/package.json` avec scripts `dev/build/start/lint` en npm, `apps/web/package-lock.json` (~288 Ko).
- `apps/web/Dockerfile` : **4 étages sur `node:22-alpine`**, npm partout. Le commentaire en tête dit explicitement : *« npm partout : Bun n'est introduit qu'en story 3.2 »*. **C'est cette story qui le lève.**
- Les étages `deps`/`builder`/`development` font `npm ci` / `npm run build` / `npm run dev`. L'étage `production` fait `node server.js` sur le standalone — **sans npm ni Bun**, et cela doit le rester (AC2).

### Version cible : **Bun 1.3.3** (plan §5.1, AC2)

Épingler la version exacte, comme Doshwork. Ne pas prendre `latest`.

### ⚠️ Piège n°1 — Générer `bun.lock`, pas `bun.lockb` (AC1)

Bun 1.2+ génère par défaut un lockfile **texte** `bun.lock` (versionnable, lisible en diff). Les anciennes versions produisaient un binaire `bun.lockb`. L'AC1 exige `bun.lock` (texte). Vérifier qu'après `bun install` c'est bien `apps/web/bun.lock` qui apparaît. Si un `bun.lockb` binaire apparaît, la config Bun force l'ancien format → corriger.

```bash
cd apps/web
rm package-lock.json
bun install          # génère bun.lock
git add bun.lock
```

⚠️ **Supprimer `package-lock.json`** (AC1) — sinon deux lockfiles concurrents cohabitent, exactement le risque que l'AGENTS.md §2 met en garde.

### ⚠️ Piège n°2 — Installer Bun dans le Dockerfile sans casser `node` (AC2)

L'image de base reste **`node:22-alpine`** : on **ajoute** Bun, on ne remplace pas Node (le standalone Next tourne sous `node server.js` en production). Méthode Doshwork — image officielle Bun copiée dans l'étage, ou installation via le script officiel. L'approche la plus reproductible sur Alpine :

```dockerfile
# ---------- deps ----------
FROM node:22-alpine AS deps
WORKDIR /app
# Bun 1.3.3 — copié depuis l'image officielle (évite curl/unzip sur Alpine)
COPY --from=oven/bun:1.3.3 /usr/local/bin/bun /usr/local/bin/bun
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
```

Répliquer l'installation de Bun dans **`builder`** et **`development`** (AC2). Remplacer :
- `deps` : `npm ci` → `bun install --frozen-lockfile`
- `builder` : `npm run build` → `bun run build`
- `development` : `CMD ["npm","run","dev"]` → `CMD ["bun","run","dev"]`

⚠️ **`production` : NE PAS ajouter Bun** (AC2). Cet étage copie seulement le standalone et lance `node server.js`. Le laisser strictement inchangé.

> 💡 `--frozen-lockfile` (équivalent `npm ci`) garantit que le build échoue si `bun.lock` et `package.json` divergent — comportement voulu en CI/Docker.

### ⚠️ Piège n°3 — Le lockfile doit être copié AVANT `bun install` (cache Docker)

Comme pour npm, copier `package.json` **et** `bun.lock` avant `bun install` pour bénéficier du cache de couches Docker. Ne pas faire `COPY . .` avant l'install.

### ⚠️ Piège n°4 — Scripts `package.json` (AC1)

Les scripts `next dev/build/start/lint` sont **agnostiques** du gestionnaire : `bun run dev` exécute `next dev` sans changement. **Aucune réécriture des scripts n'est nécessaire.** Ne pas les toucher. La bascule est dans *comment on les appelle* (`bun run` au lieu de `npm run`), pas dans leur contenu.

### ⚠️ Piège n°5 — `.dockerignore` doit ignorer `bun.lock` ? Non.

`bun.lock` doit être **copié** dans l'image (piège n°2) : ne pas l'ajouter au `.dockerignore`. Vérifier que `node_modules` y est bien (il l'est déjà) pour forcer une install propre dans le conteneur.

## Tasks / Subtasks

- [x] **Tâche 1 — Vérifier le prérequis** (3.1 `done`)
  - [x] `apps/web/package.json` et `apps/web/Dockerfile` existent (monorepo en place, story 3.1 en `review`). Bun 1.3.3 déjà présent localement.
- [x] **Tâche 2 — Migrer le lockfile** (AC: 1, pièges n°1, 4)
  - [x] Depuis `apps/web/` : `package-lock.json` supprimé, `bun install` (541 packages, 2s).
  - [x] **`bun.lock`** (texte JSON, `lockfileVersion 1`) généré, pas de `bun.lockb`. Versionné.
  - [x] Scripts `package.json` inchangés (agnostiques du gestionnaire).
- [x] **Tâche 3 — Vérifier le tooling local passe par Bun** (AC: 1)
  - [x] `bun run build` → succès (8 routes) · `bun run lint` → 1 warning préexistant (Epic 1) · `bunx tsc --noEmit` → 0 erreur · `bun run dev` validé via conteneur (Tâche 5).
- [x] **Tâche 4 — Installer Bun 1.3.3 dans le Dockerfile** (AC: 2, pièges n°2, 3)
  - [x] Étages `deps`, `builder`, `development` : `COPY --from=oven/bun:1.3.3-alpine /usr/local/bin/bun /usr/local/bin/bun` (variante **alpine/musl** — cf. Debug Log).
  - [x] `deps` : `COPY package.json bun.lock ./` puis `bun install --frozen-lockfile`.
  - [x] `builder` : `bun run build`. `development` : `CMD ["bun","run","dev"]`.
  - [x] ❌ **Étage `production` : aucune trace de Bun** — vérifié (`which bun` → absent, cf. Tâche 5).
  - [x] Commentaire d'en-tête mis à jour (« npm partout » → « Bun dans deps/builder/development »).
- [x] **Tâche 5 — Vérifier l'image de production** (AC: 3) — 🛑 **cœur de la story**
  - [x] `docker compose -f docker-compose.prod.yml build` → succès via la chaîne Bun.
  - [x] Conteneur prod démarré (port 3001) → `curl http://localhost:3001/api/health` répond **200** `{"status":"ok"}` (AC3).
  - [x] Site servi à l'identique : `/` en 200, titre « Jeevons Eya — Développeur web » (AC3).
  - [x] `docker run ... which bun` sur l'image production → **absent** (seul `node v22`) (AC2).
- [x] **Tâche 6 — Definition of Done technique** (AGENTS.md §8)
  - [x] `bun run lint` · `bunx tsc --noEmit` · `bun run build` → verts.
  - [x] `git status` : `bun.lock` ajouté, `package-lock.json` supprimé, `Dockerfile` modifié.
  - [x] Diff relu : lockfile + Dockerfile uniquement. **Aucune modification de `src/`** (renames 3.1 toujours R100).
  - [x] `File List` + `Completion Notes` + `Change Log` remplis · `sprint-status.yaml` mis à jour.

## Dev Notes

### Périmètre — verrouillé

**Bascule du gestionnaire de paquets** : `package-lock.json` → `bun.lock`, et installation de Bun 1.3.3 dans les trois étages de build du Dockerfile.

**Hors périmètre — ne pas faire :**
- ❌ **Ne pas monter Next / React** → story 3.3. Les versions dans `package.json` restent 14.2.5 / 18.
- ❌ **Ne pas ajouter/retirer de dépendances** applicatives. Seul le gestionnaire change. `bun install` doit reproduire l'arbre existant.
- ❌ **Ne pas ajouter Bun à l'étage `production`** (AC2) — `node server.js` sur le standalone, sans gestionnaire de paquets.
- ❌ **Ne pas réécrire les scripts `package.json`** (piège n°4).
- ❌ **Ne pas créer de CI** → story 3.6 (elle installera Bun via `setup-bun@v2`).
- ❌ **Ne pas réécrire AGENTS.md** : il décrit déjà l'état cible post-3.2.

### Pourquoi Bun dans deps/builder/development mais pas production

`deps` installe, `builder` construit, `development` lance le serveur de dev — les trois ont besoin d'un gestionnaire de paquets. `production` ne fait que **servir** le standalone Next (`node server.js`) : y ajouter Bun alourdirait l'image sans usage, et la convention Doshwork (plan §5.1) l'interdit — l'étage de production reste minimal et non-root (`nextjs:nodejs`).

### Le risque en un mot

Le seul risque réel est **l'étage de production** : si un `bun install` ou un binaire Bun s'y glisse par copier-coller, l'AC2 tombe. Après la migration Docker, faire un `which bun` dans l'image de production pour prouver son absence.

### Testing standards

Pas de test automatisé. Vérification par **exécution réelle** du tooling Bun (install, build, lint, dev, tsc), **build de l'image de production** et **appel du healthcheck** `/api/health`. Absence de Bun en production vérifiée par `which bun` dans le conteneur.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.2]
- [Source: PLAN_REFONTE_2026.md §5.1 — « Base `node:22-alpine`, Bun 1.3.3 installé dans `deps`/`builder`/`development` ; `production` sans Bun : `node server.js` sur le standalone »]
- [Source: AGENTS.md §1/§2 — tableau npm → Bun 1.3+, « Tant que l'Epic 3.2 n'est pas `done`, c'est npm et rien d'autre »]
- [Source: apps/web/Dockerfile — 4 étages, commentaire « npm partout : Bun n'est introduit qu'en story 3.2 » à lever]
- [Source: docker-compose.prod.yml — healthcheck `wget -qO- http://127.0.0.1:3000/api/health` (story 2.5)]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code, dev-story workflow)

### Debug Log References

- **Binaire Bun incompatible Alpine (bug puis fix)** : le premier Dockerfile copiait Bun depuis `oven/bun:1.3.3` (image Debian/glibc). À l'exécution sur `node:22-alpine` (musl), échec `bun: not found` (exit 127) — le binaire glibc ne tourne pas sous musl. **Fix** : copier depuis `oven/bun:1.3.3-alpine` (binaire musl, `bun` en `/usr/local/bin/bun`). Les trois `COPY --from` mis à jour.
- **Volumes anonymes `node_modules` périmés (dev)** : après la migration, `docker compose up` lançait `bun run dev` → `next: not found`. Cause : le volume anonyme `/app/node_modules` persistait avec l'ancien contenu (tests npm de la 3.1) et masquait le `node_modules` de l'image Bun. **Résolution** : `docker compose down -v` recrée le volume depuis l'image → dev démarre (HTTP 200, `next dev` sous `bun`). ⚠️ **À retenir : au premier démarrage dev post-migration, faire `docker compose down -v` une fois.**
- **Postinstall bloqué** : `bun install` bloque le postinstall de `unrs-resolver@1.12.2` (tooling ESLint) par sécurité. Sans impact — lint, tsc et build fonctionnent. Non débloqué (aucune dépendance à ajouter/modifier, périmètre verrouillé).
- **Diffs git « inversés »** : comme la story 3.1 n'est pas encore committée, `git diff --cached` compare au HEAD racine (Dockerfile npm original) et affiche des diffs trompeurs. Le contenu **réel** du Dockerfile a été vérifié directement (`grep` : Bun dans deps/builder/dev, `node server.js` en prod).

### Completion Notes List

- Lockfile migré : `package-lock.json` supprimé, `apps/web/bun.lock` (texte JSON) versionné. `bun install` reproduit l'arbre existant (next@14.2.5, react@18.3.1 — versions inchangées, montée en 3.3).
- Dockerfile : Bun 1.3.3 (variante **alpine/musl**) installé dans `deps` (`bun install --frozen-lockfile`), `builder` (`bun run build`) et `development` (`CMD ["bun","run","dev"]`). Copie du lockfile **avant** l'install (cache Docker). Étage `production` strictement inchangé — `node server.js` sur le standalone, `which bun` confirme l'absence de Bun (AC2).
- Scripts `package.json` non touchés (agnostiques). `.dockerignore` non modifié (`bun.lock` doit être copié, `node_modules` déjà ignoré).
- Validations réelles : `bun run build`/`lint`/`tsc` verts ; image prod construite via la chaîne Bun ; healthcheck `/api/health` → 200 `{"status":"ok"}` ; rendu identique ; `which bun` absent en prod ; dev démarre sous Bun (après recréation du volume).
- 🧾 **Rappel dette (héritée de 3.1, non corrigée)** : `layout.tsx` fait `new URL(NEXT_PUBLIC_SITE_URL)` sans couvrir la chaîne vide — le build prod exige `NEXT_PUBLIC_SITE_URL` défini. Inchangé par cette story.

### File List

**Ajouté :**
- `apps/web/bun.lock` — lockfile Bun (texte)

**Supprimé :**
- `apps/web/package-lock.json` — lockfile npm

**Modifié :**
- `apps/web/Dockerfile` — Bun 1.3.3-alpine dans `deps`/`builder`/`development` ; `production` inchangé ; commentaire d'en-tête mis à jour

### Change Log

| Date | Description |
|------|-------------|
| 2026-07-23 | Story 3.2 créée — migration npm → Bun 1.3.3. |
| 2026-07-23 | Migration npm → Bun 1.3.3 réalisée : `package-lock.json` → `bun.lock`, Bun (alpine/musl) installé dans les 3 étages de build du Dockerfile, `production` sans Bun. Build/lint/tsc + image prod + healthcheck validés. Corrigé : variante alpine du binaire Bun ; documenté : `down -v` requis au 1er dev. |
