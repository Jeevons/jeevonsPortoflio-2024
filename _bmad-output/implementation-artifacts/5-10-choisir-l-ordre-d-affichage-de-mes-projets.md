---
baseline_commit: 5c22f3a6c48914801d0a226ab5a0b15c005d8765
---

# Story 5.10: Choisir l'ordre d'affichage de mes projets

Status: ready-for-dev

## Story

As **Jeevons**,
I want **réordonner mes projets en les faisant glisser**,
so that **je mette en avant ce qui compte le plus, selon le poste que je vise**.

## Acceptance Criteria

**AC1 — Drag & drop optimiste + persistance**
**Given** je suis sur la liste des projets
**When** je fais glisser un projet à une autre position
**Then** l'interface reflète le nouvel ordre immédiatement, sans attendre le serveur
**And** l'ordre est persisté

**AC2 — Rollback en cas d'échec**
**Given** l'enregistrement de l'ordre échoue
**When** le serveur renvoie une erreur
**Then** l'interface revient à l'ordre précédent et m'informe de l'échec

**AC3 — Ordre reflété côté public**
**Given** j'ai réordonné mes projets
**When** je consulte le site public après revalidation
**Then** les projets y apparaissent dans l'ordre que j'ai défini

**AC4 — Réordonnancement accessible au clavier**
**Given** je navigue au clavier
**When** je veux réordonner un projet
**Then** un moyen accessible me le permet, sans obligation d'utiliser la souris

## Contexte d'implémentation

### 🛑 Prérequis : stories 5.8 (+ 5.9) `done`

5.8 a posé la liste des projets. 5.10 y ajoute le **tri drag & drop** persistant, optimiste, accessible. PLAN §3.2 (`/admin/projects` : tri drag & drop dnd-kit → persiste `sortOrder`) et §3.3 (`useOptimistic`).

### 🎯 Ce que fait vraiment cette story

Sur `/admin/projects` : glisser un projet → l'UI **réordonne immédiatement** (`useOptimistic`), la Server Action **persiste** `sortOrder`, avec **rollback** si le serveur échoue, propagation au public après `revalidateTag('projects')`, et un **moyen clavier** équivalent (a11y non négociable).

### ⚠️ Piège n°1 (CENTRAL) — `sortOrder` : recalcul cohérent, pas de collision

- Chaque `Project` a `sortOrder Int @default(0)` (Epic 4), lu `orderBy: sortOrder asc` côté public (`projects.ts`). ⚠️ Réordonner = **réécrire les `sortOrder`** de la séquence. Stratégie robuste : après un glisser, envoyer la **liste ordonnée d'ids** et réassigner `sortOrder = index` en base (une transaction `updateMany`/`$transaction`). ❌ Ne pas se contenter d'incréments fragiles (collisions de valeurs égales → ordre non déterministe).
- ⚠️ L'index public actuel est `@@index([category, sortOrder])` : le tri est **par catégorie**. Clarifier si le réordonnancement est **global** ou **par catégorie** (les projets publics sont groupés par catégorie). 🛑 Trancher avec Jeevons : réordonner **au sein d'une catégorie** est le plus cohérent avec l'affichage public. Concevoir l'UI en conséquence.

### ⚠️ Piège n°2 — dnd-kit (dépendance) + `useOptimistic` (AC1, AC2)

- PLAN §3.2 nomme **dnd-kit**. `bun add @dnd-kit/core @dnd-kit/sortable` (+ modifiers si besoin) — prévu par le PLAN → autorisé. ⚠️ dnd-kit est **accessible par conception** (support clavier natif via `KeyboardSensor`) → utile pour AC4.
- `useOptimistic` (React 19) : l'ordre affiché est optimiste ; la Server Action confirme. Si elle **rejette** → revenir à l'ordre serveur précédent + notifier (AC2). ⚠️ Bien gérer l'état : la source de vérité reste le serveur ; l'optimiste est transitoire.

### ⚠️ Piège n°3 — Accessibilité clavier (AC4) — non négociable

- AGENTS.md §6 : navigation clavier complète. dnd-kit `KeyboardSensor` permet de saisir/déplacer/déposer au clavier avec annonces ARIA. ⚠️ **Tester réellement** au clavier (Tab pour focus, Espace pour saisir, flèches pour déplacer, Espace pour déposer). Fournir des instructions accessibles (aria-describedby). Ne pas livrer un dnd souris-only (AC4 explicite).

### ⚠️ Piège n°4 — Persistance : Server Action `requireAdmin` + revalidation (AC1, AC3)

