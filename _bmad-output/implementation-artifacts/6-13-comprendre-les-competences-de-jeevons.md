---
baseline_commit: c408eae7818fb33ef915a70085775688fbf80640
---

# Story 6.13: Comprendre les compétences de Jeevons

Status: ready-for-dev

## Story

As **recruteur**,
I want **voir les technologies maîtrisées et le niveau sur chacune**,
so that **je juge rapidement de l'adéquation à mon poste**.

## Acceptance Criteria

**AC1 — Regroupement par domaine et niveau affiché, depuis la base**
**Given** les technologies sont aujourd'hui présentées sans hiérarchie
**When** cette story est terminée
**Then** elles sont regroupées par domaine et le niveau de maîtrise est indiqué pour chacune
**And** ces informations proviennent de la base, telles que saisies en administration

**AC2 — Niveau compréhensible sans la couleur, et accessible**
**Given** le niveau est représenté visuellement
**When** je consulte cette section
**Then** il reste compréhensible sans dépendre uniquement de la couleur
**And** il est accessible aux technologies d'assistance

**AC3 — Section masquée plutôt que vide**
**Given** aucune technologie n'est enregistrée
**When** la section se rend
**Then** elle est masquée plutôt que présentée vide

## Contexte d'implémentation

### 🛑 Prérequis : stories 6.1 (tokens) et 6.2 (socle motion) `done`

