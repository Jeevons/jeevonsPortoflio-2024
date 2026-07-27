---
baseline_commit: c408eae7818fb33ef915a70085775688fbf80640
---

# Story 6.15: Découvrir la personnalité de Jeevons

Status: review

## Story

As **visiteur du portfolio**,
I want **une section « à propos » vivante et bien organisée**,
so that **je perçoive la personne derrière les projets**.

## Acceptance Criteria

**AC1 — Grille modulaire, chaque bloc dimensionné selon son contenu**
**Given** la section rassemble des contenus de natures différentes
**When** cette story est terminée
**Then** elle est organisée en grille modulaire, chaque bloc ayant une taille adaptée à son contenu

**AC2 — Le bloc manipulable est conservé et cohérent**
**Given** le bloc des centres d'intérêt était déjà manipulable
**When** je le découvre
**Then** ce comportement est conservé et cohérent avec le reste de la grille

**AC3 — Lecture verticale sur téléphone, sans perte de contenu**
**Given** je consulte sur téléphone
**When** je parcours la section
**Then** la grille se réorganise en une lecture verticale, sans perte de contenu

**AC4 — Animations neutralisées, contenu entièrement accessible**
**Given** le réglage de mouvement réduit est actif
**When** j'interagis avec la section
**Then** les animations sont neutralisées, le contenu restant entièrement accessible

## Contexte d'implémentation

### 🛑 Prérequis : stories 6.1 (tokens) et 6.2 (socle motion) `done`

AC4 s'appuie **entièrement** sur le socle de neutralisation de **6.2**. Les surfaces de cartes, rayons et espacements de la grille passent par les **tokens 6.1**. PLAN §4.2 (P3 n°11 : « **Bento grid** pour la section À propos (la carte hobbies draggable est un bon point de départ, **la généraliser**) »).

### 🛑 AVERTISSEMENT n°1 — `AboutClient.tsx` est le fichier le plus disputé de l'Epic 6

🛑 **À lire avant toute autre chose.** Quatre stories touchent ce fichier :

| Story | Ce qu'elle y fait | État |
|---|---|---|
| **6.11** — CV | repointe le lien de la carte CV vers `/cv` | `ready-for-dev` |
| **6.13** — compétences | peut **remplacer** le contenu de la carte « Mon pack d'explorateur » | `ready-for-dev` |
| **6.4** — révélation au défilement | applique la révélation aux sections publiques | `ready-for-dev` |
| **6.15** — *cette story* | **refond la grille entière** | — |

- 🛑 **AGENTS.md §9 règle 1 : une story = une branche.** ❌ **Ne fusionnez aucun de ces travaux.**
- 🛑 ⚠️ **Première action obligatoire : relire l'état RÉEL de `AboutClient.tsx` sur `DEV`**, pas l'état décrit ici. Si 6.13 a déjà remplacé la toolbox, la grille à refondre n'a plus la même composition ; si 6.11 est passée, le lien CV a changé.
- ✅ **Signaler explicitement dans les notes de complétion** lesquelles de ces stories étaient déjà fusionnées au moment de l'implémentation. C'est ce qui permettra la relecture.

### ✅ Ce que la section contient aujourd'hui (état à la baseline)

`AboutClient.tsx` rend **deux rangées** de grille, **quatre cartes** :

| Carte | Classes actuelles | Contenu |
|---|---|---|
| **CV** | `h-[380px] md:col-span-2 lg:col-span-1` | `CardHeader` + vignette du CV (ou état neutre « CV bientôt disponible. ») |
| **Mon pack d'explorateur** | `h-[380px] md:col-span-3 lg:col-span-2` | `CardHeader` + **deux bandes `ToolboxItems`** défilantes |
| **Quand je ne code pas** | `h-[380px] p-0 md:col-span-3 lg:col-span-2` | `CardHeader` + **hobbies déplaçables** (`motion` `drag`) |
| **Carte / memoji** | `h-[380px] p-0 relative md:col-span-2 lg:col-span-1` | image de carte + memoji animé (`animate-ping`) |

