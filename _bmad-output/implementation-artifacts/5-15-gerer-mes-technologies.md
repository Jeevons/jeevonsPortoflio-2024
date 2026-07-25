---
baseline_commit: 5c22f3a6c48914801d0a226ab5a0b15c005d8765
---

# Story 5.15: Gérer mes technologies

Status: ready-for-dev

## Story

As **Jeevons**,
I want **tenir à jour la liste des technologies que je maîtrise et mon niveau sur chacune**,
so that **la section « Stack & outils » reflète honnêtement où j'en suis**.

## Acceptance Criteria

**AC1 — CRUD technologie (nom unique + clé d'icône + niveau)**
**Given** je suis sur l'écran des technologies
**When** je crée ou modifie une technologie
**Then** je renseigne son nom, sa clé d'icône et mon niveau de maîtrise
**And** le nom doit rester unique, un doublon étant refusé avec un message clair

**AC2 — Suppression = avertissement + dissociation (pas de suppression des projets)**
**Given** une technologie est associée à des projets
**When** je tente de la supprimer
**Then** je suis averti du nombre de projets concernés avant de confirmer
**And** confirmer retire l'association sans supprimer les projets

**AC3 — Niveaux reflétés côté public**
**Given** j'ai modifié mes niveaux de maîtrise
**When** je consulte le site public après revalidation
**Then** la section des technologies reflète ces niveaux

## Contexte d'implémentation

### 🛑 Prérequis : socle sécurité + 5.8/5.9 (éditeur projet) `done`

CRUD du modèle **`Stack`** (Epic 4) + gestion de l'association many-to-many `ProjectStacks`. PLAN §3.2 (`/admin/stacks` : CRUD technologies, même pattern).

### 🎯 Ce que fait vraiment cette story

`/admin/stacks` : CRUD des **`Stack`** (name **unique**, `iconKey`, level), et une **suppression qui avertit du nombre de projets associés puis dissocie sans supprimer les projets**. Revalidation via tag **`projects`** (la section publique des technologies en dépend).

### ⚠️ Piège n°1 — Modèle `Stack` + relation `ProjectStacks` déjà en place (Epic 4)

- Schéma 4.2 : `Stack { name @unique, level SkillLevel, ... }`, relation **bidirectionnelle** `ProjectStacks` (many-to-many implicite ou table de jointure — vérifier la forme exacte dans `schema.prisma`). `SkillLevel` est un **enum** (valeurs à réutiliser telles quelles). ❌ Ne pas recréer le modèle ; le manipuler.
- ⚠️ **Clé d'icône** (AC1 « sa clé d'icône ») : vérifier qu'un champ (`iconKey`/`icon`) existe sur `Stack`. S'il n'existe **pas**, c'est un **ajout de colonne + migration** additive. 🛑 Vérifier le schéma avant de conclure. La clé doit correspondre au jeu d'icônes déjà utilisé par la section publique « Stack & outils » (Epic 4) — réutiliser, ne pas inventer un nouveau système d'icônes.
- ⚠️ `name @unique` : la Server Action doit gérer proprement la **violation d'unicité** (P2002) → message «`<nom>` existe déjà » (AC1), pas une 500.

### ⚠️ Piège n°2 (CENTRAL) — Suppression = avertir puis DISSOCIER (AC2), ≠ garde bloquante

- ⚠️ Contrairement à la garde média (5.13) qui **refuse**, ici la suppression est **autorisée** : on **avertit** du **nombre de projets** concernés, et si l'utilisateur **confirme**, on **retire l'association** (`ProjectStacks`) **sans supprimer les projets**, puis on supprime la `Stack` (AC2). Ne **pas** confondre les deux sémantiques.
- ⚠️ Selon la forme de la relation, régler/gérer le `onDelete` pour que la dissociation soit **propre** (les projets restent intacts, seule la ligne de jointure disparaît). Opération **transactionnelle**. 🛑 Vérifier le comportement `onDelete` de `ProjectStacks` dans le schéma pour que la dissociation soit correcte et ne cascade **pas** sur les projets.

### ⚠️ Piège n°3 — Association depuis l'éditeur projet

- L'association/dissociation au cas par cas se fait **dans l'éditeur projet** (5.9) : un multi-select des `Stack` existantes. ⚠️ Cette story fournit le **CRUD des Stack** ; si 5.9 a déjà branché le multi-select, ne pas le dupliquer. Mutation projet → `revalidateTag('projects')`.

### ⚠️ Piège n°4 — Section publique « Stack & outils » (AC3)

- ⚠️ La section publique affiche les technologies et **niveaux** (Epic 4). Modifier un niveau / créer / supprimer une `Stack` doit rafraîchir cette section → `revalidateTag('projects')`. Vérifier le tag exact utilisé par la lecture publique des stacks (probablement `projects` ; sinon aligner). AC3 : niveaux reflétés après revalidation.

