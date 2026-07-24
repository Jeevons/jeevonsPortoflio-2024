---
baseline_commit: 220ab43cc5c937806af6409fae95d96fd1f3ed21
---

# Story 4.3: Piloter les textes du site sans redéployer

Status: review

## Story

As **Jeevons**,
I want **que les textes d'accroche et mes coordonnées viennent de la base**,
so that **je puisse corriger une phrase datée sans faire un commit — la cause même du problème corrigé en Epic 1**.

## Acceptance Criteria

**AC1 — Modèle `SiteSetting` créé, indexé par clé, valeur structurée, seedé**
**Given** le titre du Hero, le badge de statut et les coordonnées sont codés en dur
**When** cette story est terminée
**Then** le modèle `SiteSetting` existe, indexé par clé (`key @id`) et portant une valeur structurée (`value Json`)
**And** une migration versionnée décrit sa création
**And** le seed y reporte les valeurs actuellement affichées, de façon idempotente

**AC2 — Le site affiche les valeurs issues de la base**
**Given** les réglages sont en base
**When** je consulte le site
**Then** le Hero (titre, sous-titre), le badge de statut, les coordonnées et les liens sociaux affichent les valeurs issues de la base

**AC3 — Valeur par défaut si une clé manque, la page ne tombe jamais en erreur**
**Given** une clé de réglage attendue est absente de la base
**When** la page se rend
**Then** une valeur par défaut raisonnable est utilisée
**And** la page ne tombe jamais en erreur pour cette raison

## Contexte d'implémentation

### 🛑 Prérequis : stories 4.1 (et 4.2) `done`

Prisma, `lib/db.ts`, patterns de seed/lecture posés en 4.1. On **étend** le schéma avec un seul modèle : `SiteSetting`. Stack : `apps/web/`, Bun, Next 16 / React 19.

### 📐 État actuel — OÙ vivent les textes/coordonnées codés en dur

| Réglage | Fichier | Valeur actuelle exacte | Contrainte |
|---|---|---|---|
| Titre Hero (`h1`) | `sections/Hero.tsx:117` | « Imaginer et construire des expériences qui donnent envie d'être vécues ! » | composant **serveur** |
| Sous-titre Hero (`p`) | `sections/Hero.tsx:121` | « Le front-end est mon terrain de jeu… » | composant serveur |
| Badge de statut | `sections/Hero.tsx:111-113` | « En recherche d'une alternance pour 2026-2027 » | composant serveur |
| Lien LinkedIn | `sections/Footer.tsx:14` & `sections/Contact.tsx` | `https://www.linkedin.com/in/jeevons-eya-3660a7297/?locale=fr_FR` | **Footer serveur / Contact `"use client"`** |
| Lien Github | `sections/Footer.tsx:18` | `https://github.com/Jeevons` | Footer serveur |
| E-mail (fragmenté) | `sections/Contact.tsx` | `MAIL_USER`/`MAIL_HOST` recomposés au clic | ⚠️ voir piège n°3 |

⚠️ `Contact.tsx` et probablement le Footer diffèrent par leur nature serveur/client — vérifier au moment d'implémenter (`"use client"` en tête de fichier). Le pattern conteneur-serveur → props (établi en 4.2) s'applique aux sections client.

### 🗄️ Modèle Prisma (et SEULEMENT celui-ci)

`PLAN_REFONTE_2026.md` §2.1 :
```prisma
model SiteSetting {
  key       String   @id
  value     Json
  updatedAt DateTime @updatedAt
}
```
`key @id` : la clé **est** l'identifiant (déduplication naturelle → seed idempotent trivial par `upsert` sur `key`). `value Json` : valeur structurée (string simple, ou objet `{ url, label }` pour les liens, ou `{ text }` pour le badge). **Choisir une convention de clés claire et la documenter**, ex. : `hero.title`, `hero.subtitle`, `hero.statusBadge`, `social.linkedin`, `social.github`, `contact.email`. Figer ces clés (elles serviront de contrat à l'admin `/admin/settings` en Epic 5, PLAN §3.2).

### ⚠️ Piège n°1 (CENTRAL) — La valeur par défaut est une exigence, pas un bonus (AC3)
L'AC3 est le cœur de la story et anticipe 4.5 : **si une clé manque, une valeur par défaut raisonnable est utilisée et la page ne tombe JAMAIS en erreur.** Implémenter une fonction de lecture typée, ex. `getSetting(key, defaultValue)`, qui renvoie le défaut si la clé est absente **ou** si la valeur Json ne correspond pas au type attendu. Les défauts = **les valeurs actuellement codées en dur** (elles deviennent les fallbacks intrinsèques). Ainsi, même base vide, le site s'affiche identiquement. 🛑 Ne pas laisser un `value!` ou un accès direct qui jetterait sur `null`.
> Distinction avec 4.5 : ici on gère la **clé absente** (DB joignable, donnée manquante). 4.5 gèrera la **DB injoignable**. Les deux convergent vers « le site ne tombe jamais en erreur », mais 4.3 ne doit **pas** implémenter le try/catch DB-down (périmètre 4.5).

