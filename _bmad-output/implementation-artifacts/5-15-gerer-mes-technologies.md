---
baseline_commit: 5c22f3a6c48914801d0a226ab5a0b15c005d8765
---

# Story 5.15: Gérer mes technologies

Status: review

## Story

As **Jeevons**,
I want **tenir à jour la liste des technologies que je maîtrise et mon niveau sur chacune**,
so that **la section « Stack & outils » reflète honnêtement où j'en suis**.

## Acceptance Criteria

**AC1 — CRUD technologie (nom unique + clé d'icône + niveau)**
**Given** je suis sur l'écran des technologies
**When** je crée ou modifie une technologie
**Then** je renseigne son nom, sa clé d'icône et mon niveau de maîtrise
**And** le nom doit rester unique, un doublon étant refusé avec un message clair

**AC2 — Suppression = avertissement + dissociation (pas de suppression des projets)**
**Given** une technologie est associée à des projets
**When** je tente de la supprimer
**Then** je suis averti du nombre de projets concernés avant de confirmer
**And** confirmer retire l'association sans supprimer les projets

**AC3 — Niveaux reflétés côté public**
**Given** j'ai modifié mes niveaux de maîtrise
**When** je consulte le site public après revalidation
**Then** la section des technologies reflète ces niveaux

## Contexte d'implémentation

### 🛑 Prérequis : socle sécurité + 5.8/5.9 (éditeur projet) `done`

CRUD du modèle **`Stack`** (Epic 4) + gestion de l'association many-to-many `ProjectStacks`. PLAN §3.2 (`/admin/stacks` : CRUD technologies, même pattern).

### 🎯 Ce que fait vraiment cette story

`/admin/stacks` : CRUD des **`Stack`** (name **unique**, `iconKey`, level), et une **suppression qui avertit du nombre de projets associés puis dissocie sans supprimer les projets**. Revalidation via tag **`projects`** (la section publique des technologies en dépend).

### ⚠️ Piège n°1 — Modèle `Stack` + relation `ProjectStacks` déjà en place (Epic 4)

- Schéma 4.2 : `Stack { name @unique, level SkillLevel, ... }`, relation **bidirectionnelle** `ProjectStacks` (many-to-many implicite ou table de jointure — vérifier la forme exacte dans `schema.prisma`). `SkillLevel` est un **enum** (valeurs à réutiliser telles quelles). ❌ Ne pas recréer le modèle ; le manipuler.
- ⚠️ **Clé d'icône** (AC1 « sa clé d'icône ») : vérifier qu'un champ (`iconKey`/`icon`) existe sur `Stack`. S'il n'existe **pas**, c'est un **ajout de colonne + migration** additive. 🛑 Vérifier le schéma avant de conclure. La clé doit correspondre au jeu d'icônes déjà utilisé par la section publique « Stack & outils » (Epic 4) — réutiliser, ne pas inventer un nouveau système d'icônes.
- ⚠️ `name @unique` : la Server Action doit gérer proprement la **violation d'unicité** (P2002) → message «`<nom>` existe déjà » (AC1), pas une 500.

### ⚠️ Piège n°2 (CENTRAL) — Suppression = avertir puis DISSOCIER (AC2), ≠ garde bloquante

- ⚠️ Contrairement à la garde média (5.13) qui **refuse**, ici la suppression est **autorisée** : on **avertit** du **nombre de projets** concernés, et si l'utilisateur **confirme**, on **retire l'association** (`ProjectStacks`) **sans supprimer les projets**, puis on supprime la `Stack` (AC2). Ne **pas** confondre les deux sémantiques.
- ⚠️ Selon la forme de la relation, régler/gérer le `onDelete` pour que la dissociation soit **propre** (les projets restent intacts, seule la ligne de jointure disparaît). Opération **transactionnelle**. 🛑 Vérifier le comportement `onDelete` de `ProjectStacks` dans le schéma pour que la dissociation soit correcte et ne cascade **pas** sur les projets.

### ⚠️ Piège n°3 — Association depuis l'éditeur projet

- L'association/dissociation au cas par cas se fait **dans l'éditeur projet** (5.9) : un multi-select des `Stack` existantes. ⚠️ Cette story fournit le **CRUD des Stack** ; si 5.9 a déjà branché le multi-select, ne pas le dupliquer. Mutation projet → `revalidateTag('projects')`.

### ⚠️ Piège n°4 — Section publique « Stack & outils » (AC3)

