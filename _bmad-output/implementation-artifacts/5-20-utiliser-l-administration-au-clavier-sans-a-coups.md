---
baseline_commit: 5c22f3a6c48914801d0a226ab5a0b15c005d8765
---

# Story 5.20: Utiliser l'administration au clavier, sans à-coups

Status: ready-for-dev

## Story

As **Jeevons**,
I want **une administration utilisable entièrement au clavier et sans clignotement au chargement**,
so that **mon back-office soit agréable à utiliser au quotidien**.

## Acceptance Criteria

**AC1 — Navigation clavier complète + focus visible**
**Given** je navigue au clavier dans l'administration
**When** je parcours une page avec la touche de tabulation
**Then** chaque élément interactif est atteignable, dans un ordre logique
**And** l'élément qui a le focus est toujours visible, avec un contraste suffisant

**AC2 — Focus piégé dans les dialogues, Échap ferme, focus restitué**
**Given** une boîte de dialogue de confirmation s'ouvre
**When** je navigue au clavier
**Then** le focus est piégé à l'intérieur et la touche d'échappement la ferme
**And** le focus revient à l'élément qui l'avait déclenchée

**AC3 — Silhouettes de chargement, pas de saut de page**
**Given** une liste ou un tableau charge ses données
**When** l'attente dure
**Then** une silhouette de chargement occupe la place du contenu final
**And** la page ne saute pas quand les données arrivent

**AC4 — Mouvement réduit respecté**
**Given** l'application respecte le réglage de mouvement réduit
**When** ce réglage est actif
**Then** l'animation de ces silhouettes est neutralisée

## Contexte d'implémentation

### 🛑 Prérequis : tous les écrans admin (5.1-5.18) `done`

Story **transversale de finition** : elle passe sur **tous** les écrans admin déjà construits pour garantir clavier, focus, skeletons et reduced-motion. C'est l'exigence a11y **non négociable** d'AGENTS.md §6 appliquée à l'ensemble du back-office. PLAN §3.4 (a11y admin) / §6 (skeletons, prefers-reduced-motion).

### 🎯 Ce que fait vraiment cette story

Passe de **finition a11y/perf** sur l'admin : (1) **navigation clavier** complète + **focus visible** contrasté partout (AC1) ; (2) **focus trap** + **Échap** + **restitution du focus** dans **toutes** les boîtes de dialogue (AC2) ; (3) **skeletons** (silhouettes) sur les listes/tableaux pour éviter le **saut de page / CLS** (AC3) ; (4) ces animations **neutralisées** sous `prefers-reduced-motion` (AC4).

### ⚠️ Piège n°1 (CENTRAL) — C'est un audit transversal, pas un écran neuf

- ⚠️ Le risque n°1 est le **scope** : il ne s'agit **pas** de reconstruire des écrans, mais de **corriger/compléter** l'a11y et les skeletons sur ceux qui existent (5.7-5.18). 🛑 Établir une **checklist par écran** (dashboard, projets+éditeur, media, timeline, stacks, settings, messages, audit, login/2FA) et vérifier chacun des 4 points. Beaucoup devrait déjà être acquis si les stories précédentes ont respecté leur DoD a11y — cette story **rattrape les manques** et **harmonise**.

### ⚠️ Piège n°2 — Focus trap + restitution : utiliser un dialog accessible (AC2)

- ⚠️ Focus **piégé**, **Échap** ferme, focus **restitué** au déclencheur : c'est exactement le comportement d'un **dialog accessible**. Si shadcn/ui `Dialog`/`AlertDialog` (Radix, déjà présent) est utilisé, ce comportement est **natif** — 🛑 **vérifier** que toutes les confirmations (suppressions 5.8/5.13/5.15/5.18, etc.) passent bien par ce composant et non par un `<div>` maison. Harmoniser les dialogues restants. Tester réellement au clavier (Tab cyclique, Échap, retour focus).

### ⚠️ Piège n°3 — Focus visible + contraste (AC1)

- ⚠️ `:focus-visible` net et **contrasté** (AA) sur **tous** les interactifs, y compris composants custom. ❌ Ne pas supprimer l'outline sans le remplacer. Ordre de tabulation **logique** (pas de `tabindex` positif hasardeux ; ordre DOM cohérent). Vérifier les pièges classiques : menus, dnd (5.10/5.14 — déjà clavier), champs de formulaire, liens de navigation admin.

### ⚠️ Piège n°4 — Skeletons via `loading.tsx` / Suspense (AC3) — anti-CLS

- Next.js App Router : **`loading.tsx`** par segment / **`<Suspense>`** pour afficher une **silhouette** pendant le chargement des données serveur (AC3). ⚠️ La silhouette doit **occuper la place** du contenu final (mêmes dimensions) pour **éviter le saut** (CLS) — cohérent avec l'exigence CLS de tout le projet. Cibler listes/tableaux (projets, media, timeline, stacks, messages, audit).

### ⚠️ Piège n°5 — `prefers-reduced-motion` sur les skeletons (AC4)

- ⚠️ L'animation de **pulsation** des skeletons doit être **neutralisée** sous `@media (prefers-reduced-motion: reduce)` (AC4). Cohérent avec la règle globale reduced-motion (AGENTS.md §6, déjà appliquée au site public). Vérifier qu'aucune autre animation admin (transitions de dialog, etc.) ne viole reduced-motion.

