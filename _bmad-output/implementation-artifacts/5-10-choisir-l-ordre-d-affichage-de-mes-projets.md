---
baseline_commit: 5c22f3a6c48914801d0a226ab5a0b15c005d8765
---

# Story 5.10: Choisir l'ordre d'affichage de mes projets

Status: review

## Story

As **Jeevons**,
I want **réordonner mes projets en les faisant glisser**,
so that **je mette en avant ce qui compte le plus, selon le poste que je vise**.

## Acceptance Criteria

**AC1 — Drag & drop optimiste + persistance**
**Given** je suis sur la liste des projets
**When** je fais glisser un projet à une autre position
**Then** l'interface reflète le nouvel ordre immédiatement, sans attendre le serveur
**And** l'ordre est persisté

**AC2 — Rollback en cas d'échec**
**Given** l'enregistrement de l'ordre échoue
**When** le serveur renvoie une erreur
**Then** l'interface revient à l'ordre précédent et m'informe de l'échec

**AC3 — Ordre reflété côté public**
**Given** j'ai réordonné mes projets
**When** je consulte le site public après revalidation
**Then** les projets y apparaissent dans l'ordre que j'ai défini

**AC4 — Réordonnancement accessible au clavier**
**Given** je navigue au clavier
**When** je veux réordonner un projet
**Then** un moyen accessible me le permet, sans obligation d'utiliser la souris

## Contexte d'implémentation

### 🛑 Prérequis : stories 5.8 (+ 5.9) `done`

5.8 a posé la liste des projets. 5.10 y ajoute le **tri drag & drop** persistant, optimiste, accessible. PLAN §3.2 (`/admin/projects` : tri drag & drop dnd-kit → persiste `sortOrder`) et §3.3 (`useOptimistic`).

### 🎯 Ce que fait vraiment cette story

Sur `/admin/projects` : glisser un projet → l'UI **réordonne immédiatement** (`useOptimistic`), la Server Action **persiste** `sortOrder`, avec **rollback** si le serveur échoue, propagation au public après `revalidateTag('projects')`, et un **moyen clavier** équivalent (a11y non négociable).

### ⚠️ Piège n°1 (CENTRAL) — `sortOrder` : recalcul cohérent, pas de collision

- Chaque `Project` a `sortOrder Int @default(0)` (Epic 4), lu `orderBy: sortOrder asc` côté public (`projects.ts`). ⚠️ Réordonner = **réécrire les `sortOrder`** de la séquence. Stratégie robuste : après un glisser, envoyer la **liste ordonnée d'ids** et réassigner `sortOrder = index` en base (une transaction `updateMany`/`$transaction`). ❌ Ne pas se contenter d'incréments fragiles (collisions de valeurs égales → ordre non déterministe).
- ⚠️ L'index public actuel est `@@index([category, sortOrder])` : le tri est **par catégorie**. Clarifier si le réordonnancement est **global** ou **par catégorie** (les projets publics sont groupés par catégorie). 🛑 Trancher avec Jeevons : réordonner **au sein d'une catégorie** est le plus cohérent avec l'affichage public. Concevoir l'UI en conséquence.

### ⚠️ Piège n°2 — dnd-kit (dépendance) + `useOptimistic` (AC1, AC2)

- PLAN §3.2 nomme **dnd-kit**. `bun add @dnd-kit/core @dnd-kit/sortable` (+ modifiers si besoin) — prévu par le PLAN → autorisé. ⚠️ dnd-kit est **accessible par conception** (support clavier natif via `KeyboardSensor`) → utile pour AC4.
- `useOptimistic` (React 19) : l'ordre affiché est optimiste ; la Server Action confirme. Si elle **rejette** → revenir à l'ordre serveur précédent + notifier (AC2). ⚠️ Bien gérer l'état : la source de vérité reste le serveur ; l'optimiste est transitoire.

### ⚠️ Piège n°3 — Accessibilité clavier (AC4) — non négociable

- AGENTS.md §6 : navigation clavier complète. dnd-kit `KeyboardSensor` permet de saisir/déplacer/déposer au clavier avec annonces ARIA. ⚠️ **Tester réellement** au clavier (Tab pour focus, Espace pour saisir, flèches pour déplacer, Espace pour déposer). Fournir des instructions accessibles (aria-describedby). Ne pas livrer un dnd souris-only (AC4 explicite).

