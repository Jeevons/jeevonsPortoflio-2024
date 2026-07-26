---
baseline_commit: c408eae7818fb33ef915a70085775688fbf80640
---

# Story 6.8: Explorer les cartes de projet

Status: ready-for-dev

## Story

As **visiteur du portfolio**,
I want **que les cartes de projet réagissent quand je les survole**,
so that **l'exploration soit engageante**.

## Acceptance Criteria

**AC1 — Inclinaison 3D + halo suivant le curseur, ancien agrandissement retiré**
**Given** les cartes grandissent aujourd'hui brutalement au survol
**When** je survole une carte à la souris
**Then** elle s'incline légèrement en suivant la position du pointeur
**And** un halo lumineux suit le curseur sur sa surface
**And** l'ancien effet d'agrandissement est retiré

**AC2 — Retour au repos sans à-coup**
**Given** je m'éloigne de la carte
**When** le pointeur en sort
**Then** elle revient à sa position d'origine sans à-coup

**AC3 — Clavier et tactile : mise en évidence sans pointeur**
**Given** je navigue au clavier ou sur écran tactile
**When** j'atteins une carte
**Then** un état de mise en évidence lisible est présenté, sans dépendre du pointeur

**AC4 — Mouvement réduit : ni inclinaison ni halo**
**Given** le réglage de mouvement réduit est actif
**When** je survole une carte
**Then** ni inclinaison ni halo ne s'appliquent

## Contexte d'implémentation

### 🛑 Prérequis : stories 6.1 (tokens), 6.2 (socle motion) `done`

Le halo (AC1) utilise le **dégradé d'accent tokenisé** en 6.1. AC4 s'appuie sur le **socle de neutralisation** de 6.2. PLAN §4.2 (P2 n°7 : « cartes projet en 3D tilt (`rotateX/rotateY` sur mousemove) + spotlight radial suivant le curseur — remplace le `hover:scale-110` actuel »).

### 🎯 Ce que fait vraiment cette story

Remplacer un survol brutal par un **tilt 3D** et un **halo radial** sur les cartes de projet, avec un état de mise en évidence **au clavier et au tactile** (AC3) et une neutralisation complète sous mouvement réduit (AC4). L'ossature existe déjà : `ProjectCard.tsx` (vue pure, sans `"use client"`) consommée par `ProjectList.tsx` (empilement `sticky`).

### 🛑 Piège n°1 (LE PLUS DANGEREUX) — `ProjectCard` est partagé avec l'aperçu admin

- 🛑 `ProjectCard.tsx` porte un **commentaire d'architecture explicite** (lignes 6-23) : il a été extrait en story 5.9 **précisément pour que l'aperçu de l'éditeur admin rende la MÊME carte que le site public**. Il est importé par `ProjectList.tsx` (public) **et par `project-preview.tsx`** (`/admin/projects`).
- 🛑 Le commentaire ligne 18 est catégorique : « **AUCUN `"use client"` ici, et c'est délibéré** ». ❌ Poser `"use client"` sur `ProjectCard.tsx` violerait une décision d'architecture documentée **et** ferait basculer le rendu de la carte côté client sur le site public.
- ✅ **Deux options, à trancher et documenter** :
  1. ✅ **Recommandé** — envelopper la carte dans un **conteneur client** créé par `ProjectList.tsx` (qui, lui, peut devenir client ou déléguer à un enfant client). `ProjectCard` reste une vue pure serveur ; l'interactivité vit dans l'enveloppe. L'aperçu admin continue d'utiliser `ProjectCard` **sans** l'enveloppe — cohérent : un aperçu statique n'a pas besoin de tilt.
  2. ⚠️ Rendre `ProjectCard` client. **Casse la décision 5.9** — à ne faire que si l'option 1 est impossible, et alors à justifier par écrit.
- ⚠️ 🛑 **Vérifier `project-preview.tsx` après implémentation** : si l'aperçu admin se met à afficher un tilt, ou pire, casse, c'est une régression sur une story livrée (5.9 AC3).

### 🛑 Piège n°2 (CENTRAL) — Le tilt 3D contre l'empilement `sticky`