### ⚠️ Piège n°2 — Hero est serveur, Contact est client
- `Hero.tsx` est un **Server Component** : il peut `await getSetting(...)` directement (le rendre `async`), comme Projects en 4.1.
- `Contact.tsx` est `"use client"` (fragments e-mail recomposés au clic) : appliquer le pattern conteneur-serveur → props de 4.2. Le fetch des coordonnées se fait côté serveur ; le composant client reçoit l'e-mail/liens en props.
- `Footer.tsx` : vérifier sa nature. S'il est serveur, `await` direct ; sinon, props.

### ⚠️ Piège n°3 — Ne pas casser la protection anti-moisson de l'e-mail (Epic 1, AGENTS.md §6)
`Contact.tsx` fragmente l'e-mail (`MAIL_USER`/`MAIL_HOST` recomposés uniquement au clic) **pour qu'il n'apparaisse jamais en clair dans le HTML servi** — c'est une correction d'accessibilité/sécurité de l'**Epic 1** (règle D10, « aucune coordonnée personnelle en clair dans le HTML servi », AGENTS.md §6). 🛑 **Si on fait venir l'e-mail de la base, il ne doit toujours JAMAIS être rendu en clair dans le HTML servi.** Deux options — trancher avec Jeevons :
- **(a)** [recommandé] Stocker l'e-mail en base **déjà fragmenté** (`value: { user: [...], host: [...] }`) et conserver la recomposition au clic côté client.
- **(b)** Garder l'e-mail hors base (il change rarement) et ne migrer que les liens sociaux + textes Hero + badge. **Documenter** ce choix : migrer l'e-mail sans le fragmenter serait une **régression de sécurité Epic 1** — interdit.
⚠️ Vérifier après coup : `curl` de la page → l'e-mail complet **n'apparaît pas** dans le HTML.

### ⚠️ Piège n°4 — Liens sortants : `rel="noopener noreferrer"` (AGENTS.md §6)
Les liens sociaux (LinkedIn, Github) restent des liens sortants `target="_blank"` : conserver `rel="noopener noreferrer"` même quand l'URL vient de la base. Ne pas régresser cette règle en passant par les props.

### ⚠️ Piège n°5 — Seed idempotent trivial, mais reporter les valeurs EXACTES
`upsert` par `key` rend l'idempotence facile. L'enjeu est la **fidélité** : reporter les chaînes **exactes** (titre, sous-titre, badge, URLs) — les copier depuis les fichiers, ne pas les reformuler. Toute différence viole l'AC2 (« affichage identique »).

### ⚠️ Piège n°6 — Rester dans le périmètre 4.3
- ❌ **Ne pas** implémenter l'écran admin `/admin/settings` (Epic 5).
- ❌ **Ne pas** implémenter l'ISR/cache (4.4) ni le fallback DB-down (4.5).
- ❌ **Ne pas** migrer d'autres textes (SectionHeaders des sections, textes légaux…) non listés dans les AC. La story vise **Hero (titre/sous-titre/badge) + coordonnées + liens sociaux**, rien d'autre.

## Tasks / Subtasks

- [x] **Tâche 0 — Prérequis** (AC: 1)
  - [x] Confirmer 4.1 (`done`) : Prisma, `lib/db.ts`, patterns seed/lecture.
  - [x] Relever les valeurs exactes (Hero, badge, Footer, Contact) et vérifier la nature serveur/client de chaque fichier.
- [x] **Tâche 1 — Modèle + migration** (AC: 1)
  - [x] Ajouter `SiteSetting` à `schema.prisma` ; migration `add_site_setting`.
  - [x] Figer la convention de clés (`hero.title`, `hero.subtitle`, `hero.statusBadge`, `social.twitter/instagram/linkedin/github`, `contact.linkedin`, `contact.email`) dans `SETTING_KEYS`.
- [x] **Tâche 2 — Lecture avec défaut** (AC: 3 ; piège n°1)
  - [x] `lib/settings.ts` : lecteurs typés (`getHeroSettings/getSocialSettings/getContactSettings`) renvoyant le défaut si clé absente/valeur invalide. Défauts = valeurs actuelles (`SETTING_DEFAULTS`).
  - [x] Ne jamais jeter sur clé absente (`readString`/`readEmail` valident le type et retombent sur le fallback).
- [x] **Tâche 3 — Seed idempotent** (AC: 1 ; piège n°5)
  - [x] `upsert` par `key` des 9 valeurs exactes. 2 passages → identique (prouvé).
