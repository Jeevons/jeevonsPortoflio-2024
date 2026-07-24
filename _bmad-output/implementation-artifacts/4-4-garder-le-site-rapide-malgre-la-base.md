---
baseline_commit: 220ab43cc5c937806af6409fae95d96fd1f3ed21
---

# Story 4.4: Garder le site rapide malgré la base

Status: review

## Story

As **visiteur du portfolio**,
I want **que les pages s'affichent instantanément**,
so that **la consultation reste agréable, sans attendre une requête à chaque visite**.

## Acceptance Criteria

**AC1 — Rendu statique + revalidation périodique d'une heure**
**Given** les pages publiques interrogent désormais la base
**When** j'inspecte leur mode de rendu
**Then** elles sont rendues statiquement avec une revalidation périodique d'une heure (`revalidate: 3600`)
**And** un visiteur ne déclenche pas de requête à la base à chaque chargement

**AC2 — Lectures étiquetées par domaine (cache tags)**
**Given** les données sont mises en cache par famille
**When** j'inspecte le code de récupération
**Then** les lectures sont étiquetées par domaine — `projects`, `timeline`, `settings` — afin qu'une revalidation ciblée soit possible

**AC3 — Revalidation ciblée reflète le changement immédiatement, sans redéploiement**
**Given** le contenu change en base
**When** la revalidation ciblée de l'étiquette correspondante est déclenchée
**Then** le site public reflète le changement immédiatement
**And** aucune reconstruction d'image ni redéploiement n'est nécessaire

## Contexte d'implémentation

### 🛑 Prérequis : stories 4.1, 4.2, 4.3 `done`

Les trois familles de données à étiqueter (`projects`, `timeline`, `settings`) doivent **exister en lecture DB** avant de les cacher. Cette story ne change pas *ce que* les pages lisent, mais *comment* les lectures sont mises en cache et revalidées. Stack : `apps/web/`, Bun, Next 16 / React 19.

### 🎯 Ce que fait vraiment cette story

Trois choses, sur les **fonctions de lecture** créées en 4.1/4.2/4.3 (`lib/`) et sur les **pages** :
1. **ISR** : la page publique est **statique** avec `export const revalidate = 3600` (1 h). Un visiteur sert la version pré-rendue, **sans** toucher la base à chaque requête (AC1).
2. **Cache tags par domaine** : chaque lecture est enveloppée dans le mécanisme de cache de Next et **étiquetée** par domaine — `projects`, `timeline`, `settings` (AC2).
3. **Revalidation à la demande** : une **capacité** de `revalidateTag('projects' | 'timeline' | 'settings')` existe et est **vérifiable manuellement** (AC3). ⚠️ Voir piège n°3 : le *déclenchement depuis l'admin* est Epic 5, ici seule la capacité est posée.

### ⚠️ Piège n°1 (CENTRAL) — L'API de cache de Next 16 : vérifier la version exacte
Le mécanisme de cache de données de Next évolue vite (`unstable_cache`, `fetch` tagué, `cacheTag`/`cacheLife` de `use cache`, `revalidateTag`). Selon la version **exacte** de Next 16.2.11 installée et la configuration (`next.config.mjs` est en **webpack**, pas Turbopack — vérifier la compatibilité du cache retenu), l'API disponible et stable diffère. 🛑 **Consulter la doc officielle de la version installée avant de coder**, et **valider avec Jeevons** l'approche retenue (directive `use cache` + `cacheTag` vs `unstable_cache` avec `{ tags }`). Ne pas copier un pattern d'une autre version de mémoire. Le critère : les lectures Prisma (qui ne passent pas par `fetch`) doivent être cachables et **taguées** — c'est le point technique délicat, car le tagging par `fetch` ne s'applique pas nativement à un appel Prisma. Enrober la lecture Prisma dans le cache Next tagué (`unstable_cache(fn, keys, { tags: ['projects'] })` ou équivalent `use cache` + `cacheTag('projects')`).

### ⚠️ Piège n°2 — `revalidate = 3600` vs lecture dynamique par requête
Aujourd'hui (après 4.1-4.3), une lecture Prisma dans un Server Component peut **basculer la page en rendu dynamique** (requête à chaque visite) — exactement ce que l'AC1 interdit (« ne déclenche pas de requête à la base à chaque chargement »). Poser `export const revalidate = 3600` sur la page **et** cacher les lectures (piège n°1) est ce qui garantit le rendu statique. **Vérifier au build** que la route `/` est marquée **statique** (« ○ » / SSG dans la sortie `next build`), pas dynamique (« ƒ »). Si elle est dynamique, le cache/tag n'est pas correctement posé — corriger avant de clore.

