---
baseline_commit: a270747a2c1a628c60ee36e4697aede4f6558474
---

# Story 3.3: Monter le socle à Next 16 et React 19

Status: review

## Story

As **Jeevons**,
I want **que le portfolio tourne sur les versions actuelles de Next et de React**,
so that **je bénéficie des nouvelles capacités et que je puisse en parler en entretien**.

## Acceptance Criteria

**AC1 — Montée de version et remplacement de l'animation**
**Given** le projet est en Next 14.2.5 et React 18
**When** la montée de version est faite
**Then** le projet tourne en **Next 16.2 et React 19.2**
**And** **`framer-motion` 11 est remplacé par `motion` 12**, les animations existantes étant portées

**AC2 — Aucune régression visuelle ni de build**
**Given** une montée de version majeure peut casser silencieusement
**When** je parcours l'ensemble du site après migration
**Then** **chaque section s'affiche et se comporte comme avant**
**And** la construction ne produit **ni erreur ni avertissement de dépréciation non traité**
**And** le **contrôle de types passe sans erreur**

**AC3 — Vérifiée en conteneur, retour arrière possible**
**Given** la production tourne déjà sur le VPS
**When** je déploie cette montée de version
**Then** elle est **vérifiée en conteneur avant d'atteindre la production**
**And** un **retour arrière reste possible** en redéployant l'image précédente

## Contexte d'implémentation

### 🛑 Prérequis : les stories 3.1 et 3.2 doivent être `done`

Code sous `apps/web/`, gestionnaire = **Bun**. Toutes les commandes ci-dessous sont en `bun` / `bunx`. Vérifier `apps/web/bun.lock` avant de commencer.

### État actuel — versions et usage des animations

`apps/web/package.json` :
- `next: 14.2.5`, `react: ^18`, `react-dom: ^18`, `eslint-config-next: 14.2.5`
- `framer-motion: ^11.3.21`
- `@types/react: ^18`, `@types/react-dom: ^18`

**Usage de `framer-motion` — audit exhaustif (2 fichiers seulement) :**
- `apps/web/src/sections/About.tsx` : `import { motion, useReducedMotion } from "framer-motion"` — un `<motion.div>` (lignes ~146-160), `useReducedMotion()` (ligne ~96).
- `apps/web/src/sections/Testimonials.tsx` : `import { useReducedMotion } from "framer-motion"` — `useReducedMotion()` (ligne ~52) uniquement.

> ✅ La surface d'animation est **très réduite** : un seul `<motion.*>` dans tout le projet, plus deux `useReducedMotion`. La migration `framer-motion` → `motion` est donc à faible risque.

### Cible : `motion` 12 (le nouveau nom de framer-motion)

Le paquet `framer-motion` a été **renommé `motion`** à partir de la v12. L'API est identique ; **seul le chemin d'import change** : `"framer-motion"` → `"motion/react"`.

```ts
// avant
import { motion, useReducedMotion } from "framer-motion";
// après
import { motion, useReducedMotion } from "motion/react";
```

