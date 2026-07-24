---
baseline_commit: 220ab43cc5c937806af6409fae95d96fd1f3ed21
---

# Story 4.2: Servir le parcours et les centres d'intérêt depuis la base

Status: review

## Story

As **visiteur du portfolio**,
I want **consulter le parcours et la personnalité de Jeevons**,
so that **je comprenne d'où il vient — et Jeevons doit pouvoir enrichir ce parcours sans toucher au code**.

## Acceptance Criteria

**AC1 — Modèles `TimelineEntry` et `Hobby` créés, migrés, seedés idempotemment**
**Given** le parcours et les centres d'intérêt sont codés en dur dans les sections
**When** cette story est terminée
**Then** les modèles `TimelineEntry` et `Hobby` existent et sont migrés (migration versionnée)
**And** le seed y reporte le contenu existant, de façon idempotente (aucun doublon en le relançant)

**AC2 — Rendu identique, même ordre, filtre de publication du parcours**
**Given** le contenu est en base
**When** je consulte les sections concernées
**Then** l'affichage est identique à avant, dans le même ordre
**And** une entrée de parcours non publiée (`published: false`) n'apparaît pas

## Contexte d'implémentation

### 🛑 Prérequis : story 4.1 `done`

Cette story **dépend de 4.1** : Prisma installé, `lib/db.ts`, patterns de seed/lecture posés. Ne pas ré-installer Prisma. On **étend** le schéma existant avec 2 nouveaux modèles. Stack : `apps/web/`, Bun, Next 16 / React 19.

### 📐 État actuel — OÙ vit réellement le contenu (surprise à connaître)

⚠️ **Le « parcours » n'est PAS dans `About.tsx`.** Il est rendu par **`apps/web/src/sections/Testimonials.tsx`** (`id="parcours"`, eyebrow « Mon parcours ») — un carrousel horizontal d'étapes de formation. C'est **lui** qui alimente `TimelineEntry`. Les **centres d'intérêt (hobbies)** sont dans **`apps/web/src/sections/About.tsx`** (cartes draggables). Cette story touche donc **deux fichiers de section**.

**Parcours → `TimelineEntry`** (`Testimonials.tsx`, constante `testimonials`, **5 entrées** dans cet ordre) :

| Champ actuel | Exemple | → modèle |
|---|---|---|
| `name` | « Baccalauréat Économique et Social… » | `title` |
| `position` | « Lycée de la Venise Verte, Niort-79000 » | `place` |
| `text` | paragraphe | `body` (`@db.Text`) |
| `avatar` | import statique (`bac-icon.webp`, `university-icon.webp`, `mmi-icon.webp`, `jeevons-avatar-coding.webp`, `jeevons-avatar-lynx.webp`) | `avatarId` — ⚠️ voir piège n°2 |

**Centres d'intérêt → `Hobby`** (`About.tsx`, constante `hobbies`, **7 entrées**) :

| Champ actuel | Exemple | → modèle |
|---|---|---|
| `title` | « Design » | `title` |
| `emoji` | « 🎨 » | `emoji` |
| `left` | « 5% » | `posLeft` |
| `top` | « 5% » | `posTop` |

### 🗄️ Modèles Prisma à créer (et SEULEMENT ceux-ci)

Depuis `PLAN_REFONTE_2026.md` §2.1. Ne créer que `TimelineEntry` et `Hobby`. Pas de `SiteSetting` (→ 4.3), pas de `Media` (→ Epic 5).

```prisma
model TimelineEntry {
  id        String  @id @default(cuid())
  title     String
  place     String
  body      String  @db.Text
  avatarId  String?           // ⚠️ Media n'existe qu'en Epic 5 — voir piège n°2
  startYear Int
  endYear   Int?
  sortOrder Int     @default(0)
  published Boolean @default(true)
}

model Hobby {
  id      String @id @default(cuid())
  title   String
  emoji   String
  posLeft String
  posTop  String
}
```

