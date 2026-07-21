---
baseline_commit: 9b097180512e2b2f7d7a526acfdb93f281aa501e
---

# Story 1.2: Rendre la section Témoignages atteignable

Status: review

<!-- Story rédigée à la volée pendant dev-story : le fichier n'existait pas (statut backlog).
     AC repris de _bmad-output/planning-artifacts/epics.md#Story 1.2. -->

## Story

As a **visiteur du portfolio**,
I want **pouvoir accéder à la section du parcours depuis la navigation**,
so that **je puisse lire le parcours de Jeevons sans la découvrir par hasard**.

## Acceptance Criteria

**AC1 — La section porte un identifiant unique et descriptif**
**Given** la section n'a aujourd'hui aucun identifiant (`src/sections/Testimonials.tsx:104`)
**When** j'inspecte le document
**Then** la section porte un `id` unique et descriptif
**And** cet `id` reste unique parmi tous les `id` de la page

**AC2 — Un lien de navigation y mène**
**Given** la section porte un identifiant
**When** je consulte la navigation du Header
**Then** un lien y mène et le défilement fonctionne

## Décisions de cadrage (validées par Jeevons, 2026-07-21)

1. **`id="parcours"`** — La section s'appelle `Testimonials.tsx` pour des raisons
   historiques (template d'origine), mais son contenu affiché est le **parcours
   scolaire** : eyebrow « Mon parcours », titre « Découvrez d'où je viens »,
   icônes `bac-icon` / `university-icon` / `mmi-icon`. Nommer l'`id`
   `testimonials` aurait contredit l'exigence « descriptif » de l'AC1.
   ⚠️ Écart assumé entre le nom du fichier et son contenu — renommage du fichier
   à traiter plus tard (Epic 3 ou 6), **hors périmètre ici**.
2. **Navigation portée à 5 entrées** — La story 1.1 (AC3) verrouillait la nav à
   quatre entrées et déclarait `Header.tsx` intouchable. L'AC2 de la présente
   story exige l'inverse. Arbitrage : la 1.2 prime, `Header.tsx` est modifié.
   Lien inséré **après « Projets », avant « À propos »**, pour suivre l'ordre du
   document.

## Tasks / Subtasks

- [x] **Tâche 1 — Ajouter l'identifiant à la section** (AC: 1)
  - [x] Dans `src/sections/Testimonials.tsx:104`, ajouter `id="parcours"` au `<section>`. Aucune classe changée.
- [x] **Tâche 2 — Ajouter le lien de navigation** (AC: 2)
  - [x] Dans `src/sections/Header.tsx`, `<a href="#parcours" className="nav-item font-light">Parcours</a>` inséré entre « Projets » et « À propos ».
- [x] **Tâche 3 — Vérifier l'unicité des identifiants** (AC: 1)
  - [x] `grep -rn 'id="' src/sections/ src/app/` → six valeurs distinctes : `hero`, `projects`, `side-projects`, `parcours`, `about`, `contact`. ✅
  - [x] HTML de production : chacun des six `id` apparaît **exactement 1 fois** ; `href="#parcours"` présent 1 fois. ✅
- [x] **Tâche 4 — Definition of Done technique** (AGENTS.md §8)
  - [x] `npm run lint` → **aucun nouveau warning**. Le seul warning (`Testimonials.tsx:78`) est préexistant et tracé dans `deferred-work.md`.
  - [x] `npx tsc --noEmit` → 0 erreur
  - [x] `npm run build` → succès (5/5 pages statiques)
  - [x] `git diff` relu : deux fichiers source modifiés (+3/−1), périmètre respecté

## Dev Notes

### Périmètre

Deux fichiers, deux modifications minimes :
- `src/sections/Testimonials.tsx:104` — ajout de l'attribut `id`
- `src/sections/Header.tsx` — ajout d'un `<a>`

**Hors périmètre :**
- ❌ Ne pas renommer `Testimonials.tsx` en `Parcours.tsx` — refactor à part entière.
- ❌ Ne pas corriger le warning lint `react-hooks/exhaustive-deps` ligne 78 : préexistant, tracé dans `deferred-work.md`. Le corriger toucherait la logique d'auto-défilement, sans rapport avec cette story.
- ❌ Ne pas ajouter de `scroll-margin-top` (dette Epic 6, tracée dans `deferred-work.md`).
- ❌ Aucune dépendance ajoutée.

### Convention d'`id` (héritée de la story 1.1)

kebab-case, descriptif, posé sur le `<section>` de premier niveau lui-même.
Valeurs après cette story : `hero`, `projects`, `side-projects`, `parcours`, `about`, `contact`.

Note : `parcours` est en français alors que les autres `id` sont en anglais. Choix
assumé — il décrit le contenu réel et s'aligne sur le libellé de nav affiché.

### Testing standards

Aucune infrastructure de test à ce stade (Playwright arrive à l'Epic 7). Vérification
par inspection du HTML de production généré par `npm run build`, comme en story 1.1.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.2]
- [Source: src/sections/Testimonials.tsx:104] · [Source: src/sections/Header.tsx]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code, workflow `dev-story`)

