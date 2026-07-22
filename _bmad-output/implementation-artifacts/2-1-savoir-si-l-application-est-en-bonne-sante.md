---
baseline_commit: 43e1e458b22cdbaaab761e933ce4021bd15301ad
---

# Story 2.1: Savoir si l'application est en bonne santé

Status: review

## Story

As an **exploitant du VPS**,
I want **interroger un point d'entrée qui me dit si l'application répond**,
so that **l'orchestrateur puisse redémarrer le conteneur tout seul quand elle ne répond plus**.

## Acceptance Criteria

**AC1 — L'endpoint répond 200 avec un JSON exploitable**
**Given** l'application est démarrée
**When** j'appelle `GET /api/health`
**Then** je reçois un statut **200**
**And** le corps de la réponse est un **JSON** indiquant l'état, exploitable par un humain comme par une machine

**AC2 — Sans effet de bord et sans fuite d'information**
**Given** l'endpoint est destiné à un healthcheck appelé **toutes les 15 secondes**
**When** je l'appelle
**Then** il répond **sans effet de bord**, sans écriture, et **sans dépendre d'un service externe indisponible**
**And** il n'expose **aucune information sensible** : ni version de dépendance, ni chaîne de connexion, ni variable d'environnement

**AC3 — Joignable depuis l'intérieur du conteneur**
**Given** l'endpoint doit rester joignable depuis l'intérieur du conteneur
**When** j'appelle `http://127.0.0.1:3000/api/health` depuis le conteneur lui-même
**Then** la réponse est **identique** à celle obtenue de l'extérieur

## Contexte d'implémentation

### 🛑 Emplacement du fichier — le monorepo n'existe PAS encore

`PLAN_REFONTE_2026.md` §2 et les AC de l'Epic 2 mentionnent `apps/web/`. **Ce n'est pas encore le cas** : la migration monorepo est la story **3.1**, pas encore faite.

👉 **Chemin à utiliser aujourd'hui : `src/app/api/health/route.ts`** (racine du dépôt, App Router actuel).
La story 3.1 déplacera `src/` vers `apps/web/src/` en bloc — rien de spécial à prévoir ici.

⚠️ Vérifie toi-même avant d'écrire : `ls apps/` doit échouer, `cat package.json` doit montrer `next: 14.2.5` et `npm`. AGENTS.md §1 : « ne présume jamais ».

### État actuel

- **Aucun dossier `src/app/api/`** n'existe. C'est la **première Route Handler** du projet.
- Le site est aujourd'hui **100 % statique** (`src/app/page.tsx` unique + `sitemap.ts`/`robots.ts`/`opengraph-image.tsx` de la story 1.10). Le build affiche `5/5 pages statiques` + les routes générées.
- ⚠️ **Attendu** : après cette story, `npm run build` listera une route supplémentaire `/api/health`, marquée **dynamique (ƒ)** et non statique. **Ce n'est pas une régression** — c'est le comportement voulu (voir « Piège n°1 » ci-dessous).

### Next.js 14.2.5 App Router — Route Handler

Convention native, **aucune dépendance à ajouter** (AGENTS.md §9 règle 6).

```ts
// src/app/api/health/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ status: "ok", uptime: process.uptime() });
}
```

#### ⚠️ Piège n°1 — la route serait mise en cache sans `dynamic = "force-dynamic"`

En Next 14, un Route Handler `GET` **sans requête dynamique est statiquement optimisé au build**. Il servirait alors une réponse figée à l'instant du build : le healthcheck renverrait 200 **même application morte**. C'est exactement le contraire de l'objectif.

👉 `export const dynamic = "force-dynamic";` est **obligatoire**. Sans lui, l'AC1 est satisfaite en apparence mais l'intention (AC2 « détecter une panne ») est trahie.

#### ⚠️ Piège n°2 — ne rien mettre de sensible dans le corps (AC2)

**Interdit dans la réponse :** version de Next ou de toute dépendance, `process.env.*` (même partiel), `DATABASE_URL` ou fragment, nom de host interne, chemin disque, stack trace.

**Autorisé et suffisant :** un état (`"ok"`), et facultativement `uptime` (secondes depuis le démarrage du process — non sensible, utile au diagnostic) et un horodatage ISO.

💡 Le champ `status: "ok"` satisfait « exploitable par un humain **comme par une machine** » : lisible à l'œil, parsable par `jq`.

#### ⚠️ Piège n°3 — ne PAS interroger la base de données

Tentation naturelle : « un healthcheck devrait vérifier Postgres ». **Non, pas ici** :
- L'AC2 exige explicitement de **ne pas dépendre d'un service externe indisponible**.
- Prisma et Postgres **n'existent pas encore** dans ce dépôt (Epic 4). Aucun import Prisma n'est possible.
- NFR17 pose le principe inverse : le site **ne doit jamais tomber** si la base est injoignable. Un healthcheck qui échoue sur une base absente ferait redémarrer en boucle un conteneur pourtant sain (crash-loop).