### ⚠️ Piège n°1 (CENTRAL) — `Testimonials.tsx` et `About.tsx` sont `"use client"`
Les deux sections sont des **Client Components** (`"use client"`) : `Testimonials.tsx` gère l'auto-scroll (hooks, `useReducedMotion`), `About.tsx` gère le drag des hobbies. **On ne peut pas y faire `await prisma….`** — un Client Component ne peut pas être `async` ni interroger la base.

**Pattern imposé** (AGENTS.md §6 : « logique de données côté Server Components ; vues bêtes, données en props ») :
- Extraire un **conteneur serveur** qui lit la base et passe les données en props au composant client. Deux approches acceptables — trancher, mais rester simple :
  - **(a)** Renommer l'actuel composant client en `…Client` (ex. `TestimonialsClient`) recevant `entries` en props, et créer un wrapper **serveur** `async` (ex. `Testimonials.tsx`) qui lit la base et rend `<TestimonialsClient entries={…} />`. Idem pour About/hobbies. `page.tsx` continue d'importer `TestimonialsSection`/`AboutSection` sans changement.
  - **(b)** Laisser la lecture dans `page.tsx` (déjà serveur) et passer les données en props aux deux sections client.
- **Recommandation : (a)** — garde `page.tsx` inchangé et colocalise le fetch avec sa section. Cohérent avec le pattern retenu en 4.1 pour Projects.
- ❌ **Ne pas** retirer `"use client"` des composants interactifs (l'auto-scroll et le drag en dépendent) ni casser `useReducedMotion` / le drag conditionné par `prefers-reduced-motion` (accessibilité non négociable, AGENTS.md §6).

### ⚠️ Piège n°2 — `avatarId` sans modèle `Media`
`TimelineEntry.avatarId String?` référence un `Media` **qui n'existe pas avant l'Epic 5**. Comme en 4.1 (piège n°4 image), **ne pas** créer de relation vers `Media`. Deux options — trancher avec Jeevons :
- **(a)** [recommandé] Laisser `avatarId` **null** au seed et **garder les imports statiques d'avatars dans le conteneur/composant**, joints par une clé stable (ex. un `sortOrder`/`slug` d'entrée → import). Le rendu reste iso, l'avatar reste un `StaticImageData`.
- **(b)** Stocker dans `avatarId` un identifiant textuel de l'asset (ex. `"bac-icon"`) et faire la correspondance côté conteneur.
Dans les deux cas, **le type d'avatar consommé par le composant reste `StaticImageData`** — ne pas anticiper les URLs (Epic 5).

### ⚠️ Piège n°3 — `startYear Int` (NOT NULL) alors que les données n'ont pas d'année structurée
Le modèle impose `startYear Int` **non nullable**, mais les entrées actuelles n'ont **pas** d'année explicite (le texte évoque « 2020 » pour le bac, « À venir » pour la dernière). Il faut **fournir un `startYear` pour chaque entrée au seed**, sinon la contrainte NOT NULL bloque. 🛑 **Trancher avec Jeevons** les années à attribuer aux 5 entrées (déduites du texte : bac ≈ 2020, licence ≈ 2020-2021, BUT MMI, Cefim, « À venir »). Pour l'entrée « À venir », `startYear` doit rester un entier plausible (ex. année cible) et `endYear` peut être `null`. **Ne pas inventer en silence** : c'est une donnée métier, elle appartient à Jeevons. `sortOrder` reprend l'ordre actuel (0→4) pour garantir l'AC2 même si les années sont approximatives.

### ⚠️ Piège n°4 — Filtre `published` sur le parcours (AC2), pas sur les hobbies
`TimelineEntry` a `published` (défaut `true`) : la lecture publique doit filtrer `where: { published: true }` et ordonner par `sortOrder`. `Hobby` **n'a pas** de `published` (modèle §2.1) : les 7 hobbies sont toujours affichés. Ne pas ajouter de champ non prévu au modèle `Hobby`.