### ⚠️ Piège n°3 — Le déclenchement de la revalidation est Epic 5, PAS ici
epics.md est explicite : « Le déclenchement de cette revalidation depuis les écrans d'administration est traité en Epic 5. **Ici, la capacité est en place et vérifiable manuellement.** » Donc :
- ✅ Poser la **capacité** : une fonction ou une route qui appelle `revalidateTag(...)`, testable manuellement (ex. une Route Handler `/api/revalidate` protégée a minima, ou un Server Action de test, ou une commande) permettant de prouver l'AC3.
- ❌ **Ne pas** construire l'UI admin ni le bouton « Revalider le site » (PLAN §3.2, Epic 5).
- 🛑 **Sécurité** : si une route de revalidation est exposée, elle ne doit **pas** être ouverte publiquement sans garde (au minimum un secret partagé). Ne pas laisser une route qui permettrait à n'importe qui de forcer des revalidations. Valider l'approche avec Jeevons.

### ⚠️ Piège n°4 — Cohérence des noms de tags (contrat inter-stories)
Les tags `projects`, `timeline`, `settings` sont un **contrat** repris tel quel en Epic 5 (chaque mutation admin appellera `revalidateTag('projects'|'timeline'|'settings')`, PLAN §3.3). **Figer exactement ces trois noms** (au singulier/pluriel du plan : `projects`, `timeline`, `settings`). Centraliser ces constantes (ex. `lib/cache-tags.ts`) pour éviter les fautes de frappe silencieuses. Note : `timeline` couvre `TimelineEntry` **et** les `Hobby` (même section conceptuelle « parcours/about ») — ou décider d'un tag distinct ; **trancher et documenter** pour que l'Epic 5 sache quoi invalider.

### ⚠️ Piège n°5 — Ne pas empiéter sur 4.5 (fallback DB-down)
Cette story suppose la **DB joignable**. La résilience à une base injoignable est **4.5**. Ne pas mélanger : ici on optimise le chemin heureux (cache + revalidation). Si le cache masque une DB-down par effet de bord, tant mieux, mais ce n'est **pas** l'objet — ne pas implémenter de try/catch de fallback ici.

### ⚠️ Piège n°6 — Vérifier « pas de requête DB par visite » concrètement
L'AC1 (« un visiteur ne déclenche pas de requête à la base à chaque chargement ») se vérifie : après build+start, charger la page plusieurs fois et confirmer via les **logs de requêtes Prisma** (activer temporairement le log Prisma `query`) qu'aucune requête n'est émise sur des chargements successifs dans la fenêtre de revalidation. Consigner cette preuve.

## Tasks / Subtasks

- [x] **Tâche 0 — Prérequis & choix d'API** (AC: 1, 2)
  - [x] Confirmer 4.1/4.2/4.3 (les 3 familles lues depuis la DB, statut `review`).
  - [x] Doc Next 16.2.11 vérifiée + approche validée avec Jeevons : `unstable_cache` + `{ tags }` (piège n°1). `use cache` écarté (exige `cacheComponents`/`dynamicIO`, friction webpack).
  - [x] Compat webpack confirmée : `unstable_cache` fonctionne avec le build `--webpack` actuel (aucun changement `next.config.mjs`).
- [x] **Tâche 1 — Tags de domaine centralisés** (AC: 2 ; piège n°4)
  - [x] `lib/cache-tags.ts` : `CACHE_TAGS` (`projects`/`timeline`/`settings`), helpers `isCacheTag`, `REVALIDATE_SECONDS`. **Décision Jeevons** : `timeline` couvre parcours + hobbies.
- [x] **Tâche 2 — Cacher et taguer les lectures** (AC: 2 ; pièges n°1, 2)
  - [x] Chaque lecture Prisma enrobée dans `unstable_cache(..., { tags, revalidate })` : projets (tag `projects`), timeline + hobbies (tag `timeline`), settings (tag `settings`).
  - [x] Lectures Prisma (hors `fetch`) bien cachées ; `settings` cache un tableau brut (sérialisable) et non la `Map`.
- [x] **Tâche 3 — ISR sur la page** (AC: 1 ; piège n°2)
  - [x] `export const revalidate = 3600` sur `app/page.tsx` (littéral requis par l'analyse statique du segment — pas d'import).
  - [x] `bun run build` : `/` marqué `○ (Static)` avec **Revalidate 1h** (plus dynamique).
- [x] **Tâche 4 — Capacité de revalidation ciblée** (AC: 3 ; piège n°3)
  - [x] Route Handler `POST /api/revalidate?tag=…` appelant `revalidateTag(tag, { expire: 0 })`, protégée par secret partagé (`REVALIDATE_SECRET`, échoue **fermé** si absent). **Décision Jeevons**.
  - [x] ❌ Pas d'UI admin ni bouton (Epic 5).