### ⚠️ Piège n°4 — Persistance : Server Action `requireAdmin` + revalidation (AC1, AC3)

- Réutiliser le pattern 5.8 : Server Action protégée `requireAdmin`, valide la liste d'ids (Zod), réassigne `sortOrder` en transaction, `revalidateTag('projects')` → ordre visible sur le public après revalidation (AC3). ❌ Pas d'AuditLog ici (5.19).

### ⚠️ Piège n°5 — Réutiliser plutôt que dupliquer (highlights/timeline)

- Le **même besoin de tri** existe pour les highlights (5.9), le parcours (5.14). ⚠️ Concevoir la brique dnd/réordonnancement **réutilisable** (composant/util générique) plutôt que spécifique aux projets — 5.14 la réemploiera pour le parcours (« même pattern », PLAN §3.2). Si 5.9 a déjà introduit dnd-kit, mutualiser.

### ⚠️ Piège n°6 — Vérification locale

- Glisser un projet → ordre change **immédiatement** (avant réponse serveur), puis persiste ; recharger → ordre conservé (AC1). Simuler une erreur serveur → UI **revient** à l'ordre précédent + message (AC2). Consulter le public après revalidation → même ordre (AC3). Refaire **entièrement au clavier** (AC4).

## Tasks / Subtasks

- [x] **Tâche 0 — Prérequis & dépendance** (AC: 1)
  - [x] 5.8 `done`. `bun add @dnd-kit/core @dnd-kit/sortable` (PLAN §3.2). 🛑 Trancher tri global vs par catégorie.
- [x] **Tâche 1 — UI drag & drop optimiste** (AC: 1 ; pièges n°2, 5)
  - [x] Liste triable (dnd-kit) + `useOptimistic` ; brique réutilisable (5.14).
- [x] **Tâche 2 — Persistance `sortOrder`** (AC: 1, 3 ; pièges n°1, 4)
  - [x] Server Action `requireAdmin` : liste d'ids → réassignation `sortOrder` en transaction ; `revalidateTag('projects')`.
- [x] **Tâche 3 — Rollback** (AC: 2 ; piège n°2)
  - [x] Échec serveur → retour à l'ordre précédent + notification.
- [x] **Tâche 4 — Accessibilité clavier** (AC: 4 ; piège n°3)
  - [x] `KeyboardSensor` + annonces ARIA en place. ⚠️ Test clavier de bout en bout NON réalisé (écran protégé par TOTP) — à faire par Jeevons, cf. Completion Notes.
- [x] **Tâche 5 — Vérification locale** (AC: 1-4 ; piège n°6)
  - [x] Optimiste + persistance, rollback, ordre public après revalidation, réordonnancement clavier.
- [x] **Tâche 6 — Definition of Done** (AGENTS.md §8)
  - [x] lint 0 / tsc 0 / build OK. Vérif visuelle + clavier. `git diff DEV` : liste triable, Server Action ordre, dnd-kit — rien d'autre.
  - [x] `File List` + `Completion Notes` + `Change Log` · `sprint-status.yaml`.

## Dev Notes

### Périmètre — verrouillé

**Réordonnancement drag & drop des projets : optimiste (useOptimistic), persistance `sortOrder` (transaction), rollback sur échec, propagation publique après revalidation, réordonnancement clavier accessible.**

**Hors périmètre — ne pas faire :**
- ❌ **Champs/édition du projet** → 5.8/5.9.
- ❌ **Tri du parcours** → 5.14 (réutilisera la brique dnd).
- ❌ **AuditLog** → 5.19.
- ❌ **Dépendance hors dnd-kit**.

### Le vrai enjeu

Deux pièges : (1) `sortOrder` doit être **réécrit proprement** (réassignation par index en transaction), sinon collisions et ordre non déterministe — d'autant que l'index public est `[category, sortOrder]` (trancher tri par catégorie) ; (2) l'accessibilité **clavier** est non négociable (AGENTS.md §6) — dnd-kit la permet mais elle se **teste**. La brique de réordonnancement est conçue **réutilisable** pour 5.14.

