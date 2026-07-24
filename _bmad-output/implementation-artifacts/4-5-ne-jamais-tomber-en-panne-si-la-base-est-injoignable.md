---
baseline_commit: 220ab43cc5c937806af6409fae95d96fd1f3ed21
---

# Story 4.5: Ne jamais tomber en panne si la base est injoignable

Status: review

## Story

As **Jeevons**,
I want **que mon portfolio reste consultable même si la base ne répond plus**,
so that **je ne me retrouve jamais avec un site en erreur pendant qu'un recruteur le consulte**.

## Acceptance Criteria

**AC1 — Contenu de repli statique sous `src/content`**
**Given** le contenu vient désormais de la base
**When** j'inspecte le projet
**Then** un contenu de repli statique existe sous `src/content`, reflétant le contenu de référence

**AC2 — DB injoignable → site affiché avec le repli, aucune page d'erreur, incident tracé**
**Given** la base est injoignable
**When** je charge la page d'accueil
**Then** le site s'affiche avec le contenu de repli
**And** aucune page d'erreur n'est présentée au visiteur
**And** l'incident est tracé côté serveur, avec assez de détail pour être diagnostiqué

**AC3 — Retour automatique au contenu réel quand la base revient**
**Given** la base redevient joignable
**When** je recharge la page
**Then** le contenu réel est de nouveau servi, sans intervention manuelle

**AC4 — Procédure de vérification documentée**
**Given** ce comportement est difficile à vérifier par hasard
**When** je veux le tester
**Then** une procédure de vérification est documentée, permettant de simuler l'indisponibilité de la base

## Contexte d'implémentation

### 🛑 Prérequis : stories 4.1, 4.2, 4.3 `done` (4.4 recommandée)

Les trois familles (`projects`, `timeline`, `settings`) sont lues depuis la DB. Cette story rend ces lectures **résilientes**. Idéalement après 4.4 (le cache atténue déjà les DB-down transitoires), mais 4.5 traite le cas où la lecture **échoue réellement**. Stack : `apps/web/`, Bun, Next 16 / React 19.

### 🎯 Ce que fait vraiment cette story

1. **Créer `src/content/*.ts`** (`apps/web/src/content/`) : un jeu de données **statique** reflétant le contenu de référence — les mêmes projets/parcours/hobbies/réglages que le seed (AC1). C'est le dossier prévu par PLAN §2 (« `content/` — fallback statique si DB vide/injoignable »).
2. **Envelopper chaque lecture DB** d'un try/catch : si Prisma jette (DB injoignable), **retourner le contenu de repli** au lieu de propager l'erreur — le composant reçoit toujours des données valides, la page se rend (AC2).
3. **Tracer l'incident** côté serveur (log structuré, niveau erreur) avec assez de détail pour diagnostiquer (AC2), **sans** afficher quoi que ce soit au visiteur.
4. **Documenter** une procédure pour simuler la DB-down et vérifier le comportement (AC4).

### ⚠️ Piège n°1 (CENTRAL) — Le fallback est PAR LECTURE, pas une page d'erreur globale
Next a un `error.tsx` / `global-error.tsx` qui attrape les exceptions de rendu — **ce n'est PAS ce qu'on veut** (l'AC2 dit « le site s'affiche avec le contenu de repli », pas « une page d'erreur élégante »). Le fallback doit être **dans la fonction de lecture** : `try { return await prisma… } catch (e) { logError(e); return fallbackContent }`. Ainsi la page se rend **normalement** avec le contenu statique, le visiteur ne voit **aucune** différence de structure. Centraliser ce pattern (ex. un helper `readWithFallback(fn, fallback, tag)`) pour ne pas dupliquer le try/catch dans chaque lecture.

### ⚠️ Piège n°2 — Cohérence du contenu de repli avec le seed (AC1)
`src/content/*.ts` doit **refléter le contenu de référence** — c'est-à-dire les mêmes données que le seed de 4.1/4.2/4.3. Risque de **dérive** : si le seed change et pas le fallback (ou l'inverse), le repli affiche du contenu obsolète. 🛑 **Décision à documenter** : soit (a) `src/content` et le seed partagent une **même source** (le seed importe depuis `src/content`), soit (b) ils sont maintenus séparément avec une note explicite. **Recommandation (a)** : le seed lit `src/content` → une seule source de vérité, pas de dérive. Cela peut impliquer un léger refactor du seed écrit en 4.1/4.2/4.3 (acceptable, dans le périmètre « fallback »). Trancher avec Jeevons.