- [x] **Tâche 5 — Vérification & Definition of Done** (AGENTS.md §8)
  - [x] AC1 prouvé : après `pg_stat_reset()`, 8 chargements de `/` → **0 lecture** sur `Project`/`TimelineEntry`/`Hobby`/`SiteSetting` (piège n°6). `/` statique au build.
  - [x] AC3 prouvé : badge modifié en base → page sert encore l'**ancienne** valeur (cache) → `POST /api/revalidate?tag=settings` (200) → page sert la **nouvelle** valeur, **sans rebuild**. Gardes : mauvais secret → 401, tag inconnu → 400.
  - [x] Rendu iso (aucun changement visuel ; badge/titre/liens identiques).
  - [x] `eslint` (0 erreur, 1 warning pré-existant Testimonials) · `bunx tsc --noEmit` (0 erreur) · `bun run build` (succès, `/` statique).
  - [x] `git status` : lib cache-tags + fonctions de lecture + `page.tsx` + route de revalidation, rien d'autre (le reste = accumulation 4.1-4.3).
  - [x] `File List` + `Completion Notes` + `Change Log` · `sprint-status.yaml` mis à jour.

## Dev Notes

### Périmètre — verrouillé

**Rendre les pages publiques statiques (ISR 1 h), cacher et étiqueter les lectures par domaine (`projects`/`timeline`/`settings`), poser une capacité de revalidation ciblée vérifiable manuellement — sans UI admin ni fallback DB-down.**

**Hors périmètre — ne pas faire :**
- ❌ **Déclenchement de la revalidation depuis l'admin / bouton « Revalider »** → **Epic 5**.
- ❌ **Fallback si DB injoignable** → **4.5**.
- ❌ **Migrations au démarrage** → **4.6**.
- ❌ **Changer le contenu, le rendu ou les modèles.** Purement cache/rendu.
- ❌ **Exposer une route de revalidation non protégée.**
- ❌ **Ajouter une dépendance** (le cache est natif Next).

### Le vrai enjeu

C'est « le cœur de la souplesse recherchée » (PLAN §3.3) : le portfolio devient **piloté par la donnée sans sacrifier la performance ni imposer un rebuild**. Le contrat de tags (`projects`/`timeline`/`settings`) figé ici est ce que **chaque mutation admin de l'Epic 5 appellera**. Une lecture mal taguée ou une page restée dynamique casserait toute la promesse « instantané + zéro redéploiement ».

### Testing standards

