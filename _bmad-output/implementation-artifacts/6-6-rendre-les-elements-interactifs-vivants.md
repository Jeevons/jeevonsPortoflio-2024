---
baseline_commit: 6e8666a33715d6a2c0af3236394a0debb43a1a33
---

# Story 6.6: Rendre les éléments interactifs vivants

Status: review

## Story

As **visiteur du portfolio**,
I want **que les boutons et le curseur réagissent à mes gestes**,
so that **je perçoive immédiatement le soin apporté au détail**.

## Acceptance Criteria

**AC1 — Boutons magnétiques**
**Given** je survole un bouton d'action à la souris
**When** je m'en approche
**Then** il se déplace légèrement vers mon curseur, de quelques pixels seulement
**And** il retrouve sa position dès que je m'en éloigne

**AC2 — Curseur personnalisé desktop**
**Given** je navigue sur un ordinateur avec une souris
**When** je déplace le curseur
**Then** un curseur personnalisé le suit, et son halo grossit au survol des éléments interactifs

**AC3 — Tactile : effets désactivés**
**Given** je navigue sur un écran tactile
**When** j'utilise le site
**Then** ces effets sont désactivés et le comportement tactile reste standard

**AC4 — Mouvement réduit : rien ne s'applique, curseur système intact**
**Given** le réglage de mouvement réduit est actif
**When** je survole ces éléments
**Then** aucun de ces effets ne s'applique et le curseur système reste inchangé

**AC5 — Clavier : effets purement décoratifs**
**Given** ces effets sont purement décoratifs
**When** je navigue au clavier
**Then** ils n'entravent ni le parcours de focus ni l'activation des contrôles

## Contexte d'implémentation

### 🛑 Prérequis : stories 6.1 (tokens), 6.2 (socle motion) `done`

Le halo du curseur (AC2) utilise le **dégradé d'accent tokenisé** en 6.1. AC4 s'appuie sur le **socle de neutralisation** de 6.2 (`useReducedMotion`). PLAN §4.2 (P1 n°4 magnetic buttons ~8 px, n°5 curseur custom desktop « point + halo qui grossit sur les éléments interactifs »).

### 🎯 Ce que fait vraiment cette story

Deux effets de pointeur, tous deux **purement décoratifs** : un **déplacement magnétique** des CTA vers le curseur (AC1), et un **curseur personnalisé** qui suit la souris avec un halo réactif (AC2). Les trois AC restantes sont des **conditions de non-nuisance** : rien sur tactile (AC3), rien sous mouvement réduit (AC4), rien qui gêne le clavier (AC5). C'est une story où **ce qu'on ne casse pas compte plus que ce qu'on ajoute**.

### ⚠️ Piège n°1 (CENTRAL) — AC3 : `hover: hover` ≠ « pas tactile », et le fallback pointeur est le vrai piège

- 🛑 Détecter le tactile par la **largeur d'écran** (`md:`) est **faux** : un laptop tactile est large, une tablette en paysage aussi. AC3 parle de **capacité de pointage**, pas de taille.
- ✅ Le bon signal est la media query **`@media (hover: hover) and (pointer: fine)`** : elle isole exactement « un pointeur précis capable de survoler ». En JS, l'équivalent est `window.matchMedia("(hover: hover) and (pointer: fine)")`.
- ⚠️ **Le défaut doit être « effet désactivé »**, jamais l'inverse. Au premier rendu serveur, aucune media query n'est évaluable : si le code part de « effet actif » puis le retire après hydratation, un mobile verra **un curseur fantôme apparaître une fraction de seconde**. Partir de `false`, activer après montage.
- 🛑 **Un appareil hybride** (laptop tactile) peut satisfaire `hover: hover` **et** recevoir des évènements tactiles. AC3 exige que « le comportement tactile reste standard » : les effets ne doivent donc jamais **capter** ou **annuler** un `pointerdown`/`click`. ❌ Pas de `preventDefault()`, pas de `touch-action: none`.
- ⚠️ Le curseur custom implique de **masquer le curseur système** (`cursor: none`). ❌ **Ne JAMAIS poser `cursor: none` globalement** sur `body` sans condition : sur un appareil sans pointeur fin — ou si le composant plante — le visiteur se retrouve **sans curseur du tout**, site inutilisable. Le `cursor: none` doit être conditionné à la même media query que l'effet, et retiré dès que la condition tombe.

