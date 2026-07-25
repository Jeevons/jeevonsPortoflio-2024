---
baseline_commit: 5c22f3a6c48914801d0a226ab5a0b15c005d8765
---

# Story 5.8: Gérer mes projets

Status: review

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

- [x] **Tâche 0 — Prérequis & dépendance** (AC: 2)
  - [x] 5.1-5.7 `done`. `bun add zod` (PLAN §3.3). 🛑 Trancher react-hook-form si voulu.
    - Décision Jeevons : **zod + react-hook-form + @hookform/resolvers** (validation client live champ par champ, en vue des formulaires longs de 5.9).
- [x] **Tâche 1 — Lectures admin dédiées** (AC: 1 ; piège n°1)
  - [x] Liste non cachée, tous statuts ; filtre/tri (titre, catégorie, statut).
    - `lib/admin/projects.ts`, distinct de `lib/projects.ts` (cachée, `published:true`). Filtre/tri **en base**. `parseProjectFilters` valide les `searchParams` sur une **liste fermée** (un `sort` arbitraire n'atteint jamais l'`orderBy` Prisma).
- [x] **Tâche 2 — Schéma Zod partagé** (AC: 2, 3 ; pièges n°2, 4)
  - [x] `schemas/project.ts` (champs + slug URL-safe) importé client & serveur.
    - Un seul schéma, **zéro règle dupliquée**. Pas de `server-only` (il doit être importable côté client) ; l'import ne vise que `generated/prisma/enums` (enums purs), pas le client Prisma.
- [x] **Tâche 3 — Créer/Modifier (Server Actions)** (AC: 2, 3, 4 ; pièges n°1, 3, 4)
  - [x] Formulaire (`useActionState`) → Server Action `requireAdmin` + Zod ; slug suggéré ; collision P2002 → message ; `revalidateTag('projects')`.
    - `guardAndValidate` factorise garde + validation : create et update **ne peuvent pas diverger**. Suggestion de slug en **création uniquement** (renommer un projet publié ne doit pas casser son URL). Conflit détecté via **P2002** plutôt qu'un `findUnique` préalable (immunisé aux courses).
- [x] **Tâche 4 — Supprimer (confirmation + cascade)** (AC: 5 ; piège n°5)
  - [x] Dialogue de confirmation ; delete → cascade highlights ; détache stacks ; `revalidateTag`.
    - `<dialog showModal()>` natif (piège du focus, Échap, fond inerte) — **aucune dépendance ajoutée** là où `AlertDialog` aurait imposé Radix.
- [x] **Tâche 5 — Vérification locale** (AC: 1-5 ; piège n°7)
  - [x] Liste/filtre/tri ; create+validation double ; slug conflit ; update visible après revalidation ; delete confirmé + cascade.
    - **33 contrôles automatisés verts** contre la vraie base (script jetable, non versionné). **AC4 prouvé de bout en bout** : le public a servi le titre périmé jusqu'au `revalidateTag('projects')`, puis le nouveau immédiatement. Base restaurée, zéro résidu.
- [x] **Tâche 6 — Definition of Done** (AGENTS.md §8)
  - [x] lint 0 / tsc 0 / build OK. Vérif visuelle. `git diff DEV` : pages projets, schéma Zod, Server Actions, `zod` — rien d'autre.
    - `bunx tsc --noEmit` **0 erreur** · `bun run lint` **0 erreur** (1 warning **préexistant** dans `TestimonialsClient.tsx`, hors périmètre) · `bun run build` **succès**. Vérification visuelle **déléguée à Jeevons** (session 2FA requise).
  - [x] `File List` + `Completion Notes` + `Change Log` · `sprint-status.yaml`.

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

## Dev Agent Record

### Implementation Plan

Le CRUD est bâti autour d'**un seul pattern de mutation**, celui que copieront 5.9-5.19 :

```
requireAdmin()  →  projectSchema.safeParse()  →  prisma.write()  →  revalidateTag('projects')
```

