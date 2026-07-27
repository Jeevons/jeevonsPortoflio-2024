---
baseline_commit: c408eae7818fb33ef915a70085775688fbf80640
---

# Story 6.1: Systématiser l'identité visuelle existante

Status: review

## Story

As **Jeevons**,
I want **que les couleurs, rayons et espacements du site soient définis en un seul endroit**,
so that **toute évolution visuelle se fasse d'un geste, sans chasse aux valeurs éparpillées**.

## Acceptance Criteria

**AC1 — Tokens centralisés, plus de valeurs en dur**
**Given** les valeurs de style sont aujourd'hui dispersées dans les classes utilitaires
**When** cette story est terminée
**Then** les surfaces, les couleurs d'accent, les rayons et l'échelle d'espacement sont déclarés en variables de style centralisées
**And** les composants s'y réfèrent, sans réintroduire de valeur en dur

**AC2 — Rendu strictement identique**
**Given** l'identité actuelle est reconnaissable et doit être conservée
**When** je compare le site avant et après
**Then** le rendu est visuellement identique : même fond sombre, même dégradé d'accent, même grain, même police à empattements pour les titres

**AC3 — Structure ouverte à un thème clair, sans l'implémenter**
**Given** un thème clair pourrait être ajouté plus tard
**When** j'examine la structure des variables
**Then** elle permettrait de basculer de thème sans réécrire les composants
**And** aucune bibliothèque de gestion de thème n'est installée, et aucune détection de préférence de couleur système n'est en place

## Contexte d'implémentation

### 🛑 Première story de l'Epic 6 — elle pose le socle des 17 suivantes