Les badges de niveau et les groupes reprennent les **tokens 6.1** (couleurs d'accent, rayons, espacements). Toute animation d'entrée relève du **socle 6.2** et de la révélation au défilement de **6.4**. PLAN §4.3 : « **Section « Stack & outils »** enrichie : niveau de maîtrise par techno, groupée par domaine ».

### 🛑 DÉCISION BLOQUANTE — « regroupées par domaine » : AUCUN champ ne porte le domaine

- 🛑 Vérifié dans `prisma/schema.prisma` :
  ```prisma
  model Stack {
    id       String      @id @default(cuid())
    name     String      @unique
    iconKey  String?
    level    SkillLevel?
    projects Project[]   @relation("ProjectStacks")
  }
  ```
  **Il n'y a ni `domain`, ni `category`, ni `group`.** AC1 exige pourtant un regroupement par domaine, **« telles que saisies en administration »**.
- 🛑 **C'est LA décision de cette story, et elle appartient à Jeevons.** ⚠️ Elle a une conséquence lourde : la seule voie qui satisfait littéralement AC1 (« saisies en administration ») demande **une migration Prisma ET une modification de l'écran `/admin/stacks`** — soit deux choses qu'AGENTS.md §9 règle 2 interdit d'entreprendre seul.
- 🛑 **ARRÊTEZ-VOUS ET DEMANDEZ À JEEVONS.** Les options à lui présenter :
  1. ✅ **Ajouter un champ de domaine** (`domain String?`) sur `Stack` — migration **additive** (nullable, aucune donnée perdue) + un champ dans le formulaire admin (`stack-form.tsx`, `schemas/stack.ts`, `actions.ts`) + le seed. **C'est la seule voie qui satisfait AC1 à la lettre.** ⚠️ Élargit nettement le périmètre : la story déborde sur l'Epic 5.
  2. **Regrouper par une règle de code** (une table de correspondance `nom/iconKey → domaine` dans `lib/`). ⚠️ Aucune migration, aucun écran admin — mais **contredit « telles que saisies en administration »** pour le domaine (le niveau, lui, vient bien de la base). ⚠️ Chaque nouvelle technologie créée en administration atterrirait dans un groupe « Autres » jusqu'à un changement de code.
  3. **Ne pas regrouper** et livrer le niveau seul. ⚠️ **AC1 n'est alors pas satisfait** : le dire explicitement, ne pas marquer la story `done`.
- ❌ **Ne tranchez pas seul, et n'écrivez aucune migration avant sa réponse.**
- ⚠️ Si l'option 1 est retenue : la migration doit être **additive et nullable** (motif de `TimelineEntry.avatarId` en 5.14) ; les technologies existantes restent sans domaine et doivent atterrir dans un groupe de repli lisible, ❌ jamais disparaître.

### ✅ Ce qui existe déjà — et le fait surprenant sur le niveau

| Besoin | Existant | Fichier |
|---|---|---|
| niveau en base | **`level SkillLevel?`** ✅ (`LEARNING` / `COMFORTABLE` / `STRONG`) | `prisma/schema.prisma` |
| saisie du niveau en admin | ✅ story 5.15, `/admin/stacks` | `admin/stacks/stack-form.tsx` |
| libellés français des niveaux | **`SKILL_LEVEL_LABELS`** ✅ (`Solide` / `À l'aise` / `En apprentissage`) | `lib/schemas/stack.ts` |
| lecture publique cachée + repli | **`getPublicStacks()`** ✅ (`unstable_cache` tag `projects`, `readWithFallback`) | `lib/projects.ts` |
| icônes | **`resolveStackIcon`** ✅ (repli neutre si clé inconnue) | `components/StackIcon.tsx` |
| domaine | ❌ **N'EXISTE PAS** | — |

- 🛑 **Le fait à connaître avant tout** : aujourd'hui **le niveau n'est PAS affiché**. `getPublicStacks()` le lit et **s'en sert uniquement pour TRIER** la bande défilante. Le commentaire de `lib/projects.ts` l'explicite : « décision Jeevons : **le niveau ordonne, il ne s'affiche pas en badge** ».
- 🛑 ⚠️ **AC1 renverse cette décision** (« le niveau de maîtrise est indiqué pour chacune »). ✅ C'est **assumé et voulu** — mais il faut alors **mettre à jour le commentaire de `lib/projects.ts`**, qui devient faux, exactement comme la story 6.10 doit corriger celui de `sitemap.ts`. ❌ Ne pas laisser une justification périmée dans le code.
- ⚠️ **`SKILL_LEVEL_LABELS` est dans `lib/schemas/stack.ts`**, un module **sans `server-only`**, donc importable côté client. ✅ **Le réutiliser tel quel** — ❌ ne pas recopier les libellés dans la section publique, ce serait exactement la dérive que le commentaire de `stack-icons.ts` met en garde (« deux listes séparées dérivent »).

### 🛑 Piège n°1 (CENTRAL) — AC3 : « masquée » ne veut PAS dire « masquée en CSS »

- 🛑 Le rendu doit **ne rien émettre** : `if (stacks.length === 0) return null;` côté serveur. ❌ Pas de `hidden`, pas de `display:none`, pas de `sr-only` — un lecteur d'écran annoncerait quand même un titre de section suivi de rien, et le DOM porterait une section fantôme.
- ⚠️ Le dépôt a **déjà ce réflexe** et le documente : `ProjectCard.tsx` ne rend ni bloc vide ni `<ul>` vide, « que les lecteurs d'écran annonceraient tout de même comme *liste, 0 élément* ». ✅ **Reproduire ce standard.**
- 🛑 ⚠️ **Le cas « aucune technologie » est en pratique difficile à atteindre — et c'est un piège** : `getPublicStacks()` passe par `readWithFallback`, qui sert **six technologies de repli** (`content/stacks.ts`) si la base est injoignable. Une base **vide mais joignable** renvoie bien `[]` ; une base **injoignable** renvoie **six entrées**. ✅ **Les deux comportements sont corrects** (le repli est le filet de la story 4.5), mais **il faut le savoir pour tester AC3** : vider la table, ❌ pas couper la base.
- ⚠️ **Si un groupe de domaine est vide**, il ne doit pas être rendu non plus — même règle, à l'échelle du groupe.
- ⚠️ AC3 impose aussi de penser à l'**ancre** : si la section porte un `id` et disparaît, un lien vers cette ancre ne mènerait nulle part. ✅ Ne pas ajouter d'entrée de menu vers cette section (voir piège n°4).

### 🛑 Piège n°2 — AC2 : le niveau ne doit pas dépendre de la couleur, et doit être annoncé

- 🛑 **C'est le piège d'accessibilité de la story, et il est classique** : représenter le niveau par trois points/barres colorés est joli — et **illisible** pour un daltonien comme pour un lecteur d'écran. AGENTS.md §6 : accessibilité **non négociable**.
- ✅ **La voie la plus sûre** : afficher le **libellé textuel** (`SKILL_LEVEL_LABELS` : « Solide », « À l'aise », « En apprentissage ») **visible à l'écran**, éventuellement accompagné d'un indicateur visuel. Un texte visible satisfait **les deux moitiés d'AC2 d'un coup**.
- ⚠️ Si un indicateur graphique (barres, points) est ajouté : il doit être **`aria-hidden="true"`** et **doublé d'un texte** — ❌ jamais un `title` seul (non annoncé de façon fiable, invisible au clavier), ❌ jamais la couleur seule, ❌ jamais un `aria-label` sur un `<div>` non sémantique.
- ⚠️ **`level` est NULLABLE** (schéma 4.1, et le seed ne le renseigne pas — `lib/projects.ts` le rappelle). 🛑 **Que fait-on d'une technologie sans niveau ?** ✅ **Décider et documenter** : l'afficher **sans badge** (recommandé — cohérent avec « les technologies sans niveau passent en dernier plutôt que d'être masquées ») plutôt que d'inventer un niveau par défaut. ❌ **Ne jamais la masquer.**
- ⚠️ **Sémantique** : une liste de technologies est une **liste** (`<ul>`/`<li>`), et un groupe de domaine mérite un **titre de niveau cohérent** avec la hiérarchie de la page (le `SectionHeader` existant porte déjà le titre de section). ❌ Ne pas casser l'ordre des niveaux de titre.
- ⚠️ **Contrastes AA** sur les badges (tokens 6.1) — les fonds d'accent clairs avec du texte clair sont le piège habituel.

### 🛑 Piège n°3 — La toolbox existante : remplacer, compléter, ou dupliquer ?

- 🛑 ⚠️ **Il existe déjà un affichage des technologies** : la carte « Mon pack d'explorateur » dans `AboutClient.tsx`, qui rend **deux bandes défilantes** `ToolboxItems` alimentées par **les mêmes `getPublicStacks()`**.
- 🛑 **Décision à prendre et documenter** — c'est structurant :
  - **A.** Une **nouvelle section** « Stack & outils » (PLAN §4.3 la nomme ainsi), la toolbox restant en place. ⚠️ Risque : **les mêmes technologies affichées deux fois** sur la page, à quelques centaines de pixels d'écart. **Redondance visible pour le recruteur.**
  - **B.** ✅ **Remplacer le contenu de la carte** « Mon pack d'explorateur » par la présentation groupée + niveaux. ⚠️ Mais la carte fait `h-[380px]` et vit dans une grille — un contenu groupé y tiendra mal. ⚠️ Et **la story 6.15 refond précisément cette grille** : conflit direct.
  - **C.** Nouvelle section **et** toolbox réduite à un rôle purement décoratif.
- ⚠️ 🛑 **Quelle que soit l'option, la story 6.15 (grille modulaire de la section À propos) touche le même fichier `AboutClient.tsx`.** **Deux stories, deux branches** (AGENTS.md §9 règle 1) : **relire l'état réel du fichier avant de commencer** et signaler le chevauchement dans les notes de complétion.
- ⚠️ Si `ToolboxItems` est retiré, ❌ **ne pas supprimer le composant** sans vérifier qu'il n'est plus utilisé ailleurs — et ne pas supprimer `content/stacks.ts`, qui **sert de repli 4.5**.
- ⚠️ Les bandes défilantes `animate-move-left/right` sont des **animations décoratives** déjà couvertes par le socle 6.2. ❌ Ne pas les « réparer » ici.

### ⚠️ Piège n°4 — Où poser la section, et l'ordre de tri

- ✅ La section se rend depuis `page.tsx` (et **`/preview`**, story 5.11 — ⚠️ vérifier les deux). ⚠️ Suivre le motif **conteneur serveur `async` + vue cliente si besoin** (`About.tsx` / `AboutClient.tsx`). 🛑 Si aucune interactivité n'est requise, ✅ **rester en composant serveur pur** — pas de `"use client"` par réflexe.
- 🛑 **Identifiants de section uniques** (AGENTS.md §6) : si la section porte un `id`, il doit être **nouveau et unique** — ❌ ne pas réutiliser `#about`. ⚠️ **Et ne pas ajouter d'entrée dans le `Header`** : le menu (`#hero`, `#projects`, `#parcours`, `#about`, `#contact`) est le socle du repérage de section de la **story 6.5** ; y toucher est hors périmètre et pourrait pointer vers une section masquée (AC3).
- ⚠️ **Le tri** : `getPublicStacks()` renvoie déjà les technologies **triées par niveau décroissant puis par nom**. ✅ **Conserver ce tri à l'intérieur de chaque groupe** — ❌ ne pas retrier par nom seul, ce qui annulerait la hiérarchie. ⚠️ `AboutClient.tsx` porte déjà cet avertissement en commentaire (« on ne retrie SURTOUT pas ici ») : il vaut aussi pour la nouvelle section.
- ⚠️ **L'ordre des groupes de domaine** doit être **déterministe** (ordre défini explicitement, pas l'ordre d'itération d'un objet) — sinon les groupes changeraient de place d'un rendu à l'autre.
- ⚠️ **Discipline ISR** : la page reste **`○ (Static, 1h)`**. `getPublicStacks()` est déjà cachée sous le tag `projects` ✅ — une mutation admin l'invalide. ❌ Aucune API dynamique dans le rendu.

### ⚠️ Piège n°5 — Périmètre

- ❌ **Hors périmètre** : **une migration hors de celle validée en tâche 0** · l'écran `/admin/stacks` **au-delà du strict champ de domaine si l'option 1 est retenue** · `getPublicStacks()` (à consommer, pas à réécrire — sauf le commentaire devenu faux) · `resolveStackIcon` / `stack-icons.ts` · le `Header` · `/cv` (6.11) · contact (6.12) · chiffres (6.14) · **la refonte de la grille À propos (6.15)** · **toute dépendance**.
- 🛑 ⚠️ **Le risque majeur de cette story est le débordement sur l'Epic 5.** Si l'option 1 est retenue, se limiter **strictement** à : migration additive + champ dans le formulaire + schéma + action + seed. ❌ Rien d'autre dans l'administration.

### ⚠️ Piège n°6 — Vérification locale, les 3 AC

- **AC1** : les technologies apparaissent **groupées par domaine**, chacune avec **son niveau**. 🛑 **Test décisif** — modifier un niveau (et un domaine, si option 1) depuis **`/admin/stacks`**, puis recharger la page publique **sans rebuild** : le changement est visible (chaîne `revalidateTag('projects')`).
- **AC2** : 🛑 **en niveaux de gris** (filtre des outils de développement), le niveau reste **compréhensible**. Au **lecteur d'écran**, chaque technologie annonce **son niveau**. ❌ Une couleur seule, un `title` seul ou un point non doublé de texte sont des échecs. Vérifier une technologie **sans niveau** : présente, sans badge.
- **AC3** : 🛑 **vider la table `Stack`** (ne PAS couper la base — le repli servirait six entrées, piège n°1) → la section **n'apparaît pas dans le DOM du tout**. Vérifier dans l'inspecteur, pas seulement à l'œil.
- 🛑 **Non-régression** : **`/` toujours `○ (Static, 1h)`** · `/preview` intact · pas de doublon d'affichage des technologies (piège n°3) · ancres du menu inchangées · contrastes AA.

## Tasks / Subtasks

- [ ] **Tâche 0 — 🛑 DÉCISION BLOQUANTE & prérequis** (AC: 1)
  - [ ] 6.1 et 6.2 `done`. 🛑 **ARRÊTER ET DEMANDER À JEEVONS** : d'où vient le **domaine** ? (champ en base + admin **recommandé si AC1 doit être satisfait à la lettre** / table de correspondance en code / abandon du regroupement). ❌ **Aucune migration avant sa réponse.**
  - [ ] 🛑 **Décider et documenter** : nouvelle section **ou** remplacement de la toolbox (piège n°3, ⚠️ conflit 6.15) · sort d'une technologie **sans niveau** (afficher sans badge, recommandé) · ordre déterministe des groupes.
- [ ] **Tâche 1 — Domaine** (AC: 1 ; selon la tâche 0)
  - [ ] Si option 1 : migration **additive nullable** sur `Stack` (motif `TimelineEntry.avatarId`, 5.14) + champ dans `schemas/stack.ts`, `stack-form.tsx`, `actions.ts` + seed. 🛑 **Rien d'autre dans l'administration.** Les technologies sans domaine → **groupe de repli lisible**, ❌ jamais masquées.
  - [ ] Si option 2 : table de correspondance dans `lib/`, avec un **groupe « Autres »** explicite. ⚠️ Documenter que le domaine n'est alors **pas** administrable.
- [ ] **Tâche 2 — Lecture** (AC: 1 ; piège n°4)
  - [ ] ✅ **Consommer `getPublicStacks()`** (déjà cachée tag `projects` + `readWithFallback`). ❌ Pas de Prisma nu, pas de nouvelle lecture. 🛑 **Mettre à jour le commentaire devenu faux** de `lib/projects.ts` (« le niveau ordonne, il ne s'affiche pas en badge »).
  - [ ] Conserver le tri niveau ↓ puis nom **à l'intérieur de chaque groupe**.
- [ ] **Tâche 3 — Rendu de la section** (AC: 1, 2, 3 ; pièges n°1, n°2)
  - [ ] Groupes ordonnés déterministes, listes sémantiques (`<ul>`/`<li>`), titres de niveau cohérents, tokens 6.1, contrastes AA. **Composant serveur** si aucune interactivité.
  - [ ] **Niveau via `SKILL_LEVEL_LABELS`** (importé, ❌ pas recopié), **texte visible**, indicateur graphique éventuel en `aria-hidden`. Technologie sans niveau : **affichée sans badge**.
  - [ ] 🛑 **AC3 : `return null`** si aucune technologie — et pour tout groupe vide. ❌ Pas de masquage CSS.
- [ ] **Tâche 4 — Intégration dans la page** (piège n°3, n°4)
  - [ ] Insertion dans `page.tsx` **et `/preview`**. `id` **unique**, ❌ **aucune entrée ajoutée au `Header`**. ⚠️ Traiter la redondance avec la toolbox selon la décision de la tâche 0 ; **relire l'état réel de `AboutClient.tsx`** (conflit 6.15).
- [ ] **Tâche 5 — Vérification locale** (AC: 1-3 ; piège n°6)
  - [ ] Les 3 AC un par un, dont **modification d'un niveau en administration sans rebuild** (AC1), **niveaux de gris + lecteur d'écran** (AC2), **table `Stack` vidée** — pas base coupée (AC3).
- [ ] **Tâche 6 — Definition of Done** (AGENTS.md §8)
  - [ ] `bun run lint` 0 / `bunx tsc --noEmit` 0 / `bun run build` OK — 🛑 **`/` toujours `○ (Static, 1h)`**.
  - [ ] `git diff DEV` : nouvelle section (+ éventuels migration/champ admin **validés**). ❌ Aucune dépendance, `Header.tsx` intact, aucun débordement Epic 5.
  - [ ] `File List` + `Completion Notes` + `Change Log` · `sprint-status.yaml`.

## Dev Notes

### Périmètre — verrouillé

**Présenter publiquement les technologies groupées par domaine avec leur niveau de maîtrise lisible sans la couleur et annoncé aux technologies d'assistance, en consommant la lecture cachée `getPublicStacks()` et les libellés `SKILL_LEVEL_LABELS` existants, la section ne produisant aucun DOM quand aucune technologie n'est enregistrée — la provenance du « domaine » étant une décision de Jeevons prise AVANT toute écriture de code.**

**Hors périmètre — ne pas faire :**
- ❌ **Écrire une migration Prisma avant la validation de Jeevons** (AGENTS.md §9 règles 2 et 6) — **arrêter et demander**.
- ❌ **Déborder sur l'Epic 5** au-delà du strict champ de domaine, si cette option est retenue.
- ❌ **Masquer la section en CSS** pour AC3 — `return null`, rien dans le DOM.
- ❌ **Représenter le niveau par la couleur seule**, par un `title` seul, ou par un graphique non doublé de texte.
- ❌ **Masquer une technologie sans niveau** (nullable par construction).
- ❌ **Recopier les libellés de niveau** au lieu d'importer `SKILL_LEVEL_LABELS` (dérive garantie).
- ❌ **Réécrire `getPublicStacks()`** ni retrier après elle — mais ✅ **corriger son commentaire devenu faux**.
- ❌ **Ajouter une entrée au `Header`** (repérage de section 6.5, et la section peut disparaître par AC3).
- ❌ **Refondre la grille À propos** (story 6.15) · `/cv` (6.11) · contact (6.12) · chiffres (6.14) · toute dépendance.

### Le vrai enjeu

Deux choses décident du sort de cette story, et **aucune n'est du dessin**. La première est une **impasse de modèle** : AC1 demande un regroupement « par domaine » **« tel que saisi en administration »**, alors que `Stack` ne porte que `name`, `iconKey` et `level`. Satisfaire l'AC à la lettre impose donc une migration **et** une modification de l'écran admin — un débordement sur l'Epic 5 que seul Jeevons peut autoriser. La seconde est un **renversement de décision assumé** : `getPublicStacks()` documente explicitement que « le niveau ordonne, il ne s'affiche pas en badge » ; AC1 demande l'inverse, et le commentaire devra donc être corrigé plutôt que laissé à mentir. Autour de ça, deux vigilances : **AC2 est une exigence d'accessibilité**, pas une préférence esthétique — un texte visible la satisfait entièrement là où trois points colorés échouent deux fois ; et **AC3 se teste en vidant la table, pas en coupant la base**, sinon le repli statique de la story 4.5 sert six technologies et masque le cas à valider.

### Testing standards

Vérification **manuelle** des 3 AC, avec trois tests décisifs : **modifier un niveau depuis `/admin/stacks` et recharger la page publique sans rebuild** (AC1, chaîne `revalidateTag('projects')`) ; **passer la page en niveaux de gris et la parcourir au lecteur d'écran** (AC2) ; **vider la table `Stack`** — surtout pas couper la base — et vérifier dans l'inspecteur que **rien** n'est émis (AC3). Plus le cas d'une technologie sans niveau, les contrastes AA des badges, et les non-régressions : `/` toujours `○ (Static, 1h)`, `/preview` intact, aucune double présentation des technologies, ancres du menu inchangées. `lint`/`tsc`/`build` verts.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.13]
- [Source: PLAN_REFONTE_2026.md §4.3 — « Section « Stack & outils » enrichie : niveau de maîtrise par techno, groupée par domaine »]
- [Source: AGENTS.md §6 — accessibilité non négociable (contrastes AA, jamais la couleur seule), identifiants de section uniques ; §9 règles 2 et 6 — périmètre verrouillé, zéro dépendance/migration hors story]
- [Source: apps/web/prisma/schema.prisma — `model Stack { id, name @unique, iconKey String?, level SkillLevel?, projects }` : **AUCUN champ de domaine** ; `enum SkillLevel { LEARNING, COMFORTABLE, STRONG }`]
- [Source: apps/web/src/lib/projects.ts:55-131 — `getPublicStacks()` (cachée tag `projects`, `readWithFallback`, tri niveau ↓ puis nom) ; COMMENTAIRE À CORRIGER : « décision Jeevons : le niveau ordonne, il ne s'affiche pas en badge » devient faux avec AC1 ; « les technologies sans niveau passent en dernier plutôt que d'être masquées »]
- [Source: apps/web/src/lib/schemas/stack.ts — `SKILL_LEVEL_LABELS` (Solide / À l'aise / En apprentissage), module SANS `server-only` donc importable côté client : à RÉUTILISER, jamais à recopier]
- [Source: apps/web/src/sections/AboutClient.tsx — toolbox « Mon pack d'explorateur » alimentée par les MÊMES `getPublicStacks()` (risque de doublon) ; avertissement « on ne retrie SURTOUT pas ici » ; fichier PARTAGÉ avec la story 6.15]
- [Source: apps/web/src/content/fallbacks.ts:100-114 — `fallbackStacks()` sert SIX technologies si la base est injoignable : c'est pourquoi AC3 se teste table vidée, pas base coupée]
- [Source: apps/web/src/components/ProjectCard.tsx:114-138 — standard « section absente plutôt que vide », `<ul>` vide annoncé « liste, 0 élément » : à reproduire pour AC3]
- [Source: apps/web/src/lib/stack-icons.ts — mise en garde « deux listes séparées dérivent » (fondement du réemploi de `SKILL_LEVEL_LABELS`) ; `resolveStackIcon` retombe sur une icône neutre : NE PAS MODIFIER]
- [Source: apps/web/src/sections/Header.tsx — menu d'ancres : ne pas y ajouter cette section (repérage 6.5, et la section peut être absente par AC3)]
- [Source: apps/web/src/app/page.tsx:16-29 — `revalidate` littéral, garde-fou anti-rendu-dynamique ; la section est aussi à intégrer dans `/preview` (5.11)]
- [Source: apps/web/prisma/schema.prisma (TimelineEntry.avatarId, story 5.14) — motif de MIGRATION ADDITIVE NULLABLE à suivre si un champ de domaine est validé]

## Dev Agent Record

### Agent Model Used

### Completion Notes

### File List

### Change Log