- 🛑 **Le constat qui justifie AC1** : les quatre cartes sont **toutes figées à `h-[380px]`**, quelle que soit la nature de leur contenu. C'est précisément ce qu'AC1 corrige (« **chaque bloc ayant une taille adaptée à son contenu** »).
- ⚠️ La grille est déjà en **deux `div` séparés** (`grid-cols-1 md:grid-cols-5 lg:grid-cols-3` chacun). 🛑 **Deux rangées indépendantes ne sont pas une grille modulaire** : les blocs ne peuvent pas se répartir librement. ✅ **Une seule grille** est la voie attendue.
- ⚠️ La section est déjà **responsive par palier** (`md:` / `lg:`) et **s'effondre en une colonne** sur petit écran (`grid-cols-1`) ✅ — AC3 est donc **largement acquis**, mais **à ne pas casser** en refondant (voir piège n°3).

### 🛑 Piège n°1 (CENTRAL) — AC2 : le `drag` des hobbies repose sur un `ref` de contraintes fragile

- 🛑 **C'est le piège technique de la story.** Le bloc manipulable fonctionne ainsi :
  ```tsx
  const constraintRef = useRef(null);
  …
  <div className="relative flex-1" ref={constraintRef}>   // ← la ZONE de contrainte
    <motion.div … drag={!shouldReduceMotion} dragConstraints={constraintRef}
                 style={{ left: hobby.posLeft, top: hobby.posTop }} />
  ```
  Les vignettes sont positionnées en **`absolute`** avec des coordonnées **`posLeft`/`posTop` venant de la base** (`Hobby.posLeft` / `posTop`, story 4.2), à l'intérieur d'un conteneur **`relative`** qui sert de **cadre de déplacement**.
- 🛑 **Trois façons de casser AC2 en refondant la grille, toutes silencieuses :**
  1. ❌ **Retirer `relative`** du conteneur de contrainte → les vignettes se positionnent par rapport à un ancêtre différent et **partent hors de la carte**.
  2. ❌ **Perdre la hauteur du conteneur** → `flex-1` n'a plus de hauteur à remplir si la carte n'a plus de hauteur définie (`h-[380px]` retiré au nom d'AC1 !) → la zone de contrainte **s'effondre à 0 pixel** et les vignettes deviennent **indéplaçables ou invisibles**.
  3. ❌ **Déplacer le `ref`** sur un autre élément → contraintes fausses.
- 🛑 ⚠️ **AC1 et AC2 sont donc en tension directe** : « taille adaptée au contenu » pousse à retirer les hauteurs fixes, alors que le bloc manipulable a **besoin d'une hauteur** pour exister. ✅ **La résolution** : cette carte-là **conserve une hauteur explicite** (c'est *sa* taille adaptée à *son* contenu — une aire de jeu), tandis que les autres s'ajustent. 🛑 **Décider et documenter.**
- ⚠️ **`drag={!shouldReduceMotion}`** est déjà la neutralisation d'AC4 pour ce bloc (story 4.2) ✅ — **la préserver telle quelle**, ainsi que le `transition={shouldReduceMotion ? { duration: 0 } : undefined}`.
- ⚠️ 🛑 **`posLeft`/`posTop` sont des valeurs de la BASE, administrables** (story 5.14 gère les hobbies). ❌ Ne pas les remplacer par une disposition en dur : les hobbies deviendraient non administrables, et le seed/les données existantes seraient contredits.
- ⚠️ **AC2 dit « conservé ET cohérent avec le reste de la grille »** : le bloc doit **rester manipulable** (❌ ne pas « simplifier » le drag) tout en adoptant les surfaces/rayons/espacements communs (tokens 6.1).

### 🛑 Piège n°2 — AC4 : la section contient DÉJÀ trois animations, dont deux non contrôlées

Inventaire vérifié, à traiter **une par une** :

| Animation | Où | Neutralisée ? |
|---|---|---|
| `drag` des hobbies | `motion.div` | ✅ **Oui** — `drag={!shouldReduceMotion}` (4.2) |
| bandes défilantes `animate-move-left` / `animate-move-right` | `ToolboxItems` (deux appels) | ⚠️ **Par la règle CSS globale de 6.2 uniquement** |
| `animate-ping` du memoji | carte / memoji | ⚠️ **Par la règle CSS globale de 6.2 uniquement** |

