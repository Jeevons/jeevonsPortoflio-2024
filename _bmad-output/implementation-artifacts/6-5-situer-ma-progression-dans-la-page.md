---
baseline_commit: c408eae7818fb33ef915a70085775688fbf80640
---

# Story 6.5: Situer ma progression dans la page

Status: ready-for-dev

## Story

As **visiteur du portfolio**,
I want **voir où j'en suis dans la page et dans quelle section je me trouve**,
so that **je garde mes repères sur une page longue**.

## Acceptance Criteria

**AC1 — Barre de progression aux couleurs d'accent**
**Given** je fais défiler la page
**When** je regarde le haut de l'écran
**Then** une barre de progression aux couleurs d'accent reflète ma position dans la page

**AC2 — Navigation qui se compacte et se floute**
**Given** la navigation est fixée en haut
**When** je m'éloigne du haut de la page
**Then** elle se compacte et se floute pour se faire discrète sans disparaître

**AC3 — Section active mise en évidence (scroll-spy)**
**Given** je traverse les sections
**When** une section occupe l'essentiel de l'écran
**Then** l'entrée de menu correspondante est mise en évidence
**And** ce repérage s'appuie sur les identifiants de section uniques posés en Epic 1

**AC4 — Clavier : entrées atteignables, état actif non porté par la seule couleur**
**Given** je navigue au clavier
**When** je parcours le menu
**Then** chaque entrée reste atteignable et son état actif est perceptible autrement que par la seule couleur

**AC5 — Mouvement réduit : mise à jour sans transition**
**Given** le réglage de mouvement réduit est actif
**When** je fais défiler
**Then** la barre et la navigation s'actualisent sans transition animée

## Contexte d'implémentation

### 🛑 Prérequis : stories 6.1 (tokens), 6.2 (socle motion) `done`

Utilise le **dégradé d'accent tokenisé** en 6.1 (AC1) et le **socle de neutralisation** de 6.2 (AC5). Les **identifiants de section uniques** viennent de l'Epic 1 (story 1.1). PLAN §4.2 (P1 n°2 barre de progression, n°3 header adaptatif + scroll-spy).

### 🎯 Ce que fait vraiment cette story