- 🛑 `ProjectList.tsx:50-55` : chaque carte est `sticky` avec `top: calc(64px + ${projectIndex * 40}px)`. Les cartes **s'empilent en défilant** — c'est l'effet signature de la section, il **doit survivre**.
- 🛑 **Le piège** : un tilt 3D exige un contexte `perspective` sur le **parent**, et applique `transform: rotateX/rotateY` sur l'enfant. Or **`transform` sur un ancêtre crée un nouveau conteneur de bloc englobant** qui peut **neutraliser `position: sticky`** du descendant. Poser la `perspective` ou un `transform` au mauvais niveau **casse l'empilement** — la régression la plus probable de cette story, et elle ne se voit qu'en faisant défiler.
- ✅ Structurer avec soin : la `perspective` sur un conteneur qui **n'est pas** l'ancêtre du `sticky`, ou le `sticky` porté par le nœud qui reçoit lui-même le `transform`. 🛑 **Tester l'empilement à chaque itération**, pas seulement à la fin.
- ⚠️ La carte porte `overflow-hidden` (`Card.tsx:13`) — utile pour contenir le halo, mais un tilt 3D avec `overflow-hidden` peut **écrêter** les bords. Vérifier visuellement.
- ⚠️ `Card.tsx` rend un pseudo-élément `after:` en `outline` (le liseré corrigé en story 1.8) : il s'incline avec la carte, ce qui est correct — mais **ne pas le supprimer** en réorganisant.

### ⚠️ Piège n°3 — AC1 : « l'ancien effet d'agrandissement est retiré » — lequel exactement ?

- 🛑 Inventaire des agrandissements existants, à vérifier soi-même :
  - `ProjectCard.tsx:149` — le bouton **« Visiter le site »** porte `hover:scale-110 transform transition duration-300 ease-in-out`. ✅ **C'est bien un `hover:scale`**, mais il est sur **le bouton**, pas sur la carte.
  - `TestimonialsClient.tsx:123` — les cartes de parcours portent `hover:-rotate-3 transition` : ❌ **hors périmètre**, elles relèvent de la story 6.9.
- 🛑 **Décision à prendre et documenter** : l'AC1 vise « les cartes grandissent aujourd'hui brutalement au survol ». Si aucun `hover:scale` n'est trouvé **sur la carte elle-même**, le seul candidat dans le périmètre est le `hover:scale-110` du bouton « Visiter le site ». ⚠️ Ce bouton est le résultat de la **story 1.4** (« Réparer le bouton Visiter le site ») : retirer son agrandissement est **acceptable** au titre d'AC1, mais **ne doit pas toucher à son `href`, son `target`, son `rel`, ni son `aria-label`** — ce serait annuler la story 1.4.
- ✅ Le remplacement est explicite dans le PLAN : le tilt + spotlight **remplacent** l'agrandissement. Après cette story, **plus aucun `hover:scale` sur la carte projet ni son bouton**.

### ⚠️ Piège n°4 — AC3 : l'AC la plus facile à oublier

- 🛑 AC3 exige « un **état de mise en évidence lisible**, **sans dépendre du pointeur** ». Le tilt et le halo sont pilotés par `pointermove` : **au clavier et au tactile, la carte n'aurait strictement aucun retour visuel** — échec d'AC3 si rien n'est prévu.
- ✅ Ajouter un état **non lié au pointeur** : `:focus-within` sur la carte (elle contient un lien focusable — le bouton « Visiter le site ») qui produit une mise en évidence lisible (bordure accentuée, halo statique, élévation). ⚠️ `:focus-within` couvre le clavier ; pour le tactile, `:active` ou un `@media (hover: none)` avec une mise en évidence permanente.
- 🛑 « **lisible** » = **contraste AA**, et l'information ne repose **pas sur la seule couleur** (AGENTS.md §6, WCAG 1.4.1). Un simple changement de teinte du liseré ne suffit pas : ajouter un signal de forme ou d'épaisseur.
- ⚠️ ❌ Ne pas rendre la carte entière focusable (`tabIndex={0}`) pour « avoir un focus » : ce serait ajouter un arrêt de tabulation sur un élément non interactif, une régression d'accessibilité. Le focus vient du lien qu'elle contient.
- ⚠️ Toutes les cartes n'ont **pas** de bouton : `project.link` peut être vide (`ProjectCard.tsx:143`) → **aucun élément focusable**, donc `:focus-within` ne se déclenche jamais. ✅ L'état tactile/`hover: none` doit couvrir ce cas.

