---
baseline_commit: 5c22f3a6c48914801d0a226ab5a0b15c005d8765
---

# Story 5.11: Préparer un projet avant de le publier

Status: ready-for-dev

## Story

As **Jeevons**,
I want **rédiger un projet tranquillement avant qu'il ne soit visible**,
so that **je ne publie jamais un contenu inachevé sur mon portfolio**.

## Acceptance Criteria

**AC1 — Brouillon invisible côté public**
**Given** je crée un projet
**When** je l'enregistre sans le publier
**Then** il est conservé en brouillon
**And** il n'apparaît nulle part sur le site public

**AC2 — Aperçu du brouillon, connecté, avec repère**
**Given** un projet est en brouillon
**When** je consulte le site avec le paramètre d'aperçu, en étant connecté
**Then** le brouillon m'est affiché comme il le serait une fois publié
**And** un repère visuel m'indique clairement que je suis en mode aperçu

**AC3 — Pas d'aperçu sans session**
**Given** je ne suis pas connecté
**When** j'utilise ce même paramètre d'aperçu
**Then** aucun brouillon ne m'est montré
**And** le site se comporte comme pour un visiteur ordinaire

**AC4 — Publication → visible après revalidation**
**Given** je publie un brouillon
**When** j'enregistre
**Then** il devient visible publiquement après revalidation

## Contexte d'implémentation

### 🛑 Prérequis : stories 5.8 (CRUD projet) + socle sécurité (session) `done`

5.8 expose le champ `published` simplement. 5.11 implémente le **vrai comportement brouillon/publié** + le mode **aperçu** (`?preview=1`) réservé à l'admin connecté. PLAN §3.3 (« Brouillon / publié : `published=false` visible uniquement en session admin via `?preview=1` »).

### 🎯 Ce que fait vraiment cette story

1. Un projet **non publié** (`published=false`) n'apparaît **nulle part** côté public (AC1). C'est déjà le cas des lectures Epic 4 (`published:true`) — vérifier l'exhaustivité.
2. **Aperçu** : avec `?preview=1` **et une session admin**, les brouillons s'affichent comme publiés + un **repère visuel** « mode aperçu » (AC2).
3. Sans session, `?preview=1` ne montre **aucun** brouillon (AC3).
4. Publier → visible après `revalidateTag('projects')` (AC4).

### ⚠️ Piège n°1 (CENTRAL) — Aperçu = lecture NON cachée, dépendante de la session

- ⚠️ Les lectures publiques (`getPublishedProjects`, `projects.ts`) sont **cachées** (ISR, tag `projects`, `published:true`) et **agnostiques de la session** (le cache ne doit pas mélanger visiteurs et admin). L'aperçu **ne peut pas** passer par ce chemin caché.
- Solution : quand `?preview=1` **et** session admin valide → lecture **dédiée, non cachée**, incluant les brouillons (`published:true OR false`). Sinon → lecture publique cachée normale. ⚠️ **Ne jamais** mettre le contenu brouillon dans le cache public (sinon fuite du brouillon aux visiteurs — faille grave). C'est l'invariant central.
- `?preview=1` force le rendu **dynamique** (pas de mise en cache de cette réponse) : cohérent avec « aperçu = vue temps réel ».

### ⚠️ Piège n°2 — Vérifier la session côté serveur (AC2/AC3)