Refonte de `src/sections/Header.tsx` (aujourd'hui **26 lignes, purement statique, sans `"use client"`**) en navigation vivante : **barre de progression** (AC1), **compactage + flou au défilement** (AC2), **scroll-spy** sur la section active (AC3), le tout **accessible au clavier** (AC4) et **neutralisé** sous mouvement réduit (AC5).

### ⚠️ Piège n°1 (CENTRAL) — Les ancres réelles ≠ les entrées du menu

- 🛑 **Inventaire exact des `id` de section** (posés en story 1.1, à vérifier soi-même) : `#hero`, `#projects`, `#side-projects`, `#parcours`, `#about`, `#contact` → **six sections**.
- 🛑 **Le menu ne compte que CINQ entrées** : `#hero`, `#projects`, `#parcours`, `#about`, `#contact`. **`#side-projects` n'a délibérément PAS d'entrée de menu** — c'est une **décision explicite de la story 1.1 (AC3)** : « la navigation reste sans lien dédié aux projets personnels, la section reste atteignable en poursuivant le défilement ».
- ⚠️ Conséquence directe pour AC3 : quand le visiteur traverse `#side-projects`, **aucune entrée de menu ne lui correspond**. 🛑 Décider et documenter le comportement : soit **conserver** la mise en évidence de « Projets » (cohérent : c'est la continuité de la zone projets), soit **n'en mettre aucune**. ❌ **Ne PAS ajouter une entrée « Projets perso » au menu** — ce serait contredire la story 1.1 et déborder du périmètre.
- ⚠️ `#parcours` est porté par `TestimonialsClient.tsx` (ligne 104) — l'id ne correspond pas au nom du fichier, ne pas se fier au nom.

### ⚠️ Piège n°2 — `Header.tsx` est un Server Component : le passer client sans casser la page

- Aujourd'hui `Header.tsx` n'a **pas** de `"use client"` — il est statique. AC1/AC2/AC3 exigent tous une réaction au défilement → **interactivité obligatoire**.
- ✅ Ici, ajouter `"use client"` est **acceptable** : contrairement aux sections `async` de la story 6.4, `Header` **ne lit aucune donnée** (aucun appel DB, aucun `await`). Il est appelé depuis `page.tsx` (rendu statique, `revalidate = 3600`).
- ⚠️ **Vérifier après implémentation** que `/` reste bien `○ (Static, 1h)` au build et **ne bascule pas** en `ƒ (Dynamic)` — c'est exactement la régression que `page.tsx` documente en garde-fou (commentaire story 5.11, lignes 20-29). Le build Next affiche ce marqueur : le contrôler explicitement.

### ⚠️ Piège n°3 — AC4 : l'état actif ne doit pas reposer sur la seule couleur (WCAG 1.4.1)

- 🛑 `.nav-item` (dans `globals.css`, `@layer base`) ne joue aujourd'hui que sur la **couleur** (`text-white/70` → `text-white`) et un fond au survol. Mettre l'entrée active en simple « couleur d'accent » **échouerait l'AC4** et la règle a11y non négociable (AGENTS.md §6).
- ✅ Ajouter un **second signal non chromatique** : soulignement/indicateur, fond plein, ou graisse. ✅ Et un signal **sémantique** pour les lecteurs d'écran : `aria-current="true"` (ou `aria-current="location"`) sur l'entrée active — indispensable, la couleur n'existe pas pour eux.
- ✅ AC4 exige aussi que chaque entrée **reste atteignable au clavier** : ce sont des `<a href="#...">`, donc focusables nativement. ⚠️ **Ne pas casser ça** en les transformant en `<div onClick>`. ✅ Focus visible contrasté — le pattern du dépôt est `focus-visible:ring-2 focus-visible:ring-ring` (harmonisé en story 5.20).
- ⚠️ `.nav-item` porte `transition duration-300` : couvert par la règle globale reduced-motion (AC5).

### ⚠️ Piège n°4 — AC1/AC2 : performance, ne pas écrire un listener `scroll` naïf

- 🛑 Un `window.addEventListener("scroll", …)` qui lit `scrollY`/`getBoundingClientRect()` **à chaque évènement** provoque du **layout thrashing** et un défilement saccadé — l'inverse de l'effet recherché.
- ✅ **AC1 (progression)** : `motion` v12 est **déjà installé** et fournit `useScroll` + `scrollYProgress` + `useSpring`, prévus pour ça (transform `scaleX` composé par le GPU). ⚠️ **Zéro nouvelle dépendance.** Alternative CSS pure moderne : `animation-timeline: scroll()` — ⚠️ support inégal, **ne pas l'utiliser seul** sans repli.
- ✅ **AC3 (scroll-spy)** : utiliser `IntersectionObserver` (comme en 6.4), **pas** un listener `scroll` calculant des offsets. AC3 précise « une section occupe **l'essentiel de l'écran** » → régler `rootMargin`/`threshold` en conséquence, et non « dès qu'elle touche le haut ».
- ⚠️ ❌ N'animer que `transform`/`opacity` (cf. piège n°3 de la story 6.4).

### ⚠️ Piège n°5 — AC2 : « discrète sans disparaître », et le flou est déjà là

- ⚠️ La nav porte **déjà** `backdrop-blur` (`Header.tsx` ligne 4) : le « flou » d'AC2 n'est pas à créer de zéro, mais à **accentuer** au défilement.
- 🛑 AC2 dit « **sans disparaître** » : ❌ pas de `opacity: 0`, ❌ pas de header qui se cache au défilement vers le bas. Il se **compacte** (padding/taille réduits) et s'estompe visuellement, **en restant présent et cliquable**.
- ⚠️ Ne pas réduire au point de rendre les cibles tactiles trop petites : viser **≥ 44 px** de hauteur de cible même compacté.
- ⚠️ Le header est `fixed top-3 z-10`. La barre de progression doit être cohérente en `z-index` avec lui **et** avec les cartes `sticky` de `ProjectList` (`top: calc(64px + …)`) — vérifier qu'aucune carte ne passe **au-dessus** de la barre.

### ⚠️ Piège n°6 — AC5 et périmètre

- ✅ **AC5** : sous reduced-motion, la barre et la nav **s'actualisent quand même** (l'information de progression reste rendue) mais **sans transition animée**. ❌ Ne pas supprimer la barre — supprimer l'**animation**, pas la fonction. Réutiliser `useReducedMotion` (socle 6.2) : notamment **ne pas appliquer de `useSpring`** sous reduced-motion.
- ❌ **Hors périmètre** : ajouter une entrée de menu (piège n°1) · menu mobile / burger (non demandé par les AC) · magnetic buttons et curseur (6.6) · hero (6.7) · reveal au scroll (6.4) · admin · **toute nouvelle dépendance**.
- ⚠️ La story 6.3 a pu toucher `Header.tsx` pour un débordement à 375px — vérifier l'état réel du fichier avant de le refondre.

### ⚠️ Piège n°7 — Vérification locale, les 5 AC

- **AC1** : défiler de haut en bas — la barre suit la progression, atteint 100 % en bas, aux **couleurs d'accent** (tokens 6.1).
- **AC2** : la nav se compacte/floute en s'éloignant du haut, **reste visible et cliquable** ; retour en haut → état initial.
- **AC3** : traverser chaque section — l'entrée correspondante s'active quand la section occupe l'essentiel de l'écran ; **vérifier le cas `#side-projects`** (comportement décidé au piège n°1).
- **AC4** : **au clavier seul** — Tab atteint les 5 entrées, focus visible, état actif perceptible **en niveaux de gris** (test décisif). Vérifier `aria-current` dans l'inspecteur.
- **AC5** : reduced-motion activé (procédure de 6.2) → barre et nav **s'actualisent sans transition**.
- 🛑 Contrôler au build que `/` reste **`○ (Static)`** (piège n°2), et que l'empilement `sticky` des cartes projet n'est pas recouvert.

## Tasks / Subtasks

- [ ] **Tâche 0 — Prérequis & inventaire des ancres** (AC: 3 ; piège n°1)
  - [ ] 6.1 et 6.2 `done`. Recenser les 6 `id` réels vs les 5 entrées de menu ; **décider et documenter** le comportement sur `#side-projects` (sans ajouter d'entrée).
- [ ] **Tâche 1 — Barre de progression** (AC: 1, 5 ; pièges n°4, n°5, n°6)
  - [ ] `useScroll`/`scrollYProgress` de `motion` (déjà installé), `transform: scaleX`, dégradé d'accent tokenisé (6.1). `z-index` cohérent avec le header et les cartes `sticky`.
- [ ] **Tâche 2 — Header adaptatif** (AC: 2, 5 ; pièges n°2, n°5)
  - [ ] `"use client"` sur `Header.tsx` (aucune lecture de données). Compactage + accentuation du `backdrop-blur` existant ; **jamais** de disparition ; cibles ≥ 44 px.
- [ ] **Tâche 3 — Scroll-spy** (AC: 3 ; pièges n°1, n°4)
  - [ ] `IntersectionObserver` sur les sections, seuil « occupe l'essentiel de l'écran ». S'appuyer sur les `id` de l'Epic 1.
- [ ] **Tâche 4 — Accessibilité du menu** (AC: 4 ; piège n°3)
  - [ ] `aria-current` sur l'entrée active + signal **non chromatique** ; `<a>` conservés ; `focus-visible:ring` contrasté.
- [ ] **Tâche 5 — Mouvement réduit** (AC: 5 ; piège n°6)
  - [ ] `useReducedMotion` : pas de spring ni de transition ; la barre et l'état actif restent **fonctionnels**.
- [ ] **Tâche 6 — Vérification locale** (AC: 1-5 ; piège n°7)
  - [ ] Les 5 AC un par un, test **clavier seul**, test **en niveaux de gris**, reduced-motion, `/` toujours `○ (Static)` au build.
- [ ] **Tâche 7 — Definition of Done** (AGENTS.md §8)
  - [ ] `bun run lint` 0 / `bunx tsc --noEmit` 0 / `bun run build` OK (**vérifier le marqueur Static de `/`**). Vérification visuelle **avec et sans** reduced-motion.
  - [ ] `git diff DEV` : header + barre de progression uniquement, aucune donnée touchée, aucune dépendance.
  - [ ] `File List` + `Completion Notes` + `Change Log` · `sprint-status.yaml`.

## Dev Notes

### Périmètre — verrouillé

**Rendre la navigation vivante : barre de progression aux couleurs d'accent (tokens 6.1) pilotée par `useScroll` de `motion`, header qui se compacte et accentue son `backdrop-blur` sans jamais disparaître, scroll-spy par `IntersectionObserver` sur les `id` de l'Epic 1, état actif signalé autrement que par la couleur (+ `aria-current`), le tout neutralisé sous mouvement réduit sans perdre sa fonction.**

**Hors périmètre — ne pas faire :**
- ❌ **Ajouter une entrée de menu** pour `#side-projects` (contredirait la story 1.1 AC3).
- ❌ **Faire disparaître le header** au défilement (AC2 : « sans disparaître »).
- ❌ **État actif porté par la seule couleur** (échec AC4 / WCAG 1.4.1).
- ❌ **Listener `scroll` naïf** recalculant des offsets (layout thrashing).
- ❌ **Basculer `/` en rendu dynamique** (garde-fou documenté dans `page.tsx`).
- ❌ **Menu mobile/burger**, magnetic/curseur (6.6), hero (6.7), reveal (6.4), admin, **nouvelle dépendance**.

### Le vrai enjeu

Le piège le moins visible est **l'asymétrie sections/menu** : six sections, cinq entrées, et `#side-projects` volontairement absent du menu depuis la story 1.1. Un scroll-spy écrit sans le savoir produira soit un état actif qui « saute » en traversant cette section, soit — pire — l'ajout spontané d'une sixième entrée qui annulerait une décision prise en Epic 1. Le second enjeu est **AC4** : l'état actif d'un menu est le cas d'école du signal porté par la seule couleur ; le test décisif est de regarder le menu en niveaux de gris. Enfin, `Header.tsx` devient client — inoffensif ici puisqu'il ne lit aucune donnée, à condition de **vérifier au build** que `/` reste statique.

### Testing standards

Vérification **manuelle** des 5 AC : défilement complet, traversée de chaque section (dont `#side-projects`), **clavier seul**, rendu **en niveaux de gris**, reduced-motion (procédure de 6.2), et contrôle du marqueur `○ (Static)` sur `/` au build. `lint`/`tsc`/`build` verts.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.5]
- [Source: PLAN_REFONTE_2026.md §4.2 — P1 n°2 (scroll progress bar), n°3 (header adaptatif + scroll-spy)]
- [Source: AGENTS.md §6 — a11y non négociable (clavier, contrastes, info jamais portée par la seule couleur) ; §9 — zéro dépendance]
- [Source: _bmad-output/implementation-artifacts/1-1-*.md AC3 — navigation SANS entrée « projets perso », décision explicite]
- [Source: apps/web/src/sections/Header.tsx — 5 entrées, `backdrop-blur` déjà présent, Server Component statique]
- [Source: apps/web/src/sections/{Hero,Projects,SelfProject}.tsx, {Testimonials,About,Contact}Client.tsx — les 6 `id` réels]
- [Source: apps/web/src/app/page.tsx:18-29 — `revalidate = 3600` et garde-fou anti-rendu-dynamique]
- [Source: apps/web/src/app/globals.css — `.nav-item` (couleur seule), règle globale reduced-motion]
- [Source: apps/web/src/components/ProjectList.tsx:50-55 — cartes `sticky`, cohérence de `z-index`]

## Dev Agent Record

### Agent Model Used

### Completion Notes

### File List

### Change Log