### ⚠️ Piège n°2 — AC4 : « le curseur système reste inchangé » est plus fort qu'« aucune animation »

- 🛑 AC4 ne dit pas « le curseur custom cesse de bouger » : il dit que **le curseur système reste inchangé**. Sous reduced-motion, le curseur personnalisé ne doit **pas exister du tout** — donc **pas de `cursor: none`**, et idéalement **pas de nœud DOM** rendu.
- ⚠️ ❌ Une simple neutralisation d'animation (le socle CSS de 6.2 met `transition-duration: 0.01ms`) **ne suffit pas ici** : le curseur custom suivrait alors la souris **instantanément**, il serait toujours là, et le curseur système resterait masqué → **échec d'AC4**. C'est le piège le plus subtil de la story : la règle globale de 6.2 traite les *transitions*, pas l'*existence* d'un composant.
- ✅ La bonne forme : `useReducedMotion()` (socle 6.2) → si vrai, le composant **retourne `null`** et aucune règle `cursor: none` n'est appliquée. Idem pour le magnétisme : `transform` jamais appliqué, le bouton garde sa position d'origine.
- ⚠️ `useReducedMotion` de `motion` est **réactif** : si Jeevons bascule le réglage système sans recharger, l'effet doit disparaître. Ne pas figer la valeur dans un `useState` initial.

### ⚠️ Piège n°3 — AC5 : ne pas casser le focus ni l'activation

- 🛑 Le magnétisme s'applique aux **CTA du hero** : ce sont des **`<a href="#projects">` et `<a href="#about">`** (`Hero.tsx` lignes 127-142), pas des `<button>`. ❌ **Ne pas les transformer** en `<div>`/`<button>` pour « pouvoir animer » — ce sont des liens d'ancre, ils doivent le rester (le fonctionnement de la navigation en dépend, story 1.1).
- ✅ Envelopper plutôt le lien dans un conteneur animé, **ou** appliquer le `transform` sur le lien lui-même — dans les deux cas le lien reste focusable, activable à `Entrée`, et son `href` intact.
- 🛑 **Le décalage magnétique ne doit jamais s'appliquer au focus clavier.** L'effet est piloté par `pointermove` ; un utilisateur clavier n'en génère aucun → l'élément reste en place. ⚠️ Mais si le `transform` est appliqué au moment d'un `mouseenter` résiduel, l'anneau de focus se décale avec l'élément : acceptable (il suit l'élément), tant que **le focus reste visible**. ❌ Ce qui est interdit : que le `transform` déplace la zone cliquable **loin du curseur** au point de rendre l'activation difficile — d'où la contrainte de l'AC1 : « **de quelques pixels seulement** » (PLAN : ~8 px).
- 🛑 **Le curseur custom ne doit JAMAIS intercepter les clics.** Il est positionné en `fixed` au-dessus de tout : sans `pointer-events: none`, il **avale tous les clics de la page** — bug catastrophique et facile à ne pas voir en développement si l'on teste au clavier. `pointer-events: none` est **obligatoire**, non négociable.
- ✅ Le curseur custom est **décoratif** : `aria-hidden="true"`, aucun texte, invisible pour les technologies d'assistance.

### ⚠️ Piège n°4 — Performance : `pointermove` est un évènement à haute fréquence

