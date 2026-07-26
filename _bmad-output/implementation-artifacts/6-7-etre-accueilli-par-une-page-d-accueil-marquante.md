---
baseline_commit: c408eae7818fb33ef915a70085775688fbf80640
---

# Story 6.7: Être accueilli par une page d'accueil marquante

Status: ready-for-dev

## Story

As **recruteur**,
I want **une première impression forte en arrivant sur le site**,
so that **je retienne le portfolio parmi tous ceux que je consulte**.

## Acceptance Criteria

**AC1 — Parallaxe des orbites à la souris**
**Given** les orbites animées de l'accueil sont l'élément reconnaissable du site
**When** je déplace ma souris sur la zone d'accueil
**Then** les anneaux réagissent au pointeur par un léger décalage de profondeur
**And** l'effet reste subtil, sans donner le tournis

**AC2 — Rôle défilant avec effet de frappe**
**Given** le rôle est aujourd'hui un texte fixe
**When** la page d'accueil s'affiche
**Then** le rôle défile entre plusieurs intitulés avec un effet de frappe
**And** le texte alterné est annoncé de façon compréhensible aux technologies d'assistance, sans les inonder de mises à jour

**AC3 — Performance perçue**
**Given** la zone d'accueil détermine la performance perçue
**When** je mesure le chargement
**Then** l'élément principal s'affiche rapidement et la mise en page ne saute pas

**AC4 — Mouvement réduit : tout est figé**
**Given** le réglage de mouvement réduit est actif
**When** j'arrive sur la page
**Then** les orbites sont immobiles, le parallaxe est désactivé et le rôle s'affiche fixe, sans effet de frappe

## Contexte d'implémentation

### 🛑 Prérequis : stories 6.1 (tokens), 6.2 (socle motion) `done`

AC4 s'appuie sur le **socle de neutralisation** de 6.2. Les couleurs d'accent (`emerald-300`) doivent passer par les **tokens 6.1**. PLAN §4.2 (P2 n°6 : « garder les orbites mais y ajouter un parallaxe à la souris + typing effect sur le rôle »).

### 🎯 Ce que fait vraiment cette story

`Hero.tsx` est un **Server Component `async`** de 147 lignes qui **lit la base** (`getHeroSettings()`, story 4.3) et rend **11 `HeroOrbit`** + 4 `hero-ring`. Cette story y ajoute deux effets : un **parallaxe au pointeur** sur les anneaux (AC1) et un **rôle défilant en effet de frappe** (AC2), sans dégrader le LCP (AC3) ni survivre au mouvement réduit (AC4).

### 🛑 Piège n°1 (LE PLUS DANGEREUX) — `Hero.tsx` est `async` : y poser `"use client"` casse le build

- 🛑 `Hero.tsx` ligne 12 : `export const HeroSection = async () => { const {...} = await getHeroSettings(); }`. C'est un Server Component **qui lit la base**. ❌ **Ajouter `"use client"` en tête de ce fichier est une erreur immédiate** : un Client Component ne peut pas être `async`, et l'appel Prisma (`server-only`) exploserait au build.
- ✅ Appliquer **le pattern déjà établi dans le dépôt** — `Testimonials.tsx` (serveur, lit la base) → `TestimonialsClient.tsx` (`"use client"`, reçoit tout en props), le même qu'`About`/`AboutClient` et `Contact`/`ContactClient`. Le conteneur `Hero.tsx` **reste serveur et `async`**, et **délègue** les parties interactives à des composants clients enfants alimentés en props.
- ⚠️ Conséquence : `getHeroSettings()` **reste dans `Hero.tsx`**. Les Client Components reçoivent `title`/`subtitle`/`statusBadge` en props — ils ne lisent **jamais** la base (AGENTS.md §6).
- ⚠️ Contrôler au build que `/` reste **`○ (Static, 1h)`** — garde-fou documenté dans `page.tsx:20-29`.

### ⚠️ Piège n°2 (CENTRAL) — AC2 : d'où vient la liste des rôles ?