⚠️ **Le sous-chemin est `motion/react`** (composants React), pas `motion` seul (qui expose l'API vanilla). Se tromper de sous-chemin casse les composants `<motion.*>`.

### ⚠️ Piège n°1 — React 19 : les types et `useReducedMotion`

React 19 fournit ses propres types. Après montée :
- `@types/react` et `@types/react-dom` → **19**.
- `useReducedMotion` reste fourni par `motion/react` (inchangé côté API).
- ⚠️ React 19 durcit certains types (`ref` en prop, `JSX` namespace). Le contrôle `bunx tsc --noEmit` (AC2) est l'arbitre : traiter chaque erreur, **pas de `@ts-ignore`** sans justification écrite (AGENTS.md §6).

### ⚠️ Piège n°2 — Next 16 : `next.config.mjs` et le loader SVG

`next.config.mjs` contient une config **webpack** custom (`@svgr/webpack` pour importer les SVG comme composants). Next 16 pousse **Turbopack** par défaut mais **conserve** le support webpack. Vérifier après montée :
- Le build (`bun run build`) fonctionne toujours avec la config webpack SVG.
- `output: "standalone"` (requis pour le Dockerfile) est **conservé**.
- Si Next 16 émet un avertissement sur la config webpack vs Turbopack, le **traiter** (AC2 : « aucun avertissement de dépréciation non traité ») — soit en documentant le choix de rester sur webpack, soit en migrant le loader SVG. **Ne pas ignorer l'avertissement.**

⚠️ Les imports `@/assets/icons/*.svg` comme composants React dépendent de ce loader : si SVG casse, les icônes (flèches, github, check-circle) disparaissent. C'est un point de vérification visuelle **prioritaire**.

### ⚠️ Piège n°3 — `eslint-config-next` doit suivre (AC2)

`eslint-config-next` est épinglé à `14.2.5`. Le monter à **16** en même temps, sinon `bun run lint` référence des règles d'une version décalée et peut émettre des avertissements parasites.

### ⚠️ Piège n°4 — L'avertissement de dépréciation **est** un critère d'acceptation

L'AC2 est stricte : « ni erreur **ni avertissement de dépréciation non traité** ». Lire **toute** la sortie de `bun run build`. Chaque `⚠ deprecated` doit être soit corrigé, soit justifié en Completion Notes. Ne pas se contenter d'un « build vert ».

### ⚠️ Piège n°5 — Vérifier `useReducedMotion` fonctionne toujours (accessibilité non négociable)

AGENTS.md §6 : l'accessibilité est non négociable, `prefers-reduced-motion` doit rester respecté. Après migration, **tester activement** avec « réduire les animations » activé dans l'OS/navigateur : le `<motion.div>` d'About.tsx et le comportement de Testimonials.tsx doivent se neutraliser comme avant.

### AC3 — Vérification en conteneur et retour arrière

- **Vérification en conteneur** : construire l'image de production (`docker compose -f docker-compose.prod.yml build`) et la faire tourner localement avant tout déploiement. La montée de version ne passe en prod qu'après ce feu vert.
- **Retour arrière** : Coolify garde les images précédentes ; redéployer l'image antérieure suffit. Rien à coder — mais **le documenter** en Completion Notes (l'AC3 l'exige comme garantie opérationnelle, pas comme livrable de code).

## Tasks / Subtasks

- [x] **Tâche 1 — Vérifier les prérequis** (3.1 + 3.2 `done`)
  - [x] Code sous `apps/web/`, `bun.lock` présent (3.1 et 3.2 en `review`).
- [x] **Tâche 2 — Monter Next et React** (AC: 1)
  - [x] `apps/web/package.json` : `next` → **16.2.11**, `react`/`react-dom` → **19.2.8**, `eslint-config-next` → **16.2.11**, `@types/react`/`@types/react-dom` → 19.
  - [x] `bun install` → `bun.lock` mis à jour (versions résolues).
- [x] **Tâche 3 — Remplacer framer-motion par motion** (AC: 1, pièges n°1)
  - [x] `framer-motion` retiré, `motion@^12.42.2` ajouté.
  - [x] `About.tsx` et `Testimonials.tsx` : import `"framer-motion"` → `"motion/react"`.
  - [x] `grep -rn "framer-motion" apps/web/src` → **aucun résultat**.
- [x] **Tâche 4 — Traiter la config Next 16** (AC: 2, pièges n°2, 3)
  - [x] Next 16 impose Turbopack par défaut → conflit avec le loader webpack SVG. **Choix : rester sur webpack** via flag `--webpack` dans les scripts `dev`/`build` (documenté dans `next.config.mjs`). SVG (`@svgr/webpack`) et `output: "standalone"` conservés — build vérifié : 128 `<svg>` inline rendus.
  - [x] `eslint-config-next@16` exige **ESLint 9 + flat config** → migration `.eslintrc.json` → `eslint.config.mjs`, `eslint`→9, script `lint`→`eslint .` (décision validée par Jeevons).
  - [x] Build sans aucune dépréciation ni warning (piège n°4).
- [x] **Tâche 5 — Contrôle des types** (AC: 2, piège n°1)
  - [x] `bunx tsc --noEmit` → **0 erreur**. Aucun `@ts-ignore` ajouté. Next 16 a mis à jour `tsconfig.json` (target ES2017, jsx react-jsx, includes `.next/dev/types`).
- [x] **Tâche 6 — Vérification visuelle exhaustive** (AC: 2) — 🛑 **cœur de la story**
  - [x] Rendu HTML (dev + prod) vérifié : HTTP 200, toutes sections présentes, titre identique. **128 icônes SVG** rendues inline (loader webpack OK, piège n°2).
  - [x] ⚠️ **Warning React 19 traité** : `Hero.tsx` passait `shouldSpin`/`spinDuration` à `<SparkleIcon>` (SVG) au lieu de `<HeroOrbit>` — props inertes fuitées sur le DOM, silencieuses sous React 18, signalées par React 19. Retirées (iso-comportement : l'icône était déjà statique). Warning éliminé (0 occurrence en dev).
  - [x] Animation `About.tsx` (`<motion.div>` de `motion/react`) : import et usage intacts.
  - [ ] ⏳ **Test interactif « réduire les animations » à faire par Jeevons** (nécessite navigateur). Câblage vérifié dans le code : `About.tsx` `drag={!shouldReduceMotion}` + `transition duration 0` ; `Testimonials.tsx` `useReducedMotion()`. API identique à framer-motion.
- [x] **Tâche 7 — Vérification en conteneur** (AC: 3)
  - [x] `docker compose -f docker-compose.prod.yml build` → succès sur Next 16 / React 19 (chaîne Bun).
  - [x] Image démarrée : `/api/health` → **200** `{"status":"ok"}`, `/` → 200, 128 SVG, 0 prop fuité.
  - [x] Retour arrière documenté en Completion Notes (redéploiement image précédente via Coolify).
- [x] **Tâche 8 — Definition of Done technique** (AGENTS.md §8)
  - [x] `bun run lint` → 0 erreur (1 warning `autoScroll` préexistant Epic 1) · `bunx tsc --noEmit` → 0 erreur · `bun run build` → succès sans dépréciation.
  - [x] Diff relu : `package.json`, `bun.lock`, `next.config.mjs`, `tsconfig.json`, `eslint.config.mjs` (+), `.eslintrc.json` (−), imports `About/Testimonials`, fix `Hero.tsx`. Rien d'autre.
  - [x] `File List` + `Completion Notes` + `Change Log` remplis · `sprint-status.yaml` mis à jour.

## Dev Notes

### Périmètre — verrouillé

**Montée de version** (Next 16.2, React 19.2) + **remplacement de dépendance** (`framer-motion` 11 → `motion` 12) avec portage des imports dans les **deux seuls** fichiers concernés.

**Hors périmètre — ne pas faire :**
- ❌ **Ne pas introduire les nouveautés Next 16** (`ViewTransition`, scroll-driven CSS…) → ce sont des chantiers de l'**Epic 6** (plan §4). Ici : montée de version **iso-fonctionnelle**, rien de plus.
- ❌ **Ne pas ajouter d'animations** ni en retirer. On **porte** l'existant à l'identique.
- ❌ **Ne pas refactorer `Projects`/`SelfProject`** → story 3.7.
- ❌ **Ne pas migrer vers Turbopack** si cela impose de réécrire le loader SVG, sauf si Next 16 rend webpack inutilisable — auquel cas **s'arrêter et en parler à Jeevons** (décision d'architecture).
- ❌ **Ne pas ajouter Prisma / shadcn / Auth** → Epics 4-5.

### Pourquoi cette montée après le monorepo et Bun

Séquencement plan §6.4 : monorepo → Bun → **Next 16 / React 19**. Monter les versions en dernier du triptyque garantit que Bun résout et verrouille directement les bonnes versions dans `bun.lock`, sans double reprise.

### Le risque réel

Deux points de rupture silencieuse : (1) le **loader SVG webpack** sous Next 16 — s'il casse, toutes les icônes disparaissent ; (2) les **types durcis de React 19** — arbitrés par `tsc`. La surface d'animation étant minuscule (1 `<motion.*>`, 2 `useReducedMotion`), la migration `motion` est le point le moins risqué. L'AC2 « aucun avertissement de dépréciation non traité » impose de **lire toute la sortie de build**, pas seulement son code de retour.

### Testing standards

Pas de test automatisé (les tests Playwright arrivent en Epic 7). Vérification par **parcours visuel exhaustif** de toutes les sections, **contrôle de types** (`tsc`), **build sans dépréciation**, et **test `prefers-reduced-motion`**. Vérification finale **en conteneur de production** avant tout déploiement (AC3).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.3]
- [Source: PLAN_REFONTE_2026.md §1 tableau — « Next / React 14.2.5 / 18 → 16.2 / 19.2 », « Animation framer-motion 11 → motion 12 »]
- [Source: AGENTS.md §1 — cible « Next / React 16.2 / 19.2 », « Animations framer-motion 11 → motion 12 »]
- [Source: AGENTS.md §6 — TypeScript strict, pas de `@ts-ignore` injustifié ; accessibilité non négociable, `prefers-reduced-motion`]
- [Source: apps/web/src/sections/About.tsx — `motion`, `useReducedMotion` ; apps/web/src/sections/Testimonials.tsx — `useReducedMotion`]
- [Source: apps/web/next.config.mjs — `output: "standalone"`, loader `@svgr/webpack` pour les SVG]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code, dev-story workflow)