Chaque maillon répond à un piège de la story : `requireAdmin` parce qu'une Server Action est un endpoint POST atteignable **sans passer par la page** (le guard de layout ne la protège pas) ; le schéma **partagé** parce qu'AC2 exige les mêmes règles des deux côtés ; `revalidateTag` parce que l'admin écrit sur le **même `Project`** que lit le public en cache (AC4).

**Séparation des lectures (piège central n°1).** `lib/admin/projects.ts` est délibérément **distinct** de `lib/projects.ts` : le public lit *caché + `published:true` + repli statique*, l'admin lit *non caché + tous statuts + sans repli*. Un repli sur un écran de gestion **mentirait** (on éditerait un contenu figé sans rien écrire). Le seul point de contact est le tag `projects`, partagé pour l'invalidation.

**Deux décisions prises avec Jeevons** avant d'écrire du code (AGENTS.md §9 règle 3) : react-hook-form retenu en plus de Zod ; filtre/tri via `searchParams` côté serveur, la page restant un Server Component.

### Debug Log

- **`z.enum(Object.values(...) as [string, ...])` → `tsc` en erreur.** Le cast élargissait la catégorie en `string`, non assignable au `ProjectCategory` de Prisma. Corrigé en passant **l'objet d'enum** à `z.enum` : l'union littérale est préservée, et la Server Action n'a **aucun re-cast** à faire — donc aucune confiance non vérifiée réintroduite.
- **`slugify` : marques diacritiques littérales dans la regex.** Les caractères combinants U+0300–U+036F, invisibles à l'écran, sont fragiles au moindre passage d'éditeur. Remplacés par la forme échappée `[\u0300-\u036f]`.
- **Conteneur `web` en 500 (`lucide-react` introuvable).** `node_modules` du volume datait d'avant la story 5.7. `bun install` dans le conteneur — sans rapport avec le code de cette story.
- **Assertion de tri erronée (mon test, pas le code).** Postgres classe `"Landing Page."` avant `"Landing page."`, `localeCompare("fr")` fait l'inverse : ces deux titres ne diffèrent que par la casse. Rejouer un tri JS testait la collation de Node, pas la requête — assertion corrigée en comparaison insensible à la casse. **Le tri en base était correct.**

### Completion Notes

**Les 5 AC sont satisfaits et vérifiés contre la vraie base** (33 contrôles automatisés, tous verts) :