### ⚠️ Piège n°5 — L'effet « scroll infini » duplique les cartes
`Testimonials.tsx` rend `[...testimonials, ...testimonials]` (duplication pour le défilement infini) avec `key={index}` sur le `Fragment`. **Conserver ce pattern exactement** : le composant client reçoit `entries` en props et continue de faire `[...entries, ...entries]`. Ne pas « corriger » la duplication (elle est intentionnelle). Vérifier l'absence de warning de clé (React 19 strict).

### ⚠️ Piège n°6 — Seed idempotent sans clé naturelle évidente
Ni `TimelineEntry` ni `Hobby` n'ont de champ `@unique`. Pour l'idempotence (AC1) : réutiliser le pattern 4.1 — **remplacer** l'ensemble à chaque seed (`deleteMany` puis recréer) est acceptable pour ces petites tables sans FK entrante, OU introduire une clé de déduplication déterministe (ex. `title`) via un `upsert` manuel (find-then-create). Rester cohérent avec le choix fait en 4.1. Prouver : 2 seeds → mêmes comptes de lignes.

### ⚠️ Piège n°7 — Ne pas déborder sur 4.3 / Epic 6
- Les **textes de `SectionHeader`** (eyebrow/title/description) de ces sections restent **en dur** ici → ils relèvent de `SiteSetting` (4.3) s'ils doivent bouger, ou de la refonte Epic 6. Ne pas les migrer.
- La refonte visuelle du parcours (timeline verticale animée, PLAN §4.2 P2) est **Epic 6**. Ici, **rendu strictement iso** : le carrousel horizontal reste tel quel, seule la **source des données** change.

## Tasks / Subtasks

- [x] **Tâche 0 — Prérequis** (AC: 1)
  - [x] 4.1 terminée (status `review`) : Prisma, `lib/db.ts`, patterns seed/lecture en place. On étend le schéma existant.
  - [x] 🛑 Années obtenues de Jeevons (piège n°3) : bac 2020→2020 · licence 2020→2023 · BUT MMI 2023→2024 · Cefim 2024→2025 · « Après le CDA » 2027→null.
- [x] **Tâche 1 — Étendre le schéma + migration** (AC: 1 ; piège n°2)
  - [x] `TimelineEntry` et `Hobby` ajoutés à `schema.prisma` (+ `slug @unique` pour idempotence/jointure, `sortOrder` sur Hobby, `@@index([published, sortOrder])`).
  - [x] `avatarId` **nu (String?)**, laissé null au seed ; pas de relation vers `Media` (décision Jeevons : avatars = imports statiques joints par slug).
  - [x] `prisma migrate dev --name add_timeline_hobby` → migration `20260724091058_add_timeline_hobby`.
- [x] **Tâche 2 — Seed idempotent** (AC: 1 ; pièges n°3, 6)
  - [x] 5 `TimelineEntry` (depuis `testimonials`) avec `startYear`/`endYear`, `sortOrder` 0→4, `published: true`. Upsert par `slug`.
  - [x] 7 `Hobby` (depuis `hobbies`) : `slug`, `title`, `emoji`, `posLeft`, `posTop`, `sortOrder`. Upsert par `slug`.
  - [x] Idempotence prouvée (2 passages) : TimelineEntry=5, Hobby=7 identiques.
- [x] **Tâche 3 — Brancher le parcours** (AC: 2 ; pièges n°1, 4, 5)
  - [x] Conteneur serveur `Testimonials.tsx` (`async`) lit `getPublishedTimeline()` (`published: true`, tri `sortOrder`) → props vers `TestimonialsClient`.
  - [x] `TestimonialsClient` (`"use client"`) conserve auto-scroll, `useReducedMotion`, duplication `[...entries, ...entries]`, `id="parcours"`, avatar joint par slug.
  - [x] Vérifié : `but-mmi` en `published: false` → disparaît de la page (AC2). État restauré.
- [x] **Tâche 4 — Brancher les hobbies** (AC: 2 ; piège n°1)
  - [x] Conteneur serveur `About.tsx` (`async`) lit `getHobbies()` → props vers `AboutClient`.
  - [x] `AboutClient` (`"use client"`) conserve le drag (`drag={!shouldReduceMotion}`), `id="about"` ; CV, map, toolbox **inchangés** (en dur).
