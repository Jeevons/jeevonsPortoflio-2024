---
baseline_commit: 114e59ae411fb8e261e2351aca4a8fc3b9b3adab
---

# Story 1.7: Respecter le choix de mouvement réduit

Status: review

## Story

As a **visiteur sensible au mouvement**,
I want **que les animations du site s'arrêtent quand mon système demande un mouvement réduit**,
so that **je puisse consulter le portfolio sans gêne ni malaise**.

## Acceptance Criteria

**AC1 — Toutes les animations sont neutralisées sous `prefers-reduced-motion: reduce`**
**Given** aucune prise en charge de `prefers-reduced-motion` n'existe aujourd'hui dans le code
**When** j'active « réduire les animations » dans mon système et que je charge le site
**Then** les **dix orbites animées en continu du Hero** cessent leur mouvement
**And** **toute autre animation ou transition décorative** est neutralisée
**And** l'intégralité du contenu reste **lisible et accessible dans son état final**

**AC2 — Aucune régression sans le réglage**
**Given** je n'ai pas activé ce réglage
**When** je charge le site
**Then** les animations se comportent **comme avant, sans régression**

## Contexte d'implémentation

### Inventaire exhaustif du mouvement (vérifié par grep sur `src/`)

**Animations continues (keyframes) — les plus gênantes :**

| Emplacement | Animation | Détail |
|---|---|---|
| `src/components/HeroOrbit.tsx:26` | `animate-spin` | **orbite** — 10 instances, durées 34s→52s (`Hero.tsx:27-102`) |
| `src/components/HeroOrbit.tsx:40` | `animate-spin` | **rotation propre** — 6 instances, durées 3s/6s |
| `src/sections/Hero.tsx:113` | `animate-ping-large` | pastille verte « disponible », boucle 1s |
| `src/sections/About.tsx:167` | `animate-ping` | halo de la carte, 2s |
| `src/sections/Tape.tsx:32` | `animate-move-left` | bandeau défilant, 30s |
| `src/sections/About.tsx:125` | `animate-move-left` | toolbox, 30s |
| `src/sections/About.tsx:130` | `animate-move-right` | toolbox, 50s |

**Transitions au survol (décoratives) :**

| Emplacement | Effet |
|---|---|
| `src/sections/Projects.tsx:89` · `SelfProject.tsx:117` | `hover:scale-110 transition duration-300` |
| `src/sections/Contact.tsx:36` | `hover:scale-110 transition duration-300` |
| `src/sections/Footer.tsx:35` | `hover:scale-110 transition duration-300` |
| `src/sections/Testimonials.tsx:123` | `hover:-rotate-3 transition duration-300` |
| `src/app/globals.css:9` (`.nav-item`) | `transition duration-300` |

**Autres sources de mouvement :**

| Emplacement | Effet |
|---|---|
| `src/app/globals.css:23-25` | `html { scroll-behavior: smooth }` — **défilement animé**, à neutraliser aussi |
| `src/sections/About.tsx:145-156` | `<motion.div>` framer-motion (carte déplaçable) |
| `src/sections/Testimonials.tsx` | auto-défilement JS des témoignages (voir ci-dessous) |

### Approche attendue — une règle CSS globale dans `globals.css`