- [x] **Tâche 4 — Brancher le Hero** (AC: 2 ; piège n°2)
  - [x] `Hero.tsx` → `async`, `await getHeroSettings()` pour titre, sous-titre, badge. Rendu iso.
- [x] **Tâche 5 — Brancher coordonnées & liens sociaux** (AC: 2 ; pièges n°2, 3, 4)
  - [x] Footer (serveur) : les 4 liens sociaux (Twitter/Instagram/LinkedIn/Github) depuis la base (`rel` conservé).
  - [x] Contact : e-mail stocké **fragmenté** en base (décision Jeevons), recomposé uniquement au clic côté client ; LinkedIn depuis la base.
  - [x] Pattern conteneur-serveur → props : `Contact.tsx` (serveur async) + `ContactClient.tsx` (`"use client"`).
- [x] **Tâche 6 — Vérification & Definition of Done** (AGENTS.md §8)
  - [x] Rendu iso : Hero, badge, liens identiques à avant (vérifié via HTML servi).
  - [x] AC3 prouvé : `hero.title` supprimé en base → rebuild OK, défaut affiché, page 200, pas d'erreur ; re-seed derrière.
  - [x] Anti-moisson : `curl` → e-mail complet, `@gmail`, `mailto:` **absents** du HTML (0 occurrence).
  - [x] Liens sortants : `target="_blank" rel="noopener noreferrer"` intacts (Footer + Contact LinkedIn).
  - [x] `bunx prisma validate` (valide) · `eslint` (0 nouveau warning, 1 pré-existant Testimonials) · `bunx tsc --noEmit` (0 erreur) · `bun run build` (succès, `/` reste `○ static`).
  - [x] `File List` + `Completion Notes` + `Change Log` · `sprint-status.yaml` mis à jour.

## Dev Notes

### Périmètre — verrouillé

**Créer `SiteSetting`, migrer, seeder idempotemment (titre/sous-titre/badge Hero + liens sociaux + e-mail), brancher Hero/Footer/Contact en lecture DB avec valeur par défaut si clé absente, sans régression anti-moisson ni erreur de page.**

**Hors périmètre — ne pas faire :**
- ❌ **Écran admin `/admin/settings`** → **Epic 5**.
- ❌ **ISR / cache par tag** → **4.4** · **Fallback DB-down** → **4.5** · **Migrations au démarrage** → **4.6**.
- ❌ **Migrer d'autres textes** que ceux des AC (pas les SectionHeaders, pas les textes de Contact hors coordonnées).
- ❌ **Rendre l'e-mail en clair** dans le HTML (régression sécurité Epic 1).
- ❌ **Ajouter une dépendance.**

### Le vrai enjeu

Cette story **ferme la boucle ouverte par l'Epic 1** : le problème « une phrase datée (ex. année d'alternance) impose un commit » disparaît — Jeevons éditera ces valeurs depuis l'admin (Epic 5) et le site se revalidera (4.4). Le contrat de clés figé ici est directement consommé par `/admin/settings`. La robustesse « défaut si clé absente » (AC3) est le premier maillon de la promesse « le site ne tombe jamais en erreur », complétée par 4.5.

### Testing standards

Pas de test automatisé (Playwright en Epic 7). Vérification : rendu iso (valeurs exactes), AC3 (clé supprimée → défaut, pas d'erreur), anti-moisson (`curl` sans e-mail en clair), `rel` intact, tsc/lint/build verts.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.3]
- [Source: PLAN_REFONTE_2026.md §2.1 — `SiteSetting{ key String @id value Json updatedAt }` (« hero, contact, statut, CV courant »)]
- [Source: PLAN_REFONTE_2026.md §3.2 — écran `/admin/settings` (Hero, coordonnées, liens sociaux) consommateur en Epic 5]
- [Source: _bmad-output/implementation-artifacts/4-1-servir-les-projets-depuis-la-base.md — Prisma, `lib/db.ts`, patterns seed idempotent/lecture serveur]
- [Source: _bmad-output/implementation-artifacts/4-2-servir-le-parcours-et-les-centres-d-interet-depuis-la-base.md — pattern conteneur serveur → props pour sections `"use client"`]
- [Source: apps/web/src/sections/Hero.tsx — titre `h1`, sous-titre `p`, badge de statut (serveur)]
- [Source: apps/web/src/sections/Contact.tsx — fragmentation e-mail `MAIL_USER`/`MAIL_HOST` (anti-moisson Epic 1), LinkedIn ; `"use client"`]
- [Source: apps/web/src/sections/Footer.tsx — liens LinkedIn/Github]
- [Source: AGENTS.md §6 — aucune coordonnée en clair dans le HTML servi, liens sortants `rel="noopener noreferrer"` ; §9 — anti-scope-creep]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code)

