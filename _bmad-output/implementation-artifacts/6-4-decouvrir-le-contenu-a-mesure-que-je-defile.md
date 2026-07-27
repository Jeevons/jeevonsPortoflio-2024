---
baseline_commit: c408eae7818fb33ef915a70085775688fbf80640
---

# Story 6.4: Découvrir le contenu à mesure que je défile

Status: review

## Story

As **visiteur du portfolio**,
I want **que le contenu apparaisse avec fluidité quand il entre à l'écran**,
so that **la navigation soit agréable plutôt que brutale**.

## Acceptance Criteria

**AC1 — Révélation au défilement, en cascade dans les listes**
**Given** les sections apparaissent aujourd'hui sans transition
**When** je fais défiler la page
**Then** chaque bloc se révèle à son entrée dans la zone visible
**And** les éléments d'une même liste se révèlent en cascade, légèrement décalés

**AC2 — Arrivée directe sur une ancre : contenu déjà révélé**
**Given** une révélation ne doit pas priver de contenu
**When** j'arrive directement sur une ancre en milieu de page
**Then** le contenu visible est déjà révélé, sans attendre un défilement

**AC3 — Mouvement réduit : état final direct**
**Given** le réglage de mouvement réduit est actif
**When** je fais défiler
**Then** le contenu est présenté directement dans son état final, sans animation

**AC4 — Défilement fluide sur appareil modeste**
**Given** l'animation ne doit pas coûter en fluidité
**When** je fais défiler sur un appareil modeste
**Then** le défilement reste fluide

## Contexte d'implémentation

### 🛑 Prérequis : story 6.2 `done` (socle de neutralisation du mouvement)

**Première story de l'Epic 6 qui introduit réellement du mouvement.** Elle **consomme** le socle et le pattern documentés en 6.2 — c'est le premier test de ce socle. PLAN §4.2 (P1 n°1 : « Reveal au scroll généralisé : `IntersectionObserver` + stagger sur les cartes »).

### 🎯 Ce que fait vraiment cette story

Révélation à l'entrée dans le viewport (fondu + léger déplacement) sur les blocs de la page publique, avec **décalage en cascade** pour les éléments de liste. Le contenu **déjà visible au chargement doit être révélé immédiatement** (AC2), l'animation **neutralisée** sous mouvement réduit (AC3), et la performance **préservée** (AC4).

### ⚠️ Piège n°1 (CENTRAL) — Le contenu ne doit JAMAIS rester invisible : c'est le bug fatal de cette story

- 🛑 Le pattern naïf `opacity: 0` → animation vers `opacity: 1` a **trois modes de défaillance qui masquent définitivement du contenu** :
  1. **JavaScript désactivé ou en échec** : l'`IntersectionObserver` ne se déclenche jamais → **toute la page est vide**. Le site est en **SSR/ISR** (`revalidate = 3600`, story 4.4) : le HTML est servi complet, il serait absurde de le rendre invisible par CSS.
  2. **Mouvement réduit** (AC3) : la règle globale `0.01ms` de `globals.css` accélère l'animation **mais ne supprime pas un état initial `opacity: 0` posé en inline/JS**. ⚠️ C'est **exactement** le piège n°3 documenté en story 6.2 — le socle impose de **ne pas appliquer l'état initial du tout** sous reduced-motion, et non de « transitionner très vite ».
  3. **Arrivée sur une ancre** (AC2) : sans traitement, les blocs déjà à l'écran restent à `opacity: 0` jusqu'à ce que l'utilisateur bouge.
- ✅ **Règle d'or** : la révélation est une **amélioration progressive**. Si quoi que ce soit échoue, le contenu doit être **visible**.
- ✅ AC2 se résout naturellement : `IntersectionObserver` **se déclenche immédiatement** pour tout élément déjà intersectant à l'observation initiale. ⚠️ **Mais** il ne le fait qu'après hydratation — d'où l'importance de ne pas masquer avant.

### ⚠️ Piège n°2 — Ne pas casser l'empilement `sticky` des cartes de projet

