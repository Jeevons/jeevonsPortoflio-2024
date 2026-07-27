---
baseline_commit: c408eae7818fb33ef915a70085775688fbf80640
---

# Story 6.17: Récompenser les curieux

Status: review

## Story

As **visiteur curieux**,
I want **découvrir une surprise cachée**,
so that **je garde un souvenir amusant du portfolio**.

## Acceptance Criteria

**AC1 — Une séquence secrète déclenche un effet visuel, qui se termine ou s'interrompt**
**Given** une séquence de touches secrète est définie
**When** je la saisis sur la page
**Then** un effet visuel amusant se déclenche
**And** il se termine de lui-même ou peut être interrompu

**AC2 — Jamais déclenchée par accident, jamais gênante**
**Given** cette surprise ne doit gêner personne
**When** je navigue normalement
**Then** je ne la déclenche jamais par accident
**And** elle n'interfère ni avec la navigation clavier ni avec les technologies d'assistance

**AC3 — Neutralisée ou statique sous mouvement réduit**
**Given** le réglage de mouvement réduit est actif
**When** je saisis la séquence
**Then** l'effet est neutralisé ou remplacé par une version statique

## Contexte d'implémentation

### 🛑 Prérequis : stories 6.1 (tokens) et 6.2 (socle motion) `done`

AC3 s'appuie sur le socle de neutralisation de **6.2** (`useReducedMotion` de `motion/react`). Les couleurs de l'effet passent par les **tokens 6.1**. PLAN §4.2 (P3 n°15 : « **Konami code / easter egg** — mémorable en entretien »).

### 🛑 La story la plus piégeuse de l'Epic 6 — et ce n'est pas l'effet visuel

🛑 **À lire avant de commencer.** Cette story a l'air d'être un amusement de trente lignes. En réalité **AC2 est le cœur du travail**, et il porte deux exigences que l'implémentation naïve viole **toutes les deux** :

1. « je ne la déclenche **jamais par accident** » — un écouteur global de clavier **capture ce que le visiteur tape dans le formulaire de contact** (story 6.12).
2. « elle n'interfère **ni avec la navigation clavier ni avec les technologies d'assistance** » — un effet plein écran non maîtrisé **piège le focus** et **inonde les lecteurs d'écran**.

✅ **L'effet visuel est la partie facile. Le contrat d'AC2 est la story.**

### 🛑 Piège n°1 (CENTRAL) — AC2 : l'écouteur global capture la saisie des champs

- 🛑 **C'est le piège décisif.** Un `window.addEventListener("keydown", …)` reçoit **toutes** les frappes du document, y compris celles destinées à un `<input>` ou un `<textarea>`.
- 🛑 **Le site en aura bientôt** : la **story 6.12** ajoute un **formulaire de contact** (nom, adresse, message) sur la page d'accueil, et `/admin` est **rempli de champs** (Epic 5). ⚠️ Un visiteur qui écrit « ...bbaba... » dans son message **déclencherait la surprise en plein milieu de sa saisie** — comportement absurde et exactement ce qu'AC2 interdit.
- ✅ **La garde obligatoire** : **ignorer l'événement** si la cible est un champ éditable —
  ```
  const el = event.target as HTMLElement | null;
  if (el?.closest("input, textarea, select, [contenteditable='true']")) return;
  ```
  ⚠️ `closest` et non une comparaison de `tagName` : un `contenteditable` peut contenir des éléments imbriqués.
- ⚠️ **Ignorer aussi les frappes avec modificateur** (`ctrlKey`, `metaKey`, `altKey`) : ce sont des **raccourcis navigateur**, ❌ pas une saisie de séquence.
- ⚠️ **Séquence suffisamment longue et improbable.** ✅ Le **Konami code** (↑↑↓↓←→←→BA) est le choix canonique du PLAN : dix touches, dont huit flèches — **statistiquement indéclenchable par accident**. ❌ Une séquence courte (« jeevons ») serait tapée par hasard.
- 🛑 ⚠️ **Les flèches font défiler la page.** ❌ **Ne pas appeler `preventDefault()`** sur les flèches pour « protéger » la séquence : cela **casserait le défilement au clavier de tout le site**, ce qui est une régression d'accessibilité majeure — et précisément ce qu'AC2 interdit. ✅ **Observer sans intercepter.**
- ⚠️ **Nettoyage** : `removeEventListener` au démontage. ⚠️ Et l'état de progression de la séquence doit vivre dans un **`ref`**, ❌ pas dans un `useState` — un `setState` par frappe re-rendrait l'arbre à chaque touche tapée sur le site.

