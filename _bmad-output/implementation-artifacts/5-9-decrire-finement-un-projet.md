---
baseline_commit: 5c22f3a6c48914801d0a226ab5a0b15c005d8765
---

# Story 5.9: Décrire finement un projet

Status: ready-for-dev

## Story

As **Jeevons**,
I want **détailler les points forts et les technologies de chaque projet**,
so that **un recruteur comprenne ce que j'ai réellement fait et avec quoi**.

## Acceptance Criteria

**AC1 — Points forts : ajout/modif/suppression + réordonnancement persisté**
**Given** j'édite un projet
**When** je gère ses points forts
**Then** je peux en ajouter, en modifier, en supprimer, sans limite arbitraire
**And** je peux les réordonner, l'ordre étant conservé après enregistrement et reflété sur le site public

**AC2 — Association multiple de technologies, bidirectionnelle**
**Given** j'édite un projet
**When** je gère ses technologies
**Then** je peux en associer plusieurs depuis la liste des technologies existantes
**And** l'association est bidirectionnelle : la technologie connaît ses projets

**AC3 — Aperçu live de la carte projet**
**Given** je saisis un projet
**When** je remplis le formulaire
**Then** un aperçu de la carte du projet s'affiche à côté et se met à jour à mesure que je tape
**And** cet aperçu ressemble à ce que verra réellement un visiteur

**AC4 — Champs optionnels tolérés, section masquée côté public**
**Given** un projet peut ne pas avoir de résultat chiffré
**When** je laisse ces champs vides
**Then** l'enregistrement est accepté
**And** la page publique du projet masque simplement la section correspondante

## Contexte d'implémentation

### 🛑 Prérequis : story 5.8 `done` (CRUD projet de base)

5.8 gère les champs scalaires du projet. 5.9 **enrichit l'éditeur** : highlights répétables, association de stacks, **aperçu live** de la carte. PLAN §3.2 (`/admin/projects/[id]` : highlights répétables + sélecteur de stacks + aperçu live).

### 🎯 Ce que fait vraiment cette story

Dans l'éditeur de projet (5.8) : gérer les **`Highlight`** (ajout/modif/suppr **sans limite** + réordonnancement persisté), **associer plusieurs `Stack`** (relation many-to-many `ProjectStacks`, bidirectionnelle), afficher un **aperçu live** de la carte projet qui se met à jour à la frappe, et tolérer les **champs optionnels** vides (section masquée côté public).

### ⚠️ Piège n°1 (CENTRAL) — Aperçu live = réutiliser le VRAI composant de carte (AC3)

- AC3 : « ressemble à ce que verra réellement un visiteur ». ⚠️ Ne **pas** recoder une fausse carte. Réutiliser le composant public réel (`src/components/Card.tsx` / `ProjectList.tsx` / la carte de `Projects.tsx`) alimenté par l'état **client** du formulaire (données non encore enregistrées).
- ⚠️ **Contrainte `server-only`** : les libs de données sont `server-only`, mais les **composants de présentation** (Card) doivent pouvoir recevoir des props côté client pour l'aperçu. Vérifier que `Card.tsx` est une vue pure (pas d'accès DB) → utilisable en client. Si la carte importe des choses serveur, en extraire la partie présentation. C'est le point technique de la story (pattern « vue bête » d'AGENTS.md §6, déjà appliqué en 4.2 : conteneur serveur → vue Client).
- L'aperçu reflète highlights + stacks + champs en direct (état React), sans round-trip serveur.

### ⚠️ Piège n°2 — Highlights répétables : ordre persisté (AC1)

- `Highlight` (Epic 4) : `label`, `sortOrder`, `projectId` (cascade). Éditeur = liste **répétable** (ajouter/retirer des lignes, sans limite arbitraire). Réordonnancement → persister `sortOrder` (AC1). La lecture publique ordonne déjà par `sortOrder` (`projects.ts` : `highlights: { orderBy: { sortOrder: 'asc' } }`) → l'ordre saisi se reflète (AC1).
- ⚠️ Pas de clé naturelle sur `Highlight` (cf. seed 4.1 : « on REMPLACE »). En édition admin, gérer create/update/delete par `id` existant ou remplacement contrôlé — sans dupliquer. Après save → `revalidateTag('projects')`.
- ⚠️ Le **drag&drop** générique de tri est 5.10 ; ici l'ordre des highlights peut se gérer par un moyen simple (boutons monter/descendre ou dnd léger). 🛑 Éviter de dupliquer l'infra dnd de 5.10 — si dnd-kit est introduit ici, le mutualiser. Prévoir un moyen **accessible** au clavier (AGENTS.md §6).

### ⚠️ Piège n°3 — Association stacks many-to-many bidirectionnelle (AC2)

- Relation `Project.stacks` ⇄ `Stack.projects` (`@relation("ProjectStacks")`, Epic 4) = déjà bidirectionnelle en base (AC2 « la technologie connaît ses projets » est structurellement vrai). L'éditeur : **sélecteur multiple** depuis les `Stack` **existantes** (AC2 « depuis la liste des technologies existantes »). Utiliser `connect`/`set` Prisma pour (dé)associer.
- ⚠️ **Créer** de nouvelles technologies est le périmètre de **5.15** (CRUD stacks). Ici on **associe** l'existant, on n'en crée pas. Si la liste est vide, inviter à en créer via 5.15.

### ⚠️ Piège n°4 — Champs optionnels (AC4)

- Schéma Epic 4 : `description String?`, `link String?`, `repoUrl String?` déjà optionnels. AC4 parle de « résultat chiffré » : ⚠️ il n'existe **pas** de champ « résultat/metric » dans le schéma actuel. Deux lectures :
  - L'AC illustre le principe (champs vides tolérés → section masquée côté public), applicable aux optionnels existants (link, repoUrl, description).
  - Si un champ « résultat » est attendu par le design/PLAN, 🛑 **clarifier avec Jeevons** avant d'ajouter un champ hors schéma (migration additive) — sinon rester sur les optionnels existants. Ne pas inventer un champ non prévu (anti-scope-creep).