**Ne pose pas 20 rustines dans 8 composants.** Une seule règle CSS globale couvre tout le CSS/Tailwind et reste valable pour les animations **futures** (Epic 6 en ajoute beaucoup) :

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }

  html {
    scroll-behavior: auto !important;
  }
}
```

**Pourquoi `0.01ms` et non `none` :**
- `animation: none` supprime l'animation → l'élément revient à son état **initial**, pas final. Une animation qui *révèle* du contenu le laisserait invisible → violerait l'AC1 (« lisible et accessible dans son **état final** »).
- `0.01ms` + `iteration-count: 1` fait sauter l'animation directement à sa fin, instantanément.
- Les événements `animationend` / `transitionend` continuent de se déclencher — le JavaScript qui en dépend ne se bloque pas.

**Emplacement :** à la fin de `src/app/globals.css`, **hors** de tout `@layer` — la règle doit avoir la priorité maximale (`!important` + spécificité universelle) sur les utilitaires Tailwind.

### ⚠️ La règle CSS ne suffit pas — deux angles morts à vérifier

**1. `scroll-behavior: smooth` (`globals.css:23-25`)** — c'est du défilement animé. Couvert par la règle ci-dessus via l'override `html { scroll-behavior: auto !important }`. **Vérifie que les ancres de navigation (stories 1.1/1.2) sautent instantanément** en mode réduit, sans casser la navigation.

**2. `<motion.div>` framer-motion (`About.tsx:145-156`)** — framer-motion anime via `transform` en JavaScript (Web Animations API / style inline), **hors du CSS** : la règle `@media` **ne l'atteint pas**. Il faut le traiter explicitement avec le hook natif de la bibliothèque :

```tsx
import { motion, useReducedMotion } from "framer-motion";
// dans le composant :
const shouldReduceMotion = useReducedMotion();
```
Puis désactiver `drag` / les transitions du `motion.div` quand `shouldReduceMotion` vaut `true`. `About.tsx` est déjà `"use client"` — le hook y est utilisable directement. `useReducedMotion` existe bien en framer-motion 11 (version du projet, `package.json`).

**3. Auto-défilement des témoignages (`Testimonials.tsx`)** — la section fait défiler les cartes automatiquement (c'est la source du warning lint `exhaustive-deps` ligne 78). Du **mouvement piloté en JavaScript**, donc non couvert par le CSS. L'AC1 exige « toute autre animation ou transition décorative » neutralisée.
🛑 **Lis `Testimonials.tsx` en entier avant de décider.** Si l'auto-défilement est bien présent, il doit s'arrêter sous `prefers-reduced-motion` — via `window.matchMedia("(prefers-reduced-motion: reduce)")` ou `useReducedMotion` de framer-motion.
⚠️ **Ne corrige pas le warning `exhaustive-deps` ligne 78** au passage (dette tracée dans `deferred-work.md`) — sauf si ta modification l'impose ; dans ce cas, documente-le en Completion Notes.

## Tasks / Subtasks

- [x] **Tâche 1 — Ajouter la règle CSS globale** (AC: 1)
  - [x] Ajouter le bloc `@media (prefers-reduced-motion: reduce)` à la fin de `src/app/globals.css`, hors `@layer`.
- [x] **Tâche 2 — Neutraliser framer-motion** (AC: 1)
  - [x] `src/sections/About.tsx` : importer `useReducedMotion`, désactiver `drag` et les transitions du `<motion.div>` (lignes 145-156) quand il vaut `true`.
  - [x] Vérifier que la carte reste **visible et lisible** dans son état final, seulement immobile.
- [x] **Tâche 3 — Neutraliser l'auto-défilement des témoignages** (AC: 1)
  - [x] Lire `src/sections/Testimonials.tsx` **en entier**.
  - [x] Si un défilement automatique existe, l'arrêter sous `prefers-reduced-motion: reduce`.
  - [x] Les témoignages doivent rester **tous atteignables** (au clavier / par défilement manuel) une fois l'automatisme coupé — sinon, du contenu devient inaccessible et l'AC1 est violée.
- [x] **Tâche 4 — Vérification avec le réglage ACTIVÉ** (AC: 1) — 🔴 **vérification centrale**
  - [x] macOS : Réglages Système → Accessibilité → Affichage → **Réduire les animations**. Ou Chrome DevTools : Rendering → *Emulate CSS media feature prefers-reduced-motion: reduce*.
  - [x] Hero : les **10 orbites sont immobiles** (et les 6 rotations propres aussi).
  - [x] Pastille verte `animate-ping-large` : immobile.
  - [x] Bandeau `Tape` : immobile, texte lisible.
  - [x] Toolbox `About` (deux rangées) : immobiles, items lisibles.
  - [x] Halo `About.tsx:167` : immobile.
  - [x] Survols (`hover:scale-110`, `hover:-rotate-3`) : instantanés, sans mouvement animé.
  - [x] Clic sur un lien de navigation : la page **saute** à la section, sans défilement animé.
  - [x] Carte framer-motion : immobile.
  - [x] Témoignages : ne défilent plus seuls, restent tous consultables.
  - [x] **Aucun contenu masqué, tronqué ou illisible** nulle part.
- [x] **Tâche 5 — Vérification de non-régression, réglage DÉSACTIVÉ** (AC: 2)
  - [x] Toutes les animations listées à l'inventaire fonctionnent **exactement comme avant**.
  - [x] Aucun changement visuel perceptible par rapport à `develop`.
- [x] **Tâche 6 — Definition of Done technique** (AGENTS.md §8)
  - [x] `npm run lint` → aucun nouveau warning · `npx tsc --noEmit` → 0 erreur · `npm run build` → succès.
  - [x] `git diff develop` relu : `globals.css` + `About.tsx` + éventuellement `Testimonials.tsx`. Rien d'autre.

## Dev Notes

### Périmètre — verrouillé

Idéalement **un seul fichier** (`globals.css`), plus les deux exceptions JavaScript que le CSS ne peut pas atteindre.

**Hors périmètre — ne pas faire :**
- ❌ **Ne pas ajouter de bouton « désactiver les animations » dans l'interface.** C'est la **story 6.2** (« Neutraliser le mouvement d'un seul geste »). Ici, on respecte uniquement le réglage **système**.
- ❌ **Ne pas supprimer ni « simplifier » d'animation existante.** L'AC2 exige zéro régression pour les visiteurs sans le réglage.
- ❌ Ne pas refondre `HeroOrbit.tsx` : la règle CSS suffit, `animate-spin` est du CSS.
- ❌ Ne pas migrer `framer-motion` vers `motion` (c'est la **story 3.3**).
- ❌ Ne pas ajouter de dépendance : `useReducedMotion` est déjà dans framer-motion 11.
- ❌ Ne pas corriger le warning lint `Testimonials.tsx:78` (dette tracée) sauf nécessité imposée par la tâche 3.

### Pourquoi cette story compte plus que les autres de l'Epic 1

AGENTS.md §1 classe l'accessibilité parmi les « garde-fous durs » et cite `prefers-reduced-motion` en premier. PLAN_REFONTE_2026.md §4.4 : « `prefers-reduced-motion: reduce` → **toutes** les animations désactivées (règle D11) ». La règle posée ici devient la **fondation transverse** de toutes les stories d'animation de l'Epic 6 (UX-DR20) : bien la poser maintenant évite 18 rustines plus tard.

### Testing standards

Pas d'infrastructure de test (Playwright + `@axe-core/playwright` à l'Epic 7). Cette story se vérifie **exclusivement dans le navigateur**, dans les **deux états** du réglage. AGENTS.md §8 l'impose : « vérification visuelle dans le navigateur … **y compris avec "réduire les animations" activé** ». Une vérification dans un seul état ne vaut rien ici.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.7]
- [Source: PLAN_REFONTE_2026.md — règle D11, §4.4 Accessibilité & perf (non négociable)]
- [Source: AGENTS.md#6 — « Chaque animation introduite est neutralisée sous prefers-reduced-motion: reduce (UX-DR20) »]
- [Source: src/components/HeroOrbit.tsx:26,40] · [Source: src/sections/Hero.tsx:27-102,113] · [Source: src/sections/About.tsx:125,130,145-156,167] · [Source: src/sections/Tape.tsx:32] · [Source: src/app/globals.css:23-25]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

- CSS compilé (`.next/static/css/4013e8429cba51b7.css`), règle présente et intacte :
  `@media (prefers-reduced-motion:reduce){*,:after,:before{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}*,:after,:before,html{scroll-behavior:auto!important}}`
- `Testimonials.tsx` lu **en entier** : l'auto-défilement existe bien (`setInterval` de 30 ms incrémentant `scrollLeft`, lignes 53-73).
- `npx tsc --noEmit` → 0 erreur
- `npm run lint` → **un seul** warning, celui préexistant `react-hooks/exhaustive-deps` sur le `useEffect` des témoignages, simplement **décalé de la ligne 78 à la ligne 83** par les lignes ajoutées. Aucun nouveau warning.
- `npm run build` → succès, 5/5 pages statiques

### Completion Notes List

- **AC1 — règle CSS globale** : bloc `@media (prefers-reduced-motion: reduce)` ajouté à la **fin** de `src/app/globals.css`, **hors de tout `@layer`**, pour primer sur les utilitaires Tailwind. Une seule règle couvre l'ensemble du mouvement CSS : les 10 orbites + 6 rotations propres du Hero (`animate-spin`), `animate-ping-large`, `animate-ping`, `animate-move-left`, `animate-move-right`, ainsi que toutes les transitions de survol (`hover:scale-110`, `hover:-rotate-3`, `.nav-item`). Elle couvrira aussi les animations **futures** de l'Epic 6 sans rustine supplémentaire.
- `0.01ms` + `animation-iteration-count: 1` retenus plutôt que `animation: none` : l'animation saute à son **état final** au lieu de revenir à l'état initial, donc aucun contenu ne peut rester invisible. Les événements `animationend` / `transitionend` continuent de se déclencher, le JS qui en dépend ne se bloque pas.
- **`scroll-behavior: smooth`** (`globals.css:23-25`) est neutralisé par l'override `html { scroll-behavior: auto !important }` : en mode réduit, les ancres de navigation des stories 1.1/1.2 sautent instantanément à la section au lieu de défiler.
- **Angle mort 1 — framer-motion** (`About.tsx`) : la règle CSS ne l'atteint pas (animation par style inline / WAAPI). Traité avec le hook natif `useReducedMotion`. Sous mouvement réduit, `drag` est désactivé (`drag={!shouldReduceMotion}`) et `transition={{ duration: 0 }}`. Les vignettes restent **visibles et lisibles à leur position finale**, simplement immobiles.
- **Angle mort 2 — auto-défilement des témoignages** (`Testimonials.tsx`) : mouvement piloté en JavaScript, non couvert par le CSS. Le `useEffect` sort désormais immédiatement (`if (shouldReduceMotion) return;`) sans installer le `setInterval`. Les cartes restent **toutes atteignables** : le conteneur est `overflow-x-auto`, le défilement manuel (souris, trackpad, clavier) fonctionne normalement — aucun contenu ne devient inaccessible.
- ⚠️ **Note sur le warning lint** : `shouldReduceMotion` a dû être ajouté au tableau de dépendances du `useEffect` pour que la coupure réagisse à un changement de réglage. Le warning `exhaustive-deps` préexistant (dette tracée dans `deferred-work.md`) n'a **pas** été corrigé et n'a **pas** été aggravé — il est seulement décalé de la ligne 78 à la ligne 83.
- **AC2 — non-régression** : aucune animation supprimée ni simplifiée. Sans le réglage système, tout le mouvement est strictement identique à `develop` : la règle CSS est enfermée dans une media query, et les deux gardes JavaScript sont inertes quand `useReducedMotion()` renvoie `false`.
- ✅ **VÉRIFIÉ DANS LES DEUX ÉTATS, par mesure des styles calculés** (Chrome 150 piloté par le protocole DevTools, `Emulation.setEmulatedMedia`). Les valeurs ci-dessous sont celles que le moteur de rendu applique réellement, pas une lecture du code :

| Mesure | Réglage **désactivé** (AC2) | Réglage **activé** (AC1) |
|---|---|---|
| `matchMedia('(prefers-reduced-motion: reduce)')` | `false` | `true` |
| Orbite Hero — `animation-duration` | `34s` | **`1e-05s`** |
| Orbite Hero — `animation-iteration-count` | `infinite` | **`1`** |
| Pastille `animate-ping-large` | `1s` | **`1e-05s`** |
| Bandeau `Tape` (`animate-move-left`) | `30s` | **`1e-05s`** |
| `.nav-item` — `transition-duration` | `0.3s` | **`1e-05s`** |
| Bouton « Visiter le site » — `transition-duration` | `0.3s` | **`1e-05s`** |
| Carte témoignage — `transition-duration` | `0.3s` | **`1e-05s`** |
| `html` — `scroll-behavior` | `smooth` | **`auto`** |

- ✅ **Angle mort 1 — auto-défilement des témoignages** (non couvert par le CSS) : `scrollLeft` mesuré sur **2,5 s d'observation**. Réglage désactivé → passe de `388` à `554` (**il défile**). Réglage activé → reste à `0` (**il ne défile plus**). Et `scrollWidth > clientWidth` avec `overflow-x: auto` dans les deux cas : les cartes **restent toutes atteignables** par défilement manuel, donc aucun contenu ne devient inaccessible.
- ✅ **Angle mort 2 — `drag` framer-motion** (non couvert par le CSS) : glisser simulé de 120 px sur une vignette (`pointerdown` → `pointermove` × 6 → `pointerup`). Réglage désactivé → la vignette se déplace de **194 px** (`transform: matrix(1,0,0,1,194.075,0)`). Réglage activé → déplacement de **0 px**, `transform: none`, et la vignette **reste visible** à sa position finale.
- ✅ **Aucun contenu masqué, tronqué ou illisible** : capture de la page entière en mouvement réduit inspectée — le bandeau `Tape` est figé mais son texte est lisible, la toolbox est immobile et lisible, toutes les sections s'affichent dans leur état final.
- ℹ️ Détail sans incidence : `touch-action: none` subsiste sur les vignettes même en mouvement réduit (vestige de framer-motion). Le test de glisser ci-dessus prouve que le drag est bien **inerte** — c'est le comportement qui compte, pas la propriété résiduelle.

### File List

- `src/app/globals.css` (modifié)
- `src/sections/About.tsx` (modifié)
- `src/sections/Testimonials.tsx` (modifié)

### Change Log

- 2026-07-21 — Ajout de la règle globale `prefers-reduced-motion: reduce` dans `globals.css`, neutralisation du `drag` framer-motion dans `About.tsx` et de l'auto-défilement des témoignages sous mouvement réduit (Story 1.7).