- [x] **Tâche 5 — Vérification & Definition of Done** (AGENTS.md §8)
  - [x] Rendu iso confirmé (page de prod) : 5 cartes parcours (même ordre, duplication scroll infini préservée) + 7 hobbies (même ordre/émojis).
  - [x] Accessibilité : `prefers-reduced-motion` intact (garde auto-scroll `if (shouldReduceMotion) return`, drag `!shouldReduceMotion`) — code déplacé verbatim.
  - [x] Ancres `#parcours` et `#about` intactes.
  - [x] `prisma validate` OK · `bun run lint` 0 nouveau warning (seul le warning `autoScroll` pré-existant, déplacé tel quel) · `tsc --noEmit` 0 erreur · `bun run build` succès (`/` static).
  - [x] Périmètre : schéma + migration + seed + `lib/timeline.ts` + `Testimonials.*`/`About.*` (split serveur/client). `page.tsx` inchangé.
  - [x] `File List` + `Completion Notes` + `Change Log` · `sprint-status.yaml` → review.

## Dev Notes

### Périmètre — verrouillé

**Créer `TimelineEntry` + `Hobby`, migrer, seeder idempotemment le parcours (5) et les hobbies (7), brancher `Testimonials.tsx` et `About.tsx` en lecture DB via un conteneur serveur, rendu iso.**

**Hors périmètre — ne pas faire :**
- ❌ **`SiteSetting`** / textes d'accroche → story **4.3**.
- ❌ **`Media`** / vraie relation avatar → **Epic 5**.
- ❌ **ISR / cache par tag** → story **4.4** · **Fallback statique** → story **4.5** · **Migrations au démarrage** → story **4.6**.
- ❌ **Refonte visuelle** du parcours (timeline verticale) ou de la bento About → **Epic 6**. Rendu iso.
- ❌ **Retirer `"use client"`** ou casser l'auto-scroll / le drag / `prefers-reduced-motion`.
- ❌ **Ajouter un champ `published` à `Hobby`** (hors modèle) ou toute dépendance.

### Le vrai enjeu

Le pattern **conteneur serveur (fetch) → composant client (vue)** est le cœur de cette story : c'est la première fois qu'on branche la base derrière une section **interactive** (les projets en 4.1 étaient des composants serveur). Bien le poser ici sert de modèle pour tout l'Epic 5 (écrans admin) et clarifie la frontière serveur/client de Next 16.

### Testing standards

Pas de test automatisé (Playwright en Epic 7). Vérification : rendu iso avant/après (5 + 7 éléments, même ordre/positions), idempotence du seed (2 passages), filtre `published` du parcours, `prefers-reduced-motion` respecté, tsc/lint/build verts.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.2]
- [Source: PLAN_REFONTE_2026.md §2.1 — modèles `TimelineEntry`, `Hobby`]
- [Source: _bmad-output/implementation-artifacts/4-1-servir-les-projets-depuis-la-base.md — Prisma installé, `lib/db.ts`, patterns seed idempotent et lecture serveur, gestion image/avatar par import statique joint au slug]
- [Source: apps/web/src/sections/Testimonials.tsx — `id="parcours"`, constante `testimonials` (5), `"use client"`, auto-scroll, `[...testimonials, ...testimonials]`]
- [Source: apps/web/src/sections/About.tsx — constante `hobbies` (7), `"use client"`, drag conditionné par `useReducedMotion`, `id="about"`]
- [Source: apps/web/src/app/page.tsx — ordre : Testimonials puis About]
- [Source: AGENTS.md §6 — données côté Server Components, vues bêtes en props, `prefers-reduced-motion` non négociable ; §5 — chevauchement Epic 6, ne pas préempter la refonte ; §9 — anti-scope-creep]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