- 🛑 **Le texte du hero est piloté par la base depuis la story 4.3.** `getHeroSettings()` renvoie `{ title, subtitle, statusBadge }` — **il n'existe AUCUNE clé « rôles »** dans `SETTING_KEYS` (`lib/settings.ts`). Le « rôle » d'aujourd'hui, c'est le `subtitle` (rendu ligne 122-124) ou le `title` : **un texte unique, administrable**.
- 🛑 **Décision à prendre et à documenter** (ne pas trancher en silence) — trois options, par ordre de moindre débordement :
  1. ✅ **Liste en dur dans le composant** (« Développeur Full-Stack » / « UI Engineer » / « Créatif », PLAN §4.2 n°6). Aucun changement de schéma, aucune migration, aucun écran d'administration. **Recommandé** : c'est le périmètre exact de l'AC.
  2. ⚠️ Nouvelle clé `SiteSetting` contenant les rôles séparés par un séparateur. **Coûteux** : migration + champ dans `settings-form.tsx` = story 5.16 rouverte, **hors périmètre**.
  3. ❌ Nouveau modèle Prisma. Absolument hors périmètre.
- 🛑 **Ne PAS écraser le contenu administrable.** Si le rôle défilant remplace `subtitle`, le texte que Jeevons a saisi en administration (story 4.3 / 5.16) **disparaît de l'écran** — régression silencieuse d'une fonctionnalité livrée. ✅ Le rôle défilant doit être un élément **ajouté**, ou remplacer un texte dont on **assume et documente** la disparition. Vérifier ce que valent réellement `title`/`subtitle` en base avant de décider.

### ⚠️ Piège n°3 — AC2 : l'annonce aux technologies d'assistance, « sans les inonder »

- 🛑 C'est la partie **la plus facile à rater**. Un effet de frappe modifie le DOM **caractère par caractère**. Avec un `aria-live="polite"` posé naïvement sur le conteneur, un lecteur d'écran annonce **chaque lettre** : « D… Dé… Dév… » — exactement l'inondation que l'AC interdit.
- ✅ Le pattern correct : **deux nœuds**.
  - Le texte animé est **`aria-hidden="true"`** — purement visuel, il n'existe pas pour les technologies d'assistance.
  - Un nœud **visuellement caché mais lisible** (`sr-only`) porte le **rôle complet**, mis à jour **une seule fois** par intitulé (pas par caractère).
- ⚠️ Alternative encore plus sûre et parfaitement conforme à l'AC : **ne rien annoncer du tout en direct** — un unique texte statique, non animé, contenant l'ensemble des rôles (« Développeur Full-Stack, UI Engineer, Créatif ») en `sr-only`. Zéro mise à jour = zéro inondation. ✅ Cette option est **acceptable et recommandée** si le doute persiste.
- 🛑 ❌ **Ne pas mettre `aria-live="assertive"`** : il interrompt la lecture en cours. Si live il y a, c'est `polite`.
- ⚠️ Le rôle est probablement dans un `<h1>` ou à côté (`Hero.tsx:119-124`) : le `<h1>` doit **toujours contenir un texte stable et sensé** pour le SEO et les lecteurs d'écran. ❌ Ne pas laisser le `<h1>` se vider entre deux intitulés.

### ⚠️ Piège n°4 — AC3 : LCP et CLS, l'AC la plus mesurable de la story

- 🛑 « l'élément principal s'affiche rapidement » = **LCP**. « la mise en page ne saute pas » = **CLS**. Cibles du projet : **LCP < 2 s, CLS < 0,05** (PLAN §4.4). Ce ne sont pas des vœux — ce sont les seuils de l'AC.
- 🛑 **Le piège CLS de l'effet de frappe** : un texte qui grandit lettre par lettre **change la largeur de son conteneur** à chaque frame. Si le bloc n'a pas de place réservée, tout ce qui suit **saute en permanence** — CLS catastrophique. ✅ Réserver la place : `min-height` sur la ligne, largeur stable (par exemple un conteneur dimensionné sur l'intitulé **le plus long**, ou l'intitulé le plus long rendu en `invisible` par-dessous). ⚠️ Le rôle est **centré** (`text-center`) : un texte qui s'allonge au centre décale **les deux côtés**. À vérifier explicitement.
- ⚠️ **LCP** : l'élément LCP du hero est probablement le `<h1>` (`Hero.tsx:119`) ou l'avatar `memojiImage` (ligne 106). ❌ Si le `<h1>` devient un texte animé qui commence **vide**, le LCP se **dégrade mécaniquement** (le navigateur n'a rien à peindre). Autre raison de garder le `<h1>` statique.
- ⚠️ L'avatar (`Image` ligne 106-110) n'a **pas de `priority`** aujourd'hui : s'il s'avère être l'élément LCP, l'ajout de `priority` est **dans le périmètre d'AC3**. À mesurer, pas à supposer.
- ⚠️ **11 orbites animées en permanence** + parallaxe : mesurer sur un profil CPU ralenti. Si le parallaxe fait chuter le taux d'images, **réduire la portée** (n'animer que les 4 `hero-ring`, ou un conteneur unique) plutôt que d'accepter des saccades.

