---
baseline_commit: c408eae7818fb33ef915a70085775688fbf80640
---

# Story 6.2: Neutraliser le mouvement d'un seul geste

Status: review

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

- [x] **Tâche 0 — Prérequis & état des lieux** (AC: 1 ; pièges n°1, n°2)
  - [x] 6.1 livrée (statut `review`). **Lu** la règle CSS existante et les usages de `useReducedMotion` avant toute écriture.
- [x] **Tâche 1 — Consolider le socle CSS** (AC: 1, 2 ; pièges n°1, n°6)
  - [x] Audit de couverture réalisé ; **un trou réel comblé** (délais). `0.01ms` et position hors `@layer` conservés.
- [x] **Tâche 2 — Formaliser le mécanisme partagé JS** (AC: 1, 2 ; pièges n°2, n°3)
  - [x] `src/lib/motion.ts` **enveloppe** `useReducedMotion` de `motion/react` (aucun hook maison concurrent).
  - [x] `resolveMotionStates()` garantit « pas d'état initial masquant » **par construction** (AC2).
- [x] **Tâche 3 — Documenter** (AC: 3 ; piège n°4)
  - [x] `docs/runbook-6-2-mouvement-reduit.md` : simulation (macOS, Chrome/Edge, Firefox, Safari) + contrat imposé aux animations futures.
- [x] **Tâche 4 — Audit des animations existantes** (AC: 1 ; piège n°6)
  - [x] `HeroOrbit`, `Tape`, badge Hero, `.nav-item`, `AboutClient`, `TestimonialsClient`, skeletons admin : **toutes déjà neutralisées**, aucune refonte. Tableau récapitulatif dans le runbook §4.
- [x] **Tâche 5 — Vérification locale** (AC: 1-3 ; piège n°7)
  - [x] Règle vérifiée sur le **CSS compilé**. ⏳ Parcours navigateur actif/inactif : **à faire par Jeevons** (procédure : runbook §2).
- [x] **Tâche 6 — Definition of Done** (AGENTS.md §8)
  - [x] `bun run lint` 0 erreur / `bunx tsc --noEmit` 0 / `bun run build` OK. ⏳ Vérification visuelle reduced-motion déléguée (voir ci-dessus).
  - [x] Socle + doc uniquement, **aucune animation nouvelle**, aucune dépendance. ⚠️ Diff mêlé à 6.1 : voir Completion Notes.
  - [x] `File List` + `Completion Notes` + `Change Log` · `sprint-status.yaml`.

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

claude-opus-5 (Claude Code)

### Completion Notes

**Socle + documentation, aucune animation ajoutée.** Comme l'annonçait la story, la majeure partie de l'existant était déjà en place : la règle CSS globale et `useReducedMotion` n'ont pas été réécrits. La valeur livrée tient en trois points.

#### 1. Un trou réel comblé dans le socle CSS (AC1, AC2)

La règle existante neutralisait durées, itérations et `scroll-behavior` — **mais pas les délais**. J'ai ajouté :

```css
animation-delay: 0ms !important;
transition-delay: 0ms !important;
```

**Pourquoi c'est un vrai défaut et pas un ajout décoratif** : une animation raccourcie à `0.01ms` mais précédée d'un `animation-delay: 400ms` laisse l'élément dans son **état initial** pendant toute l'attente — donc invisible s'il part d'une opacité nulle. C'est exactement ce qu'interdit l'AC2. La story 6.4 (reveal au scroll) utilisera des délais en cascade : le trou aurait été immédiatement exploitable.

Vérifié sur le CSS compilé : `animation-delay:0s!important;transition-delay:0s!important`. Le `0.01ms` et la position hors `@layer` sont **conservés** (piège n°1).

#### 2. `src/lib/motion.ts` — le garde-fou d'AC2 par construction

Le module **enveloppe** `useReducedMotion` de `motion/react` et le réexporte : source de vérité unique, aucun `matchMedia` maison (piège n°2), zéro dépendance.

Sa pièce centrale est `resolveMotionStates()`, qui rend le piège de l'état initial masquant **impossible** :

```ts
resolveMotionStates(shouldReduceMotion, {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
});
// Sous mouvement réduit → { initial: <état final>, animate: <état final> }
```