### ⚠️ Piège n°5 — Réutiliser le pattern mutation 5.8

- `requireAdmin` + Server Action + Zod (name non vide/unique ; iconKey dans le jeu connu ; level ∈ enum) + `revalidateTag`. Lectures admin dédiées (non cachées). AuditLog = 5.19.

### ⚠️ Piège n°6 — Vérification locale

- Créer une techno (nom + clé d'icône + niveau) (AC1) ; tenter un **doublon de nom** → refus clair (AC1). Supprimer une techno **associée** à des projets → **avertissement du nombre de projets**, confirmation → la techno disparaît, **les projets restent** mais sans cette techno (AC2). Modifier un niveau → reflété dans la section publique après revalidation (AC3).

## Tasks / Subtasks

- [ ] **Tâche 0 — Prérequis** (AC: 1)
  - [ ] Socle + 5.8/5.9 `done`. Vérifier `ProjectStacks` (`onDelete`) + présence d'un champ clé d'icône dans le schéma.
- [ ] **Tâche 1 — CRUD `Stack`** (AC: 1 ; pièges n°1, 5)
  - [ ] `/admin/stacks` : liste + éditeur (Zod name unique / iconKey / level enum) ; gestion P2002 ; migration `iconKey` si absent ; `revalidateTag('projects')`.
- [ ] **Tâche 2 — Suppression avec avertissement + dissociation** (AC: 2 ; piège n°2)
  - [ ] Compter les projets associés → **avertir** ; confirmation → dissocier (`ProjectStacks`) sans supprimer les projets, puis supprimer la `Stack`, en transaction ; `revalidateTag('projects')`.
- [ ] **Tâche 3 — Cohérence publique** (AC: 3 ; pièges n°3, 4)
  - [ ] Niveaux/associations reflétés après revalidation ; ne pas dupliquer le multi-select de 5.9.
- [ ] **Tâche 4 — Vérification locale** (AC: 1-3 ; piège n°6)
  - [ ] CRUD (icône), doublon refusé, suppression = avertissement + dissociation (projets intacts), niveaux publics.
- [ ] **Tâche 5 — Definition of Done** (AGENTS.md §8)
  - [ ] lint 0 / tsc 0 / build OK. Vérif visuelle + clavier. `git diff DEV` : écran stacks, CRUD, suppression+dissociation, (migration iconKey) — rien d'autre.
  - [ ] `File List` + `Completion Notes` + `Change Log` · `sprint-status.yaml`.

## Dev Notes

### Périmètre — verrouillé

**CRUD `Stack` (`/admin/stacks`) : name unique + clé d'icône + level (enum) ; suppression qui avertit du nombre de projets associés puis dissocie sans supprimer les projets ; niveaux reflétés côté public après revalidateTag('projects').**

**Hors périmètre — ne pas faire :**
- ❌ **Recréer `Stack`/`ProjectStacks`** (existants, Epic 4).
- ❌ **Réécrire l'éditeur projet** → 5.9 (compléter le multi-select si besoin).
- ❌ **Nouveau système d'icônes** (réutiliser le jeu existant).
- ❌ **AuditLog** → 5.19.
- ❌ **Nouvelle dépendance**.

### Le vrai enjeu

Deux subtilités : (1) **unicité du nom** (`@unique`, gérer P2002 proprement, AC1) et la **clé d'icône** (vérifier si la colonne existe → sinon migration additive, en réutilisant le jeu d'icônes public) ; (2) la sémantique de suppression est **avertir + dissocier** (les projets survivent, seule la jointure disparaît), **différente** de la garde bloquante de 5.13 — à ne pas confondre, et à faire en transaction avec un `onDelete` qui ne cascade pas sur les projets. La section publique dépend du tag `projects`.

### Testing standards

Vérification **manuelle en local** + visuelle. Les 3 AC dont doublon refusé (AC1) et suppression = avertissement + dissociation projets intacts (AC2). tsc/lint/build verts.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.15]
- [Source: PLAN_REFONTE_2026.md §3.2 — `/admin/stacks` CRUD technologies (même pattern)]
- [Source: apps/web/prisma/schema.prisma — Stack (name @unique, level SkillLevel), ProjectStacks (relation bidirectionnelle), enum SkillLevel]
- [Source: _bmad-output/implementation-artifacts/5-9-decrire-finement-un-projet.md — éditeur projet (association stacks) ; 5-8 — pattern mutation requireAdmin + revalidateTag]
- [Source: AGENTS.md §6 — sécurité, a11y ; §9 — anti-scope-creep]