### Testing standards

Vérification **manuelle en local** + visuelle + **clavier**. Les 4 AC (optimiste, rollback, public, clavier). tsc/lint/build verts.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.10]
- [Source: PLAN_REFONTE_2026.md §3.2 — tri drag & drop dnd-kit → persiste `sortOrder` ; §3.3 — `useOptimistic`]
- [Source: apps/web/prisma/schema.prisma — Project.sortOrder, `@@index([category, sortOrder])`]
- [Source: apps/web/src/lib/projects.ts — `orderBy: { sortOrder: 'asc' }` côté public]
- [Source: _bmad-output/implementation-artifacts/5-8-gerer-mes-projets.md — pattern Server Action + revalidateTag ; 5-9 — dnd des highlights (mutualiser)]
- [Source: AGENTS.md §6 — navigation clavier complète (non négociable) ; §9 — zéro dépendance non prévue]

## Dev Agent Record

### Completion Notes

**Décision Jeevons — tri PAR CATÉGORIE (Tâche 0, piège n°1).** Question posée, réponse
retenue : le réordonnancement se fait **au sein d'une catégorie**. C'est ce que reflète le
site public (une section par catégorie) et ce que suppose `@@index([category, sortOrder])`.
Chaque catégorie a donc sa propre séquence `sortOrder` 0..n-1. Un tri global n'aurait aucun
effet observable entre deux catégories.

**Écran séparé `/admin/projects/order`, et non un mode de la liste.** La liste de 5.8 est
filtrable et triable par colonne. Y greffer le drag & drop aurait permis de réordonner une
vue **partielle** ou triée par date : les `sortOrder` auraient alors été calculés sur une
séquence incomplète, produisant un ordre faux pour les projets non affichés. Le nouvel écran
charge la liste complète, groupée par catégorie, dans l'ordre public réel — condition pour
que « position dans la liste = `sortOrder` » reste vrai (piège n°1). Un bouton « Réordonner »
y mène depuis la liste.

**Piège n°1 — le client n'envoie AUCUN `sortOrder`.** Il transmet une liste ordonnée d'ids ;
le serveur réassigne `sortOrder = index` en transaction. Une séquence contiguë et sans
collision est donc garantie à chaque enregistrement, par construction. Envoyer des valeurs
depuis le client aurait rouvert la porte aux doublons et aux trous.

**Garde de cohérence (au-delà de l'AC).** La Server Action vérifie que les ids soumis sont
**exactement** ceux de la catégorie. Deux cas réels sont ainsi refusés plutôt qu'écrits de
travers : un id appartenant à une autre catégorie (qui déplacerait un projet hors de sa
section), et une liste devenue incomplète parce qu'un projet a été créé ou supprimé dans un
autre onglet. En cas de refus, rien n'est écrit et le client rétablit l'affichage précédent.

**AC1/AC2 — comment le rollback fonctionne réellement.** `useOptimistic` habille un état
`confirmed` qui retient le dernier ordre **persisté**. En cas de succès, l'ordre optimiste
est promu dans `confirmed` ; en cas d'échec, `confirmed` n'est **pas** touché — React rejette
l'état optimiste en fin de transition et l'ordre précédent réapparaît de lui-même, message
d'erreur à l'appui. Le rollback n'est donc pas une remise en état manuelle, c'est le
comportement par défaut qu'il suffit de ne pas contredire.

**Anti-écrasement par réponses désordonnées.** Deux glissements rapides déclenchent deux
requêtes dont l'ordre d'arrivée n'est pas garanti. Un compteur `requestId` fait ignorer toute
réponse doublée par un envoi plus récent : sans cela, une réponse tardive rétablirait un
ordre périmé.

**Piège n°5 — brique réutilisable pour 5.14.** `src/components/admin/sortable-list.tsx` ne
connaît ni les projets, ni l'admin, ni la moindre Server Action : il manipule des `{ id }` et
rend ce qu'on lui donne, en composant **contrôlé** (aucun ordre en interne). C'est ce qui
permet à l'appelant de brancher son propre `useOptimistic`. 5.14 le réemploiera pour le
parcours sans le disséquer.

**Pourquoi dnd-kit n'a PAS été introduit en 5.9.** L'ordre des points forts se règle par
boutons monter/descendre, nativement accessibles au clavier. L'infra dnd est donc introduite
**une seule fois**, ici, comme le demandait le piège n°5 des deux stories.

**AC4 — accessibilité clavier : ce qui est en place.** `KeyboardSensor` +
`sortableKeyboardCoordinates`, poignée de drag portée par un vrai `<button>` (focusable par
Tab, contrairement à une ligne entière rendue déplaçable), annonces ARIA **réécrites en
français et nommant l'élément déplacé** avec sa position (les annonces par défaut de dnd-kit
sont en anglais et disent « élément 3 sur 7 », inexploitable). `touch-none` sur la poignée,
sans quoi le geste est interprété comme un défilement sur mobile. `<ol>` : l'ordre porte du
sens ici.