### Debug Log References

- `git rev-parse HEAD` → baseline `9b097180512e2b2f7d7a526acfdb93f281aa501e`
- `grep -rn 'id="' src/sections/ src/app/` → 6 valeurs distinctes après modification.
- `npx tsc --noEmit` → 0 erreur.
- `npm run lint` → 1 warning (`Testimonials.tsx:78`), identique à l'état d'avant-story. Aucun nouveau warning introduit.
- `npm run build` → succès, 5/5 pages statiques.
- HTML rendu `.next/server/app/index.html` :
  - `hero`, `projects`, `side-projects`, `parcours`, `about`, `contact` → 1 occurrence chacun.
  - `href="#parcours"` → 1 · `class="nav-item"` → 5.
  - Ordre des sections : `hero → projects → side-projects → parcours → about → contact`.
  - Ordre des liens de nav : `#hero → #projects → #parcours → #about → #contact` — aligné sur l'ordre du document.

### Completion Notes List

**Implémentation** — Deux modifications minimales :
- `src/sections/Testimonials.tsx:104` — ajout de `id="parcours"` sur le `<section>` (aucune classe touchée).
- `src/sections/Header.tsx` — ajout du lien `<a href="#parcours" className="nav-item font-light">Parcours</a>`, inséré entre « Projets » et « À propos ».

**Vérification des AC**
- **AC1 ✅** — La section porte désormais un `id` unique et descriptif. Les six `id` de la page sont distincts et apparaissent chacun exactement une fois dans le HTML de production.
- **AC2 ✅** — Un lien de navigation mène à la section. Le défilement fluide est natif (`scroll-behavior: smooth`, `globals.css:23-25`), aucun JavaScript requis.

**Décision de nommage — pourquoi `parcours` et pas `testimonials`** — Malgré son nom de fichier, `Testimonials.tsx` n'affiche pas de témoignages : eyebrow « Mon parcours », titre « Découvrez d'où je viens », et des icônes de formation (`bac-icon`, `university-icon`, `mmi-icon`). L'AC1 exige un `id` **descriptif** ; `testimonials` aurait décrit le fichier, pas le contenu. Validé par Jeevons.
⚠️ Ceci **invalide la suggestion faite dans les Completion Notes de la story 1.1**, qui recommandait `id="testimonials"` — cette recommandation avait été formulée sans avoir lu le contenu réel de la section.
⚠️ **Dette : le nom du fichier `Testimonials.tsx` ne correspond pas à son contenu.** Renommage non effectué (hors périmètre) → à traiter en Epic 3 ou 6.

**Écart de convention assumé** — `parcours` est en français, là où les autres `id` sont en anglais (`hero`, `side-projects`, `about`, `contact`). Choix retenu pour coller au libellé de nav affiché et au contenu réel. À harmoniser si une convention stricte est adoptée plus tard.

**Arbitrage avec la story 1.1** — L'AC3 de la 1.1 verrouillait la navigation à **quatre** entrées et déclarait `Header.tsx` intouchable. L'AC2 de la présente story impose d'y ajouter un lien. La 1.2 prime, la nav passe à **cinq** entrées. Contradiction signalée à Jeevons et arbitrée explicitement avant implémentation.

**Note de process** — Le fichier de story n'existait pas (statut `backlog`, jamais passé par `create-story`). Il a été rédigé pendant ce run à partir des AC de `epics.md`, puis les deux points de cadrage ambigus ont été arbitrés avec Jeevons avant toute écriture de code. Les Dev Notes sont donc plus légères que celles d'une story issue de `create-story`.

**Dette non traitée (inchangée)** — Warning lint `Testimonials.tsx:78` et absence de `scroll-margin-top` : tous deux préexistants et déjà tracés dans `deferred-work.md`. Non corrigés ici, conformément au périmètre.

**Commit** — Non effectué : conformément à AGENTS.md, le commit et le `git push` sont déclenchés par Jeevons. Message suggéré : `feat(nav): rendre la section parcours atteignable depuis la navigation`.

### File List

- `src/sections/Testimonials.tsx` (modifié — ajout de l'attribut `id`)
- `src/sections/Header.tsx` (modifié — ajout d'un lien de navigation)
- `_bmad-output/implementation-artifacts/1-2-rendre-la-section-temoignages-atteignable.md` (créé — la story n'existait pas)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modifié — statut de story)

### Change Log

| Date | Version | Description |
|---|---|---|
| 2026-07-21 | 1.0 | `Testimonials.tsx` : ajout de `id="parcours"`. `Header.tsx` : ajout du lien « Parcours » (nav portée à 5 entrées). AC1/AC2 vérifiés sur le HTML de production. |