### ⚠️ Piège n°3 — Types partagés fallback ↔ DB
Le contenu de repli doit produire **exactement le même type** que la lecture DB (le type consommé par `ProjectList`, la timeline, etc.). Réutiliser les types déjà définis (`Project` de `ProjectList.tsx`, types de 4.2/4.3). ⚠️ Rappel des pièges 4.1/4.2 : les **images/avatars** sont des imports statiques joints par clé — le fallback les fournit directement (il est en TS, il peut importer les assets). C'est même **plus simple** côté fallback que côté DB.

### ⚠️ Piège n°4 — Interaction avec le cache ISR de 4.4 (AC3)
Avec l'ISR (`revalidate: 3600`), une page rendue **avant** une panne continue de servir la version cachée — la panne est donc souvent invisible. Le fallback intervient quand une **revalidation** (ou un premier rendu) tombe pendant que la DB est down. L'AC3 (« retour au contenu réel sans intervention ») découle naturellement de l'ISR : à la revalidation suivante, si la DB est revenue, la lecture réussit et le contenu réel repeuple le cache. 🛑 **Ne pas cacher le résultat du fallback comme s'il était la vérité** avec le tag normal : si on met en cache le contenu de repli sous le tag `projects` avec la durée d'1 h, on **fige le fallback** même après retour de la DB. Option sûre : ne pas mettre en cache (ou cacher très court) le retour fallback, pour qu'une lecture ultérieure retente la DB. Réfléchir explicitement à cette interaction avec 4.4 et la documenter.

### ⚠️ Piège n°5 — Le log ne doit rien exposer au visiteur ni fuiter de secret (AC2)
« Tracé côté serveur, assez de détail pour diagnostiquer » = `console.error` structuré (ou logger serveur) avec le message d'erreur et le domaine concerné. ❌ **Jamais** dans le HTML rendu, jamais côté client. ❌ Ne pas logguer la `DATABASE_URL` ni de secret (AGENTS.md §6). Un message du type « lecture `projects` échouée, fallback statique servi : <message d'erreur Prisma> » suffit.