- **AC1** — Liste `/admin/projects` : titre, catégorie, statut, **brouillons compris**. Filtre (recherche titre/entreprise insensible à la casse, catégorie, statut) et tri (4 colonnes × 2 sens) **en base**, état dans l'URL donc partageable et compatible avec le bouton « retour ». Des `searchParams` hostiles (`sort=passwordHash`, `dir='; drop table`) retombent silencieusement sur les défauts et la liste reste servie.
- **AC2** — **Un seul schéma** pour les deux côtés. Les 11 cas invalides envoyés **directement au schéma serveur, client contourné** sont tous refusés (titre/entreprise/période/slug vides, slug avec espaces/majuscules/accents, catégorie inconnue, `javascript:` et URL relative sur `link`, `ftp://` sur `repoUrl`).
- **AC3** — Slug `@unique` : le doublon est rejeté par la base (**P2002** confirmé) et traduit en message explicite, jamais en 500. Suggestion depuis le titre vérifiée sur les accents (« Réfonte de l'été 2026 » → `refonte-de-l-ete-2026`), la ponctuation et les tirets de bord.
- **AC4** — **Prouvé de bout en bout** : après modification en base, le site public a continué de servir le titre **périmé** (cache 4.4 actif), puis a affiché le nouveau **immédiatement** après `revalidateTag('projects')` — l'appel exact que font les trois actions.
- **AC5** — Suppression **derrière un dialogue de confirmation obligatoire**, jamais en un clic. Cascade vérifiée : 2 highlights supprimés avec le projet, et la **technologie partagée survit** (seule la jointure est retirée).

**Périmètre tenu.** Rien de 5.9 (highlights/stacks détaillés), 5.10 (drag & drop), 5.11 (brouillon/preview — `published` reste une simple case), 5.12 (cover), 5.19 (AuditLog : les trois actions sont ses points de branchement, non anticipés). `git diff DEV` ne contient que les écrans projets, le schéma Zod, les Server Actions et les 3 dépendances validées.

**Accessibilité** (AGENTS.md §6) : `<label for>` sur chaque champ, `aria-invalid` + `aria-describedby` vers le message d'erreur, `role="alert"` sur les erreurs, `<th scope="row">` sur le titre de ligne, focus visible partout, dialogue natif (piège du focus + Échap), tableau en `overflow-x-auto` (la page ne défile jamais horizontalement). Aucune animation introduite → `prefers-reduced-motion` sans objet ici.

**Point d'attention pour la relecture.** Le formulaire s'appuie sur `<form action={formAction}>` (Server Action native) et non sur `handleSubmit` de react-hook-form : la soumission fonctionne donc **sans JavaScript**, react-hook-form n'apportant que l'affichage instantané des erreurs. C'est délibéré — le client est un confort, le serveur la seule garantie.

**Dette assumée.** `updatedAt` s'affiche en `Europe/Paris` codé en dur (back-office mono-utilisateur) ; la liste n'est pas paginée (6 projets aujourd'hui, à revoir au-delà de ~100).

### File List

**Ajoutés**
- `apps/web/src/lib/schemas/project.ts` — schéma Zod partagé client/serveur + `slugify` + `projectFormDataToInput`
- `apps/web/src/lib/admin/projects.ts` — lectures admin dédiées (non cachées, tous statuts) + `parseProjectFilters`
- `apps/web/src/app/(admin)/admin/projects/actions.ts` — Server Actions create / update / delete
- `apps/web/src/app/(admin)/admin/projects/page.tsx` — liste filtrable/triable
- `apps/web/src/app/(admin)/admin/projects/project-filters.tsx` — barre de filtres (client)
- `apps/web/src/app/(admin)/admin/projects/project-form.tsx` — formulaire create/edit (client)
- `apps/web/src/app/(admin)/admin/projects/delete-project-dialog.tsx` — dialogue de confirmation (client)
- `apps/web/src/app/(admin)/admin/projects/new/page.tsx` — écran de création
- `apps/web/src/app/(admin)/admin/projects/[id]/page.tsx` — éditeur d'un projet

**Modifiés**
- `apps/web/package.json` · `apps/web/bun.lock` — ajout de `zod`, `react-hook-form`, `@hookform/resolvers`
- `apps/web/src/components/admin/admin-nav.tsx` — entrée « Projets » passée à `ready: true`
- `apps/web/src/app/(admin)/admin/page.tsx` — « Créer mon premier projet » : placeholder désactivé → vrai lien
- `_bmad-output/implementation-artifacts/5-8-gerer-mes-projets.md` · `sprint-status.yaml`

### Change Log

| Date | Changement |
|---|---|
| 2026-07-25 | CRUD projets : liste filtrable/triable, création/modification (Zod partagé, slug unique + suggestion), suppression confirmée avec cascade highlights, `revalidateTag('projects')` sur chaque mutation (story 5.8). Ajout de `zod`, `react-hook-form`, `@hookform/resolvers` (validés par Jeevons). Statut → `review`. |

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.8]
- [Source: PLAN_REFONTE_2026.md §3.2 — `/admin/projects`, `/admin/projects/[id]` ; §3.3 — Server Actions + Zod partagé client/serveur, ISR + revalidateTag]
- [Source: apps/web/src/lib/projects.ts — lecture publique cachée (`published:true`, tag `projects`) : NE PAS réutiliser pour l'admin]
- [Source: apps/web/src/lib/cache-tags.ts — `CACHE_TAGS.projects` ; apps/web/prisma/schema.prisma — Project (slug @unique), Highlight (onDelete: Cascade), Stack (ProjectStacks)]
- [Source: _bmad-output/implementation-artifacts/5-2-verrouiller-l-acces-a-l-administration.md — `requireAdmin` ; 5-7 — layout admin]
- [Source: AGENTS.md §6 — Server Components/Actions, validation, a11y ; §9 — anti-scope-creep, zéro dépendance non prévue]
