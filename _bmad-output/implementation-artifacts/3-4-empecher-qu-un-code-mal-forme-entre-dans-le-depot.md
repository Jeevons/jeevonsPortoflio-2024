---
baseline_commit: a270747a2c1a628c60ee36e4697aede4f6558474
---

# Story 3.4: Empêcher qu'un code mal formé entre dans le dépôt

Status: ready-for-dev

## Story

As **Jeevons**,
I want **que le formatage et le lint s'appliquent automatiquement à chaque commit**,
so that **je ne relise jamais de diff pollué par des questions de style**.

## Acceptance Criteria

**AC1 — Prettier, husky et lint-staged en place sur les fichiers modifiés**
**Given** le projet n'a aujourd'hui ni Prettier ni crochets Git
**When** la configuration est en place
**Then** **Prettier, husky et lint-staged sont installés et configurés**
**And** un commit déclenche le **formatage et le lint des seuls fichiers modifiés**

**AC2 — commitlint impose les conventional commits**
**Given** les messages de commit doivent rester lisibles dans l'historique
**When** je rédige un message qui ne respecte pas la convention
**Then** **commitlint rejette le commit** avec un message explicite
**And** un message conforme aux conventional commits est accepté

**AC3 — Formatage initial isolé dans son propre commit**
**Given** la base de code n'a jamais été formatée
**When** j'applique le formatage initial
**Then** il fait l'objet d'un **commit isolé, distinct de tout changement fonctionnel**

## Contexte d'implémentation

### 🛑 Prérequis : stories 3.1 et 3.2 `done`

Code sous `apps/web/`, gestionnaire = **Bun**. Installation des outils via `bun add -d`. Les crochets Git husky s'installent **à la racine du dépôt** (où vit `.git/`), pas dans `apps/web/`.

### 🛑 Point d'architecture : monorepo → où vivent les outils

Le dépôt est un **monorepo** : `.git/` est à la racine, le code applicatif dans `apps/web/`. Conséquence :
- **husky** (crochets Git) → **racine** (`.husky/` à côté de `.git/`).
- **commitlint** → **racine** (les messages de commit sont globaux au dépôt).
- **Prettier + lint-staged** → peuvent vivre à la racine ou dans `apps/web/`. **Décision recommandée** (à confirmer avec Jeevons si doute) : config Prettier à la racine pour couvrir tout le dépôt, lint-staged ciblant `apps/web/`.

