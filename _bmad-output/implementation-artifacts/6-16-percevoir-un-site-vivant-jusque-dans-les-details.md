---
baseline_commit: c408eae7818fb33ef915a70085775688fbf80640
---

# Story 6.16: Percevoir un site vivant jusque dans les détails

Status: ready-for-dev

## Story

As **visiteur du portfolio**,
I want **des détails d'ambiance soignés**,
so that **le site donne une impression d'ensemble aboutie**.

## Acceptance Criteria

**AC1 — Le bandeau défilant suit la vitesse et le sens du défilement**
**Given** le bandeau défilant a aujourd'hui une vitesse fixe
**When** je fais défiler la page
**Then** sa vitesse suit celle de mon défilement et sa direction s'inverse selon mon sens de lecture

**AC2 — Un dégradé d'ambiance animé s'ajoute au fond**
**Given** le fond utilise aujourd'hui une texture fixe
**When** je consulte le site
**Then** un dégradé d'ambiance animé s'y ajoute discrètement
**And** il n'entrave ni la lisibilité du texte ni le contraste

**AC3 — Ces effets décoratifs ne coûtent pas en fluidité**
**Given** ces effets sont décoratifs
**When** je mesure la performance
**Then** ils n'entament pas la fluidité du défilement ni les scores de performance visés

**AC4 — Bandeau immobile et fond statique sous mouvement réduit**
**Given** le réglage de mouvement réduit est actif
**When** je consulte le site
**Then** le bandeau est immobile et le fond statique

## Contexte d'implémentation

### 🛑 Prérequis : stories 6.1 (tokens) et 6.2 (socle motion) `done`

AC4 s'appuie **entièrement** sur le socle de neutralisation de **6.2** (`useReducedMotion` de `motion/react`). Les couleurs du dégradé d'ambiance (AC2) doivent passer par les **tokens 6.1** (`--accent-from` / `--accent-to`), ❌ pas par des valeurs en dur. PLAN §4.2 (P3 n°12 : « **Marquee Tape** piloté par la vitesse de scroll (accélère/inverse selon la direction) » ; P3 n°13 : « **Noise + aurora background** animé en CSS pur (**déjà 80 % là avec `grain.jpg`**) »).

### ✅ État réel à la baseline — ce que le dépôt contient déjà

**Le bandeau (`Tape.tsx`)** — vérifié, c'est un composant **serveur** (aucun `"use client"`), 50 lignes :

```tsx
<div className="flex flex-none gap-4 pr-4 py-3 animate-move-left [animation-duration:30s]">
  {[...new Array(2)].fill(0).map(…)}   // ← les mots sont DUPLIQUÉS deux fois
```