- ⚠️ La section publique affiche les technologies et **niveaux** (Epic 4). Modifier un niveau / créer / supprimer une `Stack` doit rafraîchir cette section → `revalidateTag('projects')`. Vérifier le tag exact utilisé par la lecture publique des stacks (probablement `projects` ; sinon aligner). AC3 : niveaux reflétés après revalidation.

### ⚠️ Piège n°5 — Réutiliser le pattern mutation 5.8

- `requireAdmin` + Server Action + Zod (name non vide/unique ; iconKey dans le jeu connu ; level ∈ enum) + `revalidateTag`. Lectures admin dédiées (non cachées). AuditLog = 5.19.

### ⚠️ Piège n°6 — Vérification locale

- Créer une techno (nom + clé d'icône + niveau) (AC1) ; tenter un **doublon de nom** → refus clair (AC1). Supprimer une techno **associée** à des projets → **avertissement du nombre de projets**, confirmation → la techno disparaît, **les projets restent** mais sans cette techno (AC2). Modifier un niveau → reflété dans la section publique après revalidation (AC3).

## Tasks / Subtasks

- [x] **Tâche 0 — Prérequis** (AC: 1)
  - [x] Socle + 5.8/5.9 `done`. Vérifier `ProjectStacks` (`onDelete`) + présence d'un champ clé d'icône dans le schéma.
- [x] **Tâche 1 — CRUD `Stack`** (AC: 1 ; pièges n°1, 5)
  - [x] `/admin/stacks` : liste + éditeur (Zod name unique / iconKey / level enum) ; gestion P2002 ; migration `iconKey` si absent ; `revalidateTag('projects')`.
- [x] **Tâche 2 — Suppression avec avertissement + dissociation** (AC: 2 ; piège n°2)
  - [x] Compter les projets associés → **avertir** ; confirmation → dissocier (`ProjectStacks`) sans supprimer les projets, puis supprimer la `Stack`, en transaction ; `revalidateTag('projects')`.
- [x] **Tâche 3 — Cohérence publique** (AC: 3 ; pièges n°3, 4)
  - [x] Niveaux/associations reflétés après revalidation ; ne pas dupliquer le multi-select de 5.9.
- [x] **Tâche 4 — Vérification locale** (AC: 1-3 ; piège n°6)
  - [x] CRUD (icône), doublon refusé, suppression = avertissement + dissociation (projets intacts), niveaux publics.
- [x] **Tâche 5 — Definition of Done** (AGENTS.md §8)
  - [x] lint 0 / tsc 0 / build OK. `git diff DEV` : écran stacks, CRUD, suppression+dissociation, branchement public — rien d'autre.
  - [ ] Vérif **visuelle + clavier** en session authentifiée (à faire par Jeevons — voir Completion Notes).
  - [x] `File List` + `Completion Notes` + `Change Log` · `sprint-status.yaml`.

## Dev Notes

### Périmètre — verrouillé

**CRUD `Stack` (`/admin/stacks`) : name unique + clé d'icône + level (enum) ; suppression qui avertit du nombre de projets associés puis dissocie sans supprimer les projets ; niveaux reflétés côté public après revalidateTag('projects').**

**Hors périmètre — ne pas faire :**
- ❌ **Recréer `Stack`/`ProjectStacks`** (existants, Epic 4).
- ❌ **Réécrire l'éditeur projet** → 5.9 (compléter le multi-select si besoin).
- ❌ **Nouveau système d'icônes** (réutiliser le jeu existant).
- ❌ **AuditLog** → 5.19.
- ❌ **Nouvelle dépendance**.

### Le vrai enjeu

Deux subtilités : (1) **unicité du nom** (`@unique`, gérer P2002 proprement, AC1) et la **clé d'icône** (vérifier si la colonne existe → sinon migration additive, en réutilisant le jeu d'icônes public) ; (2) la sémantique de suppression est **avertir + dissocier** (les projets survivent, seule la jointure disparaît), **différente** de la garde bloquante de 5.13 — à ne pas confondre, et à faire en transaction avec un `onDelete` qui ne cascade pas sur les projets. La section publique dépend du tag `projects`.

### Testing standards