La bonne réponse n'est pas « appliquer l'état initial puis accélérer la transition » mais **ne pas appliquer l'état initial du tout**. Le composant rend directement son état final : il n'y a plus rien à animer, et plus rien qui puisse masquer le contenu. `motionTransition()` complète avec `duration: 0` (et non l'absence de transition) pour que `onAnimationComplete` continue d'être émis — même raison que le `0.01ms` du CSS.

C'est le point que 6.4 aurait manqué mécaniquement sans ce garde-fou.

#### 3. `docs/runbook-6-2-mouvement-reduit.md` (AC3)

Ce qui manquait au point que la story 5.20 avait dû déléguer le test reduced-motion à l'humain **sans mode d'emploi**. Le runbook couvre : le fonctionnement des deux socles et leur périmètre respectif, la simulation du réglage (macOS, Chrome/Edge DevTools, Firefox `about:config`, Safari), une **checklist de vérification** point par point, le **contrat imposé aux stories 6.4-6.18** avec l'exemple de code à suivre, et l'état audité des animations existantes.

#### Audit des animations existantes — aucune refonte (piège n°6)

Les 9 animations du site sont **toutes déjà neutralisées** (tableau détaillé dans le runbook §4). Deux points valaient vérification :

- **`HeroOrbit`** pose `animationDuration` en **style inline**. Le `!important` de la règle en feuille de style prime sur un inline sans `!important` (cascade CSS) : les orbites sont bien couvertes.
- **`TestimonialsClient`** est le seul `setInterval` du dépôt, et il est déjà conditionné par `shouldReduceMotion` ; l'alternative (défilement manuel) reste utilisable. `AboutClient` conditionne son drag de la même façon. Aucun des deux n'a été touché.

#### 🛑 Point de process à arbitrer

⚠️ **Cette story partage la branche de la 6.1** (`alpha/feat/6-1-systematiser-l-identite-visuelle-existante`), ce qui contrevient à AGENTS.md §9 règle 1 (« 1 story = 1 branche »). Je ne pouvais pas séparer sans commiter 6.1 d'abord, or §4 réserve le commit à l'humain. Les deux stories cohabitent aussi dans `globals.css` (tokens = 6.1, règle reduced-motion = 6.2), ce qui rend un `git add` partiel peu fiable.

**Décision à prendre par Jeevons** : soit commiter 6.1 puis rebrancher 6.2 (`git checkout -b alpha/feat/6-2-...`), soit assumer une branche commune pour ces deux stories socles étroitement liées. Le contenu du travail n'est pas en cause — seule la découpe git l'est.

#### Autres points d'attention

- ⏳ **Vérification navigateur reduced-motion non faite par l'agent** (extension Chrome refusée cette session). Procédure complète et checklist : runbook §2. Les deux passes sont nécessaires — réglage actif **puis inactif**.
- ℹ️ Warning lint `TestimonialsClient.tsx` (`react-hooks/exhaustive-deps`) : **préexistant sur `DEV`**, hors périmètre, non corrigé.
- ℹ️ `src/lib/motion.ts` porte `"use client"` : `useReducedMotion` est un hook, le module n'est donc importable que par des Client Components — ce qui est le cas d'usage visé.

### File List

- `apps/web/src/app/globals.css` — neutralisation des **délais** ajoutée à la règle `prefers-reduced-motion` existante (durées, itérations, `scroll-behavior` et position hors `@layer` inchangés)
- `apps/web/src/lib/motion.ts` — **nouveau** : socle JS partagé (`useReducedMotion` réexporté, `resolveMotionStates`, `motionTransition`)
- `docs/runbook-6-2-mouvement-reduit.md` — **nouveau** : fonctionnement du socle, procédure de test par navigateur, contrat des animations futures, audit de l'existant
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `6-2` → `review`

### Change Log

| Date | Changement |
|---|---|
| 2026-07-26 | Story 6.2 implémentée : socle de neutralisation du mouvement consolidé. Trou réel comblé côté CSS (neutralisation des délais d'animation et de transition). Mécanisme partagé JS `src/lib/motion.ts` enveloppant `useReducedMotion`, avec `resolveMotionStates` qui interdit par construction l'état initial masquant (AC2). Runbook de test et contrat pour les stories 6.4-6.18. Audit : les 9 animations existantes sont déjà neutralisées, aucune refonte. Aucune animation nouvelle, aucune dépendance. Statut → `review`. |