- ✅ Les deux dernières sont des animations **CSS décoratives**, donc couvertes par la neutralisation globale posée en **6.2**. 🛑 **Mais AC4 impose de le VÉRIFIER À L'ŒIL**, pas de le supposer — c'est précisément la promesse de 6.2 (« neutralisée sans que le développeur ait à y penser ») et cette story est l'occasion de la valider.
- 🛑 **« le contenu restant entièrement accessible »** est la moitié la plus importante d'AC4, et la plus facile à rater : sous mouvement réduit, une bande défilante **immobile** peut **masquer une partie de ses éléments** (elle est plus large que son conteneur, avec un `mask-image` en dégradé). ✅ Vérifier que **rien ne devient inatteignable** — c'est exactement l'AC2 du socle 6.2 (« le contenu reste présenté dans son état final, **jamais masqué** »).
- ⚠️ **Si un effet est ajouté par cette story** (survol de carte, entrée en grille…), il porte **son propre critère de neutralisation** — contrainte transverse de l'Epic 6, rappelée en tête du fichier `epics.md`. ✅ Utiliser `useReducedMotion` (6.2), ❌ pas une détection maison.
- ⚠️ ❌ **Ne pas ajouter d'inclinaison 3D ni de halo au survol** : c'est la **story 6.8**, et elle vise les **cartes de projet**. Hors périmètre ici.

### 🛑 Piège n°3 — AC3 : « sans perte de contenu » est un piège d'implémentation

- ⚠️ La grille actuelle s'effondre déjà en `grid-cols-1` sur petit écran ✅. 🛑 **Le risque vient de la refonte** : une grille modulaire s'écrit souvent avec `grid-auto-rows` + `row-span`, et une carte à `row-span-2` dont le contenu déborde **est tronquée** — silencieusement, sans barre de défilement.
- ❌ **Interdits** : `overflow: hidden` qui coupe du texte · une hauteur fixe plus petite que le contenu · masquer une carte en `hidden` sur mobile pour « simplifier » (**c'est littéralement la perte de contenu qu'AC3 interdit**).
- ⚠️ 🛑 **Le bloc manipulable sur téléphone** : les hobbies sont positionnés en `absolute` à des coordonnées pensées pour une carte large. Sur un écran étroit, certaines vignettes peuvent **sortir du cadre visible**. ✅ **À vérifier explicitement** — c'est le point d'AC3 le plus susceptible d'échouer. ⚠️ Le déplacement au doigt doit aussi **ne pas capturer le défilement vertical de la page** (un `drag` mal contraint empêche de faire défiler).
- ⚠️ **`ToolboxItems`** utilise `flex-none` + `mask-image` : sur mobile, vérifier que la bande **ne provoque pas de défilement horizontal de la page** (`overflow-x`). C'est le défaut classique des bandes défilantes.
- ⚠️ **Ordre de lecture** : en une colonne, l'ordre du DOM devient l'ordre de lecture. 🛑 ❌ **Ne pas réordonner visuellement avec `order`** au point que l'ordre au clavier/lecteur d'écran diverge de l'ordre visuel (AGENTS.md §6).

### ⚠️ Piège n°4 — AC1 : « grille modulaire » ≠ tout réécrire