⚠️ Un `package.json` **racine** minimal est probablement nécessaire pour héberger husky/commitlint/lint-staged et le hook `prepare`. Vérifier d'abord s'il en existe déjà un (la 3.1 n'en a pas forcément créé). Si absent, en créer un minimal (`{ "private": true, "devDependencies": {...} }`) — **et le signaler à Jeevons**, car c'est un ajout de structure.

### État actuel (D13 du plan)

- **Aucun** Prettier, **aucun** husky/lint-staged/commitlint. `apps/web/.eslintrc.json` étend `next/core-web-vitals` uniquement.
- La base de code **n'a jamais été formatée** → l'AC3 anticipe un premier passage Prettier volumineux, qui doit être **isolé**.

### Versions cibles

Aligner sur Doshwork (plan §5.6) : **Prettier 3**, **husky 9**, **lint-staged 15/16**, **@commitlint/cli + @commitlint/config-conventional**. Épingler des versions récentes stables.

### ⚠️ Piège n°1 — L'ordre des commits est un critère d'acceptation (AC3)

L'AC3 est **explicite** : le formatage initial doit être un **commit isolé**. La séquence correcte :

1. Installer et configurer les outils (Prettier + config, husky, lint-staged, commitlint) → **commit 1** : `chore(tooling): ajoute Prettier, husky, lint-staged et commitlint`.
2. Lancer `prettier --write` sur toute la base → **commit 2 isolé** : `style: formatage initial Prettier`.

⚠️ **Ne jamais mélanger** le formatage de masse avec la config dans un seul commit : le diff deviendrait illisible, exactement ce que la story cherche à éviter. Le commit de formatage ne contient **que** des changements de style (espaces, guillemets, retours à la ligne), zéro changement de logique.

> 💡 Le type de commit `style:` est celui des conventional commits pour le formatage — cohérent avec commitlint qu'on vient d'installer.

### ⚠️ Piège n°2 — husky 9 : la nouvelle syntaxe des hooks

husky **v9** a changé la manière d'écrire les hooks (plus de `husky add`, plus de shebang boilerplate). Le hook `.husky/pre-commit` ne contient qu'une ligne :
```sh
bunx lint-staged
```
Et `.husky/commit-msg` :
```sh
bunx commitlint --edit "$1"
```
Le script `prepare: "husky"` dans le `package.json` racine installe les hooks après `bun install`.

⚠️ **Rendre les hooks exécutables** (`chmod +x .husky/*`) — sinon Git les ignore silencieusement et le commit passe sans contrôle, faux positif dangereux.

### ⚠️ Piège n°3 — lint-staged ne doit toucher QUE les fichiers modifiés (AC1)

Configuration lint-staged (dans le `package.json` racine ou `.lintstagedrc`) :
```json
{
  "apps/web/**/*.{ts,tsx,js,jsx,json,css,md}": ["prettier --write"],
  "apps/web/**/*.{ts,tsx}": ["bash -c 'cd apps/web && bun run lint'"]
}
```
L'AC1 exige « les **seuls** fichiers modifiés ». lint-staged passe la liste des fichiers stagés aux commandes — ne pas écrire une commande qui relint tout le projet.

⚠️ **Piège dans le piège** : `next lint` (le `bun run lint`) ne prend pas facilement une liste de fichiers arbitraire en argument. Deux options : (a) laisser lint-staged formater avec Prettier sur les fichiers stagés, et lancer `eslint` directement (pas `next lint`) sur la liste ; (b) accepter un `bun run lint` global dans le hook. **Option (a) recommandée** pour respecter strictement « seuls les fichiers modifiés ». Documenter le choix en Completion Notes.

### ⚠️ Piège n°4 — commitlint config (AC2)

`commitlint.config.js` (ou `.commitlintrc.json`) à la racine :
```js
export default { extends: ["@commitlint/config-conventional"] };
```
Cela impose les types `feat|fix|chore|docs|style|refactor|perf|test|build|ci`. **Vérifier activement l'AC2** : tenter un commit `mauvais message` → rejeté ; `feat(hero): test` → accepté. AGENTS.md §4 utilise déjà ces conventions (`feat(hero):`, `fix(footer):`, etc.) — la config doit les accepter.

### ⚠️ Piège n°5 — Prettier vs ESLint : éviter le conflit

ESLint (`next/core-web-vitals`) et Prettier peuvent se marcher dessus sur les règles de style. Ne **pas** ajouter `eslint-plugin-prettier` (anti-pattern perf). Si des conflits apparaissent, ajouter `eslint-config-prettier` en dernier dans les `extends` d'ESLint pour **désactiver** les règles de style d'ESLint que Prettier gère. Créer un `.prettierrc` explicite (même minimal) pour figer le style.

⚠️ Ajouter un `.prettierignore` excluant `node_modules`, `.next`, `bun.lock`, `package-lock.json`, `_bmad-output`, les assets binaires.

## Tasks / Subtasks

- [ ] **Tâche 1 — Vérifier prérequis + structure racine** (3.1, 3.2 `done`)
  - [ ] Code sous `apps/web/`, Bun actif. Vérifier/créer le `package.json` racine minimal (signaler à Jeevons si création).
- [ ] **Tâche 2 — Installer et configurer les outils** (AC: 1, 2 ; pièges n°2, 4, 5) → **commit 1**
  - [ ] `bun add -d prettier husky lint-staged @commitlint/cli @commitlint/config-conventional eslint-config-prettier` (à la racine).
  - [ ] `.prettierrc` + `.prettierignore` (piège n°5).
  - [ ] `commitlint.config.js` (piège n°4).
  - [ ] Script `prepare: "husky"` + `bun install` pour installer les hooks.
  - [ ] `.husky/pre-commit` → `bunx lint-staged` ; `.husky/commit-msg` → `bunx commitlint --edit "$1"` ; `chmod +x` (piège n°2).
  - [ ] Config lint-staged ciblant `apps/web/**` (piège n°3).
  - [ ] **Commit isolé** : `chore(tooling): ...` — **sans** le formatage de masse.
- [ ] **Tâche 3 — Formatage initial** (AC: 3, piège n°1) → **commit 2 isolé**
  - [ ] `bunx prettier --write "apps/web/**/*.{ts,tsx,js,jsx,json,css,md}"` (+ fichiers racine pertinents).
  - [ ] Vérifier que le diff ne contient **que** du style (aucun changement de logique).
  - [ ] **Commit séparé** : `style: formatage initial Prettier`.
- [ ] **Tâche 4 — Vérifier les crochets** (AC: 1, 2) — 🛑 **cœur de la story**
  - [ ] Modifier un fichier en y ajoutant du désordre de style, `git commit` → lint-staged **reformate** avant le commit (AC1).
  - [ ] Vérifier que seuls les fichiers **modifiés** sont touchés (AC1, piège n°3).
  - [ ] `git commit -m "message invalide"` → **rejeté** par commitlint (AC2).
  - [ ] `git commit -m "test(tooling): message conforme"` → **accepté** (AC2).
- [ ] **Tâche 5 — Definition of Done technique** (AGENTS.md §8)
  - [ ] `bun run lint` · `bunx tsc --noEmit` · `bun run build` → verts (le formatage ne doit rien casser).
  - [ ] `git log --oneline -3` : le commit de config et le commit de formatage sont **bien séparés** (AC3).
  - [ ] `File List` + `Completion Notes` + `Change Log` remplis · `sprint-status.yaml` mis à jour.

## Dev Notes

### Périmètre — verrouillé

**Mise en place du tooling de qualité** : Prettier + husky + lint-staged + commitlint, **plus** un commit de formatage initial isolé.

**Hors périmètre — ne pas faire :**
- ❌ **Ne pas créer la CI GitHub Actions** → story 3.6. Les crochets sont **locaux** ; la CI est le filet distant.
- ❌ **Ne pas renommer les branches ni configurer la protection** → story 3.5.
- ❌ **Ne pas corriger de bugs ni refactorer** pendant le commit de formatage (AC3) — style **uniquement**.
- ❌ **Ne pas changer les règles ESLint métier** : on ajoute seulement `eslint-config-prettier` pour désactiver les conflits de style.
- ❌ **Ne pas ajouter d'autres outils** (Biome, Stylelint…) non prévus par le plan.

### Pourquoi le formatage initial isolé (AC3)

La base n'a jamais été formatée : le premier `prettier --write` va toucher **presque tous** les fichiers. Si ce diff massif se mélange à la config, plus personne ne peut relire quoi que ce soit — et c'est précisément la pollution de diff que la story combat. Un commit `style:` isolé rend l'historique honnête : « voici la config », puis « voici le grand reformatage, zéro logique ».

### Le monorepo complique l'installation

Le seul vrai piège structurel : husky/commitlint vivent **à la racine** (près de `.git/`), le code dans `apps/web/`. Il faut probablement un `package.json` racine pour héberger le hook `prepare` et les devDeps de tooling. C'est un ajout de structure — le **signaler** à Jeevons plutôt que de le glisser en douce.

### Testing standards

Pas de test automatisé. Vérification par **manipulation réelle de commits** : un commit avec du style désordonné doit être reformaté ; un message non conventionnel doit être rejeté ; un message conforme accepté. La séparation des deux commits se vérifie par `git log`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.4]
- [Source: PLAN_REFONTE_2026.md §5.6 — « Ajouter husky + lint-staged + commitlint (conventional commits), déjà présents chez Doshwork »]
- [Source: PLAN_REFONTE_2026.md D13 — « Pas de prettier, pas de husky/lint-staged/commitlint (Doshwork les a) »]
- [Source: AGENTS.md §4 — commits conventionnels `feat(hero):`, `fix(footer):`, `chore(docs):`, etc.]
- [Source: apps/web/.eslintrc.json — `next/core-web-vitals`]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

### Change Log

| Date | Description |
|------|-------------|
| 2026-07-23 | Story 3.4 créée — Prettier + husky + lint-staged + commitlint, formatage initial isolé. |