### Debug Log References

- `bunx prisma validate` → schéma valide.
- `bunx tsc --noEmit` → 0 erreur.
- `eslint .` → 0 erreur, 1 warning **pré-existant** (`TestimonialsClient.tsx` exhaustive-deps), aucun nouveau warning.
- `bun run build` → succès ; route `/` reste `○ (Static)` (lecture DB au build, iso 4.1/4.2).
- Rendu servi (serveur standalone + `curl`) : badge/titre/sous-titre Hero présents, 4 liens sociaux présents.
- Anti-moisson : `grep` sur le HTML servi → `jeevons.eya.jr@gmail.com`, `@gmail`, `mailto:` = **0 occurrence**. E-mail recomposé uniquement au clic.
- AC3 : suppression de `hero.title` en base → `bun run build` OK (exit 0), HTML servi affiche le **titre par défaut**, page HTTP **200**, aucune erreur. Base re-seedée derrière (9 `SiteSetting`).
- Seed idempotent : 2 passages → `Project: 6, Highlight: 18, Stack: 7, TimelineEntry: 5, Hobby: 7, SiteSetting: 9`.

### Completion Notes List

- Modèle `SiteSetting` (`key @id`, `value Json`, `updatedAt`) + migration versionnée `20260724092936_add_site_setting`.
- `lib/settings.ts` (nouveau) centralise le contrat de clés `SETTING_KEYS` (figé pour `/admin/settings` en Epic 5), les `SETTING_DEFAULTS` (= valeurs codées en dur) et les lecteurs typés `getHeroSettings/getSocialSettings/getContactSettings`. Un seul `findMany` par lecture. **AC3 au cœur** : `readString`/`readEmail` valident le type Json et retombent sur le défaut si la clé est absente **ou** invalide — la page ne jette jamais.
- **Décision Jeevons** : e-mail stocké **fragmenté** en base (`{ user: [...], host: [...] }`). La chaîne complète n'existe jamais côté serveur ni dans le HTML servi ; recomposée seulement au clic côté client (protection anti-moisson Epic 1 préservée). **Décision Jeevons** : les **4 liens sociaux** (Twitter, Instagram, LinkedIn, Github) migrés en base.
- Câblage : `Hero.tsx` devient un Server Component `async` (titre/sous-titre/badge). `Footer.tsx` (serveur) devient `async` et mappe les 4 liens sociaux depuis la base (`rel="noopener noreferrer"` conservé). `Contact.tsx` scindé selon le pattern conteneur-serveur → props (établi en 4.2) : `Contact.tsx` (serveur async, lit e-mail fragmenté + LinkedIn) passe les props à `ContactClient.tsx` (`"use client"`).
- Le seed duplique volontairement les valeurs par défaut (il tourne en standalone sous Bun et ne peut pas importer un module `server-only`).
- Périmètre respecté : pas d'`/admin/settings` (Epic 5), pas d'ISR (4.4), pas de fallback DB-down (4.5). Seuls Hero (titre/sous-titre/badge), coordonnées et liens sociaux migrés.

### File List

- `apps/web/prisma/schema.prisma` — ajout du modèle `SiteSetting`.
- `apps/web/prisma/migrations/20260724092936_add_site_setting/migration.sql` — création table `SiteSetting`.
- `apps/web/prisma/seed.ts` — ajout des 9 `SiteSetting` (upsert par `key`, idempotent).
- `apps/web/src/lib/settings.ts` — **nouveau** : contrat de clés, défauts, lecteurs typés avec fallback (AC3).
- `apps/web/src/sections/Hero.tsx` — Server Component `async`, textes depuis la base.
- `apps/web/src/sections/Footer.tsx` — `async`, 4 liens sociaux depuis la base.
- `apps/web/src/sections/Contact.tsx` — conteneur serveur `async` (e-mail fragmenté + LinkedIn en props).
- `apps/web/src/sections/ContactClient.tsx` — **nouveau** : vue cliente, recompose l'e-mail au clic.

### Change Log

| Date | Description |
|------|-------------|
| 2026-07-24 | Story 4.3 créée — modèle `SiteSetting`, seed idempotent des textes Hero/badge/coordonnées/liens sociaux, lecture avec valeur par défaut, sans régression anti-moisson. |
| 2026-07-24 | Story 4.3 implémentée — `SiteSetting` + migration + seed (9 clés), `lib/settings.ts` (défauts/lecteurs typés, AC3), Hero/Footer async depuis la base, Contact scindé serveur/client (e-mail fragmenté + 4 liens sociaux, décisions Jeevons). Vérifs iso/AC3/anti-moisson/tsc/lint/build vertes. Status → review. |
