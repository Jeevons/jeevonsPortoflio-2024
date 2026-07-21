---
baseline_commit: 114e59ae411fb8e261e2351aca4a8fc3b9b3adab
---

# Story 1.3: Ouvrir les liens externes sans risque

Status: review

## Story

As a **visiteur du portfolio**,
I want **que les liens vers les projets et les réseaux sociaux s'ouvrent correctement dans un nouvel onglet**,
so that **je puisse les explorer sans perdre le portfolio et sans exposer ma session à la page ouverte**.

## Acceptance Criteria

**AC1 — La faute de frappe `_blanck` est corrigée**
**Given** `src/sections/Footer.tsx:34` porte aujourd'hui `target="_blanck"`
**When** je clique sur un lien de réseau social
**Then** le lien s'ouvre dans un nouvel onglet
**And** aucune occurrence de `_blanck` ne subsiste dans le code

**AC2 — Tout lien en nouvel onglet porte `rel="noopener noreferrer"`**
**Given** les liens de `src/sections/Projects.tsx:88` et `src/sections/SelfProject.tsx:116` portent `target="_blank"` sans attribut `rel`
**When** j'inspecte ces liens
**Then** chacun porte `rel="noopener noreferrer"`
**And** tout lien du site ouvrant un nouvel onglet porte cet attribut, sans exception

## Contexte d'implémentation

### État actuel — inventaire exhaustif (vérifié par `grep -rn 'target=' src/`)

| Fichier | Ligne | État actuel | Action |
|---|---|---|---|
| `src/sections/Footer.tsx` | 34 | `target="_blanck"` — **aucun `rel`** | → `target="_blank" rel="noopener noreferrer"` |
| `src/sections/Projects.tsx` | 88 | `target="_blank"` — aucun `rel` | → ajouter `rel="noopener noreferrer"` |
| `src/sections/SelfProject.tsx` | 116 | `target="_blank"` — aucun `rel` | → ajouter `rel="noopener noreferrer"` |
| `src/sections/About.tsx` | 112 | ✅ déjà `target="_blank" rel="noopener noreferrer"` | **ne pas toucher** |

**Il n'y a que 4 liens `target` dans tout `src/`. Trois à corriger, un déjà conforme.**

### Pourquoi `_blanck` ouvre quand même un onglet

`_blanck` n'est pas une valeur réservée : le navigateur la traite comme un **nom de fenêtre**. Résultat : les quatre liens du Footer se **partagent le même onglet** — cliquer sur LinkedIn puis GitHub réutilise l'onglet déjà ouvert au lieu d'en créer un nouveau. C'est le bug réel à corriger, pas seulement une faute d'orthographe.

### Pourquoi `rel="noopener noreferrer"`

`noopener` empêche la page ouverte d'accéder à `window.opener` (attaque *tabnabbing* : la page cible peut réécrire l'onglet d'origine). `noreferrer` supprime l'en-tête `Referer`. AGENTS.md §6 l'impose : « `target="_blank"` **toujours** accompagné de `rel="noopener noreferrer"` ».

## Tasks / Subtasks

- [x] **Tâche 1 — Corriger le Footer** (AC: 1, 2)
  - [x] `src/sections/Footer.tsx:34` : remplacer `target="_blanck"` par `target="_blank"` et ajouter `rel="noopener noreferrer"` sur la même balise `<a>`.
- [x] **Tâche 2 — Sécuriser les liens de projets** (AC: 2)
  - [x] `src/sections/Projects.tsx:88` : ajouter `rel="noopener noreferrer"` sur le `<a>`.
  - [x] `src/sections/SelfProject.tsx:116` : ajouter `rel="noopener noreferrer"` sur le `<a>`.
- [x] **Tâche 3 — Vérification exhaustive** (AC: 1, 2)
  - [x] `grep -rn '_blanck' src/` → **0 résultat**.
  - [x] `grep -rn 'target=' src/` → **4 résultats, tous accompagnés de `rel="noopener noreferrer"`**.
  - [x] Vérifier sur le HTML de production après `npm run build` : chaque `target="_blank"` rendu est suivi d'un `rel`.