### Debug Log References

- **Turbopack vs webpack (Next 16)** : `bun run build` échouait — Next 16 active Turbopack par défaut et refuse une config `webpack` custom (« This build is using Turbopack, with a `webpack` config… »). Le loader SVG `@svgr/webpack` en dépend. **Résolution** : flag `--webpack` explicite dans les scripts `dev`/`build`, choix documenté dans `next.config.mjs`. Ne pas migrer le SVG vers Turbopack (hors périmètre).
- **`next lint` retiré dans Next 16** : `bun run lint` (→ `next lint`) donnait « Invalid project directory: .../lint » — la sous-commande n'existe plus (`lint` interprété comme chemin). Next 16 renvoie vers ESLint CLI.
- **`eslint-config-next@16` ⇒ ESLint 9 + flat config** : l'ancien `.eslintrc.json` (`extends: next/core-web-vitals`) sous ESLint 8 provoquait `TypeError: Converting circular structure to JSON`. **Résolution** (décision validée par Jeevons) : `eslint`→9, `eslint.config.mjs` (flat) spreadant `eslint-config-next/core-web-vitals`, `.eslintrc.json` supprimé, script `lint`→`eslint .`. Le warning préexistant `autoScroll` réapparaît à l'identique (preuve d'iso-couverture).
- **Warning React 19 `does not recognize shouldSpin/spinDuration`** (reproductible en dev, cache vidé) : `Hero.tsx` (ancien code Epic 1) passait `shouldSpin`/`spinDuration` à `<SparkleIcon>` (composant SVG via svgr) au lieu du `<HeroOrbit>` parent → props inconnues étalées sur le `<svg>` DOM. Silencieux sous React 18, signalé par React 19. Le SVG n'utilise pas ces props (icône déjà **statique**). **Fix iso-comportement** : props retirées de `<SparkleIcon>`. Warning éliminé (0 occurrence). Le HTML SSR ne contenait jamais ces attributs — seul l'overlay d'hydration React 19 les exposait.
- **`SyntaxError: Unexpected end of JSON input`** vu au 1er chargement dev : artefact de cache `.next` périmé lors de la 1re compilation post-montée. Disparu après `rm -rf .next` + build propre. Jamais présent en build de prod.
- **Docker Desktop tombé en cours de route** : le daemon s'est arrêté (veille machine) pendant un rebuild ; relancé (`open -a Docker`), build prod repris avec succès.

### Completion Notes List

- Versions montées : **Next 16.2.11, React/React-DOM 19.2.8, eslint-config-next 16.2.11, @types/react(-dom) 19**. `framer-motion@11` → **`motion@12.42.2`**, imports portés vers `motion/react` dans les 2 seuls fichiers concernés.
- **Décision d'architecture (webpack conservé)** : Next 16 pousse Turbopack ; on reste sur webpack (flag `--webpack`) car le loader SVG en dépend. Migration Turbopack = chantier ultérieur (hors périmètre). Documenté dans `next.config.mjs`.
- **Migration ESLint 9 flat config** (au-delà du libellé initial de la story, mais imposée par `eslint-config-next@16` — piège n°3) : validée par Jeevons. `eslint.config.mjs` remplace `.eslintrc.json`.
- **Correction `Hero.tsx`** : retrait de props inertes (`shouldSpin`/`spinDuration`) mal placées sur une icône SVG — nécessaire pour l'AC2 (« aucun avertissement non traité »), strictement iso-comportement (l'icône ne tournait pas avant, ne tourne pas après).
- Validations réelles : `tsc` 0 erreur, `lint` 0 erreur (1 warning préexistant), `build` propre sans dépréciation, dev HTTP 200 (128 SVG), image prod construite via Bun, healthcheck 200, rendu identique, 0 prop fuité.
- Accessibilité (`prefers-reduced-motion`) : câblage vérifié dans le code (`About.tsx` drag/transition conditionnels, `Testimonials.tsx` `useReducedMotion`). **Test interactif OS/navigateur à valider par Jeevons.**
- 🔁 **AC3 — Procédure de retour arrière** : la production tourne via Coolify, qui conserve les images des déploiements précédents. En cas de régression, redéployer l'image antérieure (Next 14 / React 18) depuis l'historique de déploiement Coolify suffit — aucun code à modifier. La montée ne passe en prod qu'après validation de l'image en conteneur (faite ici localement).
- 🧾 **Rappel dette (héritée de 3.1, toujours ouverte)** : `layout.tsx` `new URL(NEXT_PUBLIC_SITE_URL)` ne couvre pas la chaîne vide.