- Réutiliser le pattern 5.8 : Server Action protégée `requireAdmin`, valide la liste d'ids (Zod), réassigne `sortOrder` en transaction, `revalidateTag('projects')` → ordre visible sur le public après revalidation (AC3). ❌ Pas d'AuditLog ici (5.19).

### ⚠️ Piège n°5 — Réutiliser plutôt que dupliquer (highlights/timeline)

- Le **même besoin de tri** existe pour les highlights (5.9), le parcours (5.14). ⚠️ Concevoir la brique dnd/réordonnancement **réutilisable** (composant/util générique) plutôt que spécifique aux projets — 5.14 la réemploiera pour le parcours (« même pattern », PLAN §3.2). Si 5.9 a déjà introduit dnd-kit, mutualiser.

### ⚠️ Piège n°6 — Vérification locale

- Glisser un projet → ordre change **immédiatement** (avant réponse serveur), puis persiste ; recharger → ordre conservé (AC1). Simuler une erreur serveur → UI **revient** à l'ordre précédent + message (AC2). Consulter le public après revalidation → même ordre (AC3). Refaire **entièrement au clavier** (AC4).

## Tasks / Subtasks

- [ ] **Tâche 0 — Prérequis & dépendance** (AC: 1)
  - [ ] 5.8 `done`. `bun add @dnd-kit/core @dnd-kit/sortable` (PLAN §3.2). 🛑 Trancher tri global vs par catégorie.
- [ ] **Tâche 1 — UI drag & drop optimiste** (AC: 1 ; pièges n°2, 5)
  - [ ] Liste triable (dnd-kit) + `useOptimistic` ; brique réutilisable (5.14).
- [ ] **Tâche 2 — Persistance `sortOrder`** (AC: 1, 3 ; pièges n°1, 4)
  - [ ] Server Action `requireAdmin` : liste d'ids → réassignation `sortOrder` en transaction ; `revalidateTag('projects')`.
- [ ] **Tâche 3 — Rollback** (AC: 2 ; piège n°2)
  - [ ] Échec serveur → retour à l'ordre précédent + notification.
- [ ] **Tâche 4 — Accessibilité clavier** (AC: 4 ; piège n°3)
  - [ ] `KeyboardSensor` + annonces ARIA ; testé au clavier de bout en bout.
- [ ] **Tâche 5 — Vérification locale** (AC: 1-4 ; piège n°6)
  - [ ] Optimiste + persistance, rollback, ordre public après revalidation, réordonnancement clavier.
- [ ] **Tâche 6 — Definition of Done** (AGENTS.md §8)
  - [ ] lint 0 / tsc 0 / build OK. Vérif visuelle + clavier. `git diff DEV` : liste triable, Server Action ordre, dnd-kit — rien d'autre.
  - [ ] `File List` + `Completion Notes` + `Change Log` · `sprint-status.yaml`.

## Dev Notes

### Périmètre — verrouillé

**Réordonnancement drag & drop des projets : optimiste (useOptimistic), persistance `sortOrder` (transaction), rollback sur échec, propagation publique après revalidation, réordonnancement clavier accessible.**

**Hors périmètre — ne pas faire :**
- ❌ **Champs/édition du projet** → 5.8/5.9.
- ❌ **Tri du parcours** → 5.14 (réutilisera la brique dnd).
- ❌ **AuditLog** → 5.19.
- ❌ **Dépendance hors dnd-kit**.

### Le vrai enjeu

Deux pièges : (1) `sortOrder` doit être **réécrit proprement** (réassignation par index en transaction), sinon collisions et ordre non déterministe — d'autant que l'index public est `[category, sortOrder]` (trancher tri par catégorie) ; (2) l'accessibilité **clavier** est non négociable (AGENTS.md §6) — dnd-kit la permet mais elle se **teste**. La brique de réordonnancement est conçue **réutilisable** pour 5.14.

### Testing standards

Vérification **manuelle en local** + visuelle + **clavier**. Les 4 AC (optimiste, rollback, public, clavier). tsc/lint/build verts.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.10]
- [Source: PLAN_REFONTE_2026.md §3.2 — tri drag & drop dnd-kit → persiste `sortOrder` ; §3.3 — `useOptimistic`]
- [Source: apps/web/prisma/schema.prisma — Project.sortOrder, `@@index([category, sortOrder])`]
- [Source: apps/web/src/lib/projects.ts — `orderBy: { sortOrder: 'asc' }` côté public]
- [Source: _bmad-output/implementation-artifacts/5-8-gerer-mes-projets.md — pattern Server Action + revalidateTag ; 5-9 — dnd des highlights (mutualiser)]
- [Source: AGENTS.md §6 — navigation clavier complète (non négociable) ; §9 — zéro dépendance non prévue]