### ⚠️ Piège n°6 — La procédure de vérification (AC4) va dans `docs/`
AGENTS.md §3 : `docs/` = runbooks d'exploitation (précédent : le runbook 2.4 y a été versionné sur demande de Jeevons). Documenter comment **simuler la DB-down** : en dev, arrêter le service `db` du `docker-compose.yml` (`docker compose stop db`) ou pointer `DATABASE_URL` vers un hôte injoignable, recharger, constater que le site s'affiche (repli) + le log serveur, puis relancer `db` et vérifier le retour au réel (AC3). Vérifier que `docs/` reste exclu du `.dockerignore` (déjà le cas d'après la story 2.4). ⚠️ Confirmer que ce runbook n'expose aucun secret.

### ⚠️ Piège n°7 — Périmètre : ne pas refaire 4.4, ne pas anticiper 4.6
- ❌ Ne pas re-toucher l'ISR/tags de 4.4 au-delà de l'ajustement de cache-du-fallback (piège n°4).
- ❌ Ne pas toucher au démarrage du conteneur / migrations (4.6).
- ❌ Le fallback couvre les **familles déjà en base** (projects/timeline/hobbies/settings). Ne pas inventer de contenu de repli pour des sections non encore branchées à la DB.

## Tasks / Subtasks

- [x] **Tâche 0 — Prérequis** (AC: 1)
  - [x] Confirmer 4.1/4.2/4.3 `done`. Noter l'état de 4.4 (interaction cache, piège n°4).
- [x] **Tâche 1 — Contenu de repli statique** (AC: 1 ; pièges n°2, 3)
  - [x] Créer `apps/web/src/content/*.ts` reflétant projets/parcours/hobbies/settings, typé comme les lectures DB.
  - [x] Trancher la source unique seed↔content (recommandé : seed importe `src/content`). Refactor du seed si retenu.
- [x] **Tâche 2 — Lecture résiliente** (AC: 2 ; pièges n°1, 5)
  - [x] Helper `readWithFallback(fn, fallback, domaine)` : try/catch, log erreur structuré, retour du repli.
  - [x] Appliquer à toutes les lectures DB publiques.
  - [x] ❌ Pas de page d'erreur globale ; le rendu reste normal.
- [x] **Tâche 3 — Interaction cache** (AC: 3 ; piège n°4)
  - [x] S'assurer qu'un retour fallback n'est pas figé sous le tag normal 1 h ; une lecture ultérieure retente la DB.
- [x] **Tâche 4 — Procédure de vérification** (AC: 4 ; piège n°6)
  - [x] `docs/runbook-4-5-fallback-db-injoignable.md` : simuler DB-down (arrêt `db` compose), vérifier repli + log + retour au réel. Aucun secret.
- [x] **Tâche 5 — Vérification & Definition of Done** (AGENTS.md §8)
  - [x] AC2 prouvé : DB arrêtée → page d'accueil s'affiche avec le repli, **aucune** page d'erreur, log serveur présent.
  - [x] AC3 prouvé : DB relancée → contenu réel de retour sans intervention.
  - [x] Rendu iso quand la DB est up (le fallback n'altère pas le chemin heureux).
  - [x] Aucun secret dans les logs / le HTML.
  - [x] `bun run lint` (0 nouveau warning) · `bunx tsc --noEmit` (0 erreur) · `bun run build` (succès).
  - [x] `git diff DEV` : `src/content` + helper + lectures + runbook (+ éventuel refactor seed), rien d'autre.
  - [x] `File List` + `Completion Notes` + `Change Log` · `sprint-status.yaml` mis à jour.

## Dev Notes

### Périmètre — verrouillé

**Créer le contenu de repli `src/content`, envelopper les lectures DB d'un fallback tracé (sans page d'erreur), garantir le retour automatique au réel, documenter la procédure de test de la DB-down.**

**Hors périmètre — ne pas faire :**
- ❌ **Page d'erreur globale `error.tsx`** comme mécanisme de fallback (contre-sens de l'AC2).
- ❌ **Retoucher l'ISR/tags de 4.4** au-delà de l'interaction cache-fallback (piège n°4).
- ❌ **Migrations au démarrage** → **4.6**.
- ❌ **Fallback pour des sections non branchées à la DB.**
- ❌ **Logguer un secret** ou exposer l'erreur au visiteur.
- ❌ **Ajouter une dépendance** (un logger externe n'est pas requis ; `console.error` structuré suffit).

### Le vrai enjeu

C'est la promesse **NFR17 / garde-fou AGENTS.md §3** : « les pages publiques ne doivent jamais tomber en erreur ; si la base est injoignable, le fallback statique `src/content/*.ts` prend le relais ». Le scénario redouté est nommé dans l'US : un recruteur consulte le site pendant une panne DB. Le point subtil (piège n°4) est de ne pas **figer** le fallback dans le cache : la résilience doit être transparente **et** temporaire.

### Testing standards

Pas de test automatisé (Playwright en Epic 7). Vérification **manuelle guidée par le runbook** (AC4) : arrêt `db` → repli + log + pas d'erreur (AC2), relance `db` → retour au réel (AC3), chemin heureux iso. tsc/lint/build verts.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.5]
- [Source: PLAN_REFONTE_2026.md §2 — dossier `content/` « fallback statique si DB vide/injoignable » ; §3.3 — « Fallback statique : si la DB est injoignable, `src/content/*.ts` alimente le site → le portfolio ne tombe jamais en erreur pendant un entretien »]
- [Source: AGENTS.md §3 — « les pages publiques ne doivent jamais tomber en erreur — si la base est injoignable, le fallback statique `src/content/*.ts` prend le relais (NFR17) » ; §6 — pas de secret loggé]
- [Source: _bmad-output/implementation-artifacts/4-1/4-2/4-3 — lectures DB et types à envelopper ; seed à possiblement refactorer en source unique]
- [Source: _bmad-output/implementation-artifacts/4-4-garder-le-site-rapide-malgre-la-base.md — interaction ISR/cache tags (piège n°4)]
- [Source: _bmad-output/implementation-artifacts/2-4-heberger-les-donnees-du-portfolio-sur-le-postgres-mutualise.md — précédent runbook dans `docs/`, `docs/` hors `.dockerignore`]
- [Source: docker-compose.yml — service `db` à arrêter pour simuler la panne]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code)

### Debug Log References