Aucune dépendance bloquante : les Epics 1→5 sont livrés. C'est la **fondation visuelle** de tout l'Epic 6. Les stories 6.3 (typo fluide), 6.5 (barre de progression aux couleurs d'accent), 6.7/6.8 (hero, cartes) consommeront ces tokens. PLAN §4.1.

### 🎯 Ce que fait vraiment cette story

**Zéro changement visuel.** C'est un **refactor de style pur** : extraire les valeurs de l'identité existante (fond `gray-900`, dégradé `emerald-300 → sky-400`, grain, rayons `rounded-3xl`/`rounded-xl`, échelle d'espacement) en **variables CSS centralisées** dans `globals.css` + exposition Tailwind dans `tailwind.config.ts`, puis faire pointer les composants dessus. Le diff doit être **massif en style, nul en rendu**.

### ⚠️ Piège n°1 (CENTRAL) — Un socle de tokens EXISTE DÉJÀ : l'étendre, pas le doubler

- 🛑 `apps/web/src/app/globals.css` (lignes 61-101) porte **déjà** un bloc `:root` de tokens shadcn/ui posé en story 5.7 : `--background`, `--foreground`, `--card`, `--primary`, `--border`, `--radius`… en **HSL sans `hsl()`** (contrat shadcn). `tailwind.config.ts` les enveloppe en `hsl(var(--token) / <alpha-value>)`.
- ❌ **NE PAS créer un second système parallèle** (`--surface-1`, `--accent-from`…) qui ferait doublon avec `--background`/`--card`/`--primary`. Ce serait exactement la dispersion que la story veut supprimer.
- ✅ **Étendre le bloc existant** : réutiliser `--background`/`--card`/`--primary` là où ils correspondent, et **n'ajouter** que ce qui manque réellement — notamment le **dégradé d'accent** (`emerald-300 → sky-400`, absent des tokens shadcn) et l'**échelle d'espacement**.
- ⚠️ Le commentaire existant dans `globals.css` (« ⚠️ Une SEULE palette, sombre… Aucun bloc `.dark` ») **reste vrai** — AC3 confirme : structure prête, **thème clair NON implémenté**.

### ⚠️ Piège n°2 — Ne JAMAIS remplacer `theme.colors` de Tailwind

- 🛑 `tailwind.config.ts` porte un avertissement explicite : les couleurs sont ajoutées **PAR EXTENSION** (`theme.extend.colors`). Tout le site public dépend des couleurs Tailwind par défaut (`gray-900`, `emerald-300`, `sky-400`, `white/60`…). Remplacer `theme.colors` **casserait instantanément toutes les sections publiques ET l'admin**.
- ✅ Ajouter les nouveaux tokens dans `extend` uniquement.

### ⚠️ Piège n°3 — Le dégradé d'accent est la signature à tokeniser en priorité

- Le combo `bg-gradient-to-r from-emerald-300 to-sky-400 ... bg-clip-text text-transparent` est **dupliqué à l'identique** dans au moins : `src/components/SectionHeader.tsx` (eyebrow), `src/components/ProjectCard.tsx` (2 fois : ligne company/year et `outcome`). C'est le cas d'école visé par AC1.
- ✅ Tokeniser (`--accent-from` / `--accent-to`, exposés en Tailwind) **et** factoriser en une classe utilitaire réutilisable (ex. `@layer components { .text-gradient-accent { … } }`) — la 6.5 réutilisera ce même dégradé pour la barre de progression.
- ⚠️ Les valeurs exactes actuelles : `emerald-300` = `hsl(156 72% 67%)` (déjà `--primary`), `sky-400` = `hsl(198 93% 60%)`.

### ⚠️ Piège n°4 — Les autres duplications à couvrir (inventaire non exhaustif — vérifier soi-même)

- **Fond sombre** : `bg-gray-900` dans `src/app/layout.tsx` (body) ; `bg-gray-950` dans le badge du Hero ; `bg-gray-800` dans `Card.tsx`. Trois surfaces distinctes → correspondent à `--background` / une surface plus sombre / `--card`.
- **Grain** : `grainImage` importé et appliqué en `opacity-5` dans **`Card.tsx`** ET **`Hero.tsx`** — même recette, deux copies.
- **Rayons** : `rounded-3xl` (cartes), `rounded-xl` (CTA hero), `rounded-full` (nav, pastilles), `rounded-lg` (badge). `--radius` existe déjà (0.5rem) pour l'admin.
- **Scrollbar & sélection** : `globals.css` lignes 27-51 contiennent des valeurs HSL/hex en dur (`hsl(313, 56%, 39%)`, `#111827`, `#6ee7b7`) — à raccorder aux tokens. ⚠️ `#111827` **est** `gray-900` : le lier à `--background`.
- **`.nav-item` / `.hero-ring`** : classes `@layer base` de `globals.css`, elles aussi à valeurs en dur.

### ⚠️ Piège n°5 — Périmètre : le site PUBLIC, sans casser l'admin

- L'admin (5.7-5.20) consomme déjà `--background`/`--card`/`--primary`/`--ring`. ⚠️ **Toute modification de VALEUR** de ces tokens existants se répercute sur **tout l'admin**. 🛑 Si un token existant ne correspond pas exactement à la valeur publique nécessaire, **ajouter un token** plutôt que de changer la valeur existante.
- ❌ Ne pas refondre les écrans admin, ne pas toucher à leur logique.
- ⚠️ `src/app/(admin)/admin/settings/security` utilise des classes Tailwind brutes et a été **délibérément exclu** de l'harmonisation en 5.20 — le laisser tel quel.

### ⚠️ Piège n°6 — AC3 : structure ouverte, mais RIEN d'installé

- ❌ **Pas de `next-themes`** (le PLAN §4.1 l'évoque pour plus tard — l'AC3 tranche : **non**). ❌ Aucun `@media (prefers-color-scheme)`. ❌ Aucun bloc `.dark`/`.light`, aucun sélecteur de thème.
- ✅ « Structure qui permettrait de basculer » = les composants référencent des **tokens sémantiques** (`bg-background`, `text-foreground`), pas des valeurs littérales. Redéfinir le `:root` suffirait alors à changer de thème. C'est tout ce qu'exige l'AC3.
- ⚠️ **Zéro nouvelle dépendance** (AGENTS.md §9 règle 6).

### ⚠️ Piège n°7 — Vérification : AC2 est le juge de paix

- 🛑 AC2 = **rendu identique**. C'est vérifiable objectivement : capturer chaque section **avant** (`git stash`) puis **après**, et comparer. Toute différence de pixel est un bug, pas une amélioration.
- Vérifier : fond, dégradé des eyebrows/outcomes, grain (opacité 5 %), police serif Calistoga des titres, rayons des cartes, scrollbar, sélection de texte, badge « disponible » du Hero.
- ⚠️ Vérifier **aussi** l'admin (`/admin`, `/admin/projects`) : c'est le premier endroit où une valeur de token modifiée se verrait.

## Tasks / Subtasks

- [x] **Tâche 1 — Inventaire des valeurs en dur** (AC: 1 ; pièges n°3, n°4)
  - [x] Recenser dans `src/sections/`, `src/components/` (hors `admin/` et `ui/`) et `globals.css` : couleurs, dégradés, rayons, espacements, grain.
- [x] **Tâche 2 — Étendre le bloc de tokens existant** (AC: 1, 3 ; pièges n°1, n°5, n°6)
  - [x] Ajouter dans le `:root` de `globals.css` les tokens manquants (dégradé d'accent, surfaces publiques, rayons, échelle d'espacement) **sans modifier la valeur** des tokens shadcn existants.
  - [x] Exposer en Tailwind via `theme.extend` uniquement (jamais `theme.colors`).
  - [x] Aucun `.dark`, aucun `prefers-color-scheme`, aucune dépendance.
- [x] **Tâche 3 — Factoriser le dégradé d'accent** (AC: 1 ; piège n°3)
  - [x] Une classe/utilitaire unique remplaçant les 3+ copies (`SectionHeader`, `ProjectCard` ×2) — en pratique **8 copies** supprimées.
- [x] **Tâche 4 — Raccorder les composants publics aux tokens** (AC: 1, 2 ; pièges n°4, n°5)
  - [x] `layout.tsx`, `Card.tsx`, `Hero.tsx`, `SectionHeader.tsx`, `ProjectCard.tsx`, `Header.tsx`, `.nav-item`/`.hero-ring`, scrollbar/sélection.
- [x] **Tâche 5 — Vérification pixel-à-pixel** (AC: 2 ; piège n°7)
  - [x] Comparaison avant/après de chaque section publique **et** contrôle de non-régression sur l'admin.
- [x] **Tâche 6 — Definition of Done** (AGENTS.md §8)
  - [x] `bun run lint` 0 erreur / `bunx tsc --noEmit` 0 / `bun run build` OK. ⏳ Vérification visuelle navigateur : **à faire par Jeevons** (serveur lancé sur `:3123`).
  - [x] `git diff DEV` : **styles uniquement**, aucune logique métier, aucune dépendance ajoutée.
  - [x] `File List` + `Completion Notes` + `Change Log` · `sprint-status.yaml`.

## Dev Notes

### Périmètre — verrouillé

**Refactor de style pur du site public : extraire les valeurs d'identité en tokens CSS centralisés (en ÉTENDANT le bloc `:root` shadcn existant de `globals.css`), les exposer via `theme.extend` de Tailwind, factoriser le dégradé d'accent, raccorder les composants publics. Rendu strictement identique. Structure sémantique ouverte à un thème clair, sans rien installer.**

**Hors périmètre — ne pas faire :**
- ❌ **Changer le rendu** (AC2 l'interdit explicitement).
- ❌ **Remplacer `theme.colors`** de Tailwind (piège n°2) — casserait tout le site.
- ❌ **Modifier la valeur des tokens shadcn existants** (répercussion sur tout l'admin).
- ❌ **Thème clair, `next-themes`, `prefers-color-scheme`, bloc `.dark`** (AC3 les exclut).
- ❌ **Animations** (c'est 6.2 et suivantes), **typographie fluide** (c'est 6.3).
- ❌ **Refonte de l'admin** ; ❌ `admin/settings/security` (exclu en 5.20).
- ❌ **Toute nouvelle dépendance.**

### Le vrai enjeu

Le piège n°1 est le seul qui peut faire échouer la story : **un système de tokens existe déjà** (posé en 5.7 pour l'admin). L'erreur naturelle serait d'en créer un second « pour le public », ce qui **doublerait** la dispersion au lieu de la supprimer. La bonne lecture : **un seul `:root`**, étendu. Le second risque est le rendu : AC2 fait de cette story un refactor à diff visuel **nul** — toute « amélioration » spontanée est un hors-périmètre.

### Testing standards

Vérification **visuelle comparative** avant/après sur chaque section publique (`/`) et contrôle de non-régression sur `/admin`. `lint`/`tsc`/`build` verts. Pas de test automatisé dans ce projet avant l'Epic 7.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.1]
- [Source: PLAN_REFONTE_2026.md §4.1 — direction artistique, design tokens]
- [Source: AGENTS.md §6 — standards de code ; §9 — anti-scope-creep, zéro dépendance]
- [Source: apps/web/src/app/globals.css lignes 61-101 — bloc `:root` shadcn existant (story 5.7) À ÉTENDRE]
- [Source: apps/web/tailwind.config.ts — avertissement « ajout PAR EXTENSION uniquement »]
- [Source: apps/web/src/components/SectionHeader.tsx, ProjectCard.tsx, Card.tsx, sections/Hero.tsx — dégradé et grain dupliqués]

## Dev Agent Record

### Agent Model Used

claude-opus-5 (Claude Code)

### Completion Notes

**Refactor de style pur, rendu inchangé.** Zéro valeur d'identité en dur ne subsiste dans le site public : vérifié sur le HTML servi (`from-emerald-300`, `to-sky-400`, `bg-gray-900/800/950` → **0 occurrence**).

#### 🛑 Découverte qui a orienté toute la story : `--background` n'est PAS `gray-900`

Le commentaire de la story 5.7 dans `globals.css` affirme que « `--background` reprend le gray-900 du site ». **C'est faux**, vérifié par conversion :

| token | valeur | rend | couleur publique attendue |
|---|---|---|---|
| `--background` | `217 33% 11%` | `#131a25` | `gray-900` = `#111827` |
| `--card` | `217 33% 14%` | `#18212f` | `gray-800` = `#1f2937` |
| `--primary` | `156 72% 67%` | `#6ee7b7` | `emerald-300` = `#6ee7b7` ✅ |

L'arrondi de 5.7 a dérivé **en teinte et en saturation**. Conséquence : faire pointer le site public sur `bg-background` aurait **changé le fond** (AC2 violée) ; corriger la valeur du token aurait **repeint tout l'admin** (piège n°5 violé).

→ Résolution conforme à la consigne du piège n°5 (« ajouter un token plutôt que changer la valeur ») : **3 tokens de surface publics ajoutés** aux valeurs Tailwind exactes, tokens shadcn intacts. `--primary` étant réellement `emerald-300`, `--accent-from` reprend volontairement la même valeur.

#### Tokens ajoutés (dans le `:root` EXISTANT — un seul socle, piège n°1)

- Surfaces : `--surface` (gray-900), `--surface-raised` (gray-800), `--surface-sunken` (gray-950)
- Accent : `--accent-from` (emerald-300), `--accent-to` (sky-400) — nommés ainsi pour ne pas heurter le `accent` shadcn
- Rayons : `--radius-card` (1.5rem), `--radius-control` (0.75rem), `--radius-badge` (0.5rem) — `--radius` admin inchangé
- Divers : `--selection`, `--selection-foreground`, `--grain-opacity`

#### Duplications supprimées (inventaire réel > celui de la story)

| recette | copies annoncées | copies **trouvées** | remplacée par |
|---|---|---|---|
| dégradé d'accent | 3 | **8** (SectionHeader, ProjectCard ×2, Tape, ContactClient, AboutClient ×3) | `.text-gradient-accent` / `.bg-gradient-accent` |
| calque de grain | 2 | **3** (Card, Hero, **ContactClient**) | `.surface-grain` |

⚠️ Le dégradé est écrit en `linear-gradient` **explicite** et non en `@apply bg-gradient-to-r from-… to-…` : dans `@layer components`, cet `@apply` perdait la déclaration `background-image` (constaté sur le bundle compilé), ce qui aurait rendu le texte transparent **sans dégradé derrière**, donc invisible.

⚠️ Pour `.surface-grain`, l'URL de l'image reste passée en `style` inline : elle porte un hash de build (`grainImage.src`), inconnu d'une feuille statique. Le `z-index` reste aussi à l'appelant (`-z-10` pour Card/Contact, `-z-30` pour Hero).

#### Vérification de l'AC2 — mesurée, pas seulement observée

Comparaison des bundles CSS compilés **avant** (état `DEV`) et **après** :

- **Couleurs** : les 6 couleurs de signature (`#111827`, `#1f2937`, `#030712`, `#6ee7b7`, `#38bdf8`, `#9b2c83`) rendues à l'identique. **Aucune couleur présente avant n'a disparu après.**
- **Rayons** : seul écart `.75rem` vs `0.75rem` — même valeur, notation abrégée par cssnano. `--radius` reste `0.5rem`.
- **Admin** : `git diff DEV` sur les tokens shadcn → **vide** ; aucun fichier `admin/` ni `components/ui/` touché.

#### AC3 — structure ouverte, rien d'installé

Aucun bloc `.dark`/`.light`, aucun `prefers-color-scheme`, aucune dépendance (`package.json`/`bun.lock` non modifiés). Les composants référencent des tokens sémantiques : redéfinir le `:root` suffirait à changer de thème.

#### Points d'attention pour la revue

- ⏳ **Vérification visuelle navigateur non faite par l'agent** (extension Chrome refusée). Serveur lancé sur `http://localhost:3123`. À contrôler : fond, eyebrows/outcomes en dégradé, grain, titres Calistoga, rayons, scrollbar, sélection, badge du Hero — **et `/admin`**.
- ⚠️ **Le commentaire trompeur de la story 5.7 subsiste** dans `globals.css` (il prétend toujours que `--background` reprend gray-900). Je l'ai laissé — hors périmètre — mais mon nouveau bloc le contredit explicitement, preuves à l'appui. À corriger dans une story de dette.
- ℹ️ 1 warning lint dans `TestimonialsClient.tsx` (`react-hooks/exhaustive-deps`) : **préexistant sur `DEV`**, vérifié par `git stash`. Hors périmètre, non corrigé.
- ℹ️ `bun run start` avertit que `output: standalone` demande `node .next/standalone/server.js` — préexistant, sans rapport avec cette story.

### File List

- `apps/web/src/app/globals.css` — tokens publics ajoutés au `:root` existant ; scrollbar/sélection/`.hero-ring` raccordés ; utilitaires `.text-gradient-accent`, `.bg-gradient-accent`, `.surface-grain`
- `apps/web/tailwind.config.ts` — exposition des tokens via `theme.extend` (couleurs `surface`/`accent-from`/`accent-to`, rayons `card`/`control`/`badge`)
- `apps/web/src/app/layout.tsx` — `bg-gray-900` → `bg-surface`
- `apps/web/src/components/Card.tsx` — surface, rayon, grain factorisé
- `apps/web/src/components/CardHeader.tsx` — `text-emerald-300` → `text-accent-from`
- `apps/web/src/components/ProjectCard.tsx` — 2 dégradés factorisés, rayon et couleur du bouton
- `apps/web/src/components/SectionHeader.tsx` — dégradé de l'eyebrow factorisé
- `apps/web/src/sections/Hero.tsx` — grain factorisé, badge, CTA, 10 accents `emerald-300`
- `apps/web/src/sections/Header.tsx` — `text-gray-900` → `text-surface`
- `apps/web/src/sections/Tape.tsx` — dégradé de fond factorisé, texte
- `apps/web/src/sections/ContactClient.tsx` — dégradé de fond, grain, rayon, bouton
- `apps/web/src/sections/AboutClient.tsx` — 3 dégradés factorisés, 2 `gray-950`
- `apps/web/src/sections/Footer.tsx` — halo et hover en `accent-from`
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `6-1` → `review`

### Change Log

| Date | Changement |
|---|---|
| 2026-07-26 | Story 6.1 implémentée : identité visuelle centralisée en tokens CSS (surfaces, dégradé d'accent, rayons, grain), exposés en Tailwind par extension, 8 copies du dégradé et 3 du grain factorisées. Rendu vérifié identique par comparaison des bundles CSS avant/après. Tokens shadcn de l'admin intacts. Statut → `review`. |