### ⚠️ Piège n°5 — AC4 et détection du pointeur

- ✅ **AC4** : `useReducedMotion()` (socle 6.2) → **ni tilt ni halo**, aucun listener, aucun `transform`. ⚠️ La règle CSS globale de 6.2 neutralise les *transitions* : elle **n'empêche pas** un `transform` piloté en JavaScript de s'appliquer. Il faut un test explicite en JavaScript.
- ⚠️ Comme en 6.6, l'effet n'a de sens qu'avec un **pointeur fin** : conditionner à `(hover: hover) and (pointer: fine)`, **défaut désactivé**, activation après montage. Sur tactile, c'est l'état d'AC3 qui prend le relais.
- 🛑 ❌ Ne pas écrire dans un state React à chaque `pointermove` (un rendu par mouvement → saccades). ✅ `useMotionValue`/`useSpring` de `motion` (**déjà installé, zéro dépendance**) — `useSpring` donne aussi le retour « **sans à-coup** » exigé par AC2.
- ⚠️ Mesurer la carte (`getBoundingClientRect`) **à l'entrée** du pointeur, pas à chaque mouvement (layout thrashing). ⚠️ Attention : les cartes sont `sticky` — leur position **change au défilement**. Si la mesure est prise une seule fois au montage, le halo sera **décalé** après défilement. ✅ Mesurer au `pointerenter`, qui se produit après tout défilement pertinent.
- ✅ Le halo se fait proprement par un `radial-gradient` positionné via des **variables CSS** mises à jour par les valeurs de mouvement — pas de nœud DOM supplémentaire, pas de re-rendu.

### ⚠️ Piège n°6 — Périmètre

- ⚠️ Les cartes sont rendues **deux fois** dans la page : `ProjectsSection` (`id="projects"`) et `SelfProjectsSection` (`id="side-projects"`), toutes deux via `ProjectList`. ✅ L'effet s'applique **aux deux** — c'est le même composant, et l'AC ne distingue pas.
- ❌ **Hors périmètre** : cartes de **parcours** (`TestimonialsClient.tsx`, `hover:-rotate-3`) → story 6.9 · `Card.tsx` utilisé aussi par `About`/hobbies → ne pas modifier le composant `Card` générique si l'effet peut vivre au-dessus · pages projet (6.10) · hero (6.7) · curseur/magnétisme (6.6) · header (6.5) · **admin** (`project-preview.tsx` ne doit pas changer de comportement) · **toute nouvelle dépendance**.
- 🛑 ⚠️ **`Card.tsx` est partagé** par `ProjectCard`, `TestimonialsClient` et `AboutClient`. Modifier `Card.tsx` propagerait l'effet à **toutes** les cartes du site — débordement. ✅ L'effet doit vivre dans le périmètre **carte projet**, pas dans `Card`.
- ⚠️ Les stories 6.3/6.4 ont pu toucher ces fichiers : **relire leur état réel** avant refonte.

### ⚠️ Piège n°7 — Vérification locale, les 4 AC

- **AC1** : survoler une carte → **inclinaison** suivant le pointeur + **halo** qui le suit sur la surface. 🛑 Vérifier qu'**aucun `hover:scale` ne subsiste** (`grep -rn "hover:scale" apps/web/src/components/ProjectCard.tsx apps/web/src/components/ProjectList.tsx`).
- **AC2** : sortir de la carte → retour à plat **amorti**, sans saut.
- **AC3** : 🛑 **au clavier seul** — Tab jusqu'au bouton « Visiter le site » : la carte présente un état de mise en évidence **lisible**. Vérifier **en niveaux de gris** (test décisif). Vérifier aussi une carte **sans lien** (`project.link` vide) et en **émulation tactile**.
- **AC4** : reduced-motion activé (procédure de 6.2) → **ni inclinaison ni halo**, la carte reste parfaitement utilisable.
- 🛑 **Test de non-régression n°1** : faire défiler la section projets — **l'empilement `sticky` fonctionne toujours** (piège n°2).
- 🛑 **Test de non-régression n°2** : ouvrir `/admin/projects/[id]` — **l'aperçu affiche toujours la carte correctement** (story 5.9 AC3).
- 🛑 Build : `/` toujours **`○ (Static)`**.