- **Preuve AC2 (chemin froid, DB down)** — cache `.next` supprimé + `docker compose stop db`, puis `bun run build` : build **exit 0**, `7/7` pages générées (aucune page d'erreur), et un log par domaine :
  `[fallback] Lecture "projects" échouée — repli statique servi. Cause : Invalid \`prisma.project.findMany()\` invocation: Can't reach database server at 127.0.0.1:5432` (idem `settings`, `timeline`). Le HTML prerendu contient le repli (badge, projets `maufeb`/`quantum`).
- **Sécurité log/HTML** — `DATABASE_URL`, `postgresql://`, `portfolio@` = 0 occurrence dans le log et dans le HTML. L'e-mail clair (`jeevons.eya.jr@gmail`, `@gmail`) = 0 dans le HTML de repli (anti-moisson Epic 1 préservé sur le chemin fallback).
- **Preuve AC3 (retour au réel)** — serveur standalone lancé sur le build fait DB down, puis `docker compose start db` (healthy en 11 s) + invalidation des 3 tags + reload : HTTP 200, **0 log `[fallback]`**, contenu réel servi. Aucune intervention manuelle hors relance de la base.
- **Rendu iso (chemin heureux)** — contenu métier du HTML repli identique à la référence DB-up (diff des marqueurs projets/badge vide). Build DB-up final : exit 0, `/` `Revalidate 1h` (ISR de 4.4 intact), 0 `[fallback]`.
- **Note whitespace** — les erreurs Prisma commencent par des sauts de ligne et sont multi-lignes ; `read-with-fallback.ts` aplatit les blancs (`replace(/\s+/g, " ").trim()`) pour garder la cause **sur la même ligne** que le préfixe `[fallback]` (log grep-able).

### Completion Notes List

- **Piège n°1 (central) respecté** : le repli est **par lecture** (`readWithFallback`), pas de `error.tsx` global. La page se rend normalement avec le contenu statique.
- **Piège n°2 (source unique, décision Jeevons)** : `src/content/*.ts` est la seule source ; le seed l'importe. Une **garde de cohérence** dans `settings.ts` jette au chargement si `SETTING_DEFAULTS` (défaut clé-manquante) diverge de `settingsContent` (repli DB-down) → pas de dérive silencieuse.
- **Piège n°3 (types)** : `content/fallbacks.ts` (`server-only`) transforme le contenu pur en **shape de ligne DB** exact (`PublishedProject`, `TimelineEntryData`, `HobbyData`, `{key,value}`) — les sections consomment les mêmes types que la lecture réelle.
- **Piège n°4 (cache, décision Jeevons)** : le try/catch entoure l'appel **caché** ; le repli n'est **jamais** mis en cache sous le tag normal → à la revalidation suivante, si la DB est revenue, la lecture réussit et repeuple le cache avec le réel (AC3 automatique).
- **Piège n°5 (secret)** : `console.error` structuré (domaine + message Prisma). Le message expose l'hôte:port de la base (`127.0.0.1:5432`), **jamais** les identifiants ni la `DATABASE_URL`. Rien côté client.
- **Piège n°7 (périmètre)** : ISR/tags de 4.4 non retouchés (hors interaction cache-fallback) ; démarrage conteneur/migrations laissés à 4.6 ; repli limité aux familles déjà branchées (projects/timeline/hobbies/settings).

### File List

**Nouveaux fichiers**
- `apps/web/src/content/projects.ts` — données pures des projets (source unique, sans import Prisma/server-only).
- `apps/web/src/content/timeline.ts` — données pures parcours + centres d'intérêt.
- `apps/web/src/content/settings.ts` — données pures des réglages (e-mail fragmenté, anti-moisson).
- `apps/web/src/content/fallbacks.ts` — `server-only` ; transforme le contenu en shapes de lignes DB pour le repli.
- `apps/web/src/lib/read-with-fallback.ts` — helper `readWithFallback(domaine, read, fallback)` : try/catch, log structuré, repli.
- `docs/runbook-4-5-fallback-db-injoignable.md` — procédure de simulation DB-down / vérification (AC4).

**Fichiers modifiés**
- `apps/web/src/lib/projects.ts` — `getPublishedProjects` enrobé de `readWithFallback` (tag `projects`, repli `fallbackProjects`).
- `apps/web/src/lib/timeline.ts` — `getPublishedTimeline` et `getHobbies` enrobés de `readWithFallback` (tag `timeline`).
- `apps/web/src/lib/settings.ts` — `loadSettings` lit via `readWithFallback` (tag `settings`, repli `fallbackSettingRows`) ; garde de cohérence `SETTING_DEFAULTS` ↔ `settingsContent`.
- `apps/web/prisma/seed.ts` — refactor : importe les données depuis `src/content/*` (source unique), logique d'upsert inchangée.

### Change Log

| Date | Description |
|------|-------------|
| 2026-07-24 | Story 4.5 créée — contenu de repli `src/content`, lectures DB résilientes tracées, retour automatique au réel, runbook de simulation DB-down. |
| 2026-07-24 | Implémentation 4.5 : `src/content/*` (source unique importée par le seed) + `content/fallbacks.ts` (shapes DB) + helper `read-with-fallback` appliqué à projects/timeline/settings ; log fallback mono-ligne sans secret ; runbook `docs/`. AC2/AC3 prouvés (build DB-down exit 0 + logs `[fallback]`, retour au réel après relance DB). Status → review. |