Vérification **manuelle en local** + visuelle. Les 3 AC dont doublon refusé (AC1) et suppression = avertissement + dissociation projets intacts (AC2). tsc/lint/build verts.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.15]
- [Source: PLAN_REFONTE_2026.md §3.2 — `/admin/stacks` CRUD technologies (même pattern)]
- [Source: apps/web/prisma/schema.prisma — Stack (name @unique, level SkillLevel), ProjectStacks (relation bidirectionnelle), enum SkillLevel]
- [Source: _bmad-output/implementation-artifacts/5-9-decrire-finement-un-projet.md — éditeur projet (association stacks) ; 5-8 — pattern mutation requireAdmin + revalidateTag]
- [Source: AGENTS.md §6 — sécurité, a11y ; §9 — anti-scope-creep]

## Dev Agent Record

### Décisions

**D1 — Aucune migration : `iconKey` existait déjà.** Le piège n°1 demandait de vérifier avant de conclure. `schema.prisma` porte bien `Stack { name String @unique, iconKey String?, level SkillLevel? }` depuis 4.1. La colonne est donc **utilisée telle quelle**, sans migration additive.

**D2 — Aucune dissociation à écrire : `ProjectStacks` est un many-to-many IMPLICITE.** Le piège n°2 évoquait un `onDelete` à régler. Il n'y en a pas à régler : Prisma gère lui-même la table de jointure, dont les lignes disparaissent avec la `Stack`, sans que les `Project` de l'autre côté soient touchés. La « dissociation sans supprimer les projets » de l'AC2 est donc **native**. Ajouter un `update` de dissociation avant le `delete` serait redondant, et la **transaction** évoquée par la tâche 2 ne protégerait rien de plus qu'une écriture unique — elle n'a pas été ajoutée, faute d'objet. Vérifié par sonde (voir Vérifications).

**D3 — 🛑 L'AC3 était insatisfiable en l'état, périmètre étendu après arbitrage.** La section publique « Mon pack d'explorateur » était un **tableau `toolboxItems` codé en dur** dans `AboutClient.tsx`, avec six imports statiques de SVG. **Aucune lecture de `Stack` n'existait côté public** : modifier un niveau depuis l'administration n'aurait eu strictement aucun effet visible, et l'AC3 aurait été « verte » sans rien prouver. Signalé à Jeevons, qui a tranché : **brancher la toolbox sur la base**. C'est ce qui explique que cette story touche `sections/About*.tsx` et `lib/projects.ts`.

**D4 — Contrat de repli préservé (4.5).** Les six entrées codées en dur n'ont pas été supprimées : elles sont devenues `src/content/stacks.ts`, câblées via `fallbackStacks()` + `readWithFallback`. Si la base est injoignable, le visiteur revoit **exactement** la toolbox qu'il connaissait, jamais une section vide.

**D5 — Tri seul, pas d'affichage du niveau (décision Jeevons).** L'AC3 dit « reflète ces niveaux » sans exiger de badge. Le niveau se traduit par l'**ordre** (STRONG → COMFORTABLE → LEARNING, puis nom, `localeCompare` en `fr`), et le design existant reste intact. Une technologie sans niveau passe en fin de liste plutôt que d'être masquée.

**D6 — Clé d'icône inconnue : avertir, pas refuser (décision Jeevons).** `stackSchema` n'enferme volontairement **pas** `iconKey` dans le registre. Une clé inconnue est acceptée, le site affiche une icône neutre (`resolveStackIcon`), et l'administration affiche « Clé d'icône inconnue ». Refuser la saisie ferait **disparaître** la technologie du site — pire que l'icône générique. Le `<select>` propose d'ailleurs la clé inconnue comme option sélectionnée, pour qu'ouvrir l'éditeur ne l'écrase jamais en silence.

**D7 — Unicité tranchée par la base, pas pré-vérifiée.** `isNameConflict` traduit P2002 en «`<nom>` existe déjà » (AC1). Aucun `findUnique` préalable : entre la lecture et l'écriture, un doublon peut s'insérer (course critique). La sonde a confirmé que Postgres renvoie ici P2002 **avec `meta.target` à `undefined`** — la branche de repli d'`isNameConflict` (« `name` est la seule contrainte unique du modèle ») n'est donc pas du code mort, c'est le chemin réellement emprunté.

**D8 — Titres des projets chargés dans l'éditeur seulement.** La liste ne charge que le **nombre** (`_count`), qui suffit à l'avertissement et évite N requêtes. Les titres, eux, sont chargés par `findStackUsage` sur la page d'édition — le seul endroit où l'on prend le temps de décider d'une suppression.

### Vérifications

