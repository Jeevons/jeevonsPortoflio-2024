---
baseline_commit: 5c22f3a6c48914801d0a226ab5a0b15c005d8765
---

# Story 5.12: Illustrer mes projets

Status: review

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

- [x] **Tâche 0 — Prérequis & dépendance** (AC: 1)
  - [x] 5.8/5.9 `done`. `bun add sharp` (PLAN §3.2). Ajouter `vips` aux étages Docker exécutant sharp (development **et** production runtime).
- [x] **Tâche 1 — Modèle `Media` + relation cover + migration** (AC: 1 ; pièges n°1, 6)
  - [x] `model Media` (path, width, height, blurDataUrl, alt, createdAt) + `Project.coverId/cover`. `migrate dev` + `generate`.
- [x] **Tâche 2 — Upload + traitement sharp** (AC: 2, 4 ; pièges n°1, 4)
  - [x] Drag&drop → route d'upload : validation serveur (type réel/taille), WebP + resize + blurDataUrl + dimensions, écriture volume.
- [x] **Tâche 3 — Stockage volume + service `/api/media`** (AC: 1, 5 ; pièges n°2, 3)
  - [x] Volume `portfolio_uploads` (dev+prod), écriture par `nextjs` uid 1001 ; route `/api/media/[...path]` (anti-traversal, `Cache-Control: immutable`).
- [x] **Tâche 4 — Alt requis** (AC: 3 ; piège n°5)
  - [x] Champ alt au téléversement ; absence signalée (a11y).
- [x] **Tâche 5 — Association cover + revalidation** (AC: 2 ; piège n°6)
  - [x] Éditeur associe la cover ; `revalidateTag('projects')` ; rendu public (blurDataUrl placeholder).
- [x] **Tâche 6 — Vérification locale** (AC: 1-5 ; piège n°7)
  - [x] Volume, refus serveur, alt, cache long, anti-traversal, build Docker sharp/vips (dev + prod).
- [x] **Tâche 7 — Definition of Done** (AGENTS.md §8)
  - [x] lint 0 erreur / tsc 0 / build OK (+ docker build dev & prod). `git diff DEV` : migration Media/cover, upload+sharp, route media, volume compose, Dockerfile vips, sharp — rien d'autre.
  - [x] `File List` + `Completion Notes` + `Change Log` · `sprint-status.yaml`.
  - [ ] ⏳ Vérification VISUELLE par Jeevons (téléversement réel depuis le navigateur : session 2FA requise, non simulable en CLI).

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

## Dev Agent Record

### File List

**Créés**
- `apps/web/src/lib/media/storage.ts` — volume : `uploadsRoot`, `newMediaPath`, `resolveMediaPath` (anti-traversée), `writeMediaFile`, `deleteMediaFile` (idempotent, préparé pour 5.13)
- `apps/web/src/lib/media/process.ts` — validation serveur (taille, type réel) + normalisation WebP/resize/EXIF + `blurDataUrl` + dimensions
- `apps/web/src/lib/media/index.ts` — accès données : `createMedia`, `listMedia`, `getMedia`, `updateMediaAlt`, `mediaUrl`, `toCardCover`
- `apps/web/src/app/api/media/[...path]/route.ts` — service PUBLIC des fichiers (anti-traversée, `immutable`, `nosniff`)
- `apps/web/src/app/api/admin/media/route.ts` — `GET` (liste) + `POST` (upload), gardés par `requireAdminApi`
- `apps/web/src/app/(admin)/admin/projects/cover-selector.tsx` — téléversement (bouton + glisser-déposer), champ alt, grille de sélection
- `apps/web/prisma/migrations/20260725175505_add_media_and_project_cover/migration.sql`

**Modifiés**
- `apps/web/prisma/schema.prisma` — `model Media` + `Project.coverId/cover` (`onDelete: SetNull`)
- `apps/web/Dockerfile` — `vips` aux étages `development` et `production` ; `/app/uploads` créé et `chown nextjs:nodejs` AVANT `USER nextjs`
- `docker-compose.yml` — volume nommé `portfolio_uploads_dev:/app/uploads`
- `apps/web/package.json`, `bun.lock` — `sharp@0.34.5`
- `apps/web/src/lib/schemas/project.ts` — champ `coverId` + mapping `FormData`
- `apps/web/src/app/(admin)/admin/projects/actions.ts` — `isMissingCover` (P2003) + message dédié, sur création ET modification
- `apps/web/src/app/(admin)/admin/projects/project-form.tsx` — état `coverId` + `CoverSelector`
- `apps/web/src/lib/admin/projects.ts` — `coverId` dans `AdminProject` et le `select`
- `apps/web/src/lib/projects.ts` — `include: { cover: true }` sur les lectures publique ET aperçu
- `apps/web/src/content/fallbacks.ts` — `coverId`/`cover` à `null` (repli 4.5)
- `apps/web/src/components/ProjectCard.tsx` — champ `cover`, rendu prioritaire sur l'import statique
- `apps/web/src/sections/Projects.tsx`, `SelfProject.tsx` — `cover: toCardCover(project.cover)`

### Completion Notes

