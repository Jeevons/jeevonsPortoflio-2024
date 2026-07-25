---
baseline_commit: 5c22f3a6c48914801d0a226ab5a0b15c005d8765
---

# Story 5.9: Décrire finement un projet

Status: review

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

- [x] **Tâche 0 — Prérequis** (AC: 1)
  - [x] 5.8 `done`. Réutiliser schéma Zod + Server Action projet.
- [x] **Tâche 1 — Highlights répétables + ordre** (AC: 1 ; piège n°2)
  - [x] UI répétable (add/edit/remove, sans limite) + réordonnancement (accessible clavier) → `sortOrder` persisté ; `revalidateTag`.
- [x] **Tâche 2 — Sélecteur de stacks** (AC: 2 ; piège n°3)
  - [x] Multi-select des `Stack` existantes → `connect/set` (bidirectionnel).
- [x] **Tâche 3 — Aperçu live** (AC: 3 ; piège n°1)
  - [x] Réutiliser le composant carte réel, alimenté par l'état client ; MAJ à la frappe. Extraire la présentation si nécessaire.
- [x] **Tâche 4 — Champs optionnels** (AC: 4 ; piège n°4)
  - [x] Optionnels tolérés ; section masquée côté public si vide. 🛑 Clarifier « résultat chiffré » (champ hors schéma ?) avec Jeevons.
- [x] **Tâche 5 — Vérification locale** (AC: 1-4 ; piège n°6)
  - [x] Highlights (CRUD + ordre reflété), stacks (bidirectionnel), aperçu live fidèle, optionnels vides tolérés + masquage.
- [x] **Tâche 6 — Definition of Done** (AGENTS.md §8)
  - [x] lint 0 / tsc 0 / build OK. Vérif visuelle (dont aperçu). `git diff DEV` : éditeur enrichi, gestion highlights/stacks, aperçu — rien d'autre.
  - [x] `File List` + `Completion Notes` + `Change Log` · `sprint-status.yaml`.

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

## Dev Agent Record

### Completion Notes

**Décision Jeevons — « résultat chiffré » (piège n°4, Tâche 4).** L'AC4 parle d'un résultat
chiffré qui n'existait pas au schéma. Question posée, réponse retenue : **ajouter un champ
`outcome String?`** par migration additive (`20260725122815_add_project_outcome`), plutôt que
de réinterpréter l'AC sur les optionnels existants. Champ optionnel par nature : vide → la
section publique est masquée, jamais rendue en bloc vide.

**AC3 — aperçu live : extraction de `ProjectCard` (le point technique de la story).** Plutôt
que de recoder une fausse carte, la carte a été **extraite** de `ProjectList.tsx` vers
`src/components/ProjectCard.tsx`. Ce composant n'a **ni `"use client"`, ni import
`server-only`, ni accès base** : c'est une vue pure (pattern AGENTS.md §6), donc rendue
côté serveur sur le site public ET côté client dans l'aperçu admin. L'aperçu ne peut donc
pas diverger du rendu réel — c'est littéralement le même composant. `ProjectList` réexporte
`type Project = ProjectCardData` : aucun import appelant n'a bougé.

**AC1 — ordre des highlights : la position dans le tableau est la source unique.** Le
formulaire réindexe les `name` à chaque rendu, et le serveur dérive `sortOrder` de l'index du
tableau. Il n'existe donc pas de seconde valeur d'ordre susceptible de diverger.
Réordonnancement par boutons monter/descendre — **nativement accessibles au clavier**, et
choix délibéré de **ne pas introduire dnd-kit ici** pour ne pas dupliquer l'infra de 5.10
(piège n°2).

**AC1 — réconciliation par `id`, pas delete-all/recreate.** Les highlights soumis sont
rapprochés des existants par `id` dans une `$transaction` : mise à jour si l'id existe,
création sinon, suppression des absents. Un highlight modifié **conserve son id** (vérifié).
Garde de sécurité : les ids soumis sont filtrés contre ceux appartenant réellement au projet
— un id emprunté à un autre projet ne peut pas servir à le modifier.

