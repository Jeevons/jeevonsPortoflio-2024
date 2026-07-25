---
baseline_commit: 5c22f3a6c48914801d0a226ab5a0b15c005d8765
---

# Story 5.14: Gérer mon parcours

Status: ready-for-dev

## Story

As **Jeevons**,
I want **tenir à jour mon parcours depuis l'administration**,
so that **mon expérience reste exacte au fil du temps**.

## Acceptance Criteria

**AC1 — CRUD entrée avec champs, année de fin optionnelle**
**Given** je suis sur l'écran du parcours
**When** je crée ou modifie une entrée
**Then** je renseigne son intitulé, son lieu, son texte, ses années de début et de fin, et son illustration
**And** une entrée toujours en cours peut être enregistrée sans année de fin

**AC2 — Réordonnancement persisté + public**
**Given** j'ai plusieurs entrées
**When** je les réordonne
**Then** l'ordre est persisté et reflété sur le site public

**AC3 — Entrée non publiée invisible**
**Given** une entrée n'est pas prête
**When** je la laisse non publiée
**Then** elle n'apparaît pas sur le site public

**AC4 — Suppression → disparaît après revalidation**
**Given** je supprime une entrée
**When** je confirme
**Then** elle disparaît du site après revalidation

## Contexte d'implémentation

### 🛑 Prérequis : socle sécurité + 5.8 (pattern CRUD) + 5.10 (dnd) + 5.12 (Media) `done`

Applique le **même pattern** que le CRUD projets au modèle `TimelineEntry` (Epic 4). PLAN §3.2 (`/admin/timeline` : CRUD parcours, même pattern).

### 🎯 Ce que fait vraiment cette story

`/admin/timeline` : CRUD des **`TimelineEntry`** (title, place, body, startYear, `endYear?`, illustration/avatar, `published`, `sortOrder`), **réordonnancement** persisté (réutilise 5.10), **publié/non** (invisible côté public si non publié), suppression confirmée. Revalidation via tag **`timeline`**.

### ⚠️ Piège n°1 — Modèle `TimelineEntry` déjà en place (Epic 4), y compris les subtilités

- Schéma 4.2 : `slug @unique` (clé naturelle du seed), `title`, `place`, `body @db.Text`, `avatarId String?` (**sans relation** Media — joint par slug côté conteneur), `startYear`, `endYear Int?`, `sortOrder`, `published Boolean @default(true)`. ⚠️ Le défaut `published=true` (contrairement à `Project` = false) : à la **création admin**, décider du défaut (probablement `false`/brouillon pour cohérence avec AC3). 🛑 Noter la divergence.
- `endYear` **optionnel** → « en cours » (AC1 « sans année de fin »). Zod : `endYear` nullable, et si présent `>= startYear`.

### ⚠️ Piège n°2 (CENTRAL) — Illustration : `avatarId` n'est PAS une relation Media