- 🛑 Écrire directement dans le state React à chaque `pointermove` déclenche **un rendu React par mouvement de souris** (des centaines par seconde) → saccades garanties.
- ✅ `motion` v12 est **déjà installé** (aucune dépendance à ajouter) et fournit exactement ce qu'il faut : `useMotionValue` + `useSpring` écrivent dans le style **hors du cycle de rendu React**, et `useSpring` donne le retour élastique attendu par AC1 (« il retrouve sa position »).
- ⚠️ ❌ N'animer que `transform` (`translateX/Y`, `scale`) — jamais `top`/`left`/`width`, qui déclenchent un recalcul de mise en page à chaque image (même règle qu'en 6.4/6.5).
- ⚠️ **Un seul listener global** pour le curseur (sur `window`), pas un par élément. Pour le magnétisme, listener **par bouton**, attaché au `pointerenter` et **détaché au `pointerleave`** — laisser un listener `pointermove` global actif en permanence pour chaque CTA est du gaspillage. ✅ Nettoyer dans le `return` du `useEffect` : un listener non retiré au démontage est une fuite.
- ⚠️ `getBoundingClientRect()` dans un `pointermove` provoque du layout thrashing. Le mesurer **à l'entrée** du pointeur, pas à chaque mouvement.

### ⚠️ Piège n°5 — Périmètre : quels boutons sont « magnétiques » ?

