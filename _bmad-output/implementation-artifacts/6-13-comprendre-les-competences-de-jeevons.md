---
baseline_commit: c408eae7818fb33ef915a70085775688fbf80640
---

# Story 6.13: Comprendre les compétences de Jeevons

Status: review

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

- [x] **Tâche 0 — 🛑 DÉCISION BLOQUANTE & prérequis** (AC: 1)
  - [x] 6.1 et 6.2 `done`. 🛑 **Demandé à Jeevons AVANT toute écriture** → **option 1 retenue : « Champ en base + admin »**.
  - [x] Décisions prises et documentées : **nouvelle section, toolbox gardée** · technologie sans niveau **affichée sans badge** · ordre des groupes **déterministe** (`STACK_DOMAINS`).
- [x] **Tâche 1 — Domaine** (AC: 1 ; option 1)
  - [x] Migration **additive nullable** `20260727095827_add_stack_domain` (`ALTER TABLE "Stack" ADD COLUMN "domain" TEXT;`) + champ dans `schemas/stack.ts`, `stack-form.tsx`, `actions.ts`, `lib/admin/stacks.ts`, allow-list d'audit, seed. **Rien d'autre dans l'administration.** Technologies sans domaine → groupe **« Autres technologies »**, jamais masquées.
- [x] **Tâche 2 — Lecture** (AC: 1 ; piège n°4)
  - [x] `getPublicStacks()` **consommée telle quelle** (cachée tag `projects` + `readWithFallback`) ; `domain` ajouté à sa projection. Aucun Prisma nu dans la section. 🛑 **Commentaire devenu faux corrigé** dans `lib/projects.ts`.
  - [x] Tri niveau ↓ puis nom **conservé à l'intérieur de chaque groupe** (`groupStacksByDomain` filtre, ne retrie pas).
- [x] **Tâche 3 — Rendu de la section** (AC: 1, 2, 3 ; pièges n°1, n°2)
  - [x] Groupes déterministes, `<ul>`/`<li>`, `h3` sous le `h2` du `SectionHeader`, tokens 6.1. **Composant serveur pur** (seul `Reveal` est client).
  - [x] Niveau via **`SKILL_LEVEL_LABELS` importé**, en **texte visible**, précédé d'un `sr-only` « Niveau : ». Icône `aria-hidden`. Sans niveau → **affichée sans badge**.
  - [x] 🛑 **`return null`** si aucune technologie ; aucun groupe vide n'est produit.
- [x] **Tâche 4 — Intégration dans la page** (piège n°3, n°4)
  - [x] Insérée dans `page.tsx` **et `/preview`**, `id="stack"` **nouveau**, **aucune entrée ajoutée au `Header`**. `AboutClient.tsx` **non modifié** (aucun conflit 6.15).
- [x] **Tâche 5 — Vérification locale** (AC: 1-3 ; piège n°6)
  - [x] Les 3 AC vérifiés en conditions réelles (base réelle, serveur du conteneur) — détail en Completion Notes. Restent dues par Jeevons : niveaux de gris à l'œil, lecteur d'écran réel, contrastes mesurés, 375 px.
- [x] **Tâche 6 — Definition of Done** (AGENTS.md §8)
  - [x] `bun run lint` **0** / `bun x tsc --noEmit` **0** / `bun run build` **OK** — 🛑 **`/` toujours `○ (Static, 1h)`** (vérifié dans la sortie du build).
  - [x] `git status` : **aucune dépendance**, `package.json`/`bun.lock` intacts, `Header.tsx` intact, `AboutClient.tsx` intact.
  - [x] `File List` + `Completion Notes` + `Change Log` · `sprint-status.yaml` → `review`.

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

claude-opus-5 (Claude Code)

### Completion Notes

**Décisions de Jeevons (tâche 0, prises AVANT toute écriture de code)**

1. **Domaine → champ en base + admin** (option 1). C'est la seule voie qui satisfait AC1 à la lettre (« telles que saisies en administration »).
2. **Technologie sans niveau → affichée sans badge.** Jamais masquée, jamais de niveau par défaut inventé.
3. **Nouvelle section, toolbox gardée.** « Mon pack d'explorateur » reste en place.

**Le domaine : colonne texte + liste en code, et pourquoi**

`domain String?` est une colonne **texte**, pas un enum Prisma : ajouter un domaine aurait sinon exigé une migration à chaque fois. La liste des valeurs vit donc dans `STACK_DOMAINS` (`lib/schemas/stack.ts`), et c'est **elle qui fixe l'ordre des groupes** — un ordre dérivé des données (insertion, alphabétique) ferait sauter les groupes de place d'un rendu à l'autre. Le `<select>` de l'administration s'y limite, ce qui écarte les groupes dupliqués par faute de frappe (« Back-end » / « Backend »).