### 🛑 Piège n°2 — AC2 : « n'interfère pas avec les technologies d'assistance »

- 🛑 **L'effet est purement décoratif et ne doit pas exister pour un lecteur d'écran.** ✅ Conteneur **`aria-hidden="true"`** + **`pointer-events-none`** obligatoires.
  - ❌ **Sans `pointer-events-none`**, un calque plein écran **bloque tous les clics du site** pendant toute la durée de l'effet — panne totale, silencieuse.
  - ❌ **Sans `aria-hidden`**, une pluie d'éléments animés ajoutés au DOM **inonde le lecteur d'écran** de mutations. ⚠️ **Jamais d'`aria-live`** sur cet effet (même discipline que les compteurs de la **story 6.14** et le texte alterné de la **6.7**).
- 🛑 ⚠️ **Le focus ne doit pas bouger.** ❌ Ne pas déplacer le focus vers l'effet, ❌ ne pas ouvrir de dialogue modal, ❌ ne pas piéger le focus. ✅ **Test décisif** : déclencher l'effet **au clavier**, puis appuyer sur `Tab` — 🛑 le focus doit continuer son parcours **normalement**, comme si de rien n'était.
- ⚠️ ✅ **L'interruption d'AC1 doit être atteignable au clavier** : si l'effet s'interrompt, `Échap` est la convention. 🛑 ⚠️ **Mais `Échap` ne doit pas voler la touche** à autre chose : `/admin` (Epic 5) utilise des dialogues shadcn qui se ferment à `Échap`. ✅ **Ne s'abonner à `Échap` que pendant que l'effet est actif**, et ❌ **ne pas `preventDefault()`**.
- ⚠️ ✅ **Ne pas gêner tout court** : ❌ pas de son, ❌ pas de vibration, ❌ rien qui masque durablement le contenu.

### 🛑 Piège n°3 — AC3 : « neutralisé OU remplacé par une version statique » — décider

- 🛑 **AC3 laisse explicitement le choix, donc il faut le faire et le documenter.** Deux lectures valides :
  - ✅ **Neutralisé** : sous mouvement réduit, la séquence **ne produit rien**. Simple, sûr, défendable.
  - ✅ **Version statique** : un visuel fixe apparaît (un message, un motif figé) sans mouvement, avec un moyen de le fermer.