- 🛑 AC1 dit « un **bouton d'action** », pas « tous les éléments cliquables ». ✅ Cibler les **CTA du hero** (`Hero.tsx`) — les deux boutons d'appel à l'action, qui sont l'objet de la démonstration.
- ❌ **Ne PAS rendre magnétique** : les entrées de menu (`.nav-item` — traitées en 6.5), les cartes projet (traitées en 6.8), les liens du footer, ni **quoi que ce soit dans `/admin`** (hors périmètre absolu, et l'admin a sa propre discipline clavier posée en 5.20).
- ⚠️ Le bouton « Visiter le site » de `ProjectCard.tsx` (ligne 149) porte déjà `hover:scale-110 transform transition` : ❌ **ne pas y toucher** — il relève de la carte projet (story 6.8). Toute modification ici serait du débordement.
- ❌ **Hors périmètre** : hero/orbites/typing (6.7) · tilt et spotlight des cartes (6.8) · timeline (6.9) · pages projet (6.10) · reveal au scroll (6.4) · header (6.5) · admin · **toute nouvelle dépendance**.

### ⚠️ Piège n°6 — Le curseur custom et le reste de la page

- ⚠️ AC2 : « son halo **grossit au survol des éléments interactifs** ». Il faut donc **savoir** quand le pointeur est sur un élément interactif. ✅ Le plus robuste : écouter `pointerover` sur `document` et tester la cible avec `closest("a, button, input, textarea, select, [role='button']")` — plutôt que d'exiger d'ajouter une classe sur chaque élément cliquable du site (fragile, et il faudrait retoucher des dizaines de fichiers, hors périmètre).
- ⚠️ Le curseur doit être **au-dessus de tout** en `z-index`, mais cohabiter avec le header `fixed z-10` et la barre de progression de 6.5, ainsi qu'avec les cartes `sticky` de `ProjectList` (`top: calc(64px + …)`). Choisir un `z-index` supérieur, et **vérifier** qu'il ne passe pas sous un élément.
- ⚠️ Le site a un **scrollbar personnalisé** (`globals.css` lignes 32-51) avec `cursor: pointer` sur le thumb : vérifier que le curseur custom ne rend pas la barre de défilement inutilisable.
- ⚠️ Le curseur custom vit dans `layout.tsx` (présent sur toutes les pages) **ou** dans `page.tsx` (site public seulement). 🛑 **Choisir `page.tsx` / les pages publiques** : le poser dans `layout.tsx` l'appliquerait à `/admin` et `/login`, hors périmètre. ⚠️ Si un composant client est ajouté à `layout.tsx`, vérifier au build que **`/` reste `○ (Static, 1h)`** — garde-fou documenté dans `page.tsx:20-29`.

### ⚠️ Piège n°7 — Vérification locale, les 5 AC

- **AC1** : approcher la souris des deux CTA du hero → décalage **de quelques pixels** vers le curseur ; s'éloigner → retour à la position d'origine, sans à-coup.
- **AC2** : le curseur custom suit la souris ; le halo **grossit** au survol d'un lien, d'un bouton, d'un champ ; il revient à sa taille normale ailleurs.
- **AC3** : ouvrir les outils de développement en **émulation mobile / tactile** (ou sur téléphone réel) → **aucun curseur custom**, aucun magnétisme, **le curseur système est présent**, les taps fonctionnent normalement.
- **AC4** : reduced-motion activé (procédure de 6.2) → **aucun curseur custom dans le DOM**, **le curseur système est celui du navigateur** (test décisif : le curseur change bien en `text` sur un paragraphe et en `pointer` sur un lien), les CTA ne bougent pas.
- **AC5** : **au clavier seul** — Tab atteint les deux CTA, l'anneau de focus est visible, `Entrée` navigue bien vers `#projects` / `#about`. 🛑 **Test décisif du curseur** : cliquer sur un lien, un bouton, un champ de saisie **avec le curseur custom actif** — si un clic ne passe pas, `pointer-events: none` manque.
- 🛑 Contrôler au build que `/` reste **`○ (Static)`**.

## Tasks / Subtasks

- [x] **Tâche 0 — Prérequis & détection du pointeur** (AC: 3 ; piège n°1)
  - [x] 6.1 et 6.2 `done`. Détection `(hover: hover) and (pointer: fine)`, **défaut = désactivé**, activation après montage. Aucune détection par largeur d'écran.
- [x] **Tâche 1 — Boutons magnétiques** (AC: 1, 5 ; pièges n°3, n°4, n°5)
  - [x] CTA du hero **uniquement**. `<a>` conservés, `href` intacts. `useMotionValue`/`useSpring` de `motion`, `transform` seul, amplitude ~8 px. Listeners attachés/détachés au survol, nettoyés au démontage.
- [x] **Tâche 2 — Curseur personnalisé** (AC: 2 ; pièges n°1, n°4, n°6)
  - [x] Point + halo, dégradé d'accent tokenisé (6.1). 🛑 `pointer-events: none` + `aria-hidden="true"`. Un seul listener global. `cursor: none` **conditionné** à la détection, jamais global.
  - [x] Grossissement du halo par `closest("a, button, input, textarea, select, [role='button']")` sur `pointerover`. `z-index` vérifié contre header, barre de progression et cartes `sticky`.
- [x] **Tâche 3 — Mouvement réduit** (AC: 4 ; piège n°2)
  - [x] `useReducedMotion` → curseur custom **non rendu du tout**, **aucun `cursor: none`**, aucun décalage magnétique. Réactif à un changement de réglage sans rechargement.
- [x] **Tâche 4 — Non-régression clavier & tactile** (AC: 3, 5 ; pièges n°1, n°3)
  - [x] Aucun `preventDefault`, aucun `touch-action: none`. Vérifié statiquement ; le test de clic manuel reste à faire (tâche 5).
- [ ] **Tâche 5 — Vérification locale** (AC: 1-5 ; piège n°7) — 🛑 **EN ATTENTE DE JEEVONS**
  - [ ] Les 5 AC un par un : émulation tactile, reduced-motion, **clavier seul**, et le **test de clic** curseur actif. **Non exécutée** : aucun navigateur headless dans le dépôt (Playwright n'arrive qu'en Epic 7) et la story prescrit une vérification manuelle. Détail dans les Completion Notes.
- [x] **Tâche 6 — Definition of Done** (AGENTS.md §8)
  - [x] `bun run lint` 0 erreur / `bunx tsc --noEmit` 0 / `bun run build` OK (**`/` = `○ (Static)`, Revalidate 1h**). ⚠️ Vérification visuelle **déléguée à Jeevons** (tâche 5).
  - [x] `git diff DEV` : hero CTA + composant curseur uniquement. ❌ Aucun fichier `/admin`, aucune donnée, **aucune dépendance**.
  - [x] `File List` + `Completion Notes` + `Change Log` · `sprint-status.yaml`.

## Dev Notes

### Périmètre — verrouillé

**Deux effets de pointeur décoratifs : un décalage magnétique de ~8 px des deux CTA du hero vers le curseur, et un curseur personnalisé (point + halo) desktop dont le halo grossit au survol des éléments interactifs — l'un et l'autre pilotés par `useMotionValue`/`useSpring` de `motion` (déjà installé), strictement conditionnés à `(hover: hover) and (pointer: fine)`, et totalement absents sous mouvement réduit.**

**Hors périmètre — ne pas faire :**
- ❌ **`cursor: none` global** ou non conditionné (site inutilisable si l'effet ne se monte pas).
- ❌ **Curseur custom sans `pointer-events: none`** (il avalerait tous les clics).
- ❌ **Détecter le tactile par la largeur d'écran**.
- ❌ **Se contenter de la neutralisation CSS de 6.2** sous reduced-motion (le curseur système resterait masqué → échec AC4).
- ❌ **Transformer les `<a>` du hero** en `<button>`/`<div>`.
- ❌ **Étendre le magnétisme** aux nav-items, cartes projet, footer ou à `/admin`.
- ❌ Toucher au `hover:scale-110` de `ProjectCard` (c'est 6.8), au hero/orbites (6.7), **nouvelle dépendance**.

### Le vrai enjeu

Cette story ajoute peu et peut casser beaucoup. Les deux fautes qui ruinent le site sont **muettes en développement** : un curseur custom sans `pointer-events: none` rend **toute la page incliquable** (invisible si l'on teste au clavier), et un `cursor: none` posé sans condition laisse **certains visiteurs sans curseur**. Le troisième piège est intellectuel : sous mouvement réduit, la règle globale de 6.2 neutralise les *transitions* — elle ne fait pas disparaître un composant. Un curseur custom « juste plus rapide » satisfait la lettre de 6.2 mais **échoue l'AC4**, qui exige le curseur système *inchangé*. Enfin, AC3 se joue sur `(hover: hover) and (pointer: fine)` et un **défaut à « désactivé »** : partir de l'inverse fait clignoter un curseur fantôme sur mobile.

### Testing standards

Vérification **manuelle** des 5 AC sur trois configurations : **souris** (AC1, AC2), **émulation tactile** (AC3), **reduced-motion** (AC4, procédure de 6.2), plus un passage **clavier seul** et le **test de clic** curseur custom actif (AC5). `lint`/`tsc`/`build` verts, `/` toujours `○ (Static)`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.6]
- [Source: PLAN_REFONTE_2026.md §4.2 — P1 n°4 (magnetic buttons ~8 px), n°5 (curseur custom desktop, halo au survol) ; §4.4 — a11y et perf non négociables]
- [Source: AGENTS.md §6 — a11y non négociable (clavier, focus visibles, animations neutralisées sous reduced-motion) ; §9 — zéro dépendance]
- [Source: apps/web/src/sections/Hero.tsx:126-143 — les deux CTA sont des `<a href="#projects">` / `<a href="#about">`]
- [Source: apps/web/src/components/ProjectCard.tsx:149 — `hover:scale-110` existant, relève de la story 6.8, NE PAS toucher]
- [Source: apps/web/src/app/globals.css:32-51 — scrollbar personnalisé ; :103-121 — règle globale reduced-motion (transitions, PAS l'existence des composants)]
- [Source: apps/web/src/app/page.tsx:18-29 — `revalidate = 3600` et garde-fou anti-rendu-dynamique]
- [Source: apps/web/src/components/ProjectList.tsx:50-55 — cartes `sticky`, cohérence de `z-index`]
- [Source: apps/web/package.json — `motion` ^12.42.2 déjà présent]

## Dev Agent Record

### Agent Model Used

claude-opus-5

### Completion Notes

**Deux effets de pointeur décoratifs, et trois garde-fous qui comptent davantage.**

**AC1 — Boutons magnétiques.** `MagneticLink` rend un `motion.a` : les deux CTA du hero restent de vrais `<a href="#projects">` / `<a href="#about">`, avec leurs classes d'origine inchangées. Amplitude plafonnée à 8 px (`MAX_OFFSET`), décalage proportionnel à l'écart au centre, retour au repos par `useSpring`. `getBoundingClientRect()` est appelé au `pointerenter` seulement — jamais dans le `pointermove`. Les listeners sont portés par React sur l'élément : ils vivent et meurent avec lui, sans `useEffect` à nettoyer.

**AC2 — Curseur personnalisé.** Point + halo en `fixed`, pilotés par un **unique** listener `pointermove` sur `window`, via `useMotionValue`/`useSpring` — aucun rendu React par mouvement de souris. Le halo grossit (`scale` 1,6) au survol d'un élément interactif, détecté par `closest("a, button, input, textarea, select, [role='button']")` sur `pointerover` : aucun fichier tiers à retoucher, et les éléments ajoutés plus tard sont couverts d'office. Couleurs par les tokens 6.1 (`.bg-gradient-accent`, `bg-accent-from`). `z-[60]`, au-dessus du header (`z-10`), de la barre de progression 6.5 (`z-20`) et des CTA révélés (`z-30`).

**AC3 — Tactile.** `useFinePointer()` (`lib/pointer.ts`) interroge `(hover: hover) and (pointer: fine)` — la capacité de pointage, jamais la largeur d'écran. Implémenté avec `useSyncExternalStore` : son `getServerSnapshot` renvoie `false`, ce qui fait du « défaut désactivé » une propriété structurelle plutôt qu'un état initial qu'un effet viendrait corriger. **Vérifié sur le HTML servi en production : 0 occurrence de `cursor: none`, 0 nœud de curseur.** Aucun curseur fantôme possible sur mobile.

**AC4 — Mouvement réduit.** `CustomCursor` est scindé en deux : le composant exporté décide, `ActiveCursor` porte tout l'état et n'est monté que si l'effet doit s'appliquer. Sous mouvement réduit, il ne rend **rien** — pas de nœud DOM, et surtout **pas de `cursor: none`**, puisque cette règle est posée par un `useEffect` d'`ActiveCursor` sur `document.documentElement` et retirée par son nettoyage. Le curseur système redevient donc celui du navigateur, avec ses formes contextuelles. ⚠️ La règle CSS globale de 6.2 n'aurait pas suffi : elle neutralise les *transitions*, elle ne fait pas disparaître un composant — un curseur simplement « plus rapide » aurait laissé le curseur système masqué et échoué l'AC4.

**AC5 — Clavier.** Aucun `preventDefault`, aucun `touch-action`. `pointer-events: none` est en dur sur le conteneur du curseur, et `aria-hidden="true"` le rend inexistant pour les technologies d'assistance. Le magnétisme n'est piloté que par `pointermove` : un utilisateur clavier n'en génère aucun, les CTA restent strictement immobiles sous le focus.

**🛑 Vérifications manuelles NON EXÉCUTÉES — elles restent à la charge de Jeevons.** Le dépôt ne contient aucun navigateur headless (Playwright n'arrive qu'en Epic 7) et la story prescrit explicitement une vérification manuelle sur trois configurations. Quatre des cinq AC ne sont donc **pas** validés par observation directe. Reste à faire, par ordre d'importance :

1. 🛑 **Test de clic, curseur actif** — cliquer un lien du menu, un bouton, le champ de contact. Un seul clic qui ne passe pas signifierait que `pointer-events: none` a échoué, et rendrait **tout le site incliquable**. C'est le test décisif d'AC5.
2. 🛑 **Mouvement réduit** — le curseur doit redevenir `text` sur un paragraphe et `pointer` sur un lien (AC4).
3. **Émulation tactile** — aucun curseur custom, curseur système présent, taps normaux (AC3).
4. **Souris** — décalage de quelques pixels sur les CTA, halo qui grossit sur les éléments interactifs (AC1, AC2).
5. **Clavier seul** — Tab sur les deux CTA, focus visible, `Entrée` vers `#projects` / `#about`.

**Contrôles automatisés passés.** `bun run lint` 0 erreur · `bunx tsc --noEmit` 0 · `bun run build` succès avec **`/` = `○ (Static)`, Revalidate 1h** (garde-fou de `page.tsx:20-29` tenu). Sur le serveur de production local : `/` HTTP 200 sans `cursor: none` ni nœud de curseur dans le HTML, CTA avec `href` et classes intacts et **sans `style` de transform résiduel**, `/preview` HTTP 200, `/admin` HTTP 307 (redirection normale). Aucune dépendance ajoutée.

**Deux écarts par rapport à la lettre de la story, assumés.**
- Le contexte donnait les CTA aux lignes 127-142 de `Hero.tsx` ; ils sont en réalité aux lignes 147-162, désormais enveloppés dans `<Reveal>` (story 6.4). Aucune conséquence : `MagneticLink` s'y substitue à l'identique.
- Le `baseline_commit` des stories 6.6 à 6.10 pointait sur `c408eae`, antérieur au merge de 6.1. Remis à `6e8666a`, le HEAD de `DEV` au démarrage.

**Dette signalée, hors périmètre.** `TestimonialsClient.tsx:79` émet un warning ESLint (`react-hooks/exhaustive-deps`, dépendance `autoScroll` manquante) — **préexistant**, vérifié par `git stash` sur l'arbre propre. Non corrigé ici : ce fichier relève de la story 6.9.

### File List

**Créés**
- `apps/web/src/lib/pointer.ts` — `useFinePointer()`, détection `(hover: hover) and (pointer: fine)` par `useSyncExternalStore`, défaut désactivé.
- `apps/web/src/components/MagneticLink.tsx` — CTA magnétique (AC1, AC5), dégradé en `<a>` nu hors conditions.
- `apps/web/src/components/CustomCursor.tsx` — curseur personnalisé (AC2), scindé décision / `ActiveCursor`.

**Modifiés**
- `apps/web/src/sections/Hero.tsx` — les deux CTA passent par `MagneticLink`. Reste un Server Component `async`.
- `apps/web/src/app/page.tsx` — montage de `<CustomCursor />` (site public uniquement, pas dans `layout.tsx`).
- `_bmad-output/implementation-artifacts/6-6-rendre-les-elements-interactifs-vivants.md` — `baseline_commit`, statut, tâches, Dev Agent Record.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — statut de la story.

### Change Log

| Date | Changement |
|---|---|
| 2026-07-26 | `baseline_commit` recalé sur `6e8666a` (HEAD de `DEV`), statut `ready-for-dev` → `in-progress`. |
| 2026-07-26 | AC3 — `lib/pointer.ts` : détection du pointeur fin, défaut désactivé garanti par `getServerSnapshot`. |
| 2026-07-26 | AC1/AC5 — `MagneticLink` sur les deux CTA du hero, amplitude 8 px, `<a href>` préservés. |
| 2026-07-26 | AC2 — `CustomCursor` monté dans `page.tsx` : point + halo, `pointer-events: none`, `aria-hidden`, tokens 6.1, `z-[60]`. |
| 2026-07-26 | AC4 — `cursor: none` posé et retiré par `ActiveCursor` lui-même ; aucune règle globale, composant absent sous mouvement réduit. |
| 2026-07-26 | Correctif — centrage du point et du halo par marges négatives : `x`/`y` de `motion` écrivent déjà dans `transform`, un `translateX: -50%` leur aurait disputé la même propriété. |
| 2026-07-26 | Lint — `useSyncExternalStore` et scission du curseur pour supprimer deux `setState` synchrones en effet (`react-hooks/set-state-in-effect`). |
| 2026-07-26 | Statut `in-progress` → `review`. ⚠️ Vérifications manuelles des AC1-AC5 non exécutées, déléguées à Jeevons (voir Completion Notes). |