### ⚠️ Piège n°6 — Ne rien casser + zéro dépendance

- ❌ Pas de refonte visuelle, pas de changement de logique métier : uniquement a11y/skeletons/motion. ❌ **Zéro nouvelle dépendance** (Radix/shadcn/tailwind suffisent). Ne pas régresser le comportement existant des écrans.

### ⚠️ Piège n°7 — Vérification locale (au clavier + outils)

- Parcourir **chaque** écran admin **au clavier seul** : tout atteignable, ordre logique, focus **toujours visible** (AC1). Ouvrir chaque **dialogue de confirmation** : focus piégé, **Échap** ferme, focus **revient** au bouton déclencheur (AC2). Charger des listes (throttle réseau) : **skeletons** aux bonnes dimensions, **pas de saut** à l'arrivée des données (AC3). Activer **reduced-motion** (OS) : skeletons **sans** animation (AC4). Passer un audit (axe/Lighthouse) sur les écrans admin.

## Tasks / Subtasks

- [ ] **Tâche 0 — Prérequis & checklist** (AC: 1 ; piège n°1)
  - [ ] 5.1-5.18 `done`. Établir la checklist par écran (les 4 points).
- [ ] **Tâche 1 — Clavier + focus visible** (AC: 1 ; piège n°3)
  - [ ] Ordre de tabulation logique, tout atteignable, `:focus-visible` contrasté (AA) partout.
- [ ] **Tâche 2 — Dialogues accessibles** (AC: 2 ; piège n°2)
  - [ ] Toutes les confirmations via Dialog/AlertDialog (Radix) : focus trap, Échap, restitution du focus.
- [ ] **Tâche 3 — Skeletons anti-CLS** (AC: 3 ; piège n°4)
  - [ ] `loading.tsx`/Suspense sur listes/tableaux, silhouettes aux dimensions du contenu (pas de saut).
- [ ] **Tâche 4 — Reduced-motion** (AC: 4 ; piège n°5)
  - [ ] Neutraliser l'animation des skeletons sous `prefers-reduced-motion`.
- [ ] **Tâche 5 — Vérification locale** (AC: 1-4 ; piège n°7)
  - [ ] Parcours clavier complet, dialogues, skeletons sans CLS, reduced-motion ; audit axe/Lighthouse admin.
- [ ] **Tâche 6 — Definition of Done** (AGENTS.md §8)
  - [ ] lint 0 / tsc 0 / build OK. Vérif **clavier** + visuelle sur tous les écrans. `git diff DEV` : focus styles, dialogues harmonisés, `loading.tsx`, media queries motion — **aucune** logique métier touchée.
  - [ ] `File List` + `Completion Notes` + `Change Log` · `sprint-status.yaml`.

## Dev Notes

### Périmètre — verrouillé

**Finition a11y/perf transversale de l'admin : navigation clavier complète + focus visible contrasté (AC1) ; focus trap + Échap + restitution dans toutes les confirmations (AC2, via Radix Dialog) ; skeletons anti-CLS sur les listes/tableaux (AC3, `loading.tsx`/Suspense) ; animations neutralisées sous prefers-reduced-motion (AC4). Aucune refonte, aucune logique métier, zéro dépendance.**

**Hors périmètre — ne pas faire :**
- ❌ **Refonte visuelle** / nouveaux écrans.
- ❌ **Changer la logique métier** des écrans existants.
- ❌ **A11y du site public** (déjà couverte ailleurs ; ici = admin).
- ❌ **Nouvelle dépendance** (Radix/shadcn/tailwind suffisent).

### Le vrai enjeu

C'est une story de **finition transversale**, pas un écran neuf : le risque est le **scope** (ne pas reconstruire, mais **rattraper et harmoniser** l'a11y/skeletons sur 5.7-5.18). Le focus trap/Échap/restitution est **offert** par Radix Dialog — l'essentiel est de **vérifier** que **toutes** les confirmations l'utilisent. Les skeletons (`loading.tsx`) doivent **occuper l'espace** pour éviter le **CLS**, et respecter **reduced-motion** — deux invariants déjà présents côté public à répliquer sur l'admin. Cette story **clôt l'Epic 5** en rendant le back-office agréable et accessible.

### Testing standards

Vérification **manuelle au clavier** + visuelle sur **chaque** écran admin, throttle réseau pour les skeletons, reduced-motion OS, audit axe/Lighthouse. Les 4 AC. tsc/lint/build verts.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.20]
- [Source: PLAN_REFONTE_2026.md §3.4/§6 — a11y admin, skeletons, prefers-reduced-motion]
- [Source: AGENTS.md §6 — a11y NON négociable (clavier, focus visible AA, prefers-reduced-motion), CLS ; §9 — anti-scope-creep, zéro dépendance]
- [Source: composants shadcn/ui Dialog/AlertDialog (Radix) déjà présents — focus trap natif]
- [Source: _bmad-output/implementation-artifacts/5-10-*.md / 5-14-*.md — dnd déjà clavier ; 5-7 à 5-18 — écrans à auditer]
