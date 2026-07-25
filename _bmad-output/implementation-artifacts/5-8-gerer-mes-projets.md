---
baseline_commit: 5c22f3a6c48914801d0a226ab5a0b15c005d8765
---

# Story 5.8: Gérer mes projets

Status: ready-for-dev

## Story

As **Jeevons**,
I want **créer, modifier et supprimer mes projets depuis l'administration**,
so that **je puisse enrichir mon portfolio sans commit ni redéploiement**.

## Acceptance Criteria

**AC1 — Liste filtrable/triable**
**Given** je suis sur la liste des projets
**When** la page s'affiche
**Then** je vois tous mes projets avec leur titre, leur catégorie et leur statut de publication
**And** je peux filtrer et trier cette liste

**AC2 — Création avec validation partagée client/serveur**
**Given** je crée un projet
**When** je renseigne le formulaire et que j'enregistre
**Then** le projet est créé avec son identifiant d'URL, sa catégorie, son entreprise, son titre, sa description, sa période, son lien et son dépôt
**And** les mêmes règles de validation s'appliquent côté navigateur et côté serveur, une saisie invalide étant refusée dans les deux cas

**AC3 — Slug unique + suggestion auto**
**Given** l'identifiant d'URL doit rester unique
**When** je saisis un identifiant déjà utilisé
**Then** l'enregistrement est refusé avec un message qui m'explique le conflit
**And** un identifiant m'est proposé automatiquement à partir du titre lors d'une création

**AC4 — Modification persistée + visible après revalidation**
**Given** je modifie un projet existant
**When** j'enregistre
**Then** les changements sont persistés et visibles sur le site public après revalidation

**AC5 — Suppression confirmée + cascade highlights**
**Given** je supprime un projet
**When** je confirme la suppression
**Then** le projet disparaît, ainsi que ses points forts associés
**And** une confirmation m'a été demandée avant l'action, qui est irréversible

## Contexte d'implémentation

### 🛑 Prérequis : socle sécurité 5.1-5.6 + dashboard 5.7 `done`

Premier **CRUD** de l'admin. Il établit le **pattern de mutation** (Server Action + Zod + `requireAdmin` + `revalidateTag`) réutilisé par 5.9-5.19. PLAN §3.2 (`/admin/projects`, `/admin/projects/[id]`) et §3.3 (Server Actions + Zod).

### 🎯 Ce que fait vraiment cette story

CRUD **projets** de base : liste (`/admin/projects`) filtrable/triable ; éditeur (`/admin/projects/[id]` + création) sur les champs scalaires du `Project` (slug, category, company, title, description, period, link, repoUrl) ; slug **unique** + suggestion ; suppression confirmée avec **cascade** des highlights ; persistance + `revalidateTag('projects')`. **Pas** ici : highlights/stacks détaillés (5.9), drag&drop de tri (5.10), brouillon/preview (5.11), upload cover (5.12).

### ⚠️ Piège n°1 (CENTRAL) — Écrire sur le MÊME `Project` que lisent les sections publiques [[prisma7-setup-gotchas]]

- Le modèle `Project` (Epic 4) est lu par `src/lib/projects.ts` (`getPublishedProjects`, cache tag `projects`, filtre `published:true`). Une mutation admin **doit** invalider ce cache : après create/update/delete → `revalidateTag(CACHE_TAGS.projects)` (contrat `src/lib/cache-tags.ts`). Sinon la modif n'apparaît pas (AC4).
- Écriture **exclusivement** via le singleton `src/lib/db.ts` (`prisma`), côté serveur (Server Action). Import client `@/generated/prisma/client`, enums `@/generated/prisma/enums` (`ProjectCategory`).
- ⚠️ La lib de lecture est `server-only` et **cachée** ; ne pas la réutiliser pour l'admin (qui veut TOUS les projets, brouillons compris, non cachés). Faire des lectures admin **dédiées** (non cachées, sans filtre `published`) — mais **partager** le tag pour l'invalidation.