⚠️ **Conséquence assumée** : un domaine retiré de `STACK_DOMAINS` alors qu'il est encore en base. Contrairement à `iconKey` (qu'on conserve tel quel), le schéma le **refuse** — le garder sélectionné bloquerait toute modification de la technologie. Le formulaire retombe donc sur « Non précisé » **et le dit explicitement** par un avertissement, pour que le remplacement ne soit pas silencieux. Côté public, la technologie tombe dans « Autres technologies » : visible, jamais perdue.

**Trois fichiers modifiés que la story ne listait pas — et pourquoi c'était nécessaire**

- **`lib/admin/stacks.ts`** (`getAdminStack`). Le formulaire réenvoie **tous** ses champs à chaque enregistrement. Sans `domain` dans cette sélection, il serait parti vide et l'action aurait **effacé le domaine à la première modification du nom**. Bug silencieux évité.
- **`lib/admin/audit.ts`**. `ENTITY_FIELDS` est une **allow-list** : sans y ajouter `domain`, un changement de domaine serait passé par l'action **sans laisser aucune trace au journal** (5.19).
- **`content/stacks.ts` + `content/fallbacks.ts`**. Les six technologies de repli (4.5) portent désormais un domaine, pour que le repli reste **groupé comme le site normal** au lieu de verser ses six entrées dans « Autres technologies ».

Le seed, lui, **ne renseigne ni niveau ni domaine** : les technologies y viennent des projets (`projectsContent`), qui ne portent que des noms. Inventer un domaine aurait été fabriquer de la donnée. Elles s'affichent donc dans « Autres technologies » jusqu'à ce que Jeevons leur en attribue un.

**AC2 — le choix d'accessibilité, et ce qu'il écarte**