👉 **Liveness, pas readiness.** Cet endpoint répond à « le process Node est-il vivant et capable de servir une requête ? », rien d'autre.

### Pourquoi cette story est la première de l'Epic 2

`docker-compose.prod.yml` (story **2.5**) déclare un healthcheck qui interroge `/api/health` toutes les 15 s avec `start_period: 30s` et `retries: 5` (NFR18). Si l'endpoint n'existe pas, le conteneur est marqué **unhealthy** et Coolify le redémarre en boucle. **2.5 et 2.6 dépendent donc directement de cette story.**

## Tasks / Subtasks

- [x] **Tâche 1 — Vérifier l'état du dépôt** (préalable)
  - [x] `ls apps/` → doit échouer (monorepo pas encore fait). Sinon, la story 3.1 a été faite : adapter le chemin en `apps/web/src/app/api/health/route.ts`.
  - [x] `cat package.json` → confirmer `next: 14.2.5` et gestionnaire **npm**.
- [x] **Tâche 2 — Créer la Route Handler** (AC: 1, 2)
  - [x] Créer `src/app/api/health/route.ts` (créer aussi les dossiers `api/` et `health/`).
  - [x] Exporter une fonction `GET` renvoyant `NextResponse.json(...)` avec un statut **200**.
  - [x] Ajouter `export const dynamic = "force-dynamic";` — **obligatoire** (piège n°1).
  - [x] Corps : `status` + facultativement `uptime` / `timestamp`. **Rien d'autre.**
  - [x] ❌ Aucun accès base, aucun `fetch` externe, aucune écriture (AC2).
- [x] **Tâche 3 — Vérification fonctionnelle** (AC: 1, 2)
  - [x] `npm run dev` puis `curl -s -o /dev/null -w "%{http_code}\n" localhost:3000/api/health` → **200**.
  - [x] `curl -s localhost:3000/api/health | jq .` → JSON valide et parsable.
  - [x] `curl -sI localhost:3000/api/health` → `content-type: application/json`.
  - [x] **Relire le corps de la réponse ligne à ligne** : aucune version, aucune variable d'environnement, aucun chemin (AC2).
  - [x] Appeler l'endpoint **3 fois de suite** → réponses cohérentes, `uptime` qui progresse, aucune erreur en console (absence d'effet de bord).
- [x] **Tâche 4 — Vérifier le comportement en production** (AC: 1, 3)
  - [x] `npm run build` → succès. La route `/api/health` apparaît marquée **ƒ (Dynamic)**. ⚠️ Si elle apparaît **○ (Static)**, `force-dynamic` est absent ou mal placé → **corriger**.
  - [x] `npm run start` puis re-tester le `curl` → 200 et JSON identiques au mode dev.
  - [x] **AC3** : `curl http://127.0.0.1:3000/api/health` → réponse identique. ⚠️ Le conteneur Docker n'existe qu'à la story 2.2 : la vérification *depuis l'intérieur du conteneur* sera **rejouée en story 2.2/2.5**. Le tester sur `127.0.0.1` en local est la vérification équivalente disponible aujourd'hui → **le noter en Completion Notes**.
- [x] **Tâche 5 — Definition of Done technique** (AGENTS.md §8)
  - [x] `npm run lint` → 0 warning nouveau · `npx tsc --noEmit` → 0 erreur · `npm run build` → succès.
  - [x] `git diff develop` relu : **un seul fichier créé**, rien d'autre.
  - [x] `File List` + `Completion Notes` + `Change Log` remplis · `sprint-status.yaml` mis à jour.

## Dev Notes

### Périmètre — verrouillé

**Un seul fichier créé** : `src/app/api/health/route.ts`. Aucun fichier modifié.

**Hors périmètre — ne pas faire :**
- ❌ **Ne pas ajouter de `HEALTHCHECK` au Dockerfile** — le Dockerfile n'existe pas encore (story 2.2) et la convention Doshwork **interdit** `HEALTHCHECK` dans l'image : il est délégué au compose (story 2.5). [PLAN §5.1]
- ❌ **Ne pas créer `docker-compose.yml`** ni aucun fichier Docker → stories 2.2/2.3/2.5.
- ❌ **Ne pas interroger Postgres/Prisma** : inexistants (Epic 4) et contraires à l'AC2.
- ❌ **Ne pas créer d'autres routes API** (`/api/status`, `/api/ready`, `/api/metrics`…) : hors AC.
- ❌ **Ne pas ajouter de dépendance** (pas de lib de healthcheck : Next fait tout nativement).
- ❌ **Ne pas exclure `/api/` du `robots.ts`** de la story 1.10 : hors périmètre, et sans effet réel.
- ❌ **Ne pas toucher à `next.config.mjs`** : `output: 'standalone'` relève de la story **2.2**.