### ⚠️ Piège n°2 — Validation partagée Zod client/serveur (AC2) + dépendance

- PLAN §3.3 : **Zod** partagé. `bun add zod` (prévu par le PLAN → autorisé ; **seule** nouvelle dépendance ici, sauf react-hook-form si validé — voir n°3). Définir **un schéma** (`src/lib/schemas/project.ts`) importé par le formulaire client ET la Server Action serveur → mêmes règles des deux côtés (AC2). ❌ Ne pas dupliquer les règles.
- Serveur = **source de vérité** : même si le client valide, la Server Action revalide et refuse une saisie invalide (AC2 « refusée dans les deux cas »).

### ⚠️ Piège n°3 — Formulaire : Server Actions + état, sans sur-outillage

- PLAN §3.3 : **Server Actions** + `useOptimistic` (le tri optimiste est 5.10). Pour le formulaire, `useActionState`/`useFormStatus` (React 19) suffisent souvent. 🛑 Si `react-hook-form` est souhaité, le **faire valider** (non nommé explicitement au PLAN §3.3 ; Zod l'est). Rester sobre : privilégier les primitives React 19 + Zod.
- Vue « bête » client, logique dans la Server Action serveur (AGENTS.md §6).

### ⚠️ Piège n°4 — Slug unique + suggestion (AC3)

- `slug @unique` (schéma Epic 4). En création, **proposer** un slug dérivé du titre (kebab-case, sans accents/espaces). En save, si collision → capturer l'erreur d'unicité Prisma (P2002) → message **explicite** de conflit (AC3), pas une 500. ⚠️ Valider aussi le format du slug côté Zod (URL-safe).

### ⚠️ Piège n°5 — Suppression : cascade highlights + confirmation (AC5)

- Le schéma (Epic 4) a déjà `Highlight … onDelete: Cascade` → supprimer un `Project` supprime ses `Highlight` en base automatiquement (AC5). Vérifier que la relation cascade est bien en place (elle l'est : `schema.prisma`).
- ⚠️ **Confirmation obligatoire** avant suppression (dialogue), action **irréversible** (AC5). Pas de suppression en un clic sans confirmation. Après delete → `revalidateTag('projects')`.
- ⚠️ Relations stacks (`ProjectStacks`, many-to-many) : supprimer un projet retire les **associations** (join), pas les `Stack` (partagés). Prisma gère le détachement implicite ; vérifier qu'aucune contrainte ne bloque.

### ⚠️ Piège n°6 — Audit & preview : reportés

- L'`AuditLog` (chaque mutation) est **5.19** → ne pas le créer ici (les mutations de 5.8-5.18 seront tracées quand 5.19 branchera un point d'audit commun). Le noter.
- `published` existe (défaut `false`) mais la **gestion brouillon/preview** est **5.11** : ici on peut exposer le champ statut en lecture/écriture simple, mais le comportement `?preview=1` et la visibilité conditionnelle sont 5.11. Ne pas dupliquer.

### ⚠️ Piège n°7 — Vérification locale

- Liste : tous les projets (publiés **et** brouillons), filtre/tri (AC1). Créer un projet (slug suggéré, validation client+serveur, saisie invalide refusée des deux côtés) (AC2). Slug en doublon → message de conflit (AC3). Modifier → visible sur le public **après** revalidation (AC4). Supprimer (confirmation) → projet + highlights disparus (AC5). Vérifier qu'une saisie invalide envoyée **directement** à la Server Action (client contourné) est refusée (AC2).

## Tasks / Subtasks

- [ ] **Tâche 0 — Prérequis & dépendance** (AC: 2)
  - [ ] 5.1-5.7 `done`. `bun add zod` (PLAN §3.3). 🛑 Trancher react-hook-form si voulu.
- [ ] **Tâche 1 — Lectures admin dédiées** (AC: 1 ; piège n°1)
  - [ ] Liste non cachée, tous statuts ; filtre/tri (titre, catégorie, statut).
- [ ] **Tâche 2 — Schéma Zod partagé** (AC: 2, 3 ; pièges n°2, 4)
  - [ ] `schemas/project.ts` (champs + slug URL-safe) importé client & serveur.
- [ ] **Tâche 3 — Créer/Modifier (Server Actions)** (AC: 2, 3, 4 ; pièges n°1, 3, 4)
  - [ ] Formulaire (`useActionState`) → Server Action `requireAdmin` + Zod ; slug suggéré ; collision P2002 → message ; `revalidateTag('projects')`.
- [ ] **Tâche 4 — Supprimer (confirmation + cascade)** (AC: 5 ; piège n°5)
  - [ ] Dialogue de confirmation ; delete → cascade highlights ; détache stacks ; `revalidateTag`.
- [ ] **Tâche 5 — Vérification locale** (AC: 1-5 ; piège n°7)
  - [ ] Liste/filtre/tri ; create+validation double ; slug conflit ; update visible après revalidation ; delete confirmé + cascade.
- [ ] **Tâche 6 — Definition of Done** (AGENTS.md §8)
  - [ ] lint 0 / tsc 0 / build OK. Vérif visuelle. `git diff DEV` : pages projets, schéma Zod, Server Actions, `zod` — rien d'autre.
  - [ ] `File List` + `Completion Notes` + `Change Log` · `sprint-status.yaml`.

## Dev Notes

### Périmètre — verrouillé

**CRUD projets (champs scalaires) : liste filtrable/triable, création/modification (Server Action + Zod partagé, slug unique + suggestion), suppression confirmée avec cascade highlights, revalidateTag('projects').**

**Hors périmètre — ne pas faire :**
- ❌ **Highlights répétables & sélecteur de stacks détaillés + aperçu live** → 5.9.
- ❌ **Réordonnancement drag & drop** → 5.10.
- ❌ **Brouillon/publié + `?preview=1`** → 5.11 (statut exposé simplement ici).
- ❌ **Upload cover / Media** → 5.12.
- ❌ **AuditLog** → 5.19.
- ❌ **Dépendance hors `zod`** (react-hook-form : à valider).

### Le vrai enjeu

C'est le **CRUD pivot** : il établit le pattern `requireAdmin` + Zod partagé + Server Action + `revalidateTag`, cœur de « éditer sans commit » (PLAN §3.3). Le piège central : l'admin écrit sur le **même `Project`** que lit le public (Epic 4), donc chaque mutation **doit** invalider le tag `projects`, et les lectures admin doivent être **distinctes** (non cachées, tous statuts) des lectures publiques (cachées, publiées). Ce pattern est copié par 5.9-5.19.

### Testing standards

Vérification **manuelle en local** + visuelle. Les 5 AC, dont validation serveur avec client contourné (AC2) et propagation au public après revalidation (AC4). tsc/lint/build verts.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.8]
- [Source: PLAN_REFONTE_2026.md §3.2 — `/admin/projects`, `/admin/projects/[id]` ; §3.3 — Server Actions + Zod partagé client/serveur, ISR + revalidateTag]
- [Source: apps/web/src/lib/projects.ts — lecture publique cachée (`published:true`, tag `projects`) : NE PAS réutiliser pour l'admin]
- [Source: apps/web/src/lib/cache-tags.ts — `CACHE_TAGS.projects` ; apps/web/prisma/schema.prisma — Project (slug @unique), Highlight (onDelete: Cascade), Stack (ProjectStacks)]
- [Source: _bmad-output/implementation-artifacts/5-2-verrouiller-l-acces-a-l-administration.md — `requireAdmin` ; 5-7 — layout admin]
- [Source: AGENTS.md §6 — Server Components/Actions, validation, a11y ; §9 — anti-scope-creep, zéro dépendance non prévue]