- 🛑 **La duplication ×2 n'est pas décorative, elle est structurelle** : l'animation `move-left` translate de `0%` à `-50%` (`tailwind.config.ts:88-95`). Le `-50%` correspond **exactement à la première copie** des mots — c'est ce qui rend la boucle **invisible**. ❌ **Casser cette invariance (retirer la copie, changer le `-50%`) produit un saut visible à chaque cycle.**
- ⚠️ Vitesse actuelle : **`[animation-duration:30s]`** en dur, `linear infinite`, un seul sens.
- ⚠️ `[mask-image:linear-gradient(...)]` masque les bords · `-rotate-3` incline la bande · `overflow-x-clip` sur le conteneur (⚠️ **c'est lui qui empêche la bande inclinée de provoquer un défilement horizontal de la page** — ❌ ne pas le retirer).
- ⚠️ Le dégradé de la bande est `from-emerald-300 to-sky-400` : **c'est le dégradé d'accent de l'identité** (PLAN §4.1). ✅ Passer par les **tokens 6.1**, ❌ ne pas changer les couleurs.

**Le fond** — vérifié, `grain.jpg` (177 Ko) est utilisé à **trois endroits**, tous en `backgroundImage` inline :

| Fichier | Usage |
|---|---|
| `Hero.tsx:23` | fond de la zone d'accueil |
| `ContactClient.tsx:25` | fond de l'encart contact |
| `Card.tsx:21` | fond de **chaque carte** |

- 🛑 **Le grain n'est PAS un fond de page** : il n'y a **aucun fond global** aujourd'hui, seulement `bg-gray-900` sur le `<body>` (`layout.tsx:50`). L'« aurora » d'AC2 est donc quelque chose de **nouveau**, à poser au niveau du layout — ❌ pas une modification des trois usages existants du grain.

### 🛑 Piège n°1 (CENTRAL) — AC1 : lier une animation CSS au défilement est un piège à jank

- 🛑 **C'est le piège technique de la story, et il est contre-intuitif.** La tentation naturelle est d'écouter `scroll` et de réécrire `animation-duration` (ou `transform`) à chaque événement. ❌ **C'est précisément ce qui viole AC3** : un handler de défilement qui écrit dans le style à chaque frame force un **recalcul de style + layout** sur le fil principal, exactement pendant le défilement.
- ✅ **Trois voies acceptables, par ordre de préférence :**
  1. ✅ **`useScroll` + `useVelocity` + `useSpring` de `motion`** (déjà installé) appliqués à un `motion.div` en `x` via `useTransform`. `motion` écrit sur le **compositeur** et non dans le layout. C'est le motif canonique de ce type d'effet, et il donne l'inversion de sens **gratuitement** (la vélocité est signée).
  2. ✅ Une **variable CSS** (`--tape-speed`) mise à jour dans un `requestAnimationFrame` **throttlé**, consommée par l'animation CSS existante.
  3. ❌ **Jamais** : un `setState` React à chaque événement de défilement (re-rendu de tout l'arbre à 60 Hz).
- 🛑 ⚠️ **`Tape.tsx` est un composant SERVEUR.** L'effet impose `"use client"` — ✅ soit sur `Tape.tsx` lui-même (il ne fait aucune lecture de données, la conversion est **sans risque**), ✅ soit par extraction d'une vue cliente. ⚠️ **Décider et documenter.** 🛑 **Et vérifier ensuite que `/` reste `○ (Static, 1h)`** : un composant client ne rend pas la page dynamique, mais c'est le garde-fou du dépôt et il se vérifie **à chaque build**.
- 🛑 ⚠️ **L'inversion de sens ne doit pas produire d'à-coup.** Une vélocité brute oscille : à l'arrêt du défilement elle passe par zéro en tremblant, et la bande **vibrerait**. ✅ **`useSpring` (ou tout lissage) est obligatoire**, pas optionnel. ⚠️ Prévoir aussi une **vitesse de base non nulle** : AC1 dit que la vitesse *suit* le défilement, pas que la bande **s'arrête** quand on ne défile pas — ⚠️ une bande figée à l'arrêt est un régression visuelle par rapport à l'existant. 🛑 **Décider et documenter** (✅ recommandé : vitesse de croisière + modulation par la vélocité).
- ⚠️ **Le passage à un `x` piloté par `motion` remplace l'animation CSS `animate-move-left`.** 🛑 **Attention** : c'est cette classe qui portait la neutralisation « gratuite » de 6.2 (règle CSS globale sur `animation-duration`). ✅ **Une transformation pilotée par `motion` n'est PAS couverte par cette règle** — AC4 devient alors **entièrement de votre responsabilité** (voir piège n°3). C'est le point le plus facile à rater de la story.
- ⚠️ **La boucle infinie doit être préservée** : avec un `x` piloté, il faut un **modulo** sur la largeur d'une copie (`x % -50%`) — sinon la bande sort de l'écran et ne revient jamais. ✅ `useTransform` avec `wrap` (utilitaire `motion`) ou un modulo manuel.

### 🛑 Piège n°2 — AC2 : « discrètement » et « n'entrave ni la lisibilité ni le contraste » sont des CONTRAINTES DURES

- 🛑 **AC2 contient sa propre condition d'échec.** Un dégradé d'ambiance derrière du texte **modifie le contraste local** ; le site vise **AA** (AGENTS.md §6, non négociable) et le texte principal est blanc sur `gray-900`.
- ✅ **Les garde-fous, à appliquer tous** :
  - **Opacité très basse** (indicatif : ≤ 0,10) et **flou important** — l'aurora doit être perçue comme une variation d'ambiance, pas comme une forme.
  - 🛑 **Derrière tout le contenu** : `-z-*` et **`pointer-events-none`** obligatoire. ❌ Sans `pointer-events-none`, un fond en position fixe **intercepte tous les clics de la page** — panne totale et silencieuse.
  - 🛑 **`aria-hidden="true"`** : c'est un élément purement décoratif, il ne doit pas exister pour un lecteur d'écran.
  - ✅ **Mesurer le contraste au point le plus défavorable** du dégradé (là où il est le plus clair, sous le texte le plus fin), ❌ pas au centre.
- ⚠️ **CSS pur, comme le PLAN l'indique** (« animé en **CSS pur** »). ✅ Des `radial-gradient` animés en `@keyframes` sur `transform`/`opacity`. ❌ **Pas de canvas, pas de WebGL, pas de dépendance** — ce serait un coût de performance disproportionné pour un effet d'ambiance (AC3).
- ⚠️ 🛑 **Animer `background-position` ou les stops d'un dégradé est coûteux** (repeinture de toute la surface à chaque frame). ✅ **Animer `transform` et `opacity` uniquement** sur des blobs déjà peints — ce sont les deux seules propriétés que le compositeur gère sans repeindre (AC3).
- ⚠️ **Où le poser ?** ✅ Dans `layout.tsx` (fond de **tout** le site, y compris `/cv`, `/projects/[slug]`, `/admin`) **ou** dans `page.tsx` (accueil seulement). 🛑 **Décider et documenter.** ⚠️ **`/admin` a sa propre identité (tokens shadcn 5.7)** : ❌ y injecter une aurora est un débordement sur l'Epic 5 — ✅ si le fond est posé au layout racine, **vérifier explicitement le rendu de `/admin`**.
- ⚠️ **Le grain reste.** AC2 dit « un dégradé **s'y ajoute** » — ❌ ne pas remplacer ni retirer `grain.jpg` de ses trois usages.

### 🛑 Piège n°3 — AC4 : la neutralisation N'EST PLUS automatique après cette story

- 🛑 **À lire deux fois.** Aujourd'hui, le bandeau est neutralisé par la **règle CSS globale de 6.2** (`animation-duration: 0.01ms`), sans que personne n'ait à y penser. **Cette story remplace l'animation CSS par une transformation pilotée en JavaScript** — et `motion` **ne lit pas** cette règle CSS. ✅ **Il faut donc neutraliser explicitement** :
  - ✅ `const shouldReduceMotion = useReducedMotion()` (socle 6.2), puis **ne pas s'abonner du tout au défilement** quand il est vrai — ❌ pas « animer plus lentement ».
  - 🛑 ✅ **Et rendre la bande dans un état LISIBLE**, pas dans un état arbitraire : `x = 0`. ⚠️ Une bande figée à une position intermédiaire couperait des mots au milieu.
- 🛑 ⚠️ **Le piège jumeau, côté aurora** : la règle CSS globale de 6.2 met `animation-duration: 0.01ms` — l'animation **saute à son état final** (c'est exactement ce que le commentaire de `globals.css:103-107` explique). ⚠️ **L'état final d'une aurora doit rester un fond présentable** : si la dernière frame est une position extrême ou une opacité nulle, le fond « statique » d'AC4 sera **laid ou absent**. ✅ **Vérifier à l'œil l'état figé**, ❌ ne pas le supposer.
- ⚠️ ❌ **Ne pas ajouter de seconde media-query `prefers-reduced-motion`** dans `globals.css` : la règle globale de 6.2 y est déjà et prime sur les utilitaires (commentaire ligne 105). ✅ Le cas échéant, ajouter une règle **ciblée** à côté, ❌ pas une redéfinition concurrente.
- ⚠️ **Contrainte transverse Epic 6** (`epics.md`, en-tête) : toute animation ajoutée porte **son propre** critère de neutralisation. ✅ `useReducedMotion` (6.2), ❌ pas de `matchMedia` maison.

### ⚠️ Piège n°4 — AC3 : « ne pas entamer la fluidité » se mesure, ne se suppose pas

- 🛑 Cibles PLAN §4.4 : **Lighthouse ≥ 95**, **LCP < 2 s**, **CLS < 0,05**. Cette story ajoute **deux effets permanents** — c'est la story de l'Epic 6 la plus susceptible de les dégrader.
- ✅ **Les règles non négociables** :
  - **`transform` / `opacity` uniquement** pour tout ce qui est animé. ❌ Jamais `top`/`left`/`width`/`background-position`/`filter` animés.
  - ✅ **`will-change` avec parcimonie** — 🛑 en abuser (sur chaque blob) **consomme de la mémoire GPU et dégrade** au lieu d'améliorer.
  - ❌ **Aucun `box-shadow` ou `filter: blur()` animé** : ce sont les deux propriétés les plus coûteuses à repeindre.
  - ✅ Un `blur` **statique** (non animé) sur un blob est acceptable ; ⚠️ un `blur` très large sur une grande surface reste coûteux sur mobile — **mesurer**.
- 🛑 ⚠️ **L'aurora ne doit pas devenir le LCP.** Un très grand élément de fond peint tôt peut être élu comme **Largest Contentful Paint** par le navigateur, faisant chuter la métrique alors que le contenu réel est prêt. ⚠️ Un élément avec une opacité quasi nulle est en principe ignoré par l'heuristique LCP — ✅ **mais le vérifier dans le panneau Performance**, pas le supposer.
- 🛑 **Test décisif d'AC3** : profiler le **défilement** (onglet Performance, throttling CPU ×4) **avant et après**. ❌ Aucune frame longue supplémentaire, ❌ aucun `Recalculate Style` récurrent pendant le défilement.
- ⚠️ ❌ **Aucun saut de mise en page** : l'aurora en `fixed`/`absolute` **ne doit pas** entrer dans le flux (CLS).

### ⚠️ Piège n°5 — Périmètre

- ❌ **Hors périmètre** : **toute migration Prisma** · toute lecture de données (le bandeau est **codé en dur** dans `Tape.tsx` — ❌ **ne pas le rendre administrable**, ce serait une story Epic 5 entière) · les **mots** du bandeau (contenu éditorial) · le grain (`Hero`, `Contact`, `Card`) · `/admin` · le `Header` (**6.5**) · les cartes projet (**6.8**) · le curseur/magnétisme (**6.6**) · le hero (**6.7**) · **toute dépendance** (`motion` 12 est **déjà** installé).
- ⚠️ 🛑 **Le débordement le plus probable** : « tant que je touche au bandeau, autant rendre les mots administrables / ajouter un second bandeau / animer aussi les cartes ». ❌ **Non.** **Une story, rien qu'une story, toute la story.**
- ⚠️ 🛑 **Le second débordement** : « le fond, c'est global, donc j'en profite pour refondre `layout.tsx` ». ❌ L'ajout doit être **chirurgical** : un élément décoratif, rien d'autre. ⚠️ **`layout.tsx` porte les métadonnées SEO (story 1.10, livrée)** — ❌ ne pas y toucher.

### ⚠️ Piège n°6 — Vérification locale, les 4 AC

- **AC1** : 🛑 **Test décisif** — défiler **vers le bas** : la bande accélère dans un sens ; défiler **vers le haut** : elle **s'inverse**. À l'arrêt : elle continue à sa vitesse de croisière, **sans vibrer** ni saccader. 🛑 **Et la boucle reste invisible** — aucun saut, aucun blanc, aucun mot coupé au raccord.
- **AC2** : le dégradé est **perceptible mais discret**. 🛑 **Vérifier le contraste AA au point le plus clair du dégradé, sous le texte le plus fin** (pas au centre). 🛑 **Cliquer partout** : aucun élément ne doit être devenu inerte (`pointer-events-none`). Au lecteur d'écran : le fond **n'existe pas**.
- **AC3** : 🛑 profiler le défilement avec **throttling CPU ×4** — ❌ aucune frame longue supplémentaire. Lighthouse **≥ 95**, **CLS < 0,05**, LCP **inchangé** (❌ l'aurora n'est pas devenue le LCP).
- **AC4** : 🛑 mouvement réduit activé → bande **immobile ET lisible** (`x = 0`, aucun mot coupé), fond **statique ET présentable** (état figé vérifié à l'œil). ❌ Aucun abonnement au défilement actif.
- **Accessibilité** : contrastes **AA** sur toutes les sections traversées par l'aurora · fond `aria-hidden` · ❌ aucune capture d'événement.
- **Non-régression** : 🛑 **`/` toujours `○ (Static, 1h)`** · `/preview` intact · ❌ **aucun défilement horizontal** de la page (la bande est inclinée : `overflow-x-clip` **préservé**) · `/admin` **visuellement inchangé** si le fond est au layout racine.

## Tasks / Subtasks

- [ ] **Tâche 0 — Prérequis & décisions** (AC: 1, 2)
  - [ ] 6.1 et 6.2 `done`. 🛑 **Décider et documenter** : `"use client"` sur `Tape.tsx` ou vue cliente extraite · **vitesse de croisière** conservée à l'arrêt (✅ recommandé) · **où** poser l'aurora (`layout.tsx` global ou `page.tsx`) et **ce que devient `/admin`**.
- [ ] **Tâche 1 — Bandeau piloté par le défilement** (AC: 1 ; piège n°1)
  - [ ] `useScroll` + `useVelocity` + **`useSpring`** (lissage **obligatoire**) + `useTransform` sur `x`. ❌ Aucun `setState` au défilement, ❌ aucune écriture de style dans un handler `scroll`.
  - [ ] 🛑 **Préserver la boucle** : duplication ×2 des mots **ET** modulo sur `-50%`. ❌ Aucun saut au raccord.
  - [ ] ⚠️ **Conserver** `overflow-x-clip`, `mask-image`, `-rotate-3`, le dégradé d'accent (via **tokens 6.1**).
- [ ] **Tâche 2 — Aurora de fond** (AC: 2 ; piège n°2)
  - [ ] `radial-gradient` animés en **CSS pur**, `transform`/`opacity` **uniquement**. Couleurs via **tokens 6.1**. ❌ Aucune dépendance, ❌ pas de canvas.
  - [ ] 🛑 **`pointer-events-none`** + **`aria-hidden="true"`** + `-z-*` + hors flux (anti-CLS). ⚠️ **Le grain est CONSERVÉ** dans ses trois usages.
  - [ ] 🛑 **Contraste AA vérifié au point le plus défavorable.**
- [ ] **Tâche 3 — Mouvement réduit** (AC: 4 ; piège n°3)
  - [ ] 🛑 `useReducedMotion` → **aucun abonnement au défilement**, bande figée à **`x = 0`** (lisible). ❌ Pas « plus lent ».
  - [ ] 🛑 **Vérifier à l'œil l'état FIGÉ de l'aurora** (la règle 6.2 saute à la dernière frame) — il doit rester présentable.
- [ ] **Tâche 4 — Performance** (AC: 3 ; piège n°4)
  - [ ] Profil de défilement **avant/après**, throttling CPU ×4. Lighthouse ≥ 95, CLS < 0,05, **LCP inchangé**. `will-change` **parcimonieux**.
- [ ] **Tâche 5 — Vérification locale** (AC: 1-4 ; piège n°6)
  - [ ] Les 4 AC un par un, dont **défilement haut/bas + arrêt** (AC1), **contraste au point le plus clair + clics partout** (AC2), **profil CPU ×4** (AC3), **mouvement réduit sur les deux effets** (AC4). Mobile : ❌ aucun défilement horizontal.
- [ ] **Tâche 6 — Definition of Done** (AGENTS.md §8)
  - [ ] `bun run lint` 0 / `bunx tsc --noEmit` 0 / `bun run build` OK — 🛑 **`/` toujours `○ (Static, 1h)`**.
  - [ ] `git diff DEV` : `Tape.tsx` + l'aurora (+ `globals.css`/`tailwind.config.ts` si keyframes). ❌ Aucune migration, aucune dépendance, aucune lecture, `Header.tsx` / `Card.tsx` / `/admin` / métadonnées de `layout.tsx` intacts.
  - [ ] `File List` + `Completion Notes` + `Change Log` · `sprint-status.yaml`.

## Dev Notes

### Périmètre — verrouillé

**Piloter le bandeau défilant par la vélocité de défilement lissée (accélération et inversion de sens) en remplaçant l'animation CSS `animate-move-left` par une transformation `motion` bouclée, et ajouter au fond un dégradé d'ambiance animé en CSS pur, discret, décoratif et hors du flux — les deux effets étant explicitement neutralisés sous mouvement réduit et mesurés comme sans coût sur la fluidité du défilement. Aucune donnée, aucune dépendance, aucune migration.**

**Hors périmètre — ne pas faire :**
- ❌ **Écrire dans le style depuis un handler `scroll`** ou faire un `setState` par frame (viole AC3 directement).
- ❌ **Oublier la neutralisation explicite du bandeau** : en quittant l'animation CSS, la règle globale de 6.2 **ne s'applique plus** — c'est le piège central d'AC4.
- ❌ **Casser la boucle du bandeau** en retirant la duplication ×2 ou en changeant le `-50%` (saut visible à chaque cycle).
- ❌ **Retirer `overflow-x-clip`** (la bande est inclinée : défilement horizontal de la page).
- ❌ **Un fond sans `pointer-events-none`** — il intercepterait tous les clics du site.
- ❌ **Animer `background-position`, `filter` ou `box-shadow`** · abuser de `will-change`.
- ❌ **Rendre les mots du bandeau administrables** (débordement Epic 5) · toucher au grain · toucher aux métadonnées de `layout.tsx` (story 1.10).
- ❌ Toute dépendance (`motion` 12 est déjà là) · toute migration · `/admin` · `Header` (6.5) · cartes projet (6.8) · curseur (6.6) · hero (6.7).

### Le vrai enjeu

Deux effets décoratifs, et un piège dans chacun. Le bandeau : lier une animation au défilement invite naturellement à écouter `scroll` et à réécrire du style — ce qui provoque exactement le jank qu'AC3 interdit. La bonne voie est `useScroll`/`useVelocity`/`useSpring` de `motion`, déjà installé, qui écrit sur le compositeur et donne l'inversion de sens gratuitement puisque la vélocité est signée ; le lissage n'y est pas un raffinement mais une nécessité, sans lui la bande vibre à chaque arrêt de défilement. Et un piège dérivé, plus sournois : en abandonnant `animate-move-left`, on quitte la couverture de la règle CSS globale de 6.2 — **AC4 cesse d'être gratuit** et devient une responsabilité explicite. Le fond, lui, est techniquement trivial en CSS pur ; sa difficulté est ailleurs, dans les deux conditions qu'AC2 s'impose à lui-même — ne pas dégrader le contraste AA (à mesurer au point le plus clair, pas au centre) et ne pas exister pour l'interaction ni pour les lecteurs d'écran, faute de quoi un fond en position fixe absorbe silencieusement tous les clics de la page.

### Testing standards

Vérification **manuelle** des 4 AC, avec trois tests décisifs : **défiler vers le bas, vers le haut, puis s'arrêter** — la bande accélère, s'inverse, puis reprend sa vitesse de croisière sans vibrer et sans saut au raccord de boucle (AC1) ; **profiler le défilement avec throttling CPU ×4 avant et après** — aucune frame longue supplémentaire, aucun `Recalculate Style` récurrent (AC3) ; **activer le mouvement réduit** — bande immobile *et lisible* à `x = 0`, fond figé *et présentable* (AC4). Plus le contraste AA mesuré au point le plus clair du dégradé sous le texte le plus fin, un test de clic sur toute la page (`pointer-events-none`), le lecteur d'écran (le fond n'existe pas), Lighthouse ≥ 95 / CLS < 0,05 / LCP inchangé, et les non-régressions : `/` toujours `○ (Static, 1h)`, aucun défilement horizontal sur mobile, `/preview` et `/admin` intacts. `lint`/`tsc`/`build` verts.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.16 ; en-tête Epic 6 — contrainte transverse : chaque story introduisant du mouvement porte son propre critère de neutralisation]
- [Source: PLAN_REFONTE_2026.md §4.2 P3 n°12 — « Marquee Tape piloté par la vitesse de scroll (accélère/inverse selon la direction) » ; P3 n°13 — « Noise + aurora background animé en CSS pur (déjà 80 % là avec grain.jpg) » ; §4.1 — identité conservée (dégradé emerald→sky, grain) ; §4.4 — Lighthouse ≥ 95, LCP < 2 s, CLS < 0,05]
- [Source: AGENTS.md §6 — `prefers-reduced-motion` sur CHAQUE animation, contrastes AA, focus visibles ; §9 règles 2 et 6 — périmètre verrouillé, zéro dépendance]
- [Source: apps/web/src/sections/Tape.tsx — composant SERVEUR ; `animate-move-left [animation-duration:30s]` ; duplication ×2 des mots (INVARIANT de la boucle, couplé au `-50%`) ; `mask-image`, `-rotate-3`, `overflow-x-clip` (anti-débordement horizontal) ; dégradé `emerald-300 → sky-400`]
- [Source: apps/web/tailwind.config.ts:76-104 — keyframes `move-left`/`move-right` (`0%` → `-50%`) : le `-50%` correspond exactement à la première copie des mots]
- [Source: apps/web/src/app/globals.css:103-121 — règle globale `prefers-reduced-motion` (socle 6.2) : `animation-duration: 0.01ms` fait SAUTER à l'état FINAL. ⚠️ Elle ne couvre PAS les transformations pilotées par `motion` en JS]
- [Source: apps/web/src/app/layout.tsx:44-56 — `bg-gray-900` sur le `<body>`, AUCUN fond décoratif global aujourd'hui ; ⚠️ le fichier porte les métadonnées SEO de la story 1.10 : ne pas y toucher]
- [Source: apps/web/src/sections/Hero.tsx:23, apps/web/src/sections/ContactClient.tsx:25, apps/web/src/components/Card.tsx:21 — les TROIS usages de `grain.jpg` en `backgroundImage` inline : à CONSERVER tels quels]
- [Source: apps/web/src/sections/AboutClient.tsx — motif `useReducedMotion` de `motion/react` (socle 6.2) à réutiliser]
- [Source: apps/web/src/app/page.tsx:16-29 — garde-fou : `/` doit rester `○ (Static, 1h)` ; le bandeau est aussi rendu par `/preview` (5.11)]
- [Source: apps/web/package.json — `motion` 12 DÉJÀ installé (`useScroll`, `useVelocity`, `useSpring`, `useTransform`) : aucune bibliothèque à ajouter]

## Dev Agent Record

### Agent Model Used

### Completion Notes

### File List

### Change Log
