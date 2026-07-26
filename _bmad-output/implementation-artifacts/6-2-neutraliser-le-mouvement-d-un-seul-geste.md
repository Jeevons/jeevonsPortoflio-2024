---
baseline_commit: c408eae7818fb33ef915a70085775688fbf80640
---

# Story 6.2: Neutraliser le mouvement d'un seul geste

Status: ready-for-dev

## Story

As **développeur du portfolio**,
I want **un mécanisme unique qui coupe toutes les animations**,
so that **chaque animation ajoutée par la suite respecte le choix du visiteur sans effort supplémentaire**.

## Acceptance Criteria

**AC1 — Mécanisme partagé + neutralisation globale par défaut**
**Given** l'Epic 1 a neutralisé les animations existantes au cas par cas
**When** cette story est terminée
**Then** un mécanisme partagé permet à tout composant de savoir si le mouvement doit être réduit
**And** une neutralisation globale s'applique par défaut aux transitions et animations décoratives

**AC2 — Une animation NOUVELLE est neutralisée sans effort, contenu jamais masqué**
**Given** une nouvelle animation est ajoutée au site
**When** le réglage de mouvement réduit est actif
**Then** elle est neutralisée sans que le développeur ait à y penser
**And** le contenu reste présenté dans son état final, jamais masqué

**AC3 — Comportement vérifiable et documenté**
**Given** ce comportement doit rester vérifiable
**When** je veux le tester
**Then** la façon de simuler ce réglage est documentée

## Contexte d'implémentation

### 🛑 Prérequis : story 6.1 `done` (tokens centralisés)

Story **socle** de l'Epic 6 : **toutes** les stories 6.4 à 6.18 qui introduisent du mouvement s'appuieront sur ce mécanisme. L'epic pose comme contrainte transverse que chaque story porte son propre critère de neutralisation — **le socle est posé ici**. PLAN §4.4 (règle D11), AGENTS.md §6 (a11y non négociable).

### 🎯 Ce que fait vraiment cette story

**⚠️ Une grande partie du travail est DÉJÀ FAITE. Lire ce qui suit avant d'écrire une ligne.**

Cette story consolide un existant en **socle réutilisable et documenté** :
1. **AC1 (moitié CSS)** : ✅ **DÉJÀ EN PLACE** — `globals.css` lignes 103-121 porte la règle globale `@media (prefers-reduced-motion: reduce)` sur `*, *::before, *::after`.
2. **AC1 (moitié JS)** : le « mécanisme partagé » côté composants — à **formaliser**.
3. **AC2** : garantir que le pattern par défaut ne **masque jamais** le contenu.
4. **AC3** : **documenter** la procédure de test (rien n'existe aujourd'hui).

### ⚠️ Piège n°1 (CENTRAL) — La règle CSS globale EXISTE : ne pas la réécrire

