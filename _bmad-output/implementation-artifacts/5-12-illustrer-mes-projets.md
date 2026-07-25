---
baseline_commit: 5c22f3a6c48914801d0a226ab5a0b15c005d8765
---

# Story 5.12: Illustrer mes projets

Status: ready-for-dev

## Story

As **Jeevons**,
I want **déposer une image de couverture par simple glisser-déposer**,
so that **mes projets soient illustrés sans que j'aie à préparer mes fichiers à la main**.

## Acceptance Criteria

**AC1 — Modèle `Media` + migration + stockage sur volume persistant**
**Given** aucun stockage de média n'existe encore
**When** cette story est terminée
**Then** le modèle `Media` existe avec chemin, dimensions, texte alternatif et miniature de flou, décrit par une migration
**And** les fichiers sont écrits dans le volume persistant prévu, hors de l'image du conteneur

**AC2 — Upload → WebP + redimensionnement + blur + dimensions**
**Given** j'édite un projet
**When** je dépose une image sur la zone prévue
**Then** elle est téléversée, convertie en WebP et redimensionnée
**And** une miniature de flou est générée pour éviter que la page ne saute au chargement
**And** ses dimensions réelles sont enregistrées

**AC3 — Texte alternatif requis**
**Given** une image doit être décrite pour être accessible
**When** je téléverse
**Then** un texte alternatif m'est demandé
**And** l'absence de description est signalée comme un défaut d'accessibilité

**AC4 — Refus des fichiers trop lourds / non pris en charge (côté serveur)**
**Given** je dépose un fichier trop lourd ou d'un type non pris en charge
**When** le téléversement démarre
**Then** il est refusé avec un message qui m'explique la limite
**And** la vérification est faite côté serveur, pas seulement côté navigateur

**AC5 — Cache longue durée pour les images**
**Given** les images téléversées ne changent jamais
**When** un visiteur les charge
**Then** elles sont servies avec des en-têtes de cache de longue durée

## Contexte d'implémentation

### 🛑 Prérequis : stories 5.8/5.9 (éditeur projet) + Epic 2 (volume Docker) `done`

Premier **upload** de l'admin. Il crée le modèle `Media` (attendu depuis Epic 4 : `cover/coverId` était réservé) et l'infra image (sharp, route de service, volume). PLAN §2.1 (`Media`), §3.2 (upload cover, sharp, blurDataUrl), §3.3 (volume `portfolio_uploads`, route `/api/media/[...path]`).

### 🎯 Ce que fait vraiment cette story

1. Modèle **`Media`** (path, width, height, blurDataUrl, alt) + migration ; **relation `cover/coverId`** ajoutée à `Project` (réservée en 4.1).
2. **Upload** (drag&drop) dans l'éditeur → conversion **WebP** (sharp), redimensionnement, **blurDataUrl**, dimensions réelles enregistrées.
3. **Alt requis** (a11y). **Validation serveur** taille/type. Fichiers écrits sur le **volume persistant** (hors image conteneur), servis avec **cache long**.

### ⚠️ Piège n°1 (CENTRAL) — sharp + `vips-dev` dans le Dockerfile (dépendance native)