Le niveau est un **libellé texte visible** (« Solide », « À l'aise », « En apprentissage »), importé de `SKILL_LEVEL_LABELS`, précédé d'un `sr-only` « Niveau : ». Un lecteur d'écran annonce donc « Html, Niveau : Solide » et non un « Solide » orphelin. Le fond du badge n'est qu'un renfort d'intensité : **retirez toute couleur, l'information reste entière**. Le texte est `text-white` plein sur les trois niveaux — le contraste ne dépend pas du palier. L'icône est `aria-hidden` (le nom juste à côté porte déjà l'information). ❌ Aucun point coloré, aucun `title`, aucune couleur seule.

**Vérifications faites en conditions réelles** (base réelle, serveur du conteneur — pas par lecture du code)

- **AC1 — groupement + niveaux depuis la base.** Domaines et niveaux attribués en base, puis lecture via `getPublicStacks()` : groupes rendus dans l'ordre `Front-end → Back-end → CMS & e-commerce → Autres technologies`, exactement l'ordre de `STACK_DOMAINS`. Tri interne préservé : `Html`/`Javascript` (Solide) **avant** `Css` (À l'aise), puis les sans-niveau par nom.
- **AC1 — test décisif, sans rebuild.** `revalidateTag('projects')` puis relecture : les nouvelles valeurs apparaissent **immédiatement**, sans redémarrage ni rebuild. La chaîne d'invalidation que les actions admin déclenchent est donc opérante de bout en bout.
- **AC2 — dans le DOM servi.** Item avec niveau : `<span …><span class="sr-only">Niveau : </span>Solide</span>`. Item sans niveau (`Javascript`) : **présent, sans badge**. Icône `aria-hidden="true"` confirmée.
- **AC3 — table `Stack` vidée** (et **non** base coupée, piège n°1) : lecture `count: 0`, `groups: []`, et dans le HTML de `/` → **`id="stack"` : 0 occurrence**, « Stack & outils » : 0, « Autres technologies » : 0. **Rien n'est émis dans le DOM.**
- **Non-régression décisive** : `bun run build` → **`┌ ○ / 1h 1y`**. La home reste statique.
- `bun run lint` → 0. `bun x tsc --noEmit` → 0.
- `git status` : **aucune dépendance ajoutée**, `Header.tsx` intact, **`AboutClient.tsx` intact**.

**⚠️ Un piège de vérification qui a coûté plusieurs allers-retours — à connaître pour les stories suivantes**

`unstable_cache` **survit au redémarrage du conteneur** et son TTL est d'1 h. Après avoir vidé la table pour AC3, la lecture a continué de renvoyer `[]` alors que la base avait été repeuplée : ni `docker compose restart`, ni la suppression de `.next/cache` ne le purgent. Le seul levier fiable est **`revalidateTag`**. Deuxième piège cumulé : **`docker-entrypoint.sh` rejoue le seed à chaque démarrage**, ce qui recrée les 7 technologies (sans niveau ni domaine, `update: {}`) — un `DELETE` suivi d'un restart est donc annulé. Vérifier via une route qui invalide puis relit, sans redémarrer.

**Chevauchement 6.15 — signalé comme demandé (piège n°3)**

La story avertissait que `AboutClient.tsx` est partagé avec 6.15. **Il n'a pas été touché** : la toolbox reste alimentée par `getPublicStacks()` mais ne reçoit ni niveau ni domaine (`About.tsx` ne mappe que `id`/`name`/`iconKey`). Aucun doublon d'information non plus : la toolbox est **décorative** (bandes défilantes de logos), la nouvelle section est **informative**. 6.15 peut donc refondre la grille À propos sans conflit avec cette story.

**Restant dû par Jeevons** (vérifications humaines, non automatisables ici) : la page en **niveaux de gris** à l'œil ; un parcours au **lecteur d'écran réel** ; les **contrastes AA** mesurés sur les trois paliers de badge ; le rendu à **375 px** ; et l'attribution des domaines aux 7 technologies réelles depuis `/admin/stacks` (la base a été **rendue à son état d'origine exact** après les tests : 7 technologies, seule `Css` en « À l'aise », aucun domaine).

### File List

**Nouveaux**
- `apps/web/src/sections/Stacks.tsx` — section publique « Stack & outils » (composant serveur pur)
- `apps/web/prisma/migrations/20260727095827_add_stack_domain/migration.sql` — migration additive nullable

**Modifiés**
- `apps/web/prisma/schema.prisma` — `domain String?` sur `model Stack`
- `apps/web/prisma/seed.ts` — note sur `domain` laissé `null` (pas de donnée inventée)
- `apps/web/src/lib/schemas/stack.ts` — `STACK_DOMAINS`, `STACK_DOMAIN_LABELS`, `STACK_DOMAIN_FALLBACK_LABEL`, `isKnownStackDomain`, champ `domain` du schéma + `stackFormDataToInput`
- `apps/web/src/lib/projects.ts` — `domain` dans `PublicStack` et la projection ; `groupStacksByDomain` ; **commentaire corrigé** (« le niveau ordonne, il ne s'affiche pas en badge »)
- `apps/web/src/lib/admin/stacks.ts` — `domain` dans `AdminStack` et `getAdminStack` (sinon effacement silencieux)
- `apps/web/src/lib/admin/audit.ts` — `domain` ajouté à l'allow-list `Stack`
- `apps/web/src/app/(admin)/admin/stacks/stack-form.tsx` — champ « Domaine » + avertissement domaine hors liste ; grille passée à 3 colonnes
- `apps/web/src/app/(admin)/admin/stacks/actions.ts` — `domain` dans la lecture `before` de l'audit
- `apps/web/src/content/stacks.ts` — `domain` sur les six entrées de repli
- `apps/web/src/content/fallbacks.ts` — `domain` propagé par `fallbackStacks()`
- `apps/web/src/app/page.tsx` — `<StacksSection />` intégrée
- `apps/web/src/app/preview/page.tsx` — `<StacksSection />` intégrée
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — statut `review`

### Change Log

| Date | Version | Description |
|---|---|---|
| 2026-07-27 | 0.1 | Tâche 0 : décisions de Jeevons obtenues avant tout code (champ en base + admin · sans niveau = sans badge · nouvelle section, toolbox gardée). |
| 2026-07-27 | 0.2 | Migration additive nullable `add_stack_domain` + `domain` propagé au schéma partagé, au formulaire admin, à l'audit et au repli 4.5. |
| 2026-07-27 | 0.3 | `groupStacksByDomain` (ordre déterministe, aucun groupe vide, repli « Autres technologies ») et correction du commentaire devenu faux de `lib/projects.ts`. |
| 2026-07-27 | 0.4 | Section `Stacks.tsx` (serveur pur, `<ul>`/`<li>`, niveau en texte visible + `sr-only`, `return null` si vide) intégrée à `/` et `/preview`. |
| 2026-07-27 | 0.5 | AC1/AC2/AC3 vérifiés en conditions réelles ; `/` toujours `○ (Static, 1h)` ; base restaurée à l'identique ; statut `review`. |