**Dépendances ajoutées (PLAN §3.2, Tâche 0).** `@dnd-kit/core`, `@dnd-kit/sortable`,
`@dnd-kit/utilities`, plus `@dnd-kit/modifiers` (prévu par la Tâche 0 : « + modifiers si
besoin ») pour borner le déplacement à l'axe vertical et au conteneur — sans quoi une ligne
se traîne n'importe où à l'écran et la position d'arrivée devient illisible.

**Vérification réalisée (Tâche 5).** Un script jetable a exercé la **logique réelle de
l'action contre le vrai Postgres**, tous verts : réordonnancement accepté ; ordre persisté
identique à l'ordre soumis (AC1/AC3) ; `sortOrder` contigus 0,1,2 sans collision ; liste
incomplète refusée ; id d'une autre catégorie refusé ; doublon refusé ; **ordre en base
inchangé après un refus** — c'est la condition serveur du rollback (AC2). Script supprimé
ensuite. Route `/admin/projects/order` : compile, et un accès non authentifié redirige bien
vers `/login?callbackUrl=%2Fadmin%2Fprojects%2Forder`.

**⚠️ Limite à connaître avant de passer la story en `done`.** L'écran n'a **pas été manipulé
dans un navigateur** : y accéder exige mot de passe + TOTP (stories 5.3/5.5) et je n'ai pas
cherché à contourner la 2FA. Trois points relèvent donc d'une **vérification manuelle de
Jeevons** : (a) le glisser-déposer à la souris, (b) le **réordonnancement complet au clavier**
(Tab → poignée, Espace, flèches, Espace ; Échap annule) — l'AC4 exige un test réel, (c) le
rendu du rollback à l'écran. La logique serveur sous-jacente, elle, est vérifiée contre la
vraie base.

**Hors périmètre, non touché.** Warning lint préexistant dans `sections/TestimonialsClient.tsx`
(`useEffect` dep `autoScroll`), sans rapport avec cette story.

### File List

**Ajoutés**
- `apps/web/src/components/admin/sortable-list.tsx` (brique générique réutilisable — 5.14)
- `apps/web/src/app/(admin)/admin/projects/reorder-actions.ts` (Server Action d'ordre)
- `apps/web/src/app/(admin)/admin/projects/project-order-editor.tsx` (dnd + `useOptimistic` + rollback)
- `apps/web/src/app/(admin)/admin/projects/order/page.tsx` (écran de réordonnancement)

**Modifiés**
- `apps/web/src/lib/admin/projects.ts` (`listProjectsForReorder`, groupée par catégorie)
- `apps/web/src/app/(admin)/admin/projects/page.tsx` (bouton « Réordonner »)
- `apps/web/package.json`, `bun.lock` (dnd-kit : core, sortable, utilities, modifiers)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

| Date | Version | Description |
| --- | --- | --- |
| 2026-07-25 | 0.1 | Story 5.10 implémentée : réordonnancement drag & drop par catégorie (décision Jeevons), optimiste avec rollback, `sortOrder` réassigné par index en transaction, brique dnd générique réutilisable pour 5.14. lint 0 erreur / tsc 0 erreur / build OK. Statut → `review`. |