### ⚠️ Piège n°5 — AC1 : parallaxe « subtil, sans donner le tournis »

- ✅ `motion` v12 est **déjà installé** — `useMotionValue` + `useSpring` + `useTransform`. **Zéro nouvelle dépendance.**
- 🛑 ❌ Ne pas écrire dans un state React à chaque `pointermove` (des centaines de rendus par seconde). Même règle qu'en 6.6 : valeurs de mouvement hors cycle de rendu, `transform` uniquement.
- ⚠️ « **sans donner le tournis** » est un critère d'acceptation : amplitude **de quelques pixels**, mouvement amorti (`useSpring`), **pas** de rotation 3D agressive. Décalages **différenciés** par anneau (les plus grands bougent moins) pour la profondeur.
- 🛑 `HeroOrbit` rend un `<i aria-hidden="true">` en `absolute … -z-20`, et les `hero-ring` sont en `-z-30` — le tout dans un conteneur `pointer-events-none` (`Hero.tsx:19`). ✅ **Conserver `pointer-events-none`** : les orbites ne doivent jamais capter un clic destiné aux CTA. Le listener de parallaxe se pose donc sur **la section** ou sur `window`, jamais sur les orbites.
- ⚠️ `HeroOrbit` compose déjà **trois `transform` imbriqués** (`rotate` de conteneur, `animate-spin`, `rotate` inverse). Ajouter un `transform` de parallaxe **sur ces mêmes nœuds écraserait** les rotations existantes. ✅ Envelopper : appliquer le parallaxe sur un **conteneur parent**, laisser `HeroOrbit` intact.
- ⚠️ AC1 dit « quand je déplace ma souris **sur la zone d'accueil** » : l'effet est **borné au hero**, il ne suit pas la souris sur toute la page. Nettoyer le listener au démontage.

### ⚠️ Piège n°6 — AC4 : les orbites doivent devenir IMMOBILES

- 🛑 AC4 exige que **« les orbites sont immobiles »**. ⚠️ Les orbites tournent via `animate-spin` avec `animationDuration` en style inline (34s à 52s, `HeroOrbit.tsx:26-29` et `:40-43`). La règle globale de 6.2 met `animation-duration: 0.01ms !important` + `animation-iteration-count: 1` → l'animation **saute à son état final et s'arrête**. ✅ C'est bien « immobile » — **mais le vérifier à l'œil**, car un `animation-duration` inline pourrait, selon l'ordre de cascade, l'emporter. Le commentaire de `globals.css:104` affirme la primauté ; **contrôler visuellement** plutôt que supposer.
- ✅ **Parallaxe** : `useReducedMotion()` → aucun listener, aucun `transform`. Ne pas se contenter de la neutralisation CSS.
- 🛑 **Effet de frappe** : sous reduced-motion, le rôle **s'affiche fixe**. ❌ Pas « il défile instantanément », ❌ pas « il disparaît » — **un intitulé, affiché en entier, définitivement**. Un `setInterval` neutralisé par CSS continuerait de tourner : c'est du **JavaScript**, la règle CSS de 6.2 ne l'atteint pas. ✅ Il faut un `if (shouldReduceMotion) return;` explicite avant de démarrer le minuteur.
- ⚠️ `useReducedMotion` est **réactif** : basculer le réglage sans recharger doit arrêter le défilement. Le nettoyage du `setInterval`/`setTimeout` dans le `useEffect` est obligatoire.

### ⚠️ Piège n°7 — Périmètre

- ❌ **Hors périmètre** : boutons magnétiques et curseur custom (6.6, même si les CTA du hero y sont touchés — **deux stories, deux branches**) · cartes projet (6.8) · timeline (6.9) · pages projet (6.10) · header/barre de progression (6.5) · reveal (6.4) · **nouvelle clé de réglage ou migration Prisma** (piège n°2) · admin · **toute nouvelle dépendance**.
- ⚠️ Les stories 6.3 (typographie fluide) et 6.4 (reveal) ont pu toucher `Hero.tsx` : **relire l'état réel du fichier** avant de le refondre.
- ⚠️ Le hero rend `grainImage` en fond (ligne 19-25) et un `mask-image` : ne pas les casser en réorganisant le DOM.