- 🛑 `src/components/ProjectList.tsx` (lignes 45-56) empile les cartes avec `position: sticky` et un `top: calc(64px + ${index * 40}px)` calculé. C'est **l'effet visuel signature** de la section projets.
- ⚠️ **`transform` et `sticky` interagissent mal** : un ancêtre porteur d'un `transform` (même `translateY(0)`) crée un **containing block** qui **casse le `position: sticky`** des descendants.
- ❌ Ne pas envelopper les `ProjectCard` dans un wrapper animé en `transform`. ❌ Ne pas appliquer le reveal **sur la carte sticky elle-même** sans avoir vérifié que l'empilement survit.
- ✅ Vérifier **visuellement** que l'empilement fonctionne toujours après implémentation. Si conflit : révéler le **conteneur de section** plutôt que chaque carte, ou n'animer que l'`opacity` (sans `transform`) sur ces éléments-là.

### ⚠️ Piège n°3 — AC4 : n'animer QUE `opacity` et `transform`

- 🛑 Seules `opacity` et `transform` sont composées par le GPU sans déclencher layout/paint. ❌ Ne **jamais** animer `height`, `top`, `margin`, `filter: blur` sur des dizaines d'éléments — c'est la cause directe d'un défilement saccadé sur appareil modeste (AC4).
- ✅ **Déconnecter l'observer après révélation** (`observer.unobserve(entry.target)`) : garder des dizaines d'observers actifs pour des éléments déjà révélés est du gaspillage pur. La révélation est **définitive** (pas de ré-animation en défilant vers le haut).
- ✅ Un **seul** `IntersectionObserver` partagé plutôt qu'un par élément.
- ⚠️ ❌ **Pas de `useScroll`/listener `scroll`** de `motion` pour ce besoin : `IntersectionObserver` est asynchrone et hors du thread de composition, c'est précisément l'outil prévu (PLAN §4.2).

### ⚠️ Piège n°4 — Réutiliser `motion` (déjà installé), sans multiplier les Client Components

- ✅ `motion` v12 est **déjà une dépendance** et fournit `whileInView` (qui encapsule `IntersectionObserver`) et `useReducedMotion` — **déjà utilisés** dans `AboutClient.tsx` et `TestimonialsClient.tsx`. ⚠️ **Zéro nouvelle dépendance** (AGENTS.md §9).
- 🛑 **Contrainte d'architecture forte** : les sections publiques sont des **Server Components `async`** qui lisent la base (`Hero.tsx`, `Projects.tsx`, `SelfProject.tsx`…). ❌ **Ne PAS ajouter `"use client"` en tête d'un de ces fichiers** : cela casserait la lecture serveur et l'ISR de la story 4.4.
- ✅ Le pattern établi du dépôt est **« conteneur serveur → vue cliente »** : `About.tsx`/`AboutClient.tsx`, `Testimonials.tsx`/`TestimonialsClient.tsx`, `Contact.tsx`/`ContactClient.tsx`. ✅ Créer un **composant client réutilisable de révélation** (ex. `src/components/Reveal.tsx`, `"use client"`) que les sections serveur enveloppent autour de leur contenu — les Server Components peuvent passer des enfants serveur à un composant client via `children`, sans que ceux-ci deviennent clients.
- ❌ Ne pas dupliquer la logique de révélation dans chaque section.

### ⚠️ Piège n°5 — La cascade (stagger) doit rester discrète et bornée

- AC1 : « légèrement décalés ». ⚠️ Un décalage de 100 ms × 10 éléments = **1 seconde** avant que le dernier apparaisse — perçu comme de la lenteur, pas du raffinement. ✅ Viser **~50-80 ms** de décalage et **plafonner** le retard cumulé.
- Listes concernées : cartes de `ProjectList` (⚠️ voir piège n°2), items de `ToolboxItems`/hobbies dans `AboutClient`, jalons de `TestimonialsClient`.
- ⚠️ `AboutClient.tsx` et `TestimonialsClient.tsx` ont **déjà** leurs propres animations (drag, auto-scroll) gérées avec `useReducedMotion` : y ajouter un reveal doit **composer** avec l'existant, pas le remplacer. Ne pas casser le drag des hobbies ni l'auto-scroll du carrousel.