Sonde temporaire exécutée contre la base de développement, puis supprimée (aucun résidu : la `Stack` de test a été effacée par la sonde elle-même).

| AC | Ce qui a été vérifié | Résultat |
|---|---|---|
| AC1 | Créer deux `Stack` de même nom | `P2002 target=undefined` → traduit en « existe déjà » |
| AC2 | Associer la techno à un projet, compter, supprimer la techno | 1 projet compté ; après suppression, projet **conservé** avec ses autres technologies (`Javascript, Html, Css`) intactes |
| AC3 | Tri public appliqué à l'état réel de la base | `Css(COMFORTABLE)` placé avant les technologies sans niveau, puis ordre alphabétique |
| DoD | `bunx tsc --noEmit` | 0 erreur |
| DoD | `bun run lint` | 0 erreur, 1 warning **préexistant** (`TestimonialsClient.tsx`, hors périmètre) |
| DoD | `bun run build` | Succès ; `/admin/stacks`, `/admin/stacks/new`, `/admin/stacks/[id]` rendues dynamiques (ƒ) |

### Completion Notes

**Reste à faire par Jeevons avant `done` :** la vérification **visuelle et clavier** en session authentifiée n'a pas pu être menée — elle exige une vraie session admin (mot de passe + TOTP). La case correspondante de la tâche 5 est donc laissée **décochée**, à dessein. Points à regarder : navigation clavier dans les deux `<select>`, ouverture/fermeture du dialogue de suppression (Échap, piège du focus), et lisibilité de l'avertissement chiffré.

**⚠️ Conséquence visible immédiate.** La base contient **7 technologies seedées** dont la plupart ont `iconKey: null` et `level: null`, alors que la toolbox affichait jusqu'ici **6 entrées choisies à la main**. Au premier rendu après déploiement, la section publique changera donc : d'autres technologies apparaîtront, et la plupart avec l'icône neutre. C'est le comportement attendu du branchement (D3), pas une régression — il suffit de renseigner icônes et niveaux depuis `/admin/stacks` pour retrouver le rendu voulu.

**Non fait, volontairement :** aucun `AuditLog` (story 5.19), aucun nouveau système d'icônes (le registre réutilise les six SVG existants), aucune modification de l'éditeur projet — son `StacksSelector` (5.9) existait déjà et pointait même vers `/admin/stacks`, lien mort jusqu'à cette story.

### File List

**Créés**
- `apps/web/src/lib/stack-icons.ts` — registre de clés d'icônes (chaînes seules, importable client ET serveur)
- `apps/web/src/components/StackIcon.tsx` — résolution clé → SVG, avec icône de repli
- `apps/web/src/content/stacks.ts` — les six entrées historiques, devenues contenu de repli
- `apps/web/src/lib/schemas/stack.ts` — schéma Zod partagé client/serveur
- `apps/web/src/lib/admin/stacks.ts` — lectures admin (liste + `projectCount`, détail, `findStackUsage`)
- `apps/web/src/app/(admin)/admin/stacks/actions.ts` — Server Actions (create/update/delete)
- `apps/web/src/app/(admin)/admin/stacks/stack-form.tsx` — formulaire création/modification
- `apps/web/src/app/(admin)/admin/stacks/delete-stack-dialog.tsx` — confirmation + avertissement chiffré
- `apps/web/src/app/(admin)/admin/stacks/page.tsx` — liste
- `apps/web/src/app/(admin)/admin/stacks/new/page.tsx` — création
- `apps/web/src/app/(admin)/admin/stacks/[id]/page.tsx` — édition + zone de suppression

**Modifiés**
- `apps/web/src/lib/projects.ts` — lecture publique cachée `getPublicStacks` (tag `projects`) + tri par niveau
- `apps/web/src/content/fallbacks.ts` — adaptateur `fallbackStacks()`
- `apps/web/src/sections/About.tsx` — lit les technologies en base
- `apps/web/src/sections/AboutClient.tsx` — toolbox alimentée par props, tableau en dur retiré
- `apps/web/src/components/admin/admin-nav.tsx` — entrée « Technologies » passée à `ready: true`
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — statut de la story

### Change Log

| Date | Description |
|---|---|
| 2026-07-26 | Story 5.15 implémentée : CRUD des technologies sous `/admin/stacks` (nom unique via P2002, clé d'icône, niveau), suppression avec avertissement chiffré et conservation des projets, et branchement de la section publique « Stack & outils » sur la base avec tri par niveau et repli statique. Statut → `review`. |