### Fenêtre de détection de panne (NFR18)

Le compose de la story 2.5 configurera `interval: 15s`, `retries: 5`, `start_period: 30s`. Conséquence : une panne est détectée en **~75 s** au pire, et le conteneur dispose de **30 s de grâce** au démarrage. L'endpoint doit donc être **immédiatement disponible** dès que Node sert des requêtes — d'où l'absence délibérée de toute I/O au démarrage.

### Testing standards

Pas d'infrastructure de test automatisé (Playwright en Epic 7). Vérification par **`curl` en mode `dev` puis en mode `start`** (le build de production est le seul à révéler une mauvaise statisation), plus **relecture manuelle du corps JSON** pour l'AC2.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.1]
- [Source: _bmad-output/planning-artifacts/epics.md — FR36 : endpoint `/api/health` renvoyant 200, consommé par le healthcheck Coolify]
- [Source: _bmad-output/planning-artifacts/epics.md — NFR18 : `start_period: 30s`, `interval: 15s`, `retries: 5`]
- [Source: PLAN_REFONTE_2026.md §5.1 — « Pas de `HEALTHCHECK` dans l'image : délégué au compose »]
- [Source: PLAN_REFONTE_2026.md §5.3 — `test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:3000/api/health || exit 1"]`]
- [Source: PLAN_REFONTE_2026.md §8.4 — smoke test `curl .../api/health` attendu à 200]
- [Source: AGENTS.md §1 — le stack évolue, vérifier `package.json` et la présence de `apps/`]
- [Source: package.json — Next.js 14.2.5, npm]
- [Source: Next.js 14 App Router — Route Handlers, `export const dynamic`]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

- `npm run dev` → `curl` : 200, `content-type: application/json`, corps `{"status":"ok","uptime":1,"timestamp":"..."}`
- 3 appels consécutifs : `uptime` 1 → 3 → 5, aucune erreur ni warning en console (aucun effet de bord)
- `npm run build` → succès, table des routes : `ƒ /api/health` (Dynamic) ✅ — les 5 autres routes restent `○ (Static)`
- `npm run start` → `curl localhost:3000` et `curl 127.0.0.1:3000` : réponses **identiques**, 200, JSON
- `npx tsc --noEmit` → 0 erreur
- `npm run lint` → seul warning : `src/sections/Testimonials.tsx:83` (`react-hooks/exhaustive-deps`), **pré-existant**, non lié à cette story

### Completion Notes List

- Route Handler créée en `src/app/api/health/route.ts` : le monorepo n'existe pas encore (`ls apps/` échoue), conformément au contexte d'implémentation. La story 3.1 déplacera ce fichier en bloc avec le reste de `src/`.
- `export const dynamic = "force-dynamic"` bien présent et **vérifié par le build** : la route est marquée `ƒ (Dynamic)`. Sans cela, la réponse aurait été figée au build et le healthcheck aurait renvoyé 200 même application morte (piège n°1).
- **AC2 — pas de fuite d'information** : le corps ne contient que `status`, `uptime` (entier, secondes depuis le démarrage du process) et `timestamp` (ISO). Aucune version de dépendance, aucun `process.env`, aucun chemin disque, aucune stack trace.
- **AC2 — pas d'effet de bord** : aucune écriture, aucun accès base, aucun `fetch` externe. Liveness pure — l'endpoint répond « le process Node est-il vivant ? », rien d'autre. Il est donc disponible immédiatement au démarrage, ce qui respecte le `start_period: 30s` de NFR18.
- **AC3 — réserve assumée** : la vérification *depuis l'intérieur du conteneur* n'est pas réalisable aujourd'hui, le Dockerfile n'existant qu'à la story 2.2. La vérification équivalente disponible (`curl http://127.0.0.1:3000/api/health` en mode `npm run start`) a été faite et renvoie une réponse identique à celle obtenue via `localhost`. **À rejouer en stories 2.2 / 2.5** une fois le conteneur en place.
- Périmètre respecté : **un seul fichier créé**, aucun fichier modifié. Pas de Dockerfile, pas de compose, pas de `next.config.mjs`, pas de dépendance ajoutée.

### File List

- `src/app/api/health/route.ts` (créé)

### Change Log

| Date | Description |
|------|-------------|
| 2026-07-21 | Story 2.1 — Création de l'endpoint de liveness `GET /api/health` (Route Handler Next.js App Router, `force-dynamic`), renvoyant 200 et un JSON `{status, uptime, timestamp}` sans effet de bord ni information sensible. |