- Côté **public** : la page projet détaillée (`/projects/[slug]`) est **Epic 6** (FR24). Ici, « masquer la section » s'applique aux cartes/sections publiques **existantes** (Epic 4) : un champ vide ne doit pas afficher de bloc vide. Vérifier le rendu public actuel.

### ⚠️ Piège n°5 — Réutiliser le pattern de mutation de 5.8

- `requireAdmin` + Zod (étendre le schéma projet avec highlights[] et stackIds[]) + Server Action + `revalidateTag('projects')`. ❌ Ne pas réimplémenter un autre chemin de sauvegarde. AuditLog reste 5.19.

### ⚠️ Piège n°6 — Vérification locale

- Éditer un projet : ajouter/modifier/supprimer des highlights, les réordonner → après save, ordre reflété sur le public (AC1). Associer 2-3 stacks existantes → présent des deux côtés (vérifier `stack.projects`) (AC2). Aperçu : taper dans le formulaire → la carte à côté change en direct et ressemble au rendu public (AC3). Laisser des optionnels vides → save OK, section masquée côté public (AC4). Clavier : réordonnancement des highlights accessible.

## Tasks / Subtasks

- [ ] **Tâche 0 — Prérequis** (AC: 1)
  - [ ] 5.8 `done`. Réutiliser schéma Zod + Server Action projet.
- [ ] **Tâche 1 — Highlights répétables + ordre** (AC: 1 ; piège n°2)
  - [ ] UI répétable (add/edit/remove, sans limite) + réordonnancement (accessible clavier) → `sortOrder` persisté ; `revalidateTag`.
- [ ] **Tâche 2 — Sélecteur de stacks** (AC: 2 ; piège n°3)
  - [ ] Multi-select des `Stack` existantes → `connect/set` (bidirectionnel).
- [ ] **Tâche 3 — Aperçu live** (AC: 3 ; piège n°1)
  - [ ] Réutiliser le composant carte réel, alimenté par l'état client ; MAJ à la frappe. Extraire la présentation si nécessaire.
- [ ] **Tâche 4 — Champs optionnels** (AC: 4 ; piège n°4)
  - [ ] Optionnels tolérés ; section masquée côté public si vide. 🛑 Clarifier « résultat chiffré » (champ hors schéma ?) avec Jeevons.
- [ ] **Tâche 5 — Vérification locale** (AC: 1-4 ; piège n°6)
  - [ ] Highlights (CRUD + ordre reflété), stacks (bidirectionnel), aperçu live fidèle, optionnels vides tolérés + masquage.
- [ ] **Tâche 6 — Definition of Done** (AGENTS.md §8)
  - [ ] lint 0 / tsc 0 / build OK. Vérif visuelle (dont aperçu). `git diff DEV` : éditeur enrichi, gestion highlights/stacks, aperçu — rien d'autre.
  - [ ] `File List` + `Completion Notes` + `Change Log` · `sprint-status.yaml`.

## Dev Notes

### Périmètre — verrouillé

**Éditeur projet enrichi : highlights répétables (CRUD + ordre persisté), association multiple de stacks existantes (bidirectionnelle), aperçu live fidèle de la carte, tolérance des champs optionnels avec masquage public.**

**Hors périmètre — ne pas faire :**
- ❌ **CRUD des stacks (création de technologies)** → 5.15 (ici on associe l'existant).
- ❌ **Drag&drop générique de tri des projets** → 5.10 (mutualiser l'infra si dnd introduit).
- ❌ **Brouillon/preview** → 5.11 ; **upload cover** → 5.12 ; **AuditLog** → 5.19.
- ❌ **Page publique `/projects/[slug]`** → Epic 6.
- ❌ **Ajouter un champ hors schéma** sans validation Jeevons.

### Le vrai enjeu

L'**aperçu live** est le point technique : il exige de réutiliser le **vrai composant de carte** (AC3 « ressemble à ce que verra un visiteur ») alimenté par l'état client — donc une vue de présentation pure, séparée de la donnée serveur (pattern d'AGENTS.md §6, déjà éprouvé en 4.2). Highlights et stacks s'appuient sur des relations Epic 4 déjà en place (`Highlight` cascade, `ProjectStacks` bidirectionnel). Réutiliser le pattern de mutation de 5.8 sans le réinventer.

### Testing standards

Vérification **manuelle en local** + visuelle (aperçu). Les 4 AC (highlights CRUD+ordre, stacks bidirectionnels, aperçu fidèle, optionnels masqués), a11y clavier du réordonnancement. tsc/lint/build verts.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.9]
- [Source: PLAN_REFONTE_2026.md §3.2 — éditeur : highlights répétables + sélecteur de stacks + aperçu live de la carte]
- [Source: apps/web/prisma/schema.prisma — Highlight (label, sortOrder, cascade), Stack ⇄ Project (`ProjectStacks`, bidirectionnel)]
- [Source: apps/web/src/lib/projects.ts — highlights ordonnés par sortOrder côté public]
- [Source: apps/web/src/components/Card.tsx, ProjectList.tsx — composants de carte à réutiliser pour l'aperçu ; _bmad-output/implementation-artifacts/4-2-*.md — pattern conteneur serveur → vue Client]
- [Source: _bmad-output/implementation-artifacts/5-8-gerer-mes-projets.md — schéma Zod + Server Action projet à étendre]
- [Source: AGENTS.md §6 — vues bêtes, a11y clavier ; §9 — anti-scope-creep]