Pas de test automatisé (Playwright en Epic 7). Vérification : route `/` statique au build, logs Prisma silencieux sur chargements répétés (AC1), revalidation ciblée effective sans rebuild (AC3), rendu iso, tsc/lint/build verts.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.4]
- [Source: _bmad-output/planning-artifacts/epics.md — « le déclenchement de cette revalidation depuis les écrans d'administration est traité en Epic 5 ; ici la capacité est en place et vérifiable manuellement »]
- [Source: PLAN_REFONTE_2026.md §3.3 — « ISR + revalidation à la demande : pages statiques (`revalidate: 3600`) ; chaque mutation admin appelle `revalidateTag('projects'|'timeline'|'settings')` → site instantanément à jour sans rebuild Docker. C'est le cœur de la souplesse recherchée. »]
- [Source: _bmad-output/implementation-artifacts/4-1/4-2/4-3 — fonctions de lecture par domaine à cacher/taguer]
- [Source: apps/web/next.config.mjs — build webpack (`--webpack`), `output: "standalone"` (compat cache à vérifier)]
- [Source: apps/web/src/app/page.tsx — page publique cible de l'ISR]
- [Source: AGENTS.md §3 — « pages publiques statiques avec ISR (`revalidate: 3600`) ; une mutation admin ne redéploie rien, elle déclenche `revalidateTag` » ; §9 — anti-scope-creep]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code)

### Debug Log References

- API cache Next 16.2.11 : `next/cache` exporte `unstable_cache` ET la famille `use cache` (`cacheTag`/`cacheLife`). Choix `unstable_cache` (stable, compatible build webpack actuel, pas de config à activer). Décision validée avec Jeevons.
- **Breaking change Next 16** : `revalidateTag(tag)` exige désormais un 2e argument `(tag, profile: string | { expire })`. Utilisé `{ expire: 0 }` = purge immédiate sans dépendre d'un profil `cacheLife` nommé.
- **Piège de build** : `export const revalidate` doit être un **littéral** (analyse statique du segment). Un import (`REVALIDATE_SECONDS`) fait échouer le build (`Unknown identifier ... at "revalidate"`) → valeur `3600` inline sur `page.tsx`, alignée sur la constante partagée.
- `bun run build` : `/` → `○ (Static)`, **Revalidate 1h / Expire 1y** ; `/api/revalidate` → `ƒ` (dynamique). AC1/AC2 confirmés au build.
- AC1 (aucune requête par visite) : `pg_stat_reset()` puis 8× `curl /` → `SUM(seq_scan+idx_scan)` = **0** sur `Project`/`TimelineEntry`/`Hobby`/`SiteSetting`. Page sert la donnée correctement.
- AC3 (revalidation ciblée sans rebuild) : badge modifié en base → page cachée sert l'ancienne valeur → `POST /api/revalidate?tag=settings` (secret) → 200 → nouvelle valeur servie, sans rebuild. Gardes : secret invalide → 401, tag inconnu → 400, secret non configuré → 503 (échec fermé).
- **Piège rencontré (post-mortem)** : un serveur standalone de la story 4.3 tournait encore sur le port 3000 (PID orphelin) ; mes premiers curls le frappaient → 404 sur la nouvelle route. Résolu en tuant le process du port avant de relancer le build frais. Vérifs rejouées OK.
- `eslint` 0 erreur (1 warning pré-existant `TestimonialsClient`), `tsc --noEmit` 0 erreur.

### Completion Notes List

- **`lib/cache-tags.ts`** (nouveau) : contrat de tags `CACHE_TAGS = { projects, timeline, settings }` — **repris tel quel en Epic 5** (chaque mutation admin appellera `revalidateTag`). Helpers `isCacheTag`/`CACHE_TAG_VALUES` (validation d'entrée de la route) et `REVALIDATE_SECONDS = 3600`. **Décision Jeevons** : `timeline` couvre parcours (`TimelineEntry`) ET hobbies (`Hobby`) — même section conceptuelle ; éditer l'un ou l'autre invalide le même tag.
- **Cache des lectures** (`lib/projects.ts`, `lib/timeline.ts`, `lib/settings.ts`) : chaque lecture Prisma (hors `fetch`) enrobée dans `unstable_cache(fn, keyParts, { tags, revalidate })`. La signature publique des fonctions (`getPublishedProjects`, etc.) est **inchangée** — seul le corps est caché → aucun impact sur les sections consommatrices. Pour `settings`, on cache le **tableau brut** de lignes (sérialisable) et la `Map` est reconstruite hors cache.
- **ISR** : `export const revalidate = 3600` sur `app/page.tsx`. Combiné au cache tagué, `/` reste **statique** (SSG + revalidation 1 h), pas de requête DB par visite (AC1).
- **Capacité de revalidation** (`app/api/revalidate/route.ts`, nouveau) : `POST /api/revalidate?tag=<projects|timeline|settings>`, protégée par header `x-revalidate-secret` == `REVALIDATE_SECRET`. **Échec fermé** : secret non configuré → 503 (jamais ouverte publiquement, piège n°3). C'est la surface que l'admin Epic 5 réutilisera. **Aucune UI/bouton** ajouté (hors périmètre).
- `.env` local : ajout de `REVALIDATE_SECRET` (gitignoré). ⚠️ **À définir côté hôte en prod** pour activer la revalidation (documenté dans `.env` et l'en-tête de la route).
- Périmètre respecté : purement cache/rendu. Aucun changement de contenu, de modèle ni de rendu visuel. Pas de fallback DB-down (4.5), pas de migrations au démarrage (4.6), pas de déclenchement admin (Epic 5). Aucune dépendance ajoutée (cache natif Next).

### File List

- `apps/web/src/lib/cache-tags.ts` — **nouveau** : contrat de tags + constantes de cache.
- `apps/web/src/lib/projects.ts` — lecture enrobée dans `unstable_cache` (tag `projects`).
- `apps/web/src/lib/timeline.ts` — lectures parcours + hobbies enrobées (tag `timeline`).
- `apps/web/src/lib/settings.ts` — lecture enrobée (tag `settings`), cache d'un tableau sérialisable.
- `apps/web/src/app/page.tsx` — `export const revalidate = 3600` (ISR, AC1).
- `apps/web/src/app/api/revalidate/route.ts` — **nouveau** : route de revalidation ciblée protégée par secret (AC3).
- `apps/web/.env` — **(gitignoré)** ajout de `REVALIDATE_SECRET` pour le dev local.

### Change Log

| Date | Description |
|------|-------------|
| 2026-07-24 | Story 4.4 créée — ISR 1 h sur les pages publiques, cache/étiquetage des lectures par domaine, capacité de revalidation ciblée vérifiable manuellement. |
| 2026-07-24 | Story 4.4 implémentée — `lib/cache-tags.ts` (contrat `projects`/`timeline`/`settings`), lectures Prisma enrobées dans `unstable_cache` tagué, ISR `revalidate=3600` sur `/`, route `POST /api/revalidate` protégée par secret (`revalidateTag(tag,{expire:0})`). AC1 prouvé (0 requête DB sur 8 chargements), AC3 prouvé (modif → revalidation ciblée → à jour sans rebuild). Décisions Jeevons : `unstable_cache`, `timeline` couvre les hobbies, route protégée par secret. Status → review. |