## Tasks / Subtasks

- [ ] **Tâche 0 — Prérequis & inventaire** (AC: 1 ; pièges n°1, n°3)
  - [ ] 6.1 et 6.2 `done`. Recenser les `hover:scale` **dans le périmètre carte projet**. 🛑 **Décider et documenter** : enveloppe client (recommandé) vs `ProjectCard` client. Vérifier les appelants (`ProjectList`, `project-preview.tsx`).
- [ ] **Tâche 1 — Tilt 3D sans casser le `sticky`** (AC: 1, 2 ; pièges n°2, n°5)
  - [ ] `perspective` + `rotateX/rotateY` placés de façon à **préserver `position: sticky`**. `useMotionValue`/`useSpring` de `motion`. Mesure au `pointerenter`. 🛑 **Tester l'empilement au défilement à chaque itération.**
- [ ] **Tâche 2 — Halo radial suivant le curseur** (AC: 1 ; pièges n°2, n°5)
  - [ ] `radial-gradient` piloté par variables CSS, dégradé d'accent tokenisé (6.1). Contenu par l'`overflow-hidden` de `Card`. Aucun nœud captant les clics.
- [ ] **Tâche 3 — Retrait de l'ancien agrandissement** (AC: 1 ; piège n°3)
  - [ ] Retirer `hover:scale-110` du bouton « Visiter le site ». ❌ **Ne pas toucher** à `href`/`target`/`rel`/`aria-label` (story 1.4).
- [ ] **Tâche 4 — Mise en évidence clavier & tactile** (AC: 3 ; piège n°4)
  - [ ] `:focus-within` + état tactile (`hover: none`). Contraste AA, signal **non chromatique**. ❌ Pas de `tabIndex` sur la carte. Couvrir le cas **carte sans lien**.
- [ ] **Tâche 5 — Mouvement réduit & pointeur** (AC: 4 ; piège n°5)
  - [ ] `useReducedMotion` → aucun listener, aucun `transform`, aucun halo (test **JavaScript**, pas seulement CSS). Détection `(hover: hover) and (pointer: fine)`, défaut désactivé.
- [ ] **Tâche 6 — Non-régression** (pièges n°1, n°2, n°6)
  - [ ] Empilement `sticky` intact · aperçu `/admin/projects/[id]` intact · `Card.tsx` **non modifié** (ou modification justifiée) · cartes de parcours et hobbies inchangées.
- [ ] **Tâche 7 — Vérification locale** (AC: 1-4 ; piège n°7)
  - [ ] Les 4 AC un par un, **clavier seul**, **niveaux de gris**, émulation tactile, reduced-motion, défilement complet de la section projets.
- [ ] **Tâche 8 — Definition of Done** (AGENTS.md §8)
  - [ ] `bun run lint` 0 / `bunx tsc --noEmit` 0 / `bun run build` OK (**marqueur `○ (Static)` de `/`**). Vérification visuelle **avec et sans** reduced-motion.
  - [ ] `git diff DEV` : carte projet uniquement. ❌ Aucune donnée, aucun écran admin modifié, **aucune dépendance**.
  - [ ] `File List` + `Completion Notes` + `Change Log` · `sprint-status.yaml`.

## Dev Notes

### Périmètre — verrouillé