**Piège n°1 (central) — sharp/vips au runtime de production : VÉRIFIÉ.**
`vips-dev` n'existait qu'à l'étage `builder`, où il ne sert qu'à l'installation. Le traitement se faisant au **runtime** de l'upload, `vips` a été ajouté aux étages `development` et `production` (`vips` suffit — `vips-dev` n'apporte que les en-têtes). Vérifié dans l'image de production réelle :
```
uid=1001(nextjs) gid=1001(nodejs)
/usr/lib/libvips.so.42
drwxr-xr-x nextjs nodejs /app/uploads
SHARP PROD OK: webp 1600x960 | octets: 2816 | blur b64: 80 | fichier ecrit: 2816
```
**Next trace `sharp` automatiquement dans le standalone** — contrairement à `argon2` (5.1), aucune copie explicite n'est nécessaire.

**Piège n°2 — volume et non-root.** `/app/uploads` est créé et attribué à `nextjs` AVANT `USER nextjs` : sans ce `chown`, Docker donne au volume vide la propriété root et tout téléversement échouerait sur EACCES. Le volume prod existait déjà ; un volume **nommé** `portfolio_uploads_dev` a été ajouté en dev, monté par-dessus le bind `./apps/web:/app` pour que les images ne se retrouvent pas versionnées dans le dépôt. Effet secondaire constaté et voulu : `/app` n'est PAS inscriptible par `nextjs`, seul `/app/uploads` l'est.

**Piège n°3 — anti-traversée.** `resolveMediaPath` est le SEUL endroit où un chemin devient absolu. Les 6 cas testés dans le conteneur : chemin légitime accepté ; `../../etc/passwd`, `../../../etc/shadow`, `/etc/passwd`, `a/../../../etc/passwd`, octet nul → tous refusés. La route répond **404 et non 403** : un 403 confirmerait l'existence de la cible. AC5 vérifié sur un fichier réel servi par le conteneur :
```
cache-control: public, max-age=31536000, immutable
content-type: image/webp · x-content-type-options: nosniff · 812 octets intacts
```

**Piège n°4 — validation serveur.** Le contrôle qui fait foi porte sur les octets reçus, jamais sur l'extension ni le MIME déclaré. Vérifié en conteneur : un faux PNG (`%PDF-…` renommé) est refusé au décodage (`unsupported image format`) ; le **SVG est exclu volontairement** de la liste blanche — c'est un document actif (scripts), servi depuis notre domaine il ouvrirait une voie au XSS stocké. Le `file.size` de la route n'est qu'un garde-fou mémoire, explicitement documenté comme non-sécuritaire.

**Piège n°6 — relation et erreurs.** `onDelete: SetNull` et non `Cascade` : supprimer une image ne doit jamais supprimer les projets. Une couverture disparue produit un **P2003** (clé étrangère) et non P2025 : sans traitement dédié, l'utilisateur aurait vu « une technologie sélectionnée n'existe plus », message faux. `isMissingCover` + message propre ont été branchés sur les deux chemins d'écriture.

**Décision — `<img>` plutôt que `next/image` (validée par Jeevons).** Le fichier est déjà normalisé en WebP et redimensionné par sharp au téléversement ; le repasser dans l'optimiseur de Next le retraiterait sans gain. `width`/`height` explicites + `blurDataUrl` en fond suffisent à réserver la place, donc à tenir l'exigence anti-CLS (AC2).

**Décision — upload par route dédiée, pas via le formulaire projet (validée par Jeevons).** Le formulaire (534 lignes, 5.9) reste un formulaire de TEXTE piloté par `useActionState` ; l'envoi de fichier a ses propres besoins (progression, erreurs de transfert). Le `CoverSelector` appelle `/api/admin/media` et ne modifie pas le contrat du formulaire.

**⚠️ Changement de version signalé — sharp 0.35.3 → 0.34.5.** Next 16 déclare `sharp` en `optionalDependencies` avec la plage `^0.34.5`. Une 0.35.x ne la satisfait pas : bun installait alors **deux copies**, chacune avec sa libvips native, et le build avertissait explicitement (« Class GNotificationCenterDelegate is implemented in both … libvips-cpp.8.17 and … 8.18 … mysterious crashes »). Rester dans la plage de Next déduplique et fait disparaître l'avertissement. Documenté en tête de `process.ts` : toute montée de sharp doit d'abord vérifier la plage déclarée par Next.

**⚠️ Anomalie PRÉEXISTANTE constatée, hors périmètre.** `docker build --target production` échoue sans `--build-arg NEXT_PUBLIC_SITE_URL` : le Dockerfile pose `ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL`, donc la variable vaut `""`, et `"" ?? "https://…"` vaut `""` — le repli de `layout.tsx`/`robots.ts`/`sitemap.ts` ne se déclenche jamais, d'où `Invalid URL` sur `/_not-found`. **Sans lien avec cette story** (`docker-compose.prod.yml` passe bien l'argument, le déploiement réel n'est pas affecté) ; signalé pour une story dédiée. Non corrigé ici : hors périmètre (AGENTS.md §9.2).

**Avertissement lint préexistant** : `TestimonialsClient.tsx:78` (`react-hooks/exhaustive-deps`) existe à l'identique sur `DEV`. Laissé intact.

**Reste à vérifier par Jeevons (non simulable en CLI)** : le téléversement réel depuis le navigateur exige une session 2FA complète. Toute la chaîne serveur (traitement sharp, écriture volume, service, refus) a été vérifiée directement dans les conteneurs dev et prod ; c'est le parcours visuel dans l'interface qui reste à confirmer.

### Change Log

- Modèle `Media` + relation `Project.cover/coverId` (migration additive `20260725175505`)
- Infrastructure image : `sharp` + `vips` aux étages Docker exécutant le traitement, volume `/app/uploads` inscriptible par `nextjs` (dev + prod)
- Téléversement admin (`/api/admin/media`) avec validation serveur taille/type réel, normalisation WebP, `blurDataUrl`, dimensions
- Service public `/api/media/[...path]` : anti-traversée, `Cache-Control: immutable`, `nosniff`
- Association d'une couverture depuis l'éditeur de projet, rendu public avec placeholder flouté
- `sharp` aligné sur la plage de Next (0.34.5) pour éviter une double libvips