### ⚠️ Piège n°8 — Vérification locale, les 4 AC

- **AC1** : déplacer la souris sur le hero → décalage **subtil** et différencié des anneaux ; sortir du hero → retour au repos. 🛑 Vérifier que les **CTA restent cliquables** (`pointer-events-none` préservé).
- **AC2** : le rôle défile entre les intitulés avec effet de frappe. 🛑 **Test décisif a11y** : inspecter le DOM — le texte animé est `aria-hidden`, et le rôle est disponible **une fois** pour les lecteurs d'écran, pas lettre par lettre. Vérifier que le `<h1>` n'est **jamais vide**.
- **AC3** : Lighthouse en local — **LCP < 2 s**, **CLS < 0,05**. 🛑 Regarder le hero pendant la frappe : **rien ne doit sauter** sous le rôle. Identifier l'élément LCP réel dans l'onglet Performance.
- **AC4** : reduced-motion activé (procédure de 6.2) → orbites **immobiles à l'œil**, aucun parallaxe, rôle **fixe et complet**. Basculer le réglage sans recharger : le défilement doit s'arrêter.
- 🛑 Build : `/` toujours **`○ (Static)`**, et `Hero.tsx` **toujours `async` sans `"use client"`**.

## Tasks / Subtasks

- [ ] **Tâche 0 — Prérequis & décision sur la source des rôles** (AC: 2 ; pièges n°1, n°2)
  - [ ] 6.1 et 6.2 `done`. 🛑 **Décider et documenter** : liste en dur (recommandé) vs clé de réglage. Vérifier ce que valent `title`/`subtitle` en base et **ne rien écraser** sans le dire.
- [ ] **Tâche 1 — Extraction client sans casser le Server Component** (AC: 1, 2 ; piège n°1)
  - [ ] `Hero.tsx` **reste serveur `async`** avec `getHeroSettings()`. Créer le(s) enfant(s) `"use client"` alimentés **en props**, sur le modèle `Testimonials`/`TestimonialsClient`.
- [ ] **Tâche 2 — Parallaxe des orbites** (AC: 1, 4 ; pièges n°5, n°6)
  - [ ] `useMotionValue`/`useSpring` de `motion` sur un **conteneur enveloppant** (jamais sur les `transform` de `HeroOrbit`). Amplitude subtile, différenciée. `pointer-events-none` conservé. Listener borné au hero et nettoyé.
- [ ] **Tâche 3 — Rôle défilant + effet de frappe** (AC: 2, 3, 4 ; pièges n°2, n°3, n°4, n°6)
  - [ ] Texte animé `aria-hidden="true"` + rôle lisible **une seule fois** en `sr-only`. `<h1>` jamais vide. **Place réservée** (largeur/hauteur stables, texte centré) contre le CLS. `if (shouldReduceMotion) return;` **avant** de démarrer le minuteur ; nettoyage au démontage.
- [ ] **Tâche 4 — Performance** (AC: 3 ; piège n°4)
  - [ ] Mesurer LCP/CLS. Identifier l'élément LCP réel ; `priority` sur l'avatar **si** c'est lui. Profiler avec CPU ralenti ; réduire la portée du parallaxe si le taux d'images chute.
- [ ] **Tâche 5 — Mouvement réduit** (AC: 4 ; piège n°6)
  - [ ] Vérifier **à l'œil** que les orbites `animate-spin` sont bien immobiles. Parallaxe et frappe coupés **en JavaScript**, pas seulement en CSS. Réactivité au changement de réglage.
- [ ] **Tâche 6 — Vérification locale** (AC: 1-4 ; piège n°8)
  - [ ] Les 4 AC un par un, inspection DOM de l'annonce a11y, Lighthouse (LCP/CLS), reduced-motion, clavier.
- [ ] **Tâche 7 — Definition of Done** (AGENTS.md §8)
  - [ ] `bun run lint` 0 / `bunx tsc --noEmit` 0 / `bun run build` OK (**marqueur `○ (Static)` de `/`**). Vérification visuelle **avec et sans** reduced-motion.
  - [ ] `git diff DEV` : hero uniquement. ❌ Aucune migration Prisma, aucun écran admin, **aucune dépendance**.
  - [ ] `File List` + `Completion Notes` + `Change Log` · `sprint-status.yaml`.