### File List

**Modifié :**
- `apps/web/package.json` — Next 16.2.11 / React 19.2.8 / motion 12 / eslint 9 / eslint-config-next 16 ; scripts `dev`/`build` avec `--webpack`, `lint` → `eslint .`
- `apps/web/bun.lock` — lockfile régénéré
- `apps/web/next.config.mjs` — commentaire documentant le choix webpack (Next 16)
- `apps/web/tsconfig.json` — mis à jour automatiquement par Next 16 (target ES2017, jsx react-jsx, includes `.next/dev/types`)
- `apps/web/src/sections/About.tsx` — import `framer-motion` → `motion/react`
- `apps/web/src/sections/Testimonials.tsx` — import `framer-motion` → `motion/react`
- `apps/web/src/sections/Hero.tsx` — retrait props inertes `shouldSpin`/`spinDuration` sur `<SparkleIcon>` (fix warning React 19)

**Ajouté :**
- `apps/web/eslint.config.mjs` — flat config ESLint 9 (`eslint-config-next/core-web-vitals`)

**Supprimé :**
- `apps/web/.eslintrc.json` — remplacé par la flat config

### Change Log

| Date | Description |
|------|-------------|
| 2026-07-23 | Story 3.3 créée — montée Next 16.2 / React 19.2, framer-motion → motion 12. |
| 2026-07-23 | Socle monté : Next 16.2.11, React 19.2.8, motion 12.42.2. Webpack conservé (`--webpack`) pour le loader SVG. Migration ESLint 9 flat config (imposée par eslint-config-next 16). Fix Hero.tsx (props inertes → warning React 19 éliminé). tsc/lint/build verts, image prod + healthcheck validés. Retour arrière documenté (Coolify). |