- [x] **Tâche 4 — Definition of Done technique** (AGENTS.md §8)
  - [x] `npm run lint` → aucun **nouveau** warning (le warning préexistant `Testimonials.tsx:78` reste, il est tracé dans `deferred-work.md`).
  - [x] `npx tsc --noEmit` → 0 erreur.
  - [x] `npm run build` → succès.
  - [x] `git diff develop` relu : **3 fichiers**, uniquement des attributs de balise `<a>`.

## Dev Notes

### Périmètre — verrouillé

Trois fichiers, uniquement des **attributs HTML**. Aucune logique, aucune classe CSS, aucune dépendance.

**Hors périmètre — ne pas faire :**
- ❌ **Ne pas corriger l'imbrication `<button>` dans `<a>`** de `Projects.tsx:88-93` et `SelfProject.tsx:116-121`. C'est un vrai bug HTML, mais il appartient à la **story 1.4**. Tu vas voir ce code en éditant la ligne 88 — **laisse-le tel quel**. Ne fusionne pas les deux stories (AGENTS.md §9 : « Une story, rien qu'une story, toute la story »).
- ❌ Ne pas factoriser `Projects.tsx` / `SelfProject.tsx` (~90 % de code dupliqué) → **story 3.7**. Appliquer la même correction deux fois est ici le comportement **attendu**.
- ❌ Ne pas toucher à `About.tsx:112` : déjà conforme.
- ❌ Ne pas ajouter de dépendance, ni de lint rule (`react/jsx-no-target-blank` est déjà dans `eslint-config-next` mais ne se déclenche pas ici car ces `<a>` n'ont pas de `href` littéral analysable).

### Convention pour la suite

Tout nouveau lien externe du projet s'écrit :
```tsx
<a href={url} target="_blank" rel="noopener noreferrer">
```

### Testing standards

Aucune infrastructure de test à ce stade (Playwright arrive à l'Epic 7). Vérification par `grep` sur les sources **et** inspection du HTML généré par `npm run build` — même protocole que les stories 1.1 et 1.2.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.3]
- [Source: AGENTS.md#6 — Standards de qualité du code, règle « Liens sortants »]
- [Source: PLAN_REFONTE_2026.md — règles D1/D2 (quick wins P0)]
- [Source: src/sections/Footer.tsx:34] · [Source: src/sections/Projects.tsx:88] · [Source: src/sections/SelfProject.tsx:116]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

- `grep -rn '_blanck' src/` → 0 résultat
- `grep -rn 'target=' src/` → 4 résultats, tous suivis de `rel="noopener noreferrer"`
- `npx tsc --noEmit` → 0 erreur
- `npm run lint` → 1 warning **préexistant** (`Testimonials.tsx:78`, tracé en dette), aucun nouveau
- `npm run build` → succès, 5/5 pages statiques
- HTML de production (`.next/server/app/index.html`) → 10 occurrences de `target="_blank"`, **toutes** accompagnées de `rel="noopener noreferrer"`

### Completion Notes List

- **AC1 satisfait** : `Footer.tsx:34` corrigé de `target="_blanck"` en `target="_blank"`. Le bug réel n'était pas orthographique : `_blanck` était traité comme un *nom de fenêtre*, donc les 4 liens sociaux se partageaient le même onglet. Ils ouvrent désormais chacun un onglet distinct.
- **AC2 satisfait** : `rel="noopener noreferrer"` ajouté sur les 3 liens qui en manquaient (`Footer.tsx`, `Projects.tsx`, `SelfProject.tsx`). `About.tsx:112` était déjà conforme et n'a pas été touché.
- Périmètre strictement respecté : **uniquement des attributs de balise `<a>`**, aucune logique, aucune classe CSS, aucune dépendance.
- Hors périmètre volontairement laissé en l'état : l'imbrication `<button>` dans `<a>` de `Projects.tsx` / `SelfProject.tsx` (→ story 1.4), la duplication entre les deux fichiers (→ story 3.7).
- Le formatage multi-lignes des `<a>` de `Projects.tsx` / `SelfProject.tsx` suit le style Prettier du projet ; le contenu du lien est inchangé.

### File List

- `src/sections/Footer.tsx` (modifié)
- `src/sections/Projects.tsx` (modifié)
- `src/sections/SelfProject.tsx` (modifié)

### Change Log

- 2026-07-21 — Correction de `target="_blanck"` en `target="_blank"` dans le Footer et ajout de `rel="noopener noreferrer"` sur les trois liens externes qui en étaient dépourvus (Story 1.3).
