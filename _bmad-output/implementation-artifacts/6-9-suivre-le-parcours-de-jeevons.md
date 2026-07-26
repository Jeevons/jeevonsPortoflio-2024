---
baseline_commit: c408eae7818fb33ef915a70085775688fbf80640
---

# Story 6.9: Suivre le parcours de Jeevons

Status: ready-for-dev

## Story

As **recruteur**,
I want **lire le parcours de Jeevons dans un déroulé clair**,
so that **je comprenne sa progression d'un coup d'œil**.

## Acceptance Criteria

**AC1 — Déroulé vertical chronologique, lisible sans interaction**
**Given** le parcours est aujourd'hui présenté en carrousel horizontal
**When** cette story est terminée
**Then** il est présenté en déroulé vertical, chronologique et lisible sans interaction

**AC2 — Ligne qui se remplit, jalons qui s'illuminent**
**Given** je fais défiler la page
**When** le déroulé entre à l'écran
**Then** la ligne se remplit progressivement et les jalons s'illuminent à mesure

**AC3 — Données issues de la base, dans l'ordre d'administration**
**Given** les entrées viennent de la base
**When** je consulte le déroulé
**Then** il reflète les entrées publiées dans l'ordre défini en administration

**AC4 — Lisible sur téléphone, sans défilement horizontal**
**Given** je consulte sur téléphone
**When** je parcours le déroulé
**Then** il reste lisible, sans défilement horizontal

**AC5 — Mouvement réduit : déroulé complet et rempli**
**Given** le réglage de mouvement réduit est actif
**When** le déroulé entre à l'écran
**Then** il s'affiche complet et rempli, sans animation de progression

## Contexte d'implémentation

### 🛑 Prérequis : stories 6.1 (tokens), 6.2 (socle motion) `done`

