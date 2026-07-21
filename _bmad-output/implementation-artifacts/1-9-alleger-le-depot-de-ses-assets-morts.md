---
baseline_commit: 114e59ae411fb8e261e2351aca4a8fc3b9b3adab
---

# Story 1.9: Alléger le dépôt de ses assets morts

Status: review

## Story

As a **Jeevons**,
I want **que mon dépôt ne transporte plus les fichiers de CV inutilisés**,
so that **les clones et les builds soient rapides et que le dépôt reste sain**.

## Acceptance Criteria

**AC1 — Les fichiers inutilisés sont supprimés**
**Given** seule la version `1.6` du CV est référencée (`src/sections/About.tsx:3` pour l'image, `src/sections/About.tsx:112` pour le PDF)
**When** j'inventorie les fichiers de CV du dépôt
**Then** les **six WebP inutilisés** (`jeevons-cv-2024_resultat.webp`, `-1.1` à `-1.5`, ≈ 10,7 Mo) sont supprimés
**And** les **six PDF inutilisés** (`jeevons-cv-2024.pdf`, `-1.1` à `-1.5`, ≈ 2,7 Mo) sont supprimés
**And** le doublon `public/assets/docs/jeevons-cv-2024_resultat.webp.webp` (≈ 1,8 Mo) est supprimé

**AC2 — Rien n'est cassé**
**Given** la suppression est faite
**When** je construis le projet et que je parcours le site
**Then** le build réussit **sans référence manquante**
**And** l'image **et** le lien de téléchargement du CV **fonctionnent toujours** dans la section À propos
**And** le dépôt a perdu **environ 15 Mo**

## Contexte d'implémentation

### Ce qui est RÉFÉRENCÉ — à conserver absolument

Vérifié par `grep -rn "cv-2024" src/` → **exactement 2 références, toutes deux vers la version 1.6** :

| Référence | Fichier requis |
|---|---|
| `src/sections/About.tsx:3` — `import jeevonsCv from "@/assets/images/jeevons-cv-2024-1.6_resultat.webp"` | 🟢 `src/assets/images/jeevons-cv-2024-1.6_resultat.webp` |
| `src/sections/About.tsx:112` — `href="/assets/docs/jeevons-cv-2024-1.6.pdf"` | 🟢 `public/assets/docs/jeevons-cv-2024-1.6.pdf` |

⚠️ **Ces deux fichiers ne doivent JAMAIS être supprimés.** Toute la story consiste à supprimer autour d'eux.

### Liste exacte des 13 fichiers à supprimer (tailles mesurées)

**A — WebP dans `src/assets/images/` (6 fichiers, 10,74 Mo)**
```
src/assets/images/jeevons-cv-2024_resultat.webp        1 778 732 o
src/assets/images/jeevons-cv-2024-1.1_resultat.webp    1 792 336 o
src/assets/images/jeevons-cv-2024-1.2_resultat.webp    1 791 908 o
src/assets/images/jeevons-cv-2024-1.3_resultat.webp    1 790 264 o
src/assets/images/jeevons-cv-2024-1.4_resultat.webp    1 790 594 o
src/assets/images/jeevons-cv-2024-1.5_resultat.webp    1 791 250 o
```

**B — PDF dans `public/assets/docs/` (6 fichiers, 2,72 Mo)**
```
public/assets/docs/jeevons-cv-2024.pdf       453 314 o
public/assets/docs/jeevons-cv-2024-1.1.pdf   454 258 o
public/assets/docs/jeevons-cv-2024-1.2.pdf   454 319 o
public/assets/docs/jeevons-cv-2024-1.3.pdf   454 500 o
public/assets/docs/jeevons-cv-2024-1.4.pdf   454 260 o
public/assets/docs/jeevons-cv-2024-1.5.pdf   454 276 o
```

**C — Le doublon (1 fichier, 1,78 Mo)**
```
public/assets/docs/jeevons-cv-2024_resultat.webp.webp   1 778 732 o
```
(double extension `.webp.webp` — copie d'un fichier de A, jamais référencée)

**Total : 13 fichiers ≈ 15,24 Mo** — conforme à l'AC2 (« environ 15 Mo »).

### 🟡 Signalement hors périmètre — `public/assets/docs/photoIDD.jpg`

Ce fichier (136 846 o) est **également orphelin** (`grep -rn "photoIDD" src/` → 0 résultat). Il n'apparaît **pas dans les AC** de la story.
👉 **Ne le supprime pas.** Signale-le à Jeevons en Completion Notes et ajoute-le à `deferred-work.md`. Une photo d'identité peut avoir une utilité future (CV, back-office Epic 5) — c'est sa décision, pas la tienne.

### ⚠️ Ce que la suppression ne fait PAS

L'AC2 dit « le dépôt a perdu environ 15 Mo » : cela vaut pour **l'arbre de travail et les clones futurs**. L'**historique Git** conserve ces blobs — un `git clone` complet téléchargera toujours ces 15 Mo tant que l'historique n'est pas réécrit.

🛑 **Ne fais AUCUNE réécriture d'historique** (`git filter-repo`, `git filter-branch`, BFG). Ce serait destructif, hors périmètre, et casserait toutes les branches existantes. L'AC est satisfaite par une suppression normale suivie d'un commit.

## Tasks / Subtasks

- [x] **Tâche 1 — Confirmer les références avant toute suppression** (AC: 1) — 🔴 **à faire en premier**
  - [x] `grep -rn "cv-2024" src/ public/ --include='*.tsx' --include='*.ts'` → confirmer que **seule la 1.6** est référencée.
  - [x] Si une autre version apparaît, **STOP** et signaler avant de supprimer quoi que ce soit.
- [x] **Tâche 2 — Supprimer les 6 WebP orphelins** (AC: 1)
  - [x] `git rm` sur les six fichiers du bloc A. ⚠️ **Ne pas toucher à `-1.6_resultat.webp`.**
- [x] **Tâche 3 — Supprimer les 6 PDF orphelins** (AC: 1)
  - [x] `git rm` sur les six fichiers du bloc B. ⚠️ **Ne pas toucher à `-1.6.pdf`.**
- [x] **Tâche 4 — Supprimer le doublon** (AC: 1)
  - [x] `git rm "public/assets/docs/jeevons-cv-2024_resultat.webp.webp"`.
- [x] **Tâche 5 — Vérifier qu'aucune référence n'est cassée** (AC: 2)
  - [x] `npm run build` → **succès**, aucune erreur « Module not found » ni « Can't resolve ».
  - [x] `grep -rn "cv-2024" src/` → toujours exactement 2 résultats, tous deux en 1.6.
  - [x] `ls src/assets/images/jeevons-cv*` → **1 seul fichier** (`-1.6_resultat.webp`).
  - [x] `ls public/assets/docs/` → `jeevons-cv-2024-1.6.pdf` + `photoIDD.jpg` **uniquement**.
- [x] **Tâche 6 — Vérification navigateur de la carte CV** (AC: 2)
  - [x] `npm run dev`, section À propos : **l'image du CV s'affiche** (pas de cadre cassé).
  - [x] Cliquer sur l'image → **le PDF 1.6 s'ouvre** dans un nouvel onglet et se télécharge.
- [x] **Tâche 7 — Mesurer le gain** (AC: 2)
  - [x] `du -sh src/assets/images public/assets/docs` avant/après → gain ≈ **15 Mo** (`src/assets/images` doit passer de ~16 Mo à ~5 Mo).
- [x] **Tâche 8 — Tracer le fichier hors périmètre**
  - [x] Ajouter `public/assets/docs/photoIDD.jpg` (137 Ko, orphelin) à `_bmad-output/implementation-artifacts/deferred-work.md`, en attente de décision de Jeevons.
- [x] **Tâche 9 — Definition of Done technique** (AGENTS.md §8)
  - [x] `npm run lint` → aucun nouveau warning · `npx tsc --noEmit` → 0 erreur · `npm run build` → succès.
  - [x] `git status` : **13 suppressions**, **0 modification de fichier source** (hormis `deferred-work.md`).

## Dev Notes

### Périmètre — verrouillé

**Zéro fichier source modifié.** Uniquement des suppressions d'assets + une ligne dans `deferred-work.md`. Si ton diff touche un `.tsx`, tu es hors périmètre.

**Hors périmètre — ne pas faire :**
- ❌ **Ne pas réécrire l'historique Git.** Jamais `git filter-repo`, `filter-branch` ou BFG.
- ❌ **Ne pas renommer le CV 1.6** (« pour enlever le suffixe `_resultat` ») : ce serait toucher `About.tsx`, hors périmètre.
- ❌ **Ne pas optimiser ni recompresser** les images restantes (l'optimisation d'images est la **story 6.18**).
- ❌ **Ne pas supprimer d'autres assets orphelins.** `src/assets/images/` contient d'autres candidats possibles (`memoji-avatar-*.png`, `map.png`, `book-cover.png`, `dark-saas-landing-page.png`…). L'AC énumère **13 fichiers précisément** — ne va pas au-delà. Si tu en repères d'autres, note-les dans `deferred-work.md`.
- ❌ Ne pas supprimer `public/next.svg` ni `public/vercel.svg` (la sortie de Vercel est l'**Epic 2**).
- ❌ Ne pas supprimer `photoIDD.jpg` (voir signalement ci-dessus).

### Pourquoi `git rm` plutôt que `rm`

`git rm` supprime le fichier **et** l'enregistre dans l'index en une opération — le `git status` final est propre et la suppression ne peut pas être oubliée au commit.

### Testing standards

Pas d'infrastructure de test (Playwright à l'Epic 7). Cette story se vérifie par **le build** (une référence cassée le fait échouer immédiatement) **et** par la vérification navigateur de la carte CV — c'est le seul endroit du site où ces fichiers sont consommés.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.9]
- [Source: PLAN_REFONTE_2026.md — règle D6, « purge des 15 Mo d'assets morts » (quick wins P0)]
- [Source: AGENTS.md#3 — « src/assets/ ⚠️ ~16 Mo, purgés en story 1.9 »]
- [Source: src/sections/About.tsx:3,112 — les deux seules références au CV]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

- **Tâche 1, avant toute suppression** — `grep -rn "cv-2024" src/ public/ --include='*.tsx' --include='*.ts'` → **exactement 2 résultats**, tous deux en **1.6** (`About.tsx:3` pour l'image, `About.tsx:113` pour le PDF). Feu vert confirmé.
- `git status --short | grep '^D' | wc -l` → **13** suppressions
- Après suppression, `ls src/assets/images/jeevons-cv*` → **1 seul fichier** : `jeevons-cv-2024-1.6_resultat.webp`
- Après suppression, `ls public/assets/docs/` → `jeevons-cv-2024-1.6.pdf` + `photoIDD.jpg` **uniquement**
- `grep -rn "cv-2024" src/` → toujours exactement 2 résultats, tous deux en 1.6
- `du -sh` avant → `16M src/assets/images` · `4.9M public/assets/docs`
- `du -sh` après → `5.3M src/assets/images` · `580K public/assets/docs`
- **Gain mesuré ≈ 15,0 Mo**, conforme à l'AC2
- `npm run build` → `✓ Compiled successfully`, 5/5 pages statiques, **aucune erreur « Module not found » ni « Can't resolve »**
- `curl -I localhost:3000/assets/docs/jeevons-cv-2024-1.6.pdf` → **200**, 454 269 o
- HTML servi : l'image du CV est bien référencée (`jeevons-cv-2024-1.6_resultat.119f3fb3.webp`)
- `npx tsc --noEmit` → 0 erreur · `npm run lint` → aucun nouveau warning

### Completion Notes List

- **AC1 satisfait** : les 13 fichiers énumérés ont été supprimés via `git rm` (6 WebP orphelins, 6 PDF orphelins, et le doublon à double extension `jeevons-cv-2024_resultat.webp.webp`).
- **AC2 satisfait** : build vert sans référence manquante, PDF 1.6 servi en 200, image du CV toujours rendue. `src/assets/images` passe de **16 Mo à 5,3 Mo** comme annoncé dans la story.
- **Zéro fichier source modifié** : le diff ne contient que des suppressions d'assets plus l'ajout dans `deferred-work.md`. Aucun `.tsx` touché.
- `git rm` utilisé plutôt que `rm` : la suppression est enregistrée dans l'index en une opération, le `git status` reste propre.
- 🟡 **Signalement — `public/assets/docs/photoIDD.jpg`** (136 846 o) : également orphelin (`grep -rn "photoIDD" src/` → 0 résultat), mais **hors des AC**, donc **non supprimé** comme demandé. Ajouté à `deferred-work.md` en attente de ta décision — une photo d'identité peut servir au back-office de l'Epic 5.
- 🟡 Également tracés dans `deferred-work.md` : les autres candidats orphelins possibles de `src/assets/images/` (non audités, hors AC) et le fait que **l'historique Git conserve les 15 Mo**.
- 🛑 **Aucune réécriture d'historique effectuée** (`git filter-repo` / `filter-branch` / BFG) : destructif et hors périmètre. L'AC est satisfaite par une suppression normale — le gain porte sur l'arbre de travail et les clones futurs, pas sur le poids d'un `git clone` complet.
- ✅ **Vérifié par capture de la page complète** : la carte CV de la section À propos affiche bien l'image (aucun cadre cassé). Le PDF 1.6 répond en **200** (454 269 o) et l'image est servie par Next (`jeevons-cv-2024-1.6_resultat.119f3fb3.webp`).
### File List

Supprimés (13) :

- `src/assets/images/jeevons-cv-2024_resultat.webp`
- `src/assets/images/jeevons-cv-2024-1.1_resultat.webp`
- `src/assets/images/jeevons-cv-2024-1.2_resultat.webp`
- `src/assets/images/jeevons-cv-2024-1.3_resultat.webp`
- `src/assets/images/jeevons-cv-2024-1.4_resultat.webp`
- `src/assets/images/jeevons-cv-2024-1.5_resultat.webp`
- `public/assets/docs/jeevons-cv-2024.pdf`
- `public/assets/docs/jeevons-cv-2024-1.1.pdf`
- `public/assets/docs/jeevons-cv-2024-1.2.pdf`
- `public/assets/docs/jeevons-cv-2024-1.3.pdf`
- `public/assets/docs/jeevons-cv-2024-1.4.pdf`
- `public/assets/docs/jeevons-cv-2024-1.5.pdf`
- `public/assets/docs/jeevons-cv-2024_resultat.webp.webp`

Modifié (1) :

- `_bmad-output/implementation-artifacts/deferred-work.md`

### Change Log

- 2026-07-21 — Suppression de 13 assets de CV orphelins (≈ 15 Mo) et traçage de `photoIDD.jpg` en dette (Story 1.9).