- PLAN §3.2/§stack : traitement image = **`sharp`**. `bun add sharp` (prévu → autorisé). ⚠️ `sharp` est **natif** (libvips). PLAN §5 (Dockerfile) : « `RUN apk add --no-cache vips-dev` dans builder pour sharp ». 🛑 Il faut **ajouter vips au(x) étage(s) Docker** qui exécutent sharp (build ET **production runtime** — le traitement image se fait au **runtime** de l'upload, pas au build). Vérifier que l'étage `production` (standalone node, story 4.6) dispose de libvips/sharp — c'est le point dur (comme Prisma en 4.6). Confirmer que `sharp` s'installe pour la bonne plateforme (alpine/musl). **Vérifiable en local** via le build Docker.

### ⚠️ Piège n°2 — Volume persistant, hors image, écriture au runtime (AC1)

- PLAN §3.3/§5 : volume Docker `portfolio_uploads:/app/uploads`. Les fichiers sont écrits dans `/app/uploads` **au runtime** (hors image du conteneur — AC1 « hors de l'image »). ⚠️ En **dev** (docker-compose.yml) et **prod** (docker-compose.prod.yml), le volume doit être monté. Vérifier/ajouter le volume au compose **dev** si absent (aujourd'hui seul le prod le mentionne au PLAN). `Media.path` = chemin **relatif** au volume (pas un chemin absolu machine).
- ⚠️ **Utilisateur non-root** `nextjs` (uid 1001, Epic 2) : le volume `/app/uploads` doit être **inscriptible** par cet utilisateur (permissions). Point à vérifier concrètement.

### ⚠️ Piège n°3 — Route de service `/api/media/[...path]` + cache long (AC5)

- PLAN §3.3 : route `/api/media/[...path]` sert les fichiers du volume avec `Cache-Control: immutable` (longue durée, AC5). ⚠️ **Sécurité path traversal** : valider/normaliser le `[...path]` pour empêcher `../` de sortir de `/app/uploads`. Servir uniquement des fichiers du volume.
- ⚠️ `next/image` : les images admin passent par ce chemin ; `blurDataUrl` alimente le placeholder (évite le saut de page, AC2 — cohérent avec l'exigence CLS de tout le projet).

### ⚠️ Piège n°4 — Validation serveur taille/type (AC4)

- ❌ La validation navigateur (accept, taille) est **contournable** → **revalider côté serveur** (type MIME réel, taille max) dans la Server Action / route d'upload (AC4 explicite). Message clair sur la limite. Vérifier le **type réel** (magic bytes / sharp qui refuse un non-image), pas juste l'extension.

### ⚠️ Piège n°5 — Alt requis + a11y (AC3)

- Demander un **texte alternatif** au téléversement ; l'absence est **signalée comme un défaut d'accessibilité** (AC3) — pas nécessairement bloquante selon l'AC, mais visible (warning). Cohérent avec l'a11y non négociable (AGENTS.md §6). `Media.alt` (schéma) porte cette valeur.

### ⚠️ Piège n°6 — Relation `Project.cover` + revalidation

- Ajouter `coverId String?` + `cover Media? @relation(...)` à `Project` (réservé en 4.1 : « cover/coverId ajoutés en Epic 5 avec Media »). Migration additive. L'éditeur (5.9) associe une image de couverture. Après upload/association → `revalidateTag('projects')`. ⚠️ Le rendu **public** de la cover (cartes) : vérifier que les composants affichent la cover si présente, `blurDataUrl` en placeholder. La page projet détaillée est Epic 6 — ici, la cover s'affiche là où le public montre déjà les projets.

### ⚠️ Piège n°7 — Vérification locale

- Migration `Media` + `cover` appliquée (`migrate dev` + `generate`). Déposer une image → WebP + redimensionnée + blurDataUrl + dimensions en base ; fichier présent dans le volume (`/app/uploads`), **pas** dans l'image (AC1/AC2). Sans alt → avertissement a11y (AC3). Déposer un fichier trop lourd / un PDF → refus **serveur** avec message (AC4). Charger l'image via `/api/media/...` → en-têtes cache long (AC5). Path traversal (`/api/media/../secret`) → refusé. Build Docker (dev+prod) avec sharp/vips OK.

## Tasks / Subtasks

- [ ] **Tâche 0 — Prérequis & dépendance** (AC: 1)
  - [ ] 5.8/5.9 `done`. `bun add sharp` (PLAN §3.2). Ajouter `vips-dev` aux étages Docker exécutant sharp (build **et** production).
- [ ] **Tâche 1 — Modèle `Media` + relation cover + migration** (AC: 1 ; pièges n°1, 6)
  - [ ] `model Media` (path, width, height, blurDataUrl, alt, createdAt) + `Project.coverId/cover`. `migrate dev` + `generate`.
- [ ] **Tâche 2 — Upload + traitement sharp** (AC: 2, 4 ; pièges n°1, 4)
  - [ ] Drag&drop → Server Action/route : validation serveur (type/taille), WebP + resize + blurDataUrl + dimensions, écriture volume.
- [ ] **Tâche 3 — Stockage volume + service `/api/media`** (AC: 1, 5 ; pièges n°2, 3)
  - [ ] Volume `portfolio_uploads` (dev+prod), écriture par `nextjs` uid 1001 ; route `/api/media/[...path]` (anti-traversal, `Cache-Control: immutable`).
- [ ] **Tâche 4 — Alt requis** (AC: 3 ; piège n°5)
  - [ ] Champ alt au téléversement ; absence signalée (a11y).
- [ ] **Tâche 5 — Association cover + revalidation** (AC: 2 ; piège n°6)
  - [ ] Éditeur associe la cover ; `revalidateTag('projects')` ; rendu public (blurDataUrl placeholder).
- [ ] **Tâche 6 — Vérification locale** (AC: 1-5 ; piège n°7)
  - [ ] Upload complet, volume, refus serveur, alt, cache long, anti-traversal, build Docker sharp/vips.
- [ ] **Tâche 7 — Definition of Done** (AGENTS.md §8)
  - [ ] lint 0 / tsc 0 / build OK (+ docker build). Vérif visuelle. `git diff DEV` : migration Media/cover, upload+sharp, route media, volume compose, Dockerfile vips, sharp — rien d'autre.
  - [ ] `File List` + `Completion Notes` + `Change Log` · `sprint-status.yaml`.

## Dev Notes

### Périmètre — verrouillé

**Modèle `Media` + relation `Project.cover` + migration ; upload drag&drop → WebP/resize/blurDataUrl/dimensions (sharp) ; alt requis ; validation serveur taille/type ; stockage sur volume persistant ; service `/api/media/[...path]` avec cache long.**

**Hors périmètre — ne pas faire :**
- ❌ **Bibliothèque média (grille, remplacement, suppression avec garde)** → 5.13.
- ❌ **Avatars du parcours / CV** → 5.14 (avatar) / 5.17 (CV) réutiliseront cette infra.
- ❌ **Page projet publique `/projects/[slug]`** → Epic 6.
- ❌ **AuditLog** → 5.19.
- ❌ **S3 / stockage cloud** (PLAN : volume Docker, pas de surcoût).
- ❌ **Dépendance hors `sharp`**.

### Le vrai enjeu

Deux points durs : (1) **sharp natif + libvips dans Docker** — comme Prisma en 4.6, l'étage production (node standalone) doit disposer de sharp/vips au **runtime** (le traitement se fait à l'upload) ; (2) **stockage hors image** sur volume persistant, inscriptible par l'utilisateur non-root, servi avec cache long **et** protégé contre le path traversal. C'est l'infra image que réemploient 5.13 (biblio), 5.14 (avatars), 5.17 (CV).

### Testing standards

Vérification **manuelle en local** + visuelle + **build Docker**. Les 5 AC dont refus serveur (AC4), anti-traversal, cache long (AC5), et build sharp/vips. tsc/lint/build verts.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.12]
- [Source: PLAN_REFONTE_2026.md §2.1 — model Media ; §3.2 — upload cover, WebP sharp, blurDataUrl, aperçu ; §3.3 — volume `portfolio_uploads:/app/uploads`, route `/api/media/[...path]` `Cache-Control: immutable` ; §5 — `apk add vips-dev` pour sharp]
- [Source: apps/web/prisma/schema.prisma — Project « cover/coverId ajoutés en Epic 5 avec Media » (réservé en 4.1)]
- [Source: docker-compose.prod.yml — volume `portfolio_uploads` ; apps/web/Dockerfile — étages, user `nextjs` uid 1001 (Epic 2), production node sans Bun (4.6)]
- [Source: _bmad-output/implementation-artifacts/5-9-decrire-finement-un-projet.md — éditeur/aperçu où s'associe la cover]
- [Source: AGENTS.md §6 — images next/image + blurDataUrl, a11y (alt), sécurité ; §9 — zéro dépendance non prévue, pas de S3]