La ligne et les jalons (AC2) utilisent le **dégradé d'accent tokenisé** en 6.1. AC5 s'appuie sur le **socle de neutralisation** de 6.2. PLAN §4.2 (P2 n°8 : « timeline verticale animée, ligne qui se remplit au scroll, jalons qui s'illuminent. Bien plus lisible que le carrousel horizontal actuel »).

### 🎯 Ce que fait vraiment cette story

C'est **la refonte la plus lourde de l'Epic 6** : `TestimonialsClient.tsx` (155 lignes) est un **carrousel horizontal auto-défilant** avec duplication des cartes, `setInterval` de défilement, gestion du survol et du clic. Cette story **supprime tout cela** et le remplace par un **déroulé vertical statique** dont la ligne se remplit au défilement. Le conteneur serveur `Testimonials.tsx` et la lecture `getPublishedTimeline()` restent en place.

### 🛑 Piège n°1 (CENTRAL) — Ce qui est SUPPRIMÉ, et ce qui doit SURVIVRE

- 🛑 **À supprimer** (tout le mécanisme de carrousel, `TestimonialsClient.tsx`) :
  - le `setInterval` d'auto-défilement (`autoScroll`, lignes 47-70) et son `useEffect` (72-78) ;
  - les états `isHovered` / `isClicked` et leurs gestionnaires (41-43, 81-94) ;
  - le listener `document.click` (96-101) ;
  - la **duplication des entrées** `[...entries, ...entries]` (ligne 119) — 🛑 **impérativement**, sinon chaque formation apparaîtrait **deux fois** dans un déroulé vertical (bug immédiatement visible) ;
  - le conteneur `overflow-x-auto` + `mask-image` horizontal (ligne 114) ;
  - le `hover:-rotate-3` des cartes (ligne 123).
- 🛑 **À conserver absolument** :
  - l'**`id="parcours"`** de la `<section>` (ligne 104) — ❌ le perdre casserait la navigation (story 1.1) **et** le scroll-spy (story 6.5, qui s'appuie sur cet identifiant) ;
  - le `SectionHeader` (⚠️ **sans** la prop `indication="Survolez / Cliquez sur une carte pour l'arrêter"`, ligne 110 — elle décrit un comportement qui n'existera plus : **la laisser serait mentir au visiteur**) ;
  - la **jointure `avatarBySlug`** (lignes 21-27) et son usage, ou la décision documentée de la retirer ;
  - `useReducedMotion` (déjà importé de `motion/react`, ligne 10).
- ⚠️ `Testimonials.tsx` (conteneur serveur) mappe `{ slug, title, place, body }` — voir piège n°3 : cette projection est **trop pauvre** pour AC1.

### 🛑 Piège n°2 — AC1 « chronologique » : le tri actuel ne l'est pas

- 🛑 `getPublishedTimeline()` (`lib/timeline.ts:17-20`) trie par **`sortOrder`**, l'ordre défini en administration. **AC3 exige explicitement ce tri**.
- 🛑 Mais **AC1 exige « chronologique »**. ⚠️ Ce sont **deux critères potentiellement contradictoires** : rien ne garantit que le `sortOrder` saisi par Jeevons corresponde à l'ordre des années.
- ✅ **Résolution** : AC3 est le critère **fonctionnel** (« reflète les entrées publiées **dans l'ordre défini en administration** ») ; AC1 décrit l'**intention de présentation**. ✅ **Conserver le tri par `sortOrder`** — c'est le contrat de la story 5.14 (écran de réordonnancement `/admin/timeline/order`) et le retirer casserait une fonctionnalité livrée. 🛑 **Ne PAS ajouter un `orderBy: { startYear: "asc" }`** qui ignorerait le travail de réordonnancement.
- ✅ Ce qui rend le déroulé « chronologique » à l'œil, c'est **l'affichage des années** — voir piège n°3. ⚠️ **Documenter cette décision** dans les notes de complétion.

### 🛑 Piège n°3 (LE PLUS IMPORTANT) — Les années existent en base et ne sont PAS affichées

- 🛑 Le modèle `TimelineEntry` porte **`startYear: Int`** et **`endYear: Int?`** (schéma, story 5.14). ⚠️ Or le conteneur `Testimonials.tsx:13-18` **ne les projette pas** : `entries` ne contient que `{ slug, title, place, body }`. **Les années sont en base, administrables, et invisibles à l'écran.**
- ✅ Un déroulé chronologique **sans dates n'en est pas un**. AC1 (« chronologique ») et le rôle recruteur (« comprendre sa progression d'un coup d'œil ») imposent d'**afficher les années**. ✅ **Étendre la projection** de `Testimonials.tsx` et le type `TestimonialEntry` pour inclure `startYear`/`endYear` — c'est **dans le périmètre**, c'est même ce qui donne son sens à la story.
- ⚠️ **`endYear` est nullable, et c'est porteur de sens** : le schéma le documente — « c'est ce qui exprime *poste toujours en cours* » (story 5.14 AC1). ✅ Rendre `2023 — aujourd'hui` (ou équivalent) quand `endYear` est `null`, **jamais** `2023 — null` ni `2023 — ` ni une année inventée.
- ⚠️ **`avatarId`/`avatar`** (relation `Media`, story 5.14) existe aussi et n'est pas projeté : la vue utilise la jointure **statique** `avatarBySlug` (lignes 21-27), qui ne couvre que **cinq slugs en dur**. 🛑 Une entrée créée depuis l'administration avec un autre slug obtient **`undefined`** → `<Image src={undefined}>` **plante**. ⚠️ Ce bug **préexiste** cette story ; le déroulé vertical le rendra plus visible. ✅ **A minima** : garder le rendu conditionnel (ne rien afficher si aucun avatar) plutôt que de propager le crash. ⚠️ Brancher `avatar` (Media) est **tentant mais hors périmètre strict** — si vous le faites, documentez-le ; sinon, **protégez le cas `undefined`**, c'est non négociable.

### ⚠️ Piège n°4 — AC2 : « la ligne se remplit », sans listener naïf

- ✅ **Ligne qui se remplit** : `motion` v12 est **déjà installé** — `useScroll` avec `target` + `offset` donne un `scrollYProgress` **relatif à la section**, exactement ce qu'il faut. `transform: scaleY` (composé par le GPU) sur une ligne d'accent tokenisée (6.1). **Zéro dépendance.**
- ✅ **Jalons qui s'illuminent** : `IntersectionObserver` par jalon (même approche qu'en 6.4/6.5), **pas** un listener `scroll` calculant des offsets — layout thrashing garanti.
- ⚠️ ❌ N'animer que `transform`/`opacity`. ❌ Jamais `height` sur la ligne (recalcul de mise en page à chaque image).
- ⚠️ `transform-origin: top` sur la ligne, sinon elle se remplit depuis le centre.
- ⚠️ La story **6.4** a généralisé le reveal au scroll : ⚠️ **vérifier ce qu'elle a déjà posé sur cette section** avant d'ajouter une seconde couche d'animation d'entrée — deux reveals superposés donnent un rendu confus.

### ⚠️ Piège n°5 — AC4 : téléphone, sans défilement horizontal

- ✅ AC4 est en grande partie **acquis par la suppression du carrousel** : `overflow-x-auto` disparaît. Mais ce n'est **pas automatique**.
- 🛑 Un déroulé vertical classique place la ligne à gauche et les cartes en alternance gauche/droite sur grand écran. ⚠️ **Sur téléphone, l'alternance ne tient pas** : elle réduit chaque carte à une demi-largeur illisible. ✅ Sur mobile : **une seule colonne**, ligne à gauche, toutes les cartes du même côté.
- 🛑 **Test obligatoire à 375 px** : aucun débordement horizontal. ⚠️ Les causes classiques : largeurs fixes (`max-w-xs md:max-w-md` ligne 122 — à réévaluer), `gap` trop grands, marges négatives (`-my-4` ligne 114), positionnement absolu de la ligne. ✅ Vérifier `document.documentElement.scrollWidth === clientWidth`.
- ⚠️ La story **6.3** a traité la lisibilité et les débordements à 375 px : **relire son état** et ne pas défaire son travail.

### ⚠️ Piège n°6 — AC5 : « complet **et rempli** »

- 🛑 AC5 est **plus exigeant** qu'une simple absence d'animation : sous mouvement réduit, la ligne doit s'afficher **remplie** et les jalons **illuminés**. ❌ Une ligne à `scaleY(0)` figée = un déroulé **vide** = échec de l'AC **et** perte d'information.
- ✅ `useReducedMotion()` → **court-circuiter** : ligne à `scaleY(1)`, tous les jalons dans leur état illuminé, aucun `IntersectionObserver`, aucun `useScroll`. Pas seulement « sans transition » — **directement dans l'état final**.
- ⚠️ C'est le même principe que le socle 6.2 : « le contenu reste présenté dans son état final, jamais masqué ».
- ⚠️ `useReducedMotion` est **réactif** : la bascule sans rechargement doit fonctionner.

### ⚠️ Piège n°7 — Périmètre et non-régression

- ✅ `TestimonialsClient.tsx` est **déjà** `"use client"` (ligne 1) : pas de piège de Server Component ici, contrairement à 6.7. Le conteneur `Testimonials.tsx` reste serveur `async`.
- ⚠️ ⚠️ **Le nom des fichiers ment** : la section « parcours » vit dans `Testimonials*.tsx` (héritage). ❌ **Ne PAS renommer les fichiers** dans cette story — le renommage toucherait `page.tsx`, `preview/page.tsx` et brouillerait le diff. Le périmètre est le **contenu**, pas le nom.
- ⚠️ ✅ **`preview/page.tsx`** rend aussi cette section (story 5.11) : vérifier que le mode aperçu fonctionne toujours.
- ❌ **Hors périmètre** : `Card.tsx` (partagé — cf. 6.8) · cartes projet (6.8) · hero (6.7) · curseur (6.6) · header (6.5) · **modifier la lecture `getPublishedTimeline()` ou le schéma Prisma** · écran `/admin/timeline` · **nouvelle dépendance**.
- ⚠️ La section **hobbies** (`AboutClient.tsx`) utilise aussi `Card` : ne pas la toucher.

### ⚠️ Piège n°8 — Vérification locale, les 5 AC

- **AC1** : la section `#parcours` est un **déroulé vertical**, lisible **sans aucune interaction** (ne rien survoler, ne rien cliquer). 🛑 **Chaque formation apparaît UNE SEULE FOIS** (duplication supprimée). Les **années sont visibles**.
- **AC2** : défiler jusqu'à la section → la ligne **se remplit** de haut en bas, les jalons **s'illuminent** à mesure.
- **AC3** : comparer l'ordre affiché à `/admin/timeline/order` → **identique**. Dépublier une entrée en administration → elle **disparaît** du site (après revalidation). Vérifier une entrée **sans `endYear`** → « aujourd'hui », jamais `null`.
- **AC4** : **375 px** — aucun défilement horizontal (`scrollWidth === clientWidth`), texte lisible, une seule colonne.
- **AC5** : reduced-motion activé (procédure de 6.2) → déroulé **complet, ligne pleine, jalons illuminés**, sans animation.
- 🛑 **Non-régression** : `#parcours` toujours atteignable depuis le menu (story 1.1) · **scroll-spy de 6.5 fonctionne toujours** sur cette section · `/preview` intact · `/` toujours **`○ (Static)`** au build.

## Tasks / Subtasks

- [ ] **Tâche 0 — Prérequis & décisions** (AC: 1, 3 ; pièges n°1, n°2, n°3)
  - [ ] 6.1 et 6.2 `done`. 🛑 **Décider et documenter** : tri par `sortOrder` conservé (AC3 prime) · affichage des années · sort du `avatarBySlug` (au minimum **protéger le cas `undefined`**).
- [ ] **Tâche 1 — Démonter le carrousel** (AC: 1, 4 ; piège n°1)
  - [ ] Supprimer `setInterval`, états survol/clic, listener `document`, **duplication `[...entries, ...entries]`**, `overflow-x-auto`, `mask-image` horizontal, `hover:-rotate-3`. 🛑 **Conserver `id="parcours"`**. Retirer la prop `indication` devenue mensongère.
- [ ] **Tâche 2 — Projeter les années** (AC: 1, 3 ; piège n°3)
  - [ ] Étendre `TestimonialEntry` et la projection de `Testimonials.tsx` avec `startYear`/`endYear`. Rendu « en cours » quand `endYear` est `null`. ❌ Ne pas modifier `lib/timeline.ts` ni le schéma.
- [ ] **Tâche 3 — Déroulé vertical** (AC: 1, 4 ; piège n°5)
  - [ ] Structure verticale, ligne + jalons. **Une seule colonne sur mobile.** Lisible **sans interaction**. Vérifier 375 px.
- [ ] **Tâche 4 — Ligne qui se remplit, jalons qui s'illuminent** (AC: 2 ; piège n°4)
  - [ ] `useScroll` (`target`/`offset`) + `scaleY` avec `transform-origin: top`, dégradé d'accent tokenisé (6.1). `IntersectionObserver` par jalon. ❌ Jamais `height`. ⚠️ Vérifier l'absence de doublon avec le reveal de 6.4.
- [ ] **Tâche 5 — Mouvement réduit** (AC: 5 ; piège n°6)
  - [ ] `useReducedMotion` → **état final directement** : ligne pleine, jalons illuminés, aucun observateur. Réactif à la bascule.
- [ ] **Tâche 6 — Non-régression** (piège n°7)
  - [ ] `#parcours` atteignable (1.1) · **scroll-spy 6.5** OK · `/preview` OK (5.11) · `Card.tsx` non modifié · fichiers **non renommés**.
- [ ] **Tâche 7 — Vérification locale** (AC: 1-5 ; piège n°8)
  - [ ] Les 5 AC un par un, dont **ordre comparé à `/admin/timeline/order`**, entrée **sans `endYear`**, **375 px**, reduced-motion.
- [ ] **Tâche 8 — Definition of Done** (AGENTS.md §8)
  - [ ] `bun run lint` 0 / `bunx tsc --noEmit` 0 / `bun run build` OK (**marqueur `○ (Static)` de `/`**). Vérification visuelle **avec et sans** reduced-motion, **et à 375 px**.
  - [ ] `git diff DEV` : section parcours uniquement. ❌ Aucune migration, aucun écran admin, **aucune dépendance**.
  - [ ] `File List` + `Completion Notes` + `Change Log` · `sprint-status.yaml`.

## Dev Notes

### Périmètre — verrouillé

**Remplacer le carrousel horizontal auto-défilant du parcours par un déroulé vertical lisible sans interaction, affichant enfin les années déjà présentes en base (`startYear`/`endYear`, « aujourd'hui » quand la fin est nulle), avec une ligne qui se remplit au défilement (`useScroll` + `scaleY`) et des jalons qui s'illuminent (`IntersectionObserver`), en conservant l'`id="parcours"`, le tri par `sortOrder` de l'administration, et en affichant directement l'état final rempli sous mouvement réduit.**

**Hors périmètre — ne pas faire :**
- ❌ **Oublier de supprimer la duplication `[...entries, ...entries]`** (chaque formation en double).
- ❌ **Perdre `id="parcours"`** (casse la navigation 1.1 et le scroll-spy 6.5).
- ❌ **Trier par `startYear`** en remplaçant `sortOrder` (annulerait l'écran de réordonnancement 5.14).
- ❌ **Modifier `lib/timeline.ts`, le schéma Prisma ou `/admin/timeline`**.
- ❌ **Renommer `Testimonials*.tsx`** (le nom ment, mais le renommer déborde).
- ❌ **Laisser la prop `indication`** qui décrit un carrousel disparu.
- ❌ **Ligne figée à `scaleY(0)`** sous reduced-motion (déroulé vide = échec AC5).
- ❌ **Animer `height`** · alternance gauche/droite **sur mobile** · `Card.tsx` modifié · cartes projet (6.8), hero (6.7), **nouvelle dépendance**.

### Le vrai enjeu

C'est la story de l'Epic 6 où l'on **retire** le plus de code, et la faute la plus probable est d'en oublier un morceau : la **duplication des entrées** existe uniquement pour donner l'illusion d'un carrousel infini ; conservée dans un déroulé vertical, elle affiche **chaque formation deux fois**. Le second enjeu est de découvrir que **les années sont déjà en base et n'ont jamais été affichées** — `startYear`/`endYear` existent depuis la story 5.14, le conteneur ne les projette pas, et un « déroulé chronologique » sans dates ne remplit pas son AC. Le troisième est un **conflit apparent entre AC1 (chronologique) et AC3 (ordre d'administration)** : la résolution est de garder `sortOrder`, parce que le retirer casserait l'écran de réordonnancement livré en 5.14 — et de laisser les années, affichées, porter la lecture chronologique. Enfin AC5 ne dit pas « sans animation » mais « **complet et rempli** » : une ligne neutralisée à zéro serait un déroulé vide.

### Testing standards

Vérification **manuelle** des 5 AC : lecture **sans aucune interaction**, unicité des entrées, remplissage de la ligne au défilement, **comparaison de l'ordre avec `/admin/timeline/order`**, cas d'une entrée **sans `endYear`**, rendu **à 375 px** sans défilement horizontal, reduced-motion (procédure de 6.2) avec ligne **pleine**. Plus les non-régressions : ancre `#parcours`, scroll-spy de 6.5, `/preview`. `lint`/`tsc`/`build` verts, `/` toujours `○ (Static)`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.9]
- [Source: PLAN_REFONTE_2026.md §4.2 — P2 n°8 (timeline verticale animée, ligne qui se remplit, jalons illuminés, remplace le carrousel horizontal)]
- [Source: AGENTS.md §6 — a11y non négociable ; §9 — périmètre verrouillé, zéro dépendance]
- [Source: apps/web/src/sections/TestimonialsClient.tsx:41-101 — carrousel à démonter (setInterval, états survol/clic, listener document) ; :104 — `id="parcours"` À CONSERVER ; :110 — prop `indication` à retirer ; :119 — duplication `[...entries, ...entries]` À SUPPRIMER ; :21-27 — `avatarBySlug` (5 slugs en dur, `undefined` non protégé) ; :123 — `hover:-rotate-3`]
- [Source: apps/web/src/sections/Testimonials.tsx:13-18 — projection actuelle SANS `startYear`/`endYear` : à étendre]
- [Source: apps/web/prisma/schema.prisma — `TimelineEntry.startYear: Int`, `endYear: Int?` (« exprime *poste toujours en cours* », story 5.14 AC1), `avatarId`/`avatar` (Media), `sortOrder`, `published`]
- [Source: apps/web/src/lib/timeline.ts:16-35 — `getPublishedTimeline()` : `published: true` + `orderBy: sortOrder` — NE PAS MODIFIER]
- [Source: _bmad-output/implementation-artifacts/1-1-*.md — ancre `#parcours` ; 6-5-*.md — scroll-spy adossé aux `id` de section]
- [Source: apps/web/src/app/preview/page.tsx — second rendu de la section (story 5.11)]
- [Source: apps/web/src/app/globals.css:103-121 — règle globale reduced-motion]
- [Source: apps/web/package.json — `motion` ^12.42.2 déjà présent]

## Dev Agent Record

### Agent Model Used

### Completion Notes

### File List

### Change Log