## Dev Notes

### Périmètre — verrouillé

**Ajouter au hero un parallaxe subtil des anneaux au pointeur et un rôle défilant en effet de frappe, en gardant `Hero.tsx` Server Component `async` (extraction client en enfants alimentés en props, pattern `Testimonials`/`TestimonialsClient`), sans dégrader LCP/CLS, avec une annonce accessible du rôle qui n'inonde pas les lecteurs d'écran, et une neutralisation JavaScript — pas seulement CSS — sous mouvement réduit.**

**Hors périmètre — ne pas faire :**
- ❌ **`"use client"` sur `Hero.tsx`** (il est `async` et lit la base — build cassé).
- ❌ **Migration Prisma ou nouvelle clé de réglage** pour la liste des rôles.
- ❌ **Écraser le texte administrable** (`title`/`subtitle`, stories 4.3/5.16) sans le documenter.
- ❌ **Annoncer la frappe lettre par lettre** en `aria-live` (inondation) · **`aria-live="assertive"`** · **`<h1>` vide**.
- ❌ **Effet de frappe sans place réservée** (CLS) · appliquer le parallaxe **sur les `transform` de `HeroOrbit`** · retirer `pointer-events-none`.
- ❌ **Neutraliser la frappe par CSS seule** (le `setInterval` continuerait).
- ❌ Magnetic buttons et curseur (6.6), cartes (6.8), timeline (6.9), pages projet (6.10), **nouvelle dépendance**.

### Le vrai enjeu

Trois pièges structurels. Le premier est **de construction** : `Hero.tsx` est `async` et lit la base — le réflexe « j'ajoute `"use client"` pour animer » casse le build immédiatement ; le dépôt a déjà la réponse avec le couple `Testimonials`/`TestimonialsClient`. Le deuxième est **de périmètre** : le PLAN donne trois intitulés de rôle, mais le texte du hero est administrable depuis la story 4.3 — il faut décider explicitement d'où viennent ces rôles sans rouvrir une migration ni faire disparaître en silence ce que Jeevons a saisi. Le troisième est **d'accessibilité et de performance combinées** : un effet de frappe naïf annonce chaque lettre aux lecteurs d'écran **et** fait sauter la mise en page à chaque caractère — deux échecs d'AC (2 et 3) pour une seule ligne de code manquante.

### Testing standards

Vérification **manuelle** des 4 AC : parallaxe à la souris (CTA toujours cliquables), inspection **DOM** de l'annonce du rôle, **Lighthouse** local pour LCP < 2 s / CLS < 0,05, reduced-motion (procédure de 6.2) avec contrôle **visuel** de l'immobilité des orbites et bascule à chaud du réglage. `lint`/`tsc`/`build` verts, `/` toujours `○ (Static)`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.7]
- [Source: PLAN_REFONTE_2026.md §4.2 — P2 n°6 (orbites + parallaxe souris, typing effect « Développeur Full-Stack » / « UI Engineer » / « Créatif ») ; §4.4 — LCP < 2 s, CLS < 0,05, reduced-motion]
- [Source: AGENTS.md §6 — logique de données côté Server Components, `"use client"` seulement si l'interactivité l'impose ; a11y non négociable ; §9 — zéro dépendance]
- [Source: apps/web/src/sections/Hero.tsx:12-13 — Server Component `async` + `getHeroSettings()` ; :19-103 — 4 `hero-ring` + 11 `HeroOrbit` sous `pointer-events-none` ; :106-124 — avatar (sans `priority`), `<h1>`, `subtitle`]
- [Source: apps/web/src/components/HeroOrbit.tsx:20-57 — `<i aria-hidden>` en `-z-20`, trois `transform` imbriqués, `animationDuration` inline]
- [Source: apps/web/src/sections/Testimonials.tsx + TestimonialsClient.tsx — PATTERN de référence conteneur serveur → vue client en props]
- [Source: apps/web/src/lib/settings.ts:145-164 — `getHeroSettings()` ne renvoie que `title`/`subtitle`/`statusBadge` : aucune clé « rôles »]
- [Source: apps/web/src/app/globals.css:12-14 — `.hero-ring` ; :103-121 — règle globale reduced-motion]
- [Source: apps/web/src/app/page.tsx:18-29 — `revalidate = 3600` et garde-fou anti-rendu-dynamique]

## Dev Agent Record

### Agent Model Used

### Completion Notes

### File List

### Change Log