- **Pattern conteneur serveur → vue client** (cœur de la story) : `Testimonials.tsx`/`About.tsx` étaient `"use client"` (auto-scroll / drag) → impossible d'y `await prisma`. Approche (a) retenue : le composant interactif devient `…Client.tsx` (reçoit les données en props), et l'ancien nom (`Testimonials.tsx`/`About.tsx`) devient un wrapper serveur `async` qui lit la base. `page.tsx` importe toujours `TestimonialsSection`/`AboutSection` → **inchangé**.
- **`prisma generate` requis après `migrate dev`** : le seed importe le client généré (`../src/generated/prisma/client`). Le 1er `bun run db:seed` a échoué (`prisma.timelineEntry is undefined`) car le client n'avait pas les nouveaux modèles — résolu par `bunx prisma generate`. À retenir pour les stories DB suivantes.
- **Avatars (piège n°2)** : `avatarId` laissé null ; la table `slug → StaticImageData` vit dans `TestimonialsClient` (imports client-safe), l'avatar reste `StaticImageData`, rendu iso.

### Completion Notes List

- **AC1** ✅ `TimelineEntry` + `Hobby` créés et migrés (`add_timeline_hobby`). Seed idempotent (upsert par `slug`) : 2 passages → 5 / 7 identiques.
- **AC2** ✅ Rendu iso confirmé sur la page de prod (5 parcours + 7 hobbies, même ordre, duplication scroll infini préservée). Filtre `published: true` **dans la requête** ; entrée `published: false` disparaît (vérifié sur `but-mmi`).
- **Décisions Jeevons** : années du parcours validées/corrigées (piège n°3) ; avatars = imports statiques joints par slug, `avatarId` null (piège n°2).
- **Accessibilité préservée** : `useReducedMotion` — pas d'auto-scroll et pas de drag en mouvement réduit (code déplacé verbatim dans les `…Client`).
- **Additions minimales au modèle** (au service des AC, pas de scope creep) : `slug @unique` (idempotence + jointure avatar), `sortOrder` sur `Hobby` (préserver l'ordre), `@@index([published, sortOrder])` sur `TimelineEntry`. **Pas** de `published` sur `Hobby` (respecté, piège n°4).
- **Hors périmètre respecté** : textes `SectionHeader` en dur (→ 4.3), CV/toolbox/map inchangés (→ Epic 5/6), pas d'ISR/fallback/migrations-démarrage (4.4/4.5/4.6), pas de refonte visuelle (Epic 6), `"use client"` conservé.

### File List

**Nouveaux fichiers :**
- `apps/web/prisma/migrations/20260724091058_add_timeline_hobby/migration.sql`
- `apps/web/src/lib/timeline.ts` *(reads `getPublishedTimeline`, `getHobbies`)*
- `apps/web/src/sections/TestimonialsClient.tsx` *(vue client du parcours)*
- `apps/web/src/sections/AboutClient.tsx` *(vue client À propos)*

**Fichiers modifiés :**
- `apps/web/prisma/schema.prisma` *(+ `TimelineEntry`, `Hobby`)*
- `apps/web/prisma/seed.ts` *(+ 5 timeline, 7 hobbies, idempotents par slug)*
- `apps/web/src/sections/Testimonials.tsx` *(→ wrapper serveur `async`)*
- `apps/web/src/sections/About.tsx` *(→ wrapper serveur `async`)*

**Non modifiés (contrat préservé) :** `apps/web/src/app/page.tsx`.

### Change Log

| Date | Description |
|------|-------------|
| 2026-07-24 | Story 4.2 créée — modèles `TimelineEntry`/`Hobby`, seed idempotent du parcours (Testimonials) et des hobbies (About), branchement serveur des deux sections client. |
| 2026-07-24 | Implémentation 4.2 — modèles `TimelineEntry`/`Hobby` + migration `add_timeline_hobby`, seed idempotent (2× → 5/7), pattern conteneur serveur `async` → vue `…Client` pour `Testimonials` et `About` (accessibilité et interactions conservées), avatars joints par slug. AC1–AC2 vérifiés. Statut → review. |