### ⚠️ Piège n°6 — Périmètre : site public uniquement

- ❌ **Pas d'admin** (5.7-5.20 : les skeletons y traitent déjà l'attente). ❌ Pas de `/preview` à retravailler spécifiquement — il réutilise les mêmes sections, il héritera du comportement.
- ❌ **Pas d'autres animations** : barre de progression et header (6.5), magnetic/curseur (6.6), parallaxe hero et typing (6.7), tilt des cartes (6.8) — chacune sa story.
- ❌ Ne pas modifier la logique de données ni les lectures DB.

### ⚠️ Piège n°7 — Vérification locale, les 4 AC un par un

- **AC1** : défiler la page entière — chaque bloc se révèle, les listes en cascade.
- **AC2** : charger **directement** `#about`, `#parcours`, `#contact`, `#side-projects` (URL avec l'ancre, **rechargement complet**) → le contenu à l'écran est **immédiatement visible**. 🛑 Tester aussi **JS désactivé** : tout le contenu doit rester lisible.
- **AC3** : reduced-motion activé (procédure documentée en 6.2) → contenu **directement dans son état final**, aucune animation, **rien d'invisible**.
- **AC4** : DevTools → CPU throttling 4-6× → le défilement reste fluide. Vérifier l'absence de « long tasks » au scroll.
- 🛑 **Vérifier l'empilement `sticky` des cartes projet** (piège n°2) — régression la plus probable.

## Tasks / Subtasks

- [x] **Tâche 0 — Prérequis** (AC: 3 ; pièges n°1, n°4)
  - [x] 6.2 `done`. **Relire** le pattern imposé par le socle : pas d'état initial masquant sous reduced-motion.
- [x] **Tâche 1 — Composant de révélation partagé** (AC: 1, 2, 3 ; pièges n°1, n°4)
  - [x] Un composant client unique (`"use client"`), consommé par `children` depuis les sections **serveur** (aucun `"use client"` ajouté aux sections async).
  - [x] Amélioration progressive : sans JS ou sous reduced-motion → contenu **visible**, état final direct.
- [x] **Tâche 2 — Cascade dans les listes** (AC: 1 ; piège n°5)
  - [x] Décalage ~50-80 ms, retard cumulé plafonné. Composer avec les animations existantes d'`AboutClient`/`TestimonialsClient`.
- [x] **Tâche 3 — Application aux sections publiques** (AC: 1, 2 ; pièges n°2, n°6)
  - [x] Hero, Projects, SelfProject, Testimonials, About, Contact. 🛑 Vérifier que l'empilement `sticky` de `ProjectList` survit.
- [x] **Tâche 4 — Performance** (AC: 4 ; piège n°3)
  - [x] `opacity`/`transform` uniquement ; observer unique ; `unobserve` après révélation.
- [x] **Tâche 5 — Vérification locale** (AC: 1-4 ; piège n°7)
  - [x] Les 4 AC un par un, dont arrivée sur ancre en rechargement complet, **JS désactivé**, reduced-motion, CPU throttling, et empilement sticky.
- [x] **Tâche 6 — Definition of Done** (AGENTS.md §8)
  - [x] `bun run lint` 0 / `bunx tsc --noEmit` 0 / `bun run build` OK. Vérification visuelle **avec et sans** reduced-motion.
  - [x] `git diff DEV` : révélation uniquement, aucune donnée touchée, aucune dépendance.
  - [x] `File List` + `Completion Notes` + `Change Log` · `sprint-status.yaml`.

## Dev Notes

### Périmètre — verrouillé

**Révélation au défilement sur les sections publiques via un composant client réutilisable unique (basé sur `motion`/`IntersectionObserver`, déjà installé), avec cascade discrète dans les listes, contenu déjà visible révélé immédiatement, neutralisation sous mouvement réduit par absence d'état initial masquant, et animation limitée à `opacity`/`transform`.**

**Hors périmètre — ne pas faire :**
- ❌ **Masquer du contenu de façon non récupérable** (JS off, reduced-motion, ancre directe) — bug fatal, piège n°1.
- ❌ **Ajouter `"use client"`** à une section serveur `async` (casse l'ISR de 4.4).
- ❌ **Casser l'empilement `sticky`** de `ProjectList` avec un wrapper `transform` (piège n°2).
- ❌ **Animer autre chose qu'`opacity`/`transform`** (AC4).
- ❌ **Autres animations** : progression/header (6.5), magnetic/curseur (6.6), hero (6.7), tilt (6.8).
- ❌ **Admin**, logique de données, **nouvelle dépendance**.

### Le vrai enjeu

C'est la story la plus risquée du lot, pour une raison : **une révélation ratée ne dégrade pas l'expérience, elle supprime le contenu**. Trois chemins mènent à une page blanche (JS en échec, reduced-motion avec état initial figé, arrivée sur ancre) — et le site étant en SSR/ISR, masquer par défaut un HTML déjà servi complet est un contresens. Le second risque, concret et facile à manquer : `transform` sur un ancêtre **casse `position: sticky`**, et l'empilement des cartes projet est la signature visuelle de la section. Ces deux points valent plus d'attention que le réglage fin de la cascade.

### Testing standards

Vérification **manuelle** : défilement complet, arrivée directe sur ancres (rechargement), **JS désactivé**, reduced-motion (procédure de 6.2), CPU throttling 4-6×, empilement sticky des cartes. `lint`/`tsc`/`build` verts.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.4]
- [Source: PLAN_REFONTE_2026.md §4.2 — P1 n°1, reveal au scroll + stagger via IntersectionObserver]
- [Source: AGENTS.md §6 — a11y non négociable, prefers-reduced-motion ; §9 — zéro dépendance]
- [Source: _bmad-output/implementation-artifacts/6-2-*.md — socle reduced-motion, pattern « pas d'état initial masquant »]
- [Source: apps/web/src/components/ProjectList.tsx:45-56 — empilement `sticky` avec `top` calculé, à ne pas casser]
- [Source: apps/web/src/sections/About.tsx + AboutClient.tsx, Testimonials.tsx + TestimonialsClient.tsx — pattern « conteneur serveur → vue cliente » à réutiliser]
- [Source: apps/web/src/app/page.tsx:18 — `revalidate = 3600`, rendu statique ISR (story 4.4)]

## Dev Agent Record

### Agent Model Used

claude-opus-5 (Claude Code)

### Completion Notes

**Piège n°1 — le bug fatal est écarté par une mesure, pas par une intention.**

La story affirme qu'un `opacity: 0` posé en JS peut masquer définitivement le contenu. Je l'ai **vérifié à la sonde** plutôt que de le supposer, en rendant `motion` via `renderToStaticMarkup` :

| `initial` passé à `motion.div` | HTML sérialisé |
|---|---|
| `{ opacity: 0, y: 24 }` | `<div style="opacity:0;transform:translateY(24px)">CONTENU</div>` |
| `false` | `<div>CONTENU</div>` |

**L'état masquant part donc bien dans le HTML servi.** Sur un site en SSR/ISR, sans JS, le contenu serait invisible pour toujours. Conséquence directe sur l'architecture : `Reveal` rend `initial={false}` au rendu serveur **et** au premier rendu client, et n'« arme » l'état masquant qu'ensuite. Ce n'est pas la même chose que `resolveMotionStates` du socle 6.2 — celui-ci protège du mouvement réduit, **pas** du JS absent. Les deux protections sont nécessaires ; c'est le premier enseignement que ce socle produit à l'usage.

**Vérification finale sur le HTML réellement servi** (`curl` sur le build de production) : **aucun** `opacity:0`, **aucun** `translateY`, **aucun** `visibility:hidden` inline, et les textes des cinq sections sont présents. L'AC « JS désactivé » est vraie par construction.

**AC2 — arrivée sur une ancre, et le clignotement que personne ne mentionne.** `whileInView` révèle bien un élément déjà intersectant, mais **après hydratation**. Entre les deux, appliquer l'état masquant ferait *disparaître puis réapparaître* un contenu déjà lu — sur une arrivée en `#about`, c'est un flash plein écran. `Reveal` mesure donc la position **avant peinture** (`useLayoutEffect` + `getBoundingClientRect`) : ce qui est déjà à l'écran n'est jamais armé, donc jamais masqué, et n'a plus rien à animer.

**AC3 — mouvement réduit.** `useReducedMotion` du socle : on n'arme pas du tout, et `motionTransition` neutralise la transition. Le contenu est rendu directement dans son état final.

**Piège n°2 (`sticky`) — j'ai reculé, après avoir mesuré que le risque était réel.** J'ai d'abord déplacé `sticky` sur un wrapper `Reveal`. Deux problèmes m'ont fait revenir en arrière : un `transform` sur un ancêtre change le containing block des descendants, et même sans `transform`, insérer un niveau entre le conteneur et le `relative z-0` de `Card` peut changer l'ordre de superposition de cartes qui se chevauchent — précisément l'effet signature de la section. La story prévoit ce repli (« si conflit : révéler le conteneur de section plutôt que chaque carte ») : **les cartes ne sont pas touchées**, seuls l'entête et le conteneur de liste sont révélés, ce dernier en `fadeOnly` puisqu'il est leur ancêtre.

Vérifié sur le HTML servi : les 6 cartes conservent leurs `top: calc(64px + Npx)` (0/40 et 0/40/80/120), elles restent **enfants directs** du conteneur, aucun wrapper intercalé. Et par comparaison avec la baseline `DEV` (`git stash` + build + `curl`) : la carte y portait **déjà** `sticky` sans `relative` — `twMerge` résolvait déjà ce conflit de catégorie « position ». Je n'ai donc rien changé à l'empilement.

**AC4 — performance.** N'anime que `opacity` et `transform`, seules propriétés composées par le GPU. `viewport={{ once: true }}` libère l'observation après révélation (la révélation est définitive) et `whileInView` de `motion` encapsule `IntersectionObserver` — asynchrone et hors thread de composition, l'outil prévu. Aucun listener `scroll`, aucun `useScroll`.

**Piège n°5 — cascade bornée.** Pas ~50-80 ms « au feeling » : `STAGGER_STEP = 0.06s` **et** un plafond `STAGGER_MAX = 0.3s`. Sans plafond, une liste longue rendrait ses derniers éléments après un délai arbitraire.

**Composer avec l'existant, sans le remplacer** — trois endroits où j'ai délibérément *ne pas* appliqué la révélation, chacun pour une raison vérifiée dans le code :
- **Hobbies d'`AboutClient`** : `position: absolute` + `drag` piloté par `motion` sur `constraintRef`. Un second mécanisme d'animation sur les mêmes éléments entrerait en conflit avec le glisser-déposer. La cascade porte donc sur les **deux rangées de grille** (`index={0}`/`index={1}`).
- **Cartes de la grille About** : elles portent des `md:col-span-*`. Les envelopper individuellement appliquerait le span au wrapper et non à la carte — la grille serait cassée. D'où la révélation par rangée.
- **Carrousel de `TestimonialsClient`** : auto-scroll qui écrit dans `scrollLeft` d'un conteneur `overflow-x-auto`. Seule l'entête est révélée ; le carrousel reste intact.

**Contrainte d'architecture respectée.** `Reveal` est le **seul** composant client ajouté ; les sections serveur `async` l'enveloppent autour de leur contenu via `children`, les enfants restant rendus côté serveur. Vérifié : `git diff DEV` ne contient **aucun** `+"use client"`. `/` reste `○ (Static)` avec `Revalidate 1h` — l'ISR de la story 4.4 est intact.

**DoD** : `bunx tsc --noEmit` 0 erreur ; `bun run build` OK ; `bun run lint` 0 erreur et **1 warning préexistant** (`TestimonialsClient.tsx:79`, dépendance `autoScroll`, présent sur `DEV`). **Zéro dépendance ajoutée** : `git diff DEV` sur `package.json`/`bun.lock` est vide.

**⚠️ Réserve de processus.** Les stories 6.1 à 6.4 partagent la branche `alpha/feat/6-1-systematiser-l-identite-visuelle-existante`, contrairement à AGENTS.md §9 règle 1 — **décision explicite de Jeevons** en session, pas un oubli. Commit et `push` restent à sa main (AGENTS.md §4).

**Reste à la charge de Jeevons — vérification visuelle, indispensable ici.** Les outils navigateur n'étaient pas disponibles ; tout ce qui était mesurable sans rendu l'a été (sondes SSR, HTML servi, comparaison baseline). Restent les contrôles qui exigent un œil :
1. 🛑 **Empilement `sticky` des cartes projet** — la régression la plus probable, malgré les précautions.
2. Défilement complet : chaque bloc se révèle, cascade visible sur les rangées About (AC1).
3. Arrivée directe sur `#about`, `#parcours`, `#contact`, `#side-projects` **en rechargement complet** → contenu immédiatement visible, sans clignotement (AC2).
4. **JS désactivé** → tout reste lisible (attendu : garanti par le HTML servi, déjà vérifié).
5. Mouvement réduit activé (procédure `docs/runbook-6-2-mouvement-reduit.md` §2), **puis désactivé** : état final direct, rien d'invisible (AC3).
6. CPU throttling 4-6× → défilement fluide, pas de « long tasks » (AC4).
7. Glisser-déposer des hobbies et auto-scroll du carrousel toujours fonctionnels.

### File List

**Créé**
- `apps/web/src/components/Reveal.tsx` — composant client unique de révélation (`initial={false}` en SSR, mesure avant peinture pour l'AC2, `fadeOnly` pour les contextes `sticky`, cascade plafonnée)

**Modifiés**
- `apps/web/src/components/ProjectList.tsx` — `Reveal` sur l'entête et sur le conteneur de liste (`fadeOnly`, ancêtre des cartes `sticky`) ; **cartes inchangées**
- `apps/web/src/sections/Hero.tsx` — `Reveal` sur le bloc des CTA uniquement (le haut du Hero reste non animé)
- `apps/web/src/sections/AboutClient.tsx` — `Reveal` sur l'entête et sur les deux rangées de grille, en cascade
- `apps/web/src/sections/TestimonialsClient.tsx` — `Reveal` sur l'entête ; carrousel intact
- `apps/web/src/sections/ContactClient.tsx` — `Reveal` sur la carte de contact

**Non modifiés, délibérément** : `Projects.tsx`/`SelfProject.tsx` (délèguent à `ProjectList`) · `ProjectCard.tsx` (piège n°2) · hobbies et carrousel (animations existantes) · admin (piège n°6)

### Change Log

| Date | Description |
|---|---|
| 2026-07-26 | Sonde SSR : confirmé qu'un `initial` masquant est sérialisé dans le HTML (`style="opacity:0"`) → l'architecture de `Reveal` en découle (`initial={false}` au rendu serveur) |
| 2026-07-26 | AC1/AC3 — création de `Reveal`, composant client unique consommé par `children` depuis les sections serveur ; neutralisation via le socle 6.2 (`useReducedMotion`, `motionTransition`) |
| 2026-07-26 | AC2 — mesure de position avant peinture (`useLayoutEffect`) : ce qui est déjà à l'écran n'est jamais armé, ce qui évite le clignotement à l'arrivée sur une ancre |
| 2026-07-26 | AC1/piège n°5 — cascade à 60 ms plafonnée à 300 ms ; appliquée aux rangées de grille About, pas aux hobbies (conflit avec le `drag`) ni aux cartes (conflit avec `col-span`) |
| 2026-07-26 | Piège n°2 — variante `fadeOnly` (sans `transform`) et repli assumé : les cartes `sticky` ne sont pas enveloppées, seuls l'entête et le conteneur de liste sont révélés |
| 2026-07-26 | AC4 — `opacity`/`transform` uniquement, `viewport.once` pour libérer l'observation, aucun listener `scroll` |
| 2026-07-26 | Vérifications — HTML servi sans aucun style masquant ; 6 cartes `sticky` avec `top` calculé intact et enfants directs ; baseline `DEV` confirme que `twMerge` retirait déjà `relative` ; aucun `+"use client"` dans le diff ; `/` toujours `Static` + `Revalidate 1h` |
| 2026-07-26 | DoD — `tsc` 0, `build` OK, `lint` 0 erreur (1 warning préexistant) ; `package.json`/`bun.lock` intacts |