- ⚠️ Décision 4.2 : `avatarId` est un `String?` **sans relation** Prisma (l'avatar était un import statique joint par `slug`). Maintenant que `Media` existe (5.12), l'« illustration » (AC1) peut pointer un `Media`. 🛑 **Trancher avec Jeevons** :
  - (a) Faire de `avatarId` une **vraie relation** `Media?` (migration : ajout de la FK) → cohérent avec 5.12/5.13, et 5.13 (`findMediaUsages`) doit alors compter cet usage.
  - (b) Garder `avatarId` comme référence libre à un `Media.id` (détection applicative, comme prévu en 5.13 piège n°1).
  - 👉 Quel que soit le choix, **compléter `findMediaUsages` (5.13)** pour inclure l'avatar → sinon on supprimerait un média encore utilisé par une entrée. C'est le couplage clé.
- Réutiliser l'**infra upload/média** (5.12/5.13) pour choisir/téléverser l'illustration — ne pas réimplémenter.

### ⚠️ Piège n°3 — Réordonnancement : réutiliser la brique de 5.10

- `sortOrder` + tri dnd accessible → **réutiliser** la brique de réordonnancement de 5.10 (conçue réutilisable). Persistance en transaction, `revalidateTag('timeline')`. Le public ordonne déjà par `sortOrder` (`@@index([published, sortOrder])`, lib timeline). ❌ Ne pas dupliquer dnd-kit.

### ⚠️ Piège n°4 — Tag `timeline` couvre parcours ET hobbies (décision 4.4)

- ⚠️ `CACHE_TAGS.timeline` couvre `TimelineEntry` **et** `Hobby` (décision 4.4 : « même section conceptuelle »). Éditer une entrée invalide `timeline` (AC2/AC4). La gestion des **hobbies** n'est **pas** dans cette story (l'epic ne liste pas de story hobbies séparée — noter que les hobbies restent gérés par seed/content sauf story dédiée ; ne pas l'inventer ici).

### ⚠️ Piège n°5 — Lecture publique vs admin

- Lib publique `src/lib/timeline.ts` (cachée, `published:true`) : ne pas la réutiliser pour l'admin (qui veut tout, non caché). Lectures admin dédiées. Non publié → invisible public (AC3, déjà garanti par le filtre publié de la lib). Après mutation → `revalidateTag('timeline')` (AC2/AC4).

### ⚠️ Piège n°6 — Vérification locale

- Créer/modifier une entrée (avec/ sans `endYear`, illustration) (AC1). Réordonner → ordre reflété public après revalidation (AC2). Laisser non publiée → **absente** du public (AC3). Supprimer (confirmation) → disparue après revalidation (AC4). Vérifier que supprimer le média d'un avatar est **bloqué** par la garde 5.13 complétée.

## Tasks / Subtasks

- [ ] **Tâche 0 — Prérequis** (AC: 1)
  - [ ] Socle + 5.8/5.10/5.12/5.13 `done`. Réutiliser pattern CRUD, dnd, média.
- [ ] **Tâche 1 — CRUD `TimelineEntry`** (AC: 1, 3, 4 ; pièges n°1, 5)
  - [ ] `/admin/timeline` : liste + éditeur (Zod : endYear optionnel/≥startYear), `published`, suppression confirmée, `revalidateTag('timeline')`.
- [ ] **Tâche 2 — Illustration via Media** (AC: 1 ; piège n°2)
  - [ ] 🛑 Trancher relation Media vs référence libre pour `avatarId` ; compléter `findMediaUsages` (5.13). Réutiliser upload 5.12/5.13.
- [ ] **Tâche 3 — Réordonnancement** (AC: 2 ; pièges n°3, 4)
  - [ ] Réutiliser la brique dnd de 5.10 ; persistance `sortOrder` ; `revalidateTag('timeline')`.
- [ ] **Tâche 4 — Vérification locale** (AC: 1-4 ; piège n°6)
  - [ ] CRUD (endYear optionnel), ordre public, non publié invisible, suppression, garde média avatar.
- [ ] **Tâche 5 — Definition of Done** (AGENTS.md §8)
  - [ ] lint 0 / tsc 0 / build OK. Vérif visuelle + clavier (dnd). `git diff DEV` : écran timeline, CRUD, dnd réutilisé, illustration, usages média — rien d'autre.
  - [ ] `File List` + `Completion Notes` + `Change Log` · `sprint-status.yaml`.

## Dev Notes

### Périmètre — verrouillé

**CRUD `TimelineEntry` (`/admin/timeline`) : champs + année de fin optionnelle + illustration (Media), réordonnancement (réutilise 5.10), publié/non (invisible public si non publié), suppression confirmée, revalidateTag('timeline').**

**Hors périmètre — ne pas faire :**
- ❌ **Gestion des hobbies** (pas de story dédiée dans l'epic — ne pas l'inventer).
- ❌ **Réimplémenter dnd / upload média** (réutiliser 5.10 / 5.12-5.13).
- ❌ **Page publique détaillée** → Epic 6.
- ❌ **AuditLog** → 5.19.
- ❌ **Nouvelle dépendance**.

### Le vrai enjeu

C'est un CRUD « même pattern » que 5.8, mais deux subtilités héritées d'Epic 4 : (1) `published` défaut `true` sur `TimelineEntry` (vs `false` sur `Project`) → aligner le comportement brouillon (AC3) ; (2) `avatarId` **n'est pas** une relation Media (décision 4.2) → l'illustration exige de trancher relation vs référence libre **et** de compléter la garde d'intégrité de 5.13 (sinon suppression de média orphelinant une entrée). Le tri réutilise 5.10, la revalidation le tag `timeline` (qui couvre aussi les hobbies, décision 4.4).

### Testing standards

Vérification **manuelle en local** + visuelle + clavier (dnd). Les 4 AC + garde média avatar. tsc/lint/build verts.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.14]
- [Source: PLAN_REFONTE_2026.md §3.2 — `/admin/timeline` CRUD parcours (même pattern)]
- [Source: apps/web/prisma/schema.prisma — TimelineEntry (slug @unique, endYear?, avatarId String? SANS relation, published @default(true), `@@index([published, sortOrder])`)]
- [Source: apps/web/src/lib/timeline.ts — lecture publique cachée ; apps/web/src/lib/cache-tags.ts — `timeline` couvre parcours + hobbies (décision 4.4)]
- [Source: _bmad-output/implementation-artifacts/5-10-choisir-l-ordre-d-affichage-de-mes-projets.md — brique dnd réutilisable ; 5-12/5-13 — infra média + `findMediaUsages` à compléter]
- [Source: AGENTS.md §6 — vues bêtes, a11y clavier ; §9 — anti-scope-creep]