- La décision « montrer les brouillons » se prend **côté serveur** en vérifiant la session (`auth()`), **jamais** sur la seule présence du paramètre `?preview=1` (sinon n'importe quel visiteur verrait les brouillons — AC3 violé). `?preview=1` **sans** session = comportement visiteur ordinaire (AC3).
- ⚠️ Le middleware (5.2) protège `/admin`, pas les pages publiques. La page publique doit **elle-même** lire la session pour décider (défense au bon endroit).

### ⚠️ Piège n°3 — Où s'applique l'aperçu ? (AC2)

- Les pages projet détaillées `/projects/[slug]` sont **Epic 6**. Aujourd'hui les projets s'affichent dans les **sections** de la home (`Projects.tsx`, `SelfProject.tsx`, Epic 4). ⚠️ Clarifier la surface d'aperçu : la home avec brouillons inclus ? Un chemin dédié ? 🛑 **Trancher avec Jeevons** : le PLAN parle de `?preview=1` sur le site ; appliquer au minimum aux sections publiques existantes (un brouillon apparaît dans la liste en mode aperçu). Ne pas construire la page `/projects/[slug]` (Epic 6).
- **Repère visuel** clair (bandeau « Mode aperçu — contenu non publié ») quand l'aperçu est actif (AC2).

### ⚠️ Piège n°4 — Cohérence fallback statique (Epic 4)

- ⚠️ Le repli statique (`src/content/*.ts`, story 4.5) ne contient que du contenu publié historique. En mode aperçu, si la DB est injoignable, l'aperçu n'a rien à montrer — acceptable (l'aperçu suppose la DB joignable). Ne pas casser le fallback public normal.

### ⚠️ Piège n°5 — Réutiliser la publication de 5.8

- Publier = passer `published=true` via la Server Action de 5.8 + `revalidateTag('projects')` (AC4). ❌ Pas de nouveau chemin. AuditLog = 5.19.

### ⚠️ Piège n°6 — Vérification locale

- Créer un brouillon → **absent** du public (home, sitemap, toute liste) (AC1). Connecté + `?preview=1` → brouillon visible + bandeau aperçu (AC2). **Déconnecté** + `?preview=1` → brouillon **invisible**, site normal (AC3). Vérifier que le brouillon **n'est jamais** servi depuis le cache public (recharger sans preview → absent). Publier → visible après revalidation (AC4).

## Tasks / Subtasks

- [ ] **Tâche 0 — Prérequis** (AC: 1)
  - [ ] 5.8 + socle session `done`. Vérifier que toutes les lectures publiques filtrent `published:true`.
- [ ] **Tâche 1 — Lecture aperçu non cachée, gardée par session** (AC: 2, 3 ; pièges n°1, 2)
  - [ ] `?preview=1` + session admin → lecture dédiée incluant brouillons (jamais cachée) ; sinon lecture publique. Décision **serveur**.
- [ ] **Tâche 2 — Surface d'aperçu + repère visuel** (AC: 2 ; piège n°3)
  - [ ] Brouillons inclus dans les sections publiques en aperçu + bandeau « Mode aperçu ». 🛑 Trancher surface avec Jeevons.
- [ ] **Tâche 3 — Publication** (AC: 4 ; piège n°5)
  - [ ] `published=true` (Server Action 5.8) + `revalidateTag('projects')`.
- [ ] **Tâche 4 — Vérification locale** (AC: 1-4 ; piège n°6)
  - [ ] Brouillon invisible public ; aperçu connecté (+repère) ; aperçu déconnecté = rien ; jamais en cache public ; publication visible après revalidation.
- [ ] **Tâche 5 — Definition of Done** (AGENTS.md §8)
  - [ ] lint 0 / tsc 0 / build OK. Vérif visuelle (aperçu + repère). `git diff DEV` : lecture aperçu, garde session, bandeau, hook publication — rien d'autre.
  - [ ] `File List` + `Completion Notes` + `Change Log` · `sprint-status.yaml`.

## Dev Notes

### Périmètre — verrouillé

**Brouillon (`published=false`) invisible côté public ; aperçu `?preview=1` réservé à l'admin connecté (lecture non cachée + repère visuel) ; aucun brouillon sans session ; publication visible après revalidation.**

**Hors périmètre — ne pas faire :**
- ❌ **Page publique `/projects/[slug]`** → Epic 6 (aperçu sur les sections existantes).
- ❌ **Édition des champs / tri** → 5.8/5.9/5.10.
- ❌ **AuditLog** → 5.19.
- ❌ **Mettre un brouillon dans le cache public** (faille — invariant central).
- ❌ **Nouvelle dépendance**.

### Le vrai enjeu

L'invariant de sécurité : un brouillon ne doit **jamais** fuiter à un visiteur. Deux pièges concrets — (1) l'aperçu ne peut pas passer par le **cache public** (sinon le brouillon est servi à tous), il faut une lecture **non cachée** distincte ; (2) la décision « montrer les brouillons » se prend **côté serveur sur la session**, jamais sur la seule présence de `?preview=1` (sinon AC3 tombe). Publication = réutilise 5.8 + revalidation.

### Testing standards

Vérification **manuelle en local** + visuelle. Les 4 AC dont le cas **déconnecté + preview** (AC3) et l'absence de brouillon dans le cache public. tsc/lint/build verts.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.11]
- [Source: PLAN_REFONTE_2026.md §3.3 — brouillon/publié : `published=false` visible uniquement en session admin via `?preview=1`]
- [Source: apps/web/src/lib/projects.ts — lecture publique cachée `published:true` (ne pas mélanger avec l'aperçu) ; apps/web/src/lib/read-with-fallback.ts — repli statique (4.5)]
- [Source: apps/web/src/sections/Projects.tsx, SelfProject.tsx — surfaces publiques actuelles]
- [Source: _bmad-output/implementation-artifacts/5-8-gerer-mes-projets.md — Server Action de publication ; 5-2 — session/auth() côté serveur]
- [Source: AGENTS.md §6 — logique serveur, sécurité ; §9 — anti-scope-creep]