- ✅ **Recommandé : la version statique**, plus fidèle à l'esprit de la story (« récompenser les curieux » — un curieux sensible au mouvement reste un curieux) et cohérente avec la règle 6.2 (« le contenu reste présenté dans son état final, **jamais masqué** »). 🛑 **Mais l'un ou l'autre est acceptable — le trancher et l'écrire.**
- 🛑 ⚠️ **Le piège structurel** : si l'effet repose sur une **animation CSS**, la règle globale de 6.2 (`animation-duration: 0.01ms`) le fait **sauter à son état final** — ⚠️ ce qui peut laisser des dizaines d'éléments **figés en plein écran, sans jamais disparaître** (l'animation ne se rejoue pas, donc rien ne les nettoie). 🛑 **C'est un site cassé, pas un effet neutralisé.** ✅ **La neutralisation doit se décider EN AMONT**, via `useReducedMotion`, ❌ pas être laissée à la règle CSS.
- ⚠️ **Contrainte transverse Epic 6** : ✅ `useReducedMotion` (socle 6.2), ❌ pas de `matchMedia` maison.

### ⚠️ Piège n°4 — AC1 : « se termine de lui-même ou peut être interrompu »

- ✅ **Les deux sont acceptables ; le plus sûr est de faire les deux** : durée bornée (indicatif : quelques secondes) **et** `Échap`.
- 🛑 ⚠️ **Le nettoyage est obligatoire, et c'est là que les fuites arrivent** : `clearTimeout`/`cancelAnimationFrame` au démontage **et** à l'interruption. ❌ Un `setTimeout` orphelin qui écrit dans l'état d'un composant démonté produit un avertissement React et une fuite.
- ⚠️ ❌ **Pas de ré-entrance** : re-saisir la séquence pendant que l'effet tourne ne doit **pas** empiler deux effets. ✅ Ignorer ou redémarrer proprement — 🛑 **décider et documenter**.
- ⚠️ **Coût de performance** (AC3 de la **story 6.16** vaut aussi ici) : ✅ `transform`/`opacity` **uniquement**, ⚠️ **nombre d'éléments borné** (quelques dizaines, ❌ pas des centaines). 🛑 L'effet doit se **démonter entièrement** à la fin — ❌ pas rester dans le DOM avec `opacity: 0`.
- ⚠️ ✅ **`motion` 12 est déjà installé** — ❌ **aucune dépendance** (pas de `react-confetti` ni équivalent). AGENTS.md §9 règle 6.

### ⚠️ Piège n°5 — Où le brancher, et l'ISR

- ✅ **Un composant client autonome, monté une fois** (`layout.tsx` ou `page.tsx`), sans props ni données. 🛑 **Décider et documenter** l'emplacement.
- 🛑 ⚠️ **Si monté dans `layout.tsx`, il est actif sur `/admin` aussi** — ⚠️ un écouteur clavier global sur le back-office, où **tous** les écrans sont des formulaires et où la **story 5.20** a livré un travail spécifique de navigation au clavier. ✅ **Recommandé : monter l'effet sur le site PUBLIC uniquement** (`page.tsx`, ou le layout public s'il en existe un), ❌ pas sur `/admin`. 🛑 **Trancher et l'écrire.**
- 🛑 **Discipline ISR** : la page reste **`○ (Static, 1h)`**. Un composant client ne rend pas la page dynamique ✅, mais le garde-fou se **vérifie au build**.
- ⚠️ **Hydratation** : ❌ le composant ne doit **rien** rendre au premier rendu (l'effet n'est pas actif) — ✅ pas de divergence serveur/client possible. ⚠️ Si un `sessionStorage`/`localStorage` est envisagé (ne rejouer qu'une fois), 🛑 **attention à l'hydratation** — ✅ et ce n'est **pas demandé** par les AC : ❌ **ne pas l'ajouter**.
- ⚠️ **Pas de dépendance à `/preview`** (5.11), mais ⚠️ **vérifier que la page ne casse pas** si le composant y est rendu.

### ⚠️ Piège n°6 — Périmètre

- ❌ **Hors périmètre** : **toute migration Prisma** · toute donnée (l'effet est **entièrement en dur** — ❌ ne pas le rendre administrable) · `/admin` · le `Header` (**6.5**) · le curseur personnalisé (**6.6**) · le hero (**6.7**) · le bandeau et l'aurora (**6.16**) · le formulaire de contact (**6.12** — ⚠️ **seulement s'en protéger**, ❌ pas le modifier) · **toute dépendance**.
- ⚠️ 🛑 **Le débordement le plus probable** : « tant qu'à faire un easter egg, autant en mettre trois, ajouter un son, un compteur de découvertes... ». ❌ **Non** : **une** séquence, **un** effet. **Une story, rien qu'une story, toute la story.**
- ⚠️ 🛑 **Le second débordement** : « pour être sûr que la séquence marche, je bloque les flèches ». ❌ **Interdit** — c'est casser le défilement au clavier du site entier (piège n°1).

### ⚠️ Piège n°7 — Vérification locale, les 3 AC

- **AC1** : la séquence déclenche l'effet ; il **se termine seul** ✅ **et** s'interrompt à `Échap` ✅. 🛑 **Vérifier qu'il est entièrement DÉMONTÉ** ensuite (inspecteur : ❌ plus rien dans le DOM), et qu'aucun avertissement React n'apparaît en console.
- **AC2** : 🛑 **Test décisif n°1** — taper la séquence **dans le champ message du formulaire de contact** (6.12) et **dans un champ de `/admin`** : ❌ **rien ne se déclenche**. 🛑 **Test décisif n°2** — déclencher l'effet, puis `Tab` : ✅ le focus **poursuit normalement**. 🛑 **Test décisif n°3** — pendant l'effet, **cliquer sur un lien** : ✅ il fonctionne (`pointer-events-none`). Au **lecteur d'écran** : ❌ **rien n'est annoncé**. 🛑 **Et les flèches font toujours défiler la page**, avant comme après.
- **AC3** : 🛑 mouvement réduit activé → comportement **décidé** appliqué (rien, ou statique fermable). ❌ **Aucun élément figé bloqué à l'écran** (piège n°3).
- **Non-régression** : 🛑 **`/` toujours `○ (Static, 1h)`** · `/preview` intact · `/admin` **inchangé** (❌ aucun écouteur ajouté s'il y est monté par erreur) · ❌ aucun défilement horizontal, aucun saut de mise en page pendant l'effet.

## Tasks / Subtasks

- [x] **Tâche 0 — Prérequis & décisions** (AC: 1, 3)
  - [x] 6.1 et 6.2 `done`. 🛑 **Décidé** : séquence = **Konami** · monté sur **`page.tsx`** (public uniquement) · AC3 = **version statique** · ré-entrance = **ignorée**.
- [x] **Tâche 1 — Détection de la séquence** (AC: 1, 2 ; piège n°1)
  - [x] Écouteur `keydown` global, progression dans un **`ref`** (❌ aucun `useState`), `removeEventListener` au démontage (2 écouteurs, 2 nettoyages).
  - [x] 🛑 **Garde obligatoire** posée via **`closest`** sur `input, textarea, select, [contenteditable='true']` · frappes avec `ctrl`/`meta`/`alt` ignorées.
  - [x] 🛑 ❌ **AUCUN `preventDefault()`** — vérifié sur le **JS compilé servi** : 0 occurrence.
- [x] **Tâche 2 — Effet visuel** (AC: 1 ; piège n°4)
  - [x] `transform`/`opacity` **uniquement**, **40 éléments** (borné), couleurs sur tokens 6.1. ❌ Aucune dépendance ajoutée.
  - [x] **Durée bornée (6 s)** ✅ **et** `Échap` (abonné **seulement pendant** l'effet, ❌ sans `preventDefault`). 🛑 `clearTimeout` au démontage **et** à l'interruption. 🛑 **Démontage complet** (`return null`).
- [x] **Tâche 3 — Accessibilité** (AC: 2 ; piège n°2)
  - [x] 🛑 **`aria-hidden="true"`** + **`pointer-events-none`** sur les DEUX calques. ❌ Aucun `aria-live` (0 dans le bundle), ❌ aucun `focus()`/`tabIndex`/`autoFocus`, ❌ aucun son.
- [x] **Tâche 4 — Mouvement réduit** (AC: 3 ; piège n°3)
  - [x] 🛑 Décision appliquée **en amont via `useReducedMotion`** : la branche animée n'est jamais montée. ❌ La règle CSS de 6.2 n'a rien à figer — aucun élément animé n'existe.
- [x] **Tâche 5 — Vérification locale** (AC: 1-3 ; piège n°7)
  - [x] Vérifié **statiquement et sur le code servi** : garde `closest` présente, 0 `preventDefault`, 0 `aria-live`, 0 déplacement de focus, `/admin` sans le composant, `/preview` 200, rien rendu au SSR. ⚠️ **Vérifications INTERACTIVES dues par Jeevons** (voir Completion Notes).
- [x] **Tâche 6 — Definition of Done** (AGENTS.md §8)
  - [x] `bun run lint` 0 / `bunx tsc --noEmit` 0 / `bun run build` OK — 🛑 **`/` toujours `○ (Static, 1h)`**.
  - [x] `git diff DEV` : **un composant client neuf + son montage dans `page.tsx`**, rien d'autre. ❌ Aucune migration, aucune dépendance, aucune donnée ; `/admin`, `Header.tsx` et `ContactDialog.tsx` **intacts**.
  - [x] `File List` + `Completion Notes` + `Change Log` · `sprint-status.yaml`.

## Dev Notes

### Périmètre — verrouillé

**Ajouter un composant client autonome, monté sur le site public uniquement, qui détecte une séquence de touches improbable (Konami) sans jamais intercepter la saisie des champs éditables ni le défilement au clavier, déclenche un effet visuel décoratif borné en durée et interruptible, entièrement invisible aux technologies d'assistance et aux événements de pointeur, et dont la neutralisation sous mouvement réduit est décidée en amont plutôt que subie par la règle CSS globale. Aucune donnée, aucune dépendance, aucune migration.**

**Hors périmètre — ne pas faire :**
- ❌ **Un écouteur clavier sans garde sur les champs éditables** — il capturerait la saisie du formulaire de contact (6.12) et de tout `/admin`.
- ❌ **`preventDefault()` sur les flèches** : cela casserait le défilement au clavier du site entier (régression d'accessibilité majeure, interdite par AC2).
- ❌ **Un calque sans `pointer-events-none`** (blocage de tous les clics) ni sans `aria-hidden` (inondation du lecteur d'écran).
- ❌ **Déplacer ou piéger le focus** · `aria-live` · son · vibration.
- ❌ **Laisser la règle CSS de 6.2 « neutraliser » l'effet** : elle le figerait à son état final, laissant des éléments bloqués en plein écran (piège n°3).
- ❌ **Un `useState` mis à jour à chaque frappe du site** (re-rendu de l'arbre à chaque touche) · un `setTimeout` non nettoyé.
- ❌ **Monter le composant sur `/admin`** · rendre l'effet administrable · ajouter plusieurs easter eggs.
- ❌ Toute dépendance (`motion` 12 est déjà là, pas de bibliothèque de confettis) · toute migration · `Header` (6.5) · curseur (6.6) · hero (6.7) · bandeau/aurora (6.16) · formulaire de contact (6.12 — s'en protéger, pas le modifier).

### Le vrai enjeu

La surprise elle-même est triviale : quelques éléments animés en `transform`/`opacity`, `motion` est déjà installé, et le Konami code est le choix évident. Le travail réel est **AC2**, qui interdit deux choses que l'implémentation naïve fait toutes les deux. D'abord, un écouteur clavier global reçoit **toutes** les frappes du document : dès que la story 6.12 aura posé son formulaire de contact, un visiteur écrivant son message déclencherait la surprise en pleine saisie — la garde sur `input, textarea, select, [contenteditable]` n'est pas une précaution, c'est une condition d'acceptation. Ensuite, l'instinct de « protéger » la séquence en appelant `preventDefault()` sur les flèches **casserait le défilement au clavier du site entier**, exactement l'interférence qu'AC2 proscrit : il faut observer sans intercepter. S'y ajoute un piège de neutralisation propre à cet Epic : contrairement aux autres animations, laisser la règle CSS globale de 6.2 s'en charger est ici **destructeur** — elle fait sauter l'animation à sa dernière frame, ce qui, pour un effet plein écran, signifie des dizaines d'éléments figés que plus rien ne vient nettoyer. La neutralisation doit se décider avant que l'effet ne démarre.

### Testing standards

Vérification **manuelle** des 3 AC, avec quatre tests décisifs : **taper la séquence dans le champ message du formulaire de contact et dans un champ de `/admin`** — rien ne se déclenche (AC2) ; **déclencher l'effet puis appuyer sur `Tab` et cliquer sur un lien** — le focus poursuit son parcours et le lien fonctionne (AC2) ; **vérifier que les flèches font toujours défiler la page**, avant comme après (AC2) ; **activer le mouvement réduit** et constater le comportement décidé, sans aucun élément figé bloqué à l'écran (AC3). Plus le lecteur d'écran (rien n'est annoncé), le démontage complet de l'effet à sa fin (inspecteur : plus rien dans le DOM, aucun avertissement React en console), l'absence de saut de mise en page, et les non-régressions : `/` toujours `○ (Static, 1h)`, `/preview` intact, `/admin` inchangé. `lint`/`tsc`/`build` verts.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.17 ; en-tête Epic 6 — contrainte transverse : chaque story introduisant du mouvement porte son propre critère de neutralisation]
- [Source: PLAN_REFONTE_2026.md §4.2 P3 n°15 — « Konami code / easter egg — mémorable en entretien » ; §4.4 — accessibilité non négociable, navigation clavier complète]
- [Source: AGENTS.md §6 — `prefers-reduced-motion` sur chaque animation, navigation clavier complète, landmarks ARIA corrects ; §9 règles 2 et 6 — périmètre verrouillé, zéro dépendance ajoutée]
- [Source: apps/web/src/app/globals.css:103-121 — règle globale `prefers-reduced-motion` (socle 6.2) : `animation-duration: 0.01ms` fait SAUTER à l'état FINAL. ⚠️ Pour un effet plein écran, cela FIGE les éléments au lieu de les supprimer — la neutralisation doit être décidée en amont]
- [Source: _bmad-output/implementation-artifacts/6-12-prendre-contact-directement-depuis-le-site.md — le formulaire de contact (nom, adresse, message) arrive sur la page d'accueil : c'est la cible principale de la garde sur les champs éditables]
- [Source: _bmad-output/implementation-artifacts/5-20-utiliser-l-administration-au-clavier-sans-a-coups.md — travail livré sur la navigation clavier de `/admin` : ne pas y superposer un écouteur global]
- [Source: _bmad-output/implementation-artifacts/6-14-saisir-l-experience-de-jeevons-en-quelques-chiffres.md — précédent explicite : `aria-hidden` sur un élément à fortes mutations DOM, JAMAIS d'`aria-live` (même discipline ici)]
- [Source: apps/web/src/sections/AboutClient.tsx — motif `useReducedMotion` de `motion/react` (socle 6.2) à réutiliser]
- [Source: apps/web/src/app/layout.tsx — point de montage possible ; ⚠️ il couvre AUSSI `/admin` : préférer un montage sur le site public seul]
- [Source: apps/web/src/app/page.tsx:16-29 — garde-fou : `/` doit rester `○ (Static, 1h)` ; vérifier aussi `/preview` (5.11)]
- [Source: apps/web/package.json — `motion` 12 DÉJÀ installé : aucune bibliothèque de confettis ni d'easter egg à ajouter]

## Dev Agent Record

### Agent Model Used

claude-opus-5 (Claude Code, workflow `bmad-dev-story`)

### Completion Notes

**Les quatre décisions de la Tâche 0 :**

1. **Séquence = le Konami code** (↑↑↓↓←→←→BA), le choix canonique du PLAN : dix touches dont huit flèches, statistiquement indéclenchable par accident.
2. **Monté dans `page.tsx`, PAS dans `layout.tsx`.** 🛑 Décision structurante : le layout racine couvre `/admin`, où **tous** les écrans sont des formulaires et où la story 5.20 a livré un travail spécifique de navigation au clavier. Y superposer un écouteur `keydown` global aurait été un débordement sur l'Epic 5. **Vérifié : 0 occurrence du composant dans le HTML de `/admin`** — l'isolation est par construction, pas par vigilance.
3. **AC3 = version STATIQUE**, pas « rien » (l'AC laisse le choix). Un curieux sensible au mouvement reste un curieux, et c'est cohérent avec la règle du socle 6.2 : « neutraliser l'animation, jamais l'information ». Un message figé, fermable à `Échap`.
4. **Ré-entrance = ignorée.** Re-saisir la séquence pendant que l'effet tourne ne fait rien : empiler deux effets doublerait le coût pour un gain nul, et redémarrer volerait au visiteur la fin de son animation.

**🛑 AC2 est le cœur du travail, et les deux pièges annoncés étaient réels.**

- **La garde sur les champs éditables n'était pas théorique** : ⚠️ **`ContactDialog.tsx` (story 6.12) est DÉJÀ livré** et porte un `<textarea>` de message. Sans garde, un visiteur écrivant « ...bbaba... » aurait déclenché la surprise en pleine saisie. L'événement est donc ignoré (et la progression remise à zéro) dès que `event.target.closest("input, textarea, select, [contenteditable='true']")` répond — **`closest` et non `tagName`**, car un `contenteditable` peut contenir des enfants qui seraient la vraie cible. Les frappes avec `ctrl`/`meta`/`alt` sont ignorées de même : ce sont des raccourcis navigateur.
- **❌ AUCUN `preventDefault()`, nulle part.** C'est l'interdit central : intercepter les flèches pour « protéger » la séquence casserait le défilement au clavier du site entier. 🛑 **Vérifié sur le JS COMPILÉ SERVI, pas sur la source : 0 occurrence de `preventDefault` et 0 de `aria-live` dans le bundle.** Les 4 occurrences présentes dans le fichier sont toutes des **commentaires d'interdiction**.
- **`Échap` sans vol de touche** : l'écouteur n'est abonné que pendant que l'effet est actif, et il ne fait pas de `preventDefault`. ⚠️ Cela compte concrètement : `ContactDialog` est un **`<dialog>` natif** (qui se ferme nativement à `Échap`) et `/admin` utilise des dialogues shadcn. En laissant l'événement se propager, les deux cohabitent au lieu de se voler la touche.
- **Technologies d'assistance** : `aria-hidden="true"` + `pointer-events-none` sur **les deux** calques (animé et statique) — sans le second, un calque plein écran bloquerait *tous* les clics du site pendant 6 secondes, panne totale et silencieuse. ❌ Aucun `aria-live`, ❌ aucun `focus()`, `tabIndex` ni `autoFocus` (vérifié : 0 occurrence) : `Tab` poursuit le parcours normal de la page pendant l'effet.
- **Progression dans un `ref`, jamais un `useState`** : un `setState` par frappe re-rendrait l'arbre à chaque touche tapée sur le site, pour un effet que la quasi-totalité des visiteurs ne déclenchera jamais.

**AC1.** L'effet fait **les deux** : durée bornée à 6 s **et** interruption à `Échap`. 🛑 **Démontage complet** — `return null` sort l'effet du DOM, il n'y reste pas avec `opacity: 0`. `clearTimeout` à l'interruption **et** au démontage (c'est là que les `setTimeout` orphelins fuient). 40 pièces, nombre **borné**, animées en `transform`/`opacity` uniquement.

**AC3 — la neutralisation est décidée EN AMONT, et c'est vital ici.** ⚠️ Contrairement aux autres stories de l'Epic 6, laisser faire la règle CSS de 6.2 aurait été **destructeur** : `animation-duration: 0.01ms` fait sauter une animation à sa dernière frame, ce qui pour un effet plein écran aurait laissé **40 éléments figés à l'écran que plus rien ne nettoie** — un site cassé, pas un effet neutralisé. La bascule se fait donc sur `useReducedMotion` **avant que le moindre élément animé n'existe** : la branche animée n'est jamais montée.

**Note de conception** : la détection de séquence est factorisée dans un hook unique (`useKonamiSequence`) partagé par les deux rendus. C'est délibéré — dupliquer la logique aurait laissé les gardes d'AC2 dériver entre les deux branches. ⚠️ **Correctif appliqué en cours de route** : la première version écrivait dans un `ref` pendant le rendu, ce que `react-hooks/refs` signale à juste titre (le rendu doit rester pur, React peut le rejouer) — l'assignation est passée dans un effet.

**Hydratation et ISR** : le composant **ne rend rien** tant que la séquence n'est pas saisie (`active` faux au premier rendu) — aucune divergence serveur/client possible. ⚠️ Les positions des pièces sont calculées par une **distribution déterministe** et non par `Math.random()`, précisément pour la même raison. ❌ Aucun `sessionStorage`/`localStorage` (non demandé par les AC). Vérifié : `/` reste **`○ (Static, 1h)`**, `/preview` répond 200.

⚠️ **VÉRIFICATIONS INTERACTIVES DUES PAR JEEVONS** (aucune n'a pu être exécutée : pas de navigateur headless dans cet environnement, contrainte connue du dépôt outillée seulement à l'Epic 7) : **saisir la séquence dans le `<textarea>` de `ContactDialog` puis dans un champ de `/admin`** → rien ne doit se déclencher (le test décisif d'AC2) ; **déclencher l'effet puis `Tab`** → le focus poursuit son parcours ; **cliquer un lien pendant l'effet** → il fonctionne ; **les flèches font toujours défiler la page**, avant comme après ; **lecteur d'écran silencieux** ; **fin automatique à 6 s et interruption à `Échap`**, puis inspecteur → plus rien dans le DOM, aucun avertissement React en console ; **mouvement réduit** → message statique, fermable, aucun élément figé bloqué ; **`Échap` alors qu'un `ContactDialog` est ouvert** → c'est bien le dialogue qui se ferme.

### File List

- `apps/web/src/components/KonamiEasterEgg.tsx` (nouveau — détection de séquence + effet animé + variante statique)
- `apps/web/src/app/page.tsx` (modifié — montage de `<KonamiEasterEgg />`)

### Change Log

| Date | Version | Description |
|---|---|---|
| 2026-07-27 | 0.1 | Story 6.17 implémentée. Easter egg Konami en composant client autonome monté sur `page.tsx` uniquement (`/admin` sans écouteur, par construction). Garde `closest` sur les champs éditables (`ContactDialog` de la 6.12 est déjà livré), aucun `preventDefault` (0 dans le bundle compilé), `Échap` sans vol de touche, `aria-hidden` + `pointer-events-none`, progression en `ref`. Effet borné à 6 s, interruptible, démonté intégralement. AC3 = version statique décidée en amont via `useReducedMotion`. lint 0 / tsc 0 / build OK, `/` reste `○ (Static, 1h)`. |