- ✅ Les composants **`Card`**, **`CardHeader`**, **`SectionHeader`** existent et sont **partagés**. ❌ **Ne pas les remplacer** par des `div` stylés localement ; ✅ les étendre par `className` (ils acceptent déjà `className` et utilisent `twMerge`).
- ⚠️ 🛑 **`Card.tsx` utilise déjà un pseudo-élément `after:`** pour son liseré (story 1.8, correctif de l'Epic 1). ❌ Ne pas le neutraliser en ajoutant un `after:` concurrent dans la grille — **c'est un correctif livré en production**.
- ⚠️ **Tailwind 3.4** : la grille s'exprime en classes utilitaires. ✅ Utiliser les **tokens 6.1** pour les rayons/surfaces/espacements, ❌ pas de nouvelles valeurs en dur (ce serait annuler 6.1).
- ⚠️ ❌ **Aucune dépendance** : pas de bibliothèque de grille/masonry. Une grille CSS suffit.
- ⚠️ **La section reste une vue cliente** (`"use client"`) car le `drag` l'impose, alimentée par le conteneur serveur `About.tsx`. ✅ Conserver ce partage — ❌ ne pas déplacer les lectures (`getHobbies`, `getPublicStacks`, `getPublicCv`) vers le client.
- 🛑 **`id="about"` doit être PRÉSERVÉ** : c'est l'ancre du `Header` (`#about`) et un identifiant de section unique dont dépend le **repérage de section de la story 6.5**.

### ⚠️ Piège n°5 — Périmètre

- ❌ **Hors périmètre** : **toute migration Prisma** · les **lectures** (`About.tsx`, `lib/timeline.ts`, `lib/projects.ts`, `lib/cv.ts`) · `/admin` (hobbies gérés en 5.14) · **le contenu éditorial** des cartes (textes, images) · `Card.tsx` **au-delà du strict nécessaire** · l'inclinaison/halo des cartes projet (**6.8**) · `/cv` (6.11) · contact (6.12) · **la section compétences (6.13)** · chiffres (6.14) · le `Header` · **toute dépendance**.
- 🛑 ⚠️ **Le débordement le plus probable** : « puisque je refais la grille, autant améliorer la toolbox / repointer le lien CV / ajouter un survol ». ❌ **Non** — ce sont 6.13, 6.11 et 6.8. **Une story, rien qu'une story, toute la story.**
- ⚠️ Cette story est **de la mise en page**. 🛑 Si elle commence à toucher des lectures ou des données, elle déborde.

### ⚠️ Piège n°6 — Vérification locale, les 4 AC

- **AC1** : la section est **une grille unique** dont les blocs ont des tailles **différentes et justifiées** par leur contenu. 🛑 ❌ Quatre cartes toutes à `h-[380px]` = AC1 non satisfait.
- **AC2** : 🛑 **Test décisif** — les vignettes de centres d'intérêt sont **toujours déplaçables à la souris**, restent **dans leur cadre**, et **ne s'échappent pas** de la carte. Vérifier après **redimensionnement** de la fenêtre.
- **AC3** : 🛑 **Sur un vrai téléphone** (ou émulation) — lecture **verticale**, **aucun contenu tronqué ni masqué**, ❌ **aucun défilement horizontal de la page**, et le **défilement vertical n'est pas capturé** par le bloc manipulable. 🛑 Vérifier que **toutes** les vignettes de hobbies sont visibles.
- **AC4** : 🛑 mouvement réduit activé → **drag désactivé**, **bandes immobiles**, **memoji sans pulsation**. 🛑 **Et surtout** : tout le contenu **reste lisible et atteignable** — aucune bande immobile ne masque ses éléments.
- **Accessibilité** : parcours **clavier** complet dans la section, focus **visibles** (tokens 6.1), ordre du DOM = ordre visuel, contrastes AA.
- **Cas limites** : **aucun hobby** en base → la carte ne doit pas être un cadre vide ; **aucun CV** → l'état neutre « CV bientôt disponible. » est **préservé** ; **base injoignable** → le repli statique s'affiche normalement.
- 🛑 **Non-régression** : **`/` toujours `○ (Static, 1h)`** · **ancre `#about` fonctionnelle** depuis le menu · `/preview` intact · liseré de `Card` (story 1.8) intact.

## Tasks / Subtasks

- [x] **Tâche 0 — Prérequis, état réel & décisions** (AC: 1, 2)
  - [x] 6.1 et 6.2 `done`. 🛑 **Relire l'état RÉEL de `AboutClient.tsx` sur `DEV`** : 6.11 / 6.13 / 6.4 sont-elles fusionnées ? **Le noter dans les notes de complétion.**
  - [x] 🛑 **Décider et documenter** : quels blocs gardent une **hauteur explicite** (⚠️ le bloc manipulable en a **besoin**, piège n°1) et lesquels s'ajustent · disposition cible aux trois paliers.
- [x] **Tâche 1 — Grille unifiée** (AC: 1, 3 ; pièges n°3, n°4)
  - [x] Fusionner les **deux `div` de grille** en **une seule grille modulaire**, tailles **différenciées par bloc**. ✅ Réutiliser `Card`/`CardHeader`/`SectionHeader` (`className` + `twMerge`), **tokens 6.1**. ❌ Aucune valeur en dur, ❌ aucune dépendance.
  - [x] 🛑 **`id="about"` PRÉSERVÉ**. ⚠️ Ne pas neutraliser le `after:` de `Card` (liseré, story 1.8).
- [x] **Tâche 2 — Bloc manipulable** (AC: 2 ; piège n°1)
  - [x] 🛑 **Conserver** `constraintRef`, le conteneur **`relative`** ET **sa hauteur**, `dragConstraints`, `drag={!shouldReduceMotion}`, le `transition` conditionnel, et les **`posLeft`/`posTop` venant de la base**.
  - [ ] Vérifier **après refonte** que les vignettes restent **dans le cadre** — y compris au redimensionnement.
- [ ] **Tâche 3 — Mobile** (AC: 3 ; piège n°3)
  - [ ] Lecture **verticale**, ❌ **aucun `hidden`** ni troncature, ❌ **aucun défilement horizontal**, ordre du DOM = ordre visuel. ⚠️ Vérifier les **vignettes hors cadre** et la **capture du défilement** par le drag.
- [ ] **Tâche 4 — Mouvement réduit** (AC: 4 ; piège n°2)
  - [ ] Vérifier **à l'œil** les **trois** animations (drag, deux bandes, memoji). 🛑 **Et que rien n'est masqué** une fois figé. Tout effet **ajouté** porte sa neutralisation via `useReducedMotion` (6.2).
- [ ] **Tâche 5 — Vérification locale** (AC: 1-4 ; piège n°6)
  - [ ] Les 4 AC un par un, dont **drag après redimensionnement** (AC2), **vrai téléphone** (AC3), **mouvement réduit avec contenu atteignable** (AC4). Cas limites : aucun hobby, aucun CV, base injoignable. Clavier + contrastes.
- [x] **Tâche 6 — Definition of Done** (AGENTS.md §8)
  - [x] `bun run lint` 0 / `bunx tsc --noEmit` 0 / `bun run build` OK — 🛑 **`/` toujours `○ (Static, 1h)`**.
  - [x] `git diff DEV` : **`AboutClient.tsx` essentiellement seul**. ❌ Aucune migration, aucune dépendance, lectures / `About.tsx` / `/admin` / `Header.tsx` intacts. 🛑 **Aucun travail de 6.8, 6.11 ou 6.13 aspiré.**
  - [x] `File List` + `Completion Notes` (⚠️ **dont l'état des stories concurrentes**) + `Change Log` · `sprint-status.yaml`.

## Dev Notes

### Périmètre — verrouillé

**Refondre la mise en page de la section « À propos » en une grille modulaire unique dont chaque bloc porte une taille adaptée à son contenu (au lieu des quatre cartes uniformément figées à `h-[380px]` réparties sur deux grilles séparées), en préservant intégralement le mécanisme de déplacement des centres d'intérêt — `ref` de contraintes, conteneur `relative` avec hauteur, coordonnées `posLeft`/`posTop` issues de la base — et en garantissant une lecture verticale sans perte de contenu sur téléphone ainsi que la neutralisation vérifiée des trois animations existantes sous mouvement réduit. Mise en page pure : aucune lecture, aucune donnée, aucune dépendance.**

**Hors périmètre — ne pas faire :**
- ❌ **Casser le `drag` des hobbies** en retirant `relative`, la hauteur du conteneur de contrainte, ou en déplaçant le `ref` (piège n°1 — échec **silencieux**).
- ❌ **Remplacer `posLeft`/`posTop` par une disposition en dur** (données administrables, story 5.14).
- ❌ **Masquer une carte (`hidden`) ou tronquer du contenu sur mobile** — c'est exactement la perte de contenu qu'AC3 interdit.
- ❌ **Neutraliser le `after:` de `Card`** (liseré, correctif de production story 1.8).
- ❌ **Renommer `id="about"`** (ancre du menu, repérage de section 6.5).
- ❌ **Réordonner visuellement** au point de désaligner l'ordre visuel et l'ordre au clavier.
- ❌ **Aspirer le travail des stories voisines** : inclinaison/halo (6.8), lien `/cv` (6.11), refonte de la toolbox (6.13).
- ❌ **Déplacer les lectures vers le client** · toute migration · toute dépendance (bibliothèque de grille/masonry incluse).

### Le vrai enjeu

C'est une story de **mise en page**, et son unique vraie difficulté est une **tension entre deux AC**. AC1 demande des blocs « à la taille de leur contenu » — ce qui invite à supprimer les `h-[380px]` uniformes ; or AC2 exige de préserver le bloc manipulable, dont le mécanisme repose sur un conteneur `relative` **qui a besoin d'une hauteur** pour que `dragConstraints` définisse une aire de jeu. Retirer cette hauteur au nom d'AC1 fait s'effondrer la zone à zéro pixel : les vignettes deviennent indéplaçables ou disparaissent, **sans aucune erreur**. La résolution est d'admettre que la « taille adaptée » de cette carte-là *est* une hauteur explicite. Le second risque n'est pas technique mais organisationnel : `AboutClient.tsx` est touché par **quatre stories** de l'Epic 6, et la première action doit être de relire son état réel sur `DEV` plutôt que de se fier à une description. Enfin, AC4 est moins une tâche qu'une **vérification** : les trois animations présentes sont déjà couvertes par le socle 6.2 — ce qui reste à prouver, c'est que figées, elles **ne masquent rien**.

### Testing standards

Vérification **manuelle** des 4 AC, avec trois tests décisifs : **déplacer les vignettes de centres d'intérêt après la refonte, puis redimensionner la fenêtre et recommencer** — elles doivent rester dans leur cadre (AC2) ; **ouvrir la section sur un vrai téléphone** pour constater la lecture verticale, l'absence de troncature, l'absence de défilement horizontal et le fait que le défilement vertical n'est pas capturé par le drag (AC3) ; **activer le mouvement réduit** et vérifier les trois animations figées **et** que tout le contenu reste lisible et atteignable (AC4). Plus les cas limites (aucun hobby, aucun CV, base injoignable), le parcours clavier avec focus visibles, les contrastes AA, et les non-régressions : `/` toujours `○ (Static, 1h)`, ancre `#about` fonctionnelle, `/preview` intact, liseré de `Card` conservé. `lint`/`tsc`/`build` verts.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.15 ; en-tête Epic 6 — contrainte transverse : chaque story introduisant du mouvement porte son propre critère de neutralisation]
- [Source: PLAN_REFONTE_2026.md §4.2 P3 n°11 — « Bento grid pour la section À propos (la carte hobbies draggable est un bon point de départ, la généraliser) »]
- [Source: AGENTS.md §6 — `prefers-reduced-motion` sur chaque animation, contrastes AA, focus visibles, navigation clavier, identifiants de section uniques ; §9 règles 1 et 2 — une story = une branche, périmètre verrouillé]
- [Source: apps/web/src/sections/AboutClient.tsx — quatre cartes TOUTES à `h-[380px]` sur DEUX grilles séparées (constat qui fonde AC1) ; `constraintRef` + conteneur `relative flex-1` + `dragConstraints` + `drag={!shouldReduceMotion}` + `transition` conditionnel (AC2/AC4, story 4.2) ; `posLeft`/`posTop` issus de la BASE ; `animate-move-left/right` et `animate-ping` (AC4) ; état neutre « CV bientôt disponible. » à préserver ; `id="about"` à PRÉSERVER. ⚠️ FICHIER PARTAGÉ avec 6.4, 6.11 et 6.13]
- [Source: apps/web/src/sections/About.tsx — conteneur serveur : `getHobbies()`, `getPublicStacks()`, `getPublicCv()` en parallèle. NE PAS déplacer ces lectures]
- [Source: apps/web/prisma/schema.prisma — `model Hobby { slug, title, emoji, posLeft, posTop, sortOrder }` : les coordonnées sont des DONNÉES administrables (5.14), pas des constantes de mise en page]
- [Source: apps/web/src/components/Card.tsx:13 — pseudo-élément `after:` du liseré (correctif story 1.8) : ne pas le neutraliser]
- [Source: apps/web/src/components/ToolboxItems.tsx — `flex-none` + `mask-image` : risque de débordement horizontal sur mobile (AC3) et de contenu masqué une fois l'animation figée (AC4)]
- [Source: apps/web/src/sections/Header.tsx — ancre `#about` : l'identifiant de section doit être préservé (repérage de section, story 6.5)]
- [Source: apps/web/src/app/page.tsx:16-29 — garde-fou : `/` doit rester `○ (Static, 1h)` ; la section est aussi rendue par `/preview` (5.11)]
- [Source: apps/web/package.json — `motion` 12 et `tailwind-merge` DÉJÀ installés ; Tailwind 3.4 : aucune bibliothèque de grille à ajouter]

## Dev Agent Record

### Agent Model Used

claude-opus-5 (Claude Code)

### Completion Notes

**🛑 État RÉEL de `AboutClient.tsx` au moment de l'implémentation** (première action obligatoire, tâche 0). Le fichier avait déjà divergé de la description de la story :

| Story | Attendu par la story | État constaté |
|---|---|---|
| **6.11** (CV) | `ready-for-dev` | ✅ **DÉJÀ FUSIONNÉE** — la carte pointe `/cv` via `next/link`, sans `target="_blank"`. **Conservée telle quelle.** |
| **6.4** (révélation) | `ready-for-dev` | ✅ **DÉJÀ FUSIONNÉE** — deux `Reveal` enveloppaient les deux rangées de grille, avec cascade par `index`. |
| **6.13** (compétences) | pouvait remplacer la toolbox | ✅ Fusionnée, mais **la toolbox est INTACTE** : décision Jeevons, la nouvelle section « Stack & outils » a été ajoutée **sans** la remplacer (décorative vs informative). |
| **6.8** (halo cartes) | non listée | ✅ **DÉJÀ FUSIONNÉE** dans `Card.tsx` (prop `as` + calque de halo, inertes par défaut). **`Card.tsx` non touché.** |

**Décisions de dimensionnement** (tâche 0 — résolution documentée de la tension AC1/AC2) :

| Bloc | Hauteur | Justification |
|---|---|---|
| Centres d'intérêt | **explicite, `h-[380px]`** | 🛑 C'est une **aire de jeu**, pas du contenu qui coule : sa « taille adaptée » *est* une hauteur. Sans elle, `flex-1` n'a rien à remplir, le conteneur de contrainte s'effondre à 0 px et les vignettes deviennent indéplaçables — **échec silencieux**, sans erreur. |
| Carte / memoji | **explicite, `h-[320px]`** | Contenu = image de fond en `object-cover`, sans hauteur intrinsèque. **Valeur différente des hobbies** : rien n'oblige les blocs à s'aligner, c'est le point d'AC1. |
| CV | **libre** | Se règle sur la vignette, et se réduit franchement dans l'état neutre. |
| Toolbox | **libre** | Se règle sur ses deux bandes. |

**Points d'implémentation :**

- **Grille unique** : les deux `div` de grille indépendants ont fusionné en une seule (`grid-cols-1 md:grid-cols-5 lg:grid-cols-3`). Vérifié sur le HTML servi : `md:grid-cols-5` passe de **2 occurrences à 1**.
- 🛑 **`items-start` est indispensable** et non cosmétique : sans lui, `align-items: stretch` réétirerait les cartes à hauteur libre jusqu'à la hauteur de leur rangée — rétablissant exactement l'uniformité qu'AC1 corrige.
- **Cascade 6.4 préservée, et même améliorée.** Le commentaire de 6.4 notait à raison qu'envelopper une carte appliquerait le `col-span` au wrapper. La grille étant désormais unique, la correction propre était de **déplacer les `col-span` sur les `Reveal`** : le wrapper devient l'élément de grille. On passe ainsi d'une cascade en deux rangées à une **cascade carte par carte** (`index` 0→3), sans rien perdre.
- 🛑 **AC2 intégralement préservé** : `constraintRef`, le conteneur `relative flex-1`, `dragConstraints`, `drag={!shouldReduceMotion}` et le `transition` conditionnel sont **inchangés, au même endroit**. Les `posLeft`/`posTop` restent ceux de la **base** (vérifié : 7 vignettes rendues aux coordonnées `5%`→`70%`).
- ⚠️ Les coordonnées étant en **pourcentages**, elles sont relatives au conteneur et donc **robustes au redimensionnement et au passage sur mobile** — le risque « vignettes hors cadre » d'AC3 est structurellement écarté (`posTop` max 70 % d'une aire d'environ 245 px ≈ 172 px).
- **Aucune animation ajoutée** par cette story, donc aucun nouveau critère de neutralisation à porter. Les trois animations existantes sont inchangées.

**Vérifications effectuées** (HTML servi par le conteneur, base réelle) :

- **AC1** — une seule grille (`md:grid-cols-5` × 1) ; hauteurs **différenciées** : un `h-[380px]`, un `h-[320px]`, deux cartes **sans hauteur**. ❌ Plus aucune uniformité à 380 px.
- **AC2** — conteneur `relative flex-1` porteur du `ref` présent × 1, à l'intérieur d'une carte qui conserve sa hauteur ; 7 vignettes aux coordonnées de la base.
- **AC3** (structurel) — `grid-cols-1` sur petit écran ; **0 `order-*`** (ordre du DOM = ordre visuel) ; **0 `hidden`** (aucune perte de contenu).
- **AC4** — règle globale 6.2 (`prefers-reduced-motion`) confirmée dans `globals.css` ; `animate-move-left/right` et `animate-ping` toujours présents et couverts ; `drag` neutralisé en JS.
- **Non-régressions** — `id="about"` préservé (×1) ; **liseré `after:` de `Card` (story 1.8) intact** (15 occurrences) ; `/preview` répond normalement (181 Ko) avec la section ; `bun run build` → **`┌ ○ / 1h 1y`**.
- **Périmètre** — `git diff` : **`AboutClient.tsx` seul** (+ `sprint-status.yaml`). Aucune migration, aucune dépendance ; `About.tsx`, les lectures, `Card.tsx`, `ToolboxItems.tsx`, `/admin` et `Header.tsx` **non touchés**. Aucun travail de 6.8 / 6.11 / 6.13 aspiré.
- `bunx tsc --noEmit` : 0. `eslint .` : 0.

**🛑 Restant à vérifier par Jeevons** (hors de portée d'un contrôle sur le HTML servi) :

- **AC2, test décisif** : déplacer les vignettes à la souris, **puis redimensionner la fenêtre et recommencer** — elles doivent rester dans leur cadre.
- **AC3, vrai téléphone** : lecture verticale, aucune troncature, **aucun défilement horizontal**, et surtout **le défilement vertical de la page ne doit pas être capturé** par le bloc manipulable au doigt.
- **AC4, mouvement réduit activé** : drag désactivé, bandes immobiles, memoji sans pulsation — **et surtout que rien ne soit masqué** une fois figé. ⚠️ **Point d'attention signalé mais NON traité** : `ToolboxItems` combine `flex-none` et un `mask-image` en dégradé ; figée, la bande peut laisser certains éléments hors du cadre visible. Ce comportement est **antérieur à cette story** (`ToolboxItems.tsx` n'a pas été modifié) et le corriger relèverait de la toolbox elle-même, hors périmètre ici. À arbitrer.
- **Cas limite « aucun hobby »** : **non vérifié**. La suppression des hobbies en base n'est pas observable sans purger le tag de cache (`getHobbies()` passe par `unstable_cache`, que `/preview` ne contourne pas). La base a été **restaurée à l'identique** (7 hobbies). À contrôler depuis `/admin` si le cas doit être couvert.
- Parcours **clavier** complet, focus visibles, contrastes AA.

### File List

**Modifiés :**
- `apps/web/src/sections/AboutClient.tsx` — grille modulaire unique, hauteurs différenciées par bloc, cascade de révélation déplacée sur les wrappers de grille
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — statut de la story

### Change Log

| Date | Version | Description |
| --- | --- | --- |
| 2026-07-27 | 1.0 | Fusion des deux grilles de la section « À propos » en une grille modulaire unique, chaque bloc dimensionné selon son contenu (hauteur explicite conservée pour l'aire de jeu des centres d'intérêt et la carte, hauteur libre pour le CV et la toolbox). Mécanisme de déplacement intégralement préservé. `/` reste `○ (Static, 1h)`. |