**AC2 — bidirectionnalité vérifiée, pas seulement supposée.** `set` (et non `connect` seul)
côté update pour permettre la **dés**association. Vérifié en base que `stack.projects`
contient bien le projet après association.

**⚠️ Bug que j'ai introduit puis corrigé — clé `published` perdue.** En réécrivant l'objet
retourné par `projectFormDataToInput`, j'avais omis `published` : `projectSchema.parse`
échouait alors avec `expected boolean, received undefined` et **toute sauvegarde aurait
échoué**. Ni `tsc` ni le lint ne l'ont vu (le retour est typé `unknown`) — seule l'exécution
réelle l'a révélé. Restauré en `formData.has("published")`, plus robuste que le
`=== "on"` d'origine qui repose sur une convention navigateur.

**Vérification réalisée (Tâche 5).** Un script jetable a exercé la **vraie logique serveur
contre le vrai Postgres** : outcome vide → `null` persisté ; ordre initial `sortOrder` 0,1,2 ;
stacks connectées + bidirectionnalité confirmée ; réordonnancement → ordre attendu avec
`sortOrder` contigus ; suppression effective ; **identité préservée** ; désassociation via
`set` ; liste de highlights vide tolérée. Script supprimé ensuite. Masquage AC4 vérifié sur le
HTML réellement rendu, dans les deux sens (vide → ni bloc outcome, ni `<ul>` vide, ni bouton).

**⚠️ Limite à connaître avant de passer la story en `done`.** L'écran admin lui-même n'a **pas
été ouvert dans un navigateur** : y accéder exige mot de passe + TOTP (stories 5.3/5.5), et je
n'ai pas cherché à contourner la 2FA. Les AC1–AC4 ont été validés par la logique serveur
contre la vraie base et par le rendu réel de `ProjectCard`. **Une passe visuelle manuelle de
Jeevons sur `/admin/projects/[id]` reste recommandée** avant `done`.

**Hors périmètre, non touché.** Un warning lint préexistant subsiste dans
`sections/TestimonialsClient.tsx` (`useEffect` dep `autoScroll`) : sans rapport avec cette
story, délibérément laissé en l'état.

### File List

**Ajoutés**
- `apps/web/prisma/migrations/20260725122815_add_project_outcome/migration.sql`
- `apps/web/src/components/ProjectCard.tsx`
- `apps/web/src/app/(admin)/admin/projects/highlights-editor.tsx`
- `apps/web/src/app/(admin)/admin/projects/stacks-selector.tsx`
- `apps/web/src/app/(admin)/admin/projects/project-preview.tsx`

**Modifiés**
- `apps/web/prisma/schema.prisma` (champ `outcome String?`)
- `apps/web/src/lib/schemas/project.ts` (`highlightSchema`, `outcome`, `stackIds`, `formDataToHighlights`)
- `apps/web/src/lib/admin/projects.ts` (`outcome`/`highlights`/`stacks` + `listStackOptions`)
- `apps/web/src/app/(admin)/admin/projects/actions.ts` (nested create + réconciliation en transaction)
- `apps/web/src/app/(admin)/admin/projects/project-form.tsx` (highlights, stacks, aperçu, `useWatch`)
- `apps/web/src/app/(admin)/admin/projects/[id]/page.tsx`
- `apps/web/src/app/(admin)/admin/projects/new/page.tsx`
- `apps/web/src/components/ProjectList.tsx` (consomme `ProjectCard`)
- `apps/web/src/sections/Projects.tsx`, `apps/web/src/sections/SelfProject.tsx` (mapping `outcome`)
- `apps/web/src/content/fallbacks.ts` (`outcome: null`)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

| Date | Version | Description |
| --- | --- | --- |
| 2026-07-25 | 0.1 | Story 5.9 implémentée : highlights répétables ordonnés, association de stacks bidirectionnelle, aperçu live via extraction de `ProjectCard`, champ `outcome` optionnel (migration additive, décision Jeevons). lint 0 erreur / tsc 0 erreur / build OK. Statut → `review`. |