**Remplacer l'agrandissement au survol des cartes projet par une inclinaison 3D suivant le pointeur et un halo radial, en préservant l'empilement `sticky` de `ProjectList` et la nature de vue pure serveur de `ProjectCard` (partagée avec l'aperçu admin, décision 5.9), avec un état de mise en évidence lisible au clavier et au tactile, et aucune inclinaison ni halo sous mouvement réduit.**

**Hors périmètre — ne pas faire :**
- ❌ **`"use client"` sur `ProjectCard.tsx`** (décision d'architecture 5.9 documentée dans le fichier) — sauf justification écrite.
- ❌ **Casser l'empilement `sticky`** en posant `perspective`/`transform` sur un ancêtre du `sticky`.
- ❌ **Modifier `Card.tsx`** (partagé par parcours et hobbies → débordement).
- ❌ **Toucher `href`/`target`/`rel`/`aria-label`** du bouton « Visiter le site » (story 1.4).
- ❌ **Oublier AC3** : sans état non-pointeur, clavier et tactile n'ont aucun retour visuel.
- ❌ **`tabIndex={0}` sur la carte** · état actif porté par la **seule couleur**.
- ❌ **Neutraliser par CSS seule** sous reduced-motion (le `transform` JavaScript passerait).
- ❌ Cartes de parcours (6.9), hero (6.7), curseur (6.6), pages projet (6.10), **nouvelle dépendance**.

### Le vrai enjeu

Deux régressions silencieuses guettent, et aucune des deux ne se voit en survolant une carte. La première est **structurelle** : un tilt 3D impose une `perspective` et un `transform` sur un ancêtre, et `transform` sur un ancêtre **neutralise `position: sticky`** — l'empilement des cartes, effet signature de la section, disparaîtrait sans qu'aucun test de survol ne le révèle. La seconde est **contractuelle** : `ProjectCard` a été extrait en 5.9 pour que l'aperçu admin rende exactement la carte publique, avec un « aucun `"use client"` ici, et c'est délibéré » écrit dans le fichier ; le réflexe d'y poser une directive client annule cette décision et touche un écran d'administration hors périmètre. Reste AC3, l'AC qu'on oublie : tout l'effet est piloté par le pointeur, donc **clavier et tactile n'obtiennent rien** si l'on ne prévoit pas explicitement un état de mise en évidence indépendant.

### Testing standards

Vérification **manuelle** des 4 AC : survol (tilt + halo, plus aucun `hover:scale`), sortie amortie, **clavier seul** et **émulation tactile** pour AC3 (contrôle **en niveaux de gris**), reduced-motion (procédure de 6.2). Plus **deux tests de non-régression obligatoires** : empilement `sticky` au défilement, et aperçu `/admin/projects/[id]`. `lint`/`tsc`/`build` verts, `/` toujours `○ (Static)`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.8]
- [Source: PLAN_REFONTE_2026.md §4.2 — P2 n°7 (3D tilt `rotateX/rotateY` + spotlight radial, « remplace le `hover:scale-110` actuel »)]
- [Source: AGENTS.md §6 — a11y non négociable (clavier, contrastes AA, info jamais portée par la seule couleur) ; §9 — zéro dépendance, périmètre verrouillé]
- [Source: apps/web/src/components/ProjectCard.tsx:6-23 — décision 5.9 : vue pure, « AUCUN `"use client"` ici, et c'est délibéré », partagée avec l'aperçu admin ; :143-154 — bouton « Visiter le site » avec `hover:scale-110` (story 1.4) ; :86 — `Card` englobante]
- [Source: apps/web/src/components/ProjectList.tsx:45-56 — empilement `sticky`, `top: calc(64px + index*40px)`]
- [Source: apps/web/src/components/Card.tsx:11-26 — `overflow-hidden`, pseudo-élément `after:` (liseré story 1.8), composant PARTAGÉ]
- [Source: apps/web/src/app/(admin)/admin/projects/project-preview.tsx — second consommateur de `ProjectCard` (story 5.9 AC3)]
- [Source: apps/web/src/sections/TestimonialsClient.tsx:123 — `hover:-rotate-3` sur les cartes de parcours : HORS PÉRIMÈTRE (story 6.9)]
- [Source: apps/web/src/app/globals.css:103-121 — règle globale reduced-motion (transitions, PAS les `transform` pilotés en JS)]
- [Source: apps/web/package.json — `motion` ^12.42.2 déjà présent]

## Dev Agent Record

### Agent Model Used

### Completion Notes

### File List

### Change Log