- 🛑 `apps/web/src/app/globals.css` lignes 103-121 contient déjà :
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
    html { scroll-behavior: auto !important; }
  }
  ```
- ⚠️ Le commentaire explique **pourquoi `0.01ms` et non `none`** : l'animation saute à son **état FINAL** au lieu de revenir à son état initial, et les évènements `animationend`/`transitionend` **continuent de se déclencher**. 🛑 **C'est exactement la garantie d'AC2** (« le contenu reste présenté dans son état final, jamais masqué »). ❌ **Ne pas la remplacer par `animation: none`** — ce serait une régression qui casserait les composants attendant `transitionend`.
- ⚠️ Elle est **hors de tout `@layer`**, délibérément, pour primer sur les utilitaires Tailwind. ❌ Ne pas la déplacer dans un `@layer`.
- ✅ Travail réel ici : **vérifier** sa couverture (elle ne couvre pas les animations pilotées en JS, ni `scroll-behavior` posé ailleurs) et la **compléter** si un trou est trouvé — pas la refaire.

### ⚠️ Piège n°2 — Le « mécanisme partagé » côté JS : `useReducedMotion` de `motion` existe déjà

- ✅ `motion` v12 est **déjà installé** (`package.json`) et son hook `useReducedMotion` est **déjà utilisé** dans `src/sections/AboutClient.tsx` (ligne 10, 63) et `src/sections/TestimonialsClient.tsx` (ligne 10, 44).
- ❌ **Ne pas écrire un hook maison** `usePrefersReducedMotion` avec `matchMedia` — ce serait réinventer la roue et créer **deux** sources de vérité.
- ✅ Le « mécanisme partagé » d'AC1 = **standardiser sur `useReducedMotion` de `motion/react`**, et le documenter comme LE point d'entrée. Si un helper est créé, il doit **envelopper** ce hook, pas le remplacer.
- ⚠️ **Zéro nouvelle dépendance** (AGENTS.md §9).

### ⚠️ Piège n°3 — AC2 : le contenu ne doit JAMAIS rester masqué

- ⚠️ C'est **le** bug classique du reveal au scroll (story 6.4, la suivante) : un composant part de `opacity: 0` et devient visible par animation. Sous reduced-motion, si l'animation est neutralisée **mais que l'état initial `opacity: 0` reste appliqué**, le contenu est **invisible pour toujours**. La règle CSS `0.01ms` protège des animations **CSS**, mais **pas** d'un état initial posé en JS/inline.
- ✅ Le socle doit rendre ce piège impossible : le pattern documenté doit être « sous reduced-motion, **ne pas appliquer l'état initial du tout** » (le composant rend directement son état final), plutôt que « appliquer l'état initial puis accélérer la transition ».
- ✅ C'est ce que le socle doit **livrer et documenter**, puisque 6.4 en dépendra directement.

### ⚠️ Piège n°4 — AC3 : documenter où l'on documente déjà

- ✅ Le dépôt a un emplacement établi pour ce type de contenu : **`docs/`** (runbooks `runbook-*.md` des stories 2.4, 4.5, 4.6).
- ✅ Documenter la simulation du réglage : macOS (Réglages → Accessibilité → Affichage → Réduire les animations), Chrome/Edge DevTools (Rendering → « Emulate CSS media feature prefers-reduced-motion »), Firefox (`ui.prefersReducedMotion` dans `about:config`).
- ⚠️ 5.20 a explicitement **délégué à l'humain** le test reduced-motion faute de navigateur interactif. Cette documentation rend ce test reproductible — c'est sa raison d'être, pas un livrable décoratif.
- ✅ Documenter aussi le **pattern à suivre** pour toute animation future (le contrat que 6.4-6.18 devront respecter).

### ⚠️ Piège n°5 — Périmètre : ne pas anticiper les animations des stories suivantes

- ❌ **N'ajouter AUCUNE animation** dans cette story : pas de reveal au scroll (6.4), pas de barre de progression (6.5), pas de magnetic button (6.6), pas de parallaxe hero (6.7).
- ✅ Le livrable est **un socle + une documentation**, pas une démonstration.
- ⚠️ AC2 dit « une nouvelle animation est ajoutée » — c'est une **propriété du socle** à garantir par construction, pas une invitation à en ajouter une pour la démontrer.

### ⚠️ Piège n°6 — Les animations existantes : les auditer, pas les refondre

- Animations CSS actuelles : `animate-ping-large` (badge Hero), `animate-spin` (`HeroOrbit`, orbites + spin), `animate-move-left`/`animate-move-right` (`Tape.tsx`), `animate-pulse` (skeletons admin), `hover:scale-110` (bouton « Visiter le site » de `ProjectCard`), transitions de `.nav-item`.
- ✅ Toutes sont des **animations/transitions CSS** → déjà couvertes par la règle globale. **Vérifier**, ne pas réécrire.
- ⚠️ Cas particuliers **JS** à vérifier : `AboutClient.tsx` (drag `motion`) et `TestimonialsClient.tsx` (auto-scroll) gèrent déjà `useReducedMotion` — confirmer qu'ils restent corrects, sans les refondre.
- ⚠️ `html { scroll-behavior: smooth }` (ligne 23-25 de `globals.css`) est **déjà** neutralisé par la règle. Ne pas le retirer.

### ⚠️ Piège n°7 — Vérification locale

- Activer reduced-motion (OS **ou** DevTools) et parcourir la page publique : orbites du Hero **immobiles**, bandeau `Tape` **arrêté**, badge sans pulsation, ancres du menu sautant **sans défilement animé**, **aucun contenu manquant ou invisible**.
- Vérifier aussi `/admin` : skeletons sans pulsation (acquis 5.20).
- ⚠️ Puis **désactiver** le réglage et vérifier que **tout remarche** — une neutralisation trop large qui casse le mode normal est le second échec possible.

## Tasks / Subtasks

- [ ] **Tâche 0 — Prérequis & état des lieux** (AC: 1 ; pièges n°1, n°2)
  - [ ] 6.1 `done`. **Lire** `globals.css` lignes 103-121 et les usages existants de `useReducedMotion` avant toute écriture.
- [ ] **Tâche 1 — Consolider le socle CSS** (AC: 1, 2 ; pièges n°1, n°6)
  - [ ] Auditer la couverture de la règle existante ; compléter uniquement les trous réels. Conserver `0.01ms` et la position hors `@layer`.
- [ ] **Tâche 2 — Formaliser le mécanisme partagé JS** (AC: 1, 2 ; pièges n°2, n°3)
  - [ ] Standardiser sur `useReducedMotion` de `motion/react` (aucun hook maison concurrent).
  - [ ] Garantir le pattern « pas d'état initial masquant sous reduced-motion » (AC2).
- [ ] **Tâche 3 — Documenter** (AC: 3 ; piège n°4)
  - [ ] `docs/` : comment simuler le réglage (macOS, Chrome DevTools, Firefox) + le pattern imposé à toute animation future.
- [ ] **Tâche 4 — Audit des animations existantes** (AC: 1 ; piège n°6)
  - [ ] Vérifier `HeroOrbit`, `Tape`, badge Hero, `.nav-item`, `AboutClient`, `TestimonialsClient`, skeletons admin. Constater, ne pas refondre.
- [ ] **Tâche 5 — Vérification locale** (AC: 1-3 ; piège n°7)
  - [ ] Parcours reduced-motion **actif** (rien ne bouge, rien ne manque) **puis inactif** (tout remarche).
- [ ] **Tâche 6 — Definition of Done** (AGENTS.md §8)
  - [ ] `bun run lint` 0 / `bunx tsc --noEmit` 0 / `bun run build` OK. Vérification visuelle **avec et sans** reduced-motion.
  - [ ] `git diff DEV` : socle + doc uniquement, **aucune animation nouvelle**, aucune dépendance.
  - [ ] `File List` + `Completion Notes` + `Change Log` · `sprint-status.yaml`.

## Dev Notes

### Périmètre — verrouillé

**Consolider en socle réutilisable la neutralisation du mouvement : vérifier/compléter la règle CSS globale existante (`globals.css` 103-121), formaliser `useReducedMotion` de `motion/react` comme mécanisme partagé unique, garantir par construction qu'aucun contenu ne reste masqué (AC2), et documenter dans `docs/` la simulation du réglage + le pattern imposé aux animations futures.**

**Hors périmètre — ne pas faire :**
- ❌ **Réécrire la règle CSS existante** ni remplacer `0.01ms` par `none` (casserait AC2 et `transitionend`).
- ❌ **Écrire un hook maison** concurrent de `useReducedMotion` (piège n°2).
- ❌ **Ajouter la moindre animation** (reveal 6.4, progression 6.5, magnetic 6.6, hero 6.7 — chacune sa story).
- ❌ **Refondre** `AboutClient`/`TestimonialsClient`/`HeroOrbit`/`Tape` : audit seulement.
- ❌ **Toute nouvelle dépendance.**

### Le vrai enjeu

Le risque n°1 est de **reconstruire un existant** : la règle CSS globale et le hook `useReducedMotion` sont **déjà là et déjà justifiés en commentaire**. La valeur ajoutée réelle de cette story tient en deux points : (1) **AC2 par construction** — interdire le pattern « état initial masquant » qui rendrait le contenu invisible sous reduced-motion, piège dans lequel 6.4 tomberait mécaniquement sans ce garde-fou ; (2) **AC3** — une documentation qui rend le test reproductible, ce qui manquait au point que 5.20 a dû déléguer cette vérification à l'humain sans mode d'emploi.

### Testing standards

Vérification **manuelle** avec reduced-motion activé puis désactivé, sur `/` et `/admin`. `lint`/`tsc`/`build` verts. Pas de test automatisé avant l'Epic 7.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.2 et contrainte transverse de l'Epic 6]
- [Source: PLAN_REFONTE_2026.md §4.4 — règle D11, prefers-reduced-motion]
- [Source: AGENTS.md §6 — a11y non négociable ; §9 — anti-scope-creep, zéro dépendance]
- [Source: apps/web/src/app/globals.css lignes 103-121 — règle globale EXISTANTE, avec sa justification `0.01ms`]
- [Source: apps/web/src/sections/AboutClient.tsx, TestimonialsClient.tsx — `useReducedMotion` de `motion/react` déjà en usage]
- [Source: _bmad-output/implementation-artifacts/5-20-*.md — test reduced-motion délégué à l'humain, faute de procédure documentée]
- [Source: docs/runbook-*.md — emplacement établi de la documentation d'exploitation]

## Dev Agent Record

### Agent Model Used

### Completion Notes

### File List

### Change Log
