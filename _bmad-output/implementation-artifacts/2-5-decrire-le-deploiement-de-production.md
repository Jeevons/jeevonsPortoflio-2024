---
baseline_commit: 43e1e458b22cdbaaab761e933ce4021bd15301ad
---

# Story 2.5: Décrire le déploiement de production

Status: review

## Story

As **Jeevons**,
I want **un fichier de composition dédié à la production**,
so that **Coolify sache exactement quoi construire et démarrer, sans ambiguïté avec l'environnement de développement**.

## 🛑 Décision requise avant implémentation

**Quelles variables lister dans `.env.production.example` ?** Le §5.3 du plan énumère `DATABASE_URL`, `AUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` et les cinq `MAIL_*` — mais **aucune n'est utilisée par le code aujourd'hui** : l'authentification est en Epic 5, le formulaire de contact en Epic 6.

- 👉 **Recommandé : lister l'ensemble des variables du §5.3.** L'AC exige que le fichier « liste **chaque variable attendue** » — attendue par la cible, pas par l'état courant. C'est une **checklist de déploiement** ; la compléter maintenant évite un oubli en Epic 5. Ajouter un commentaire par ligne indiquant l'epic qui l'active.
- **Variante minimaliste** : ne lister que `NEXT_PUBLIC_SITE_URL` et `DATABASE_URL` (les seules pertinentes aujourd'hui) et compléter au fil des epics. Plus honnête sur l'état réel, mais expose à un oubli plus tard.

⚠️ Dans les deux cas, **le service `web` du compose ne doit déclarer en `environment` que ce qui est réellement utilisé** — déclarer `AUTH_SECRET` alors que rien ne le lit ne casse rien, mais brouille la lecture. À trancher avec Jeevons en même temps.

## Acceptance Criteria

**AC1 — Un seul service, sur l'étage production**
**Given** `docker-compose.prod.yml` décrit la production
**When** j'inspecte ce fichier
**Then** il ne déclare **que le service `web`**, **sans service de base de données**
**And** ce service se construit sur l'étage **`production`** et se nomme **`portfolio_web`**
**And** il déclare **`restart: unless-stopped`**

**AC2 — Réseau Coolify**
**Given** la production est joignable via le proxy de Coolify
**When** j'inspecte la configuration réseau
**Then** le service rejoint le **réseau externe `coolify`**

**AC3 — Volume persistant pour les téléversements**
**Given** les fichiers téléversés doivent survivre à un redéploiement
**When** j'inspecte les volumes
**Then** un **volume nommé `portfolio_uploads`** est monté sur **`/app/uploads`**

**AC4 — Healthcheck conforme**
**Given** l'orchestrateur doit détecter une panne
**When** j'inspecte le healthcheck du service
**Then** il interroge **`/api/health` en interne**, **toutes les 15 secondes**, avec **5 tentatives** et une **période de grâce de 30 secondes** au démarrage

**AC5 — Aucun secret versionné**
**Given** aucun secret ne doit être versionné
**When** j'inspecte le dépôt
**Then** toutes les valeurs sensibles sont **référencées par variable**, jamais écrites en clair
**And** un fichier **`.env.production.example`** liste **chaque variable attendue**, **sans aucune valeur réelle**

## Contexte d'implémentation

### 🛑 Prérequis

- Story **2.2** `done` : l'étage `production` du Dockerfile existe.
- Story **2.1** `done` : `/api/health` répond — **sans quoi le healthcheck de l'AC4 échoue en boucle** et Coolify redémarre le conteneur indéfiniment.
- Story **2.4** recommandée : fournit le format de `DATABASE_URL`.

### État actuel

- `docker-compose.yml` (dev) existe depuis la story 2.3 — **ne pas le modifier**.
- `.gitignore` contient déjà `.env.production` **et** `!.env.production.example` : l'exception est **déjà en place**, rien à ajouter. ✅
- Aucune variable d'environnement n'est réellement lue par le code aujourd'hui, hors `NEXT_PUBLIC_SITE_URL` (story 1.10, avec valeur de repli).

### `docker-compose.prod.yml` — reprendre §5.3 du plan, adapté

Le plan §5.3 fournit le fichier quasi complet. **Deux adaptations nécessaires à l'état actuel du dépôt :**

1. **`context: ./apps/web` → `context: .`** — le monorepo n'existe pas (story 3.1 non faite). Le Dockerfile est à la racine (décision de la story 2.2).
2. Les variables d'environnement des epics futurs : selon la décision de la tâche 0.

```yaml
services:
  web:
    container_name: portfolio_web          # AC1
    build:
      context: .                           # ⚠️ pas ./apps/web — monorepo en 3.1
      target: production                   # AC1
      args:
        NEXT_PUBLIC_SITE_URL: ${NEXT_PUBLIC_SITE_URL}   # build-time, cf. story 2.2
    restart: unless-stopped                # AC1
    environment:
      NODE_ENV: production
      DATABASE_URL: ${DATABASE_URL}
      # … autres variables selon décision de la tâche 0
    volumes:
      - portfolio_uploads:/app/uploads     # AC3
    networks: [coolify]                    # AC2
    healthcheck:                           # AC4
      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:3000/api/health || exit 1"]
      interval: 15s
      timeout: 5s
      retries: 5
      start_period: 30s

volumes:
  portfolio_uploads:                       # AC3

networks:
  coolify:
    external: true                         # AC2
```

⚠️ **Pas d'attribut `version:`** (obsolète en Compose v2).

### ⚠️ Piège n°1 — `NEXT_PUBLIC_SITE_URL` est en `args`, PAS en `environment` (AC5)

C'est **la** subtilité du fichier. Next **inline** les `NEXT_PUBLIC_*` dans le bundle **au moment du `next build`**. La placer en `environment` n'aurait **aucun effet** : le bundle serait déjà figé avec la valeur de repli.

👉 `build.args` — et **conséquence directe** : changer le domaine impose un **rebuild**, pas un restart (PLAN §8.6, « piège n°1 du runbook Doshwork »).

### ⚠️ Piège n°2 — `networks: coolify` avec `external: true` (AC2)

`external: true` signifie « ce réseau existe déjà, ne le crée pas ». Il est créé par **Coolify sur le VPS**. Conséquence : **`docker compose -f docker-compose.prod.yml up` échouera sur la machine de Jeevons** avec `network coolify declared as external, but could not be found`.

👉 **C'est normal, pas un bug.** La validation locale se fait par `docker compose config` (voir tâche 4), pas par un `up`.

### ⚠️ Piège n°3 — `wget` et non `curl` dans le healthcheck (AC4)

L'image `node:22-alpine` embarque **`wget`** (BusyBox) mais **pas `curl`**. Un healthcheck écrit avec `curl` échouerait systématiquement avec `command not found` → conteneur marqué `unhealthy` → redémarrage en boucle, alors que l'application va parfaitement bien.

### ⚠️ Piège n°4 — le volume `/app/uploads` (AC3)

Le dossier `uploads/` **n'existe pas encore** dans le dépôt (l'upload d'images arrive en Epic 5, FR8). Docker créera le point de montage automatiquement au démarrage. ❌ **Ne pas créer de dossier `uploads/` dans le dépôt** pour « préparer » : il serait vide, sans usage, et le volume nommé le masquerait de toute façon.

### `.env.production.example` (AC5)

```dotenv
# Fichier d'exemple — AUCUNE valeur réelle. Les vraies valeurs vivent
# uniquement dans les Secrets Coolify.

# --- Application (build-time : tout changement impose un rebuild) ---
NEXT_PUBLIC_SITE_URL=

# --- Base de données (Epic 4) — format : postgresql://user:pass@host:5432/db?schema=public
DATABASE_URL=

# --- Authentification admin (Epic 5) ---
AUTH_SECRET=
ADMIN_EMAIL=
ADMIN_PASSWORD=

# --- SMTP Infomaniak (Epic 6) ---
MAIL_HOST=
MAIL_PORT=
MAIL_USER=
MAIL_PASSWORD=
MAIL_FROM=
```

🛑 **Chaque valeur reste vide.** Pas de valeur « d'exemple » plausible (`admin@example.com`, `changeme`) : le risque est qu'elle soit reprise telle quelle en production. L'AC dit « sans aucune valeur réelle » — le plus sûr est de n'en mettre aucune du tout.

## Tasks / Subtasks

- [x] **Tâche 0 — Obtenir la décision de Jeevons** — 🛑 **BLOQUANT**
  - [x] Périmètre de `.env.production.example` : toutes les variables du §5.3 (recommandé) ou minimaliste. → **toutes les variables du §5.3**
  - [x] Variables à déclarer en `environment` du service `web`. → **seulement l'utilisé** (`NODE_ENV`, `DATABASE_URL`)
- [x] **Tâche 1 — Vérifier les prérequis**
  - [x] `Dockerfile` avec étage `production` (story 2.2) · `src/app/api/health/route.ts` (story 2.1).
- [x] **Tâche 2 — Écrire `docker-compose.prod.yml`** (AC: 1, 2, 3, 4)
  - [x] **Un seul service `web`**, `container_name: portfolio_web`, `restart: unless-stopped` (AC1).
  - [x] ❌ **Aucun service `db`** (AC1) — Postgres est mutualisé (story 2.4).
  - [x] `build.context: .` et `build.target: production` (AC1, piège du monorepo).
  - [x] `NEXT_PUBLIC_SITE_URL` en **`build.args`**, pas en `environment` (piège n°1).
  - [x] `networks: [coolify]` + bloc `networks.coolify.external: true` (AC2).
  - [x] Volume nommé `portfolio_uploads:/app/uploads` + déclaration dans le bloc `volumes` (AC3).
  - [x] Healthcheck avec **`wget`** (piège n°3), `interval: 15s`, `retries: 5`, `start_period: 30s`, `timeout: 5s` (AC4).
  - [x] Toutes les valeurs sensibles en **`${VARIABLE}`**, jamais en clair (AC5).
  - [x] ❌ Pas d'attribut `version:`.
- [x] **Tâche 3 — Écrire `.env.production.example`** (AC: 5)
  - [x] Lister les variables retenues, **toutes avec une valeur vide**.
  - [x] Commenter chaque groupe avec l'epic qui l'active.
  - [x] 🛑 Relire ligne à ligne : **aucune valeur réelle, aucun mot de passe, aucune URL de base complète**.
- [x] **Tâche 4 — Valider la syntaxe** (AC: 1, 2, 3, 4)
  - [x] `docker compose -f docker-compose.prod.yml config` → le fichier est **résolu sans erreur de syntaxe**.
  - [x] ⚠️ Des avertissements « variable is not set » sont **attendus** (les variables ne sont définies que dans Coolify) — ce n'est pas un échec.
  - [x] Relire la sortie : `container_name: portfolio_web`, `target: production`, healthcheck complet, volume et réseau présents.
  - [x] ⚠️ **Ne pas tenter `docker compose -f docker-compose.prod.yml up`** en local : le réseau `coolify` n'existe pas ici (piège n°2). L'échec serait attendu et sans information.
- [x] **Tâche 5 — Vérifier l'étanchéité dev/prod** (AC: 1)
  - [x] `docker-compose.yml` (dev) **non modifié** : `git diff` doit le confirmer.
  - [x] Le compose de dev garde son service `db`, celui de prod n'en a pas — **différence voulue**, à noter en Completion Notes.
- [x] **Tâche 6 — Vérifier l'absence de secret** (AC: 5) — 🛑 **critique**
  - [x] `git status` → aucun `.env` réel en attente de commit.
  - [x] `grep -rniE "(password|secret|api[_-]?key)\s*[:=]\s*\S" docker-compose.prod.yml .env.production.example` → **aucune valeur** après le signe, uniquement des `${...}` ou du vide.
  - [x] Confirmer que `.gitignore` ignore bien `.env.production` tout en autorisant `.env.production.example` (déjà en place — **le vérifier, ne pas le réécrire**).
- [x] **Tâche 7 — Definition of Done technique** (AGENTS.md §8)
  - [x] `npm run lint` · `npx tsc --noEmit` · `npm run build` → verts (aucun code touché, contrôle de non-régression).
  - [x] `git diff develop` relu : **deux fichiers créés**, rien d'autre.
  - [x] `File List` + `Completion Notes` + `Change Log` remplis · `sprint-status.yaml` mis à jour.

## Dev Notes

### Périmètre — verrouillé

**Deux fichiers créés** : `docker-compose.prod.yml`, `.env.production.example`. **Aucun fichier modifié.**

**Hors périmètre — ne pas faire :**
- ❌ **Ne pas déployer sur Coolify**, ne pas créer l'application, ne pas poser de domaine → story **2.6**. AGENTS.md §2 : jamais de FQDN avant vérification DNS.
- ❌ **Ne pas modifier `docker-compose.yml`** (dev, story 2.3) ni le `Dockerfile` (story 2.2).
- ❌ **Ne pas créer de `.env.production` réel** — ni en local, ni committé (AGENTS.md §2).
- ❌ **Ne pas créer de dossier `uploads/`** dans le dépôt (piège n°4).
- ❌ **Ne pas ajouter `prisma migrate deploy` au démarrage** → **Epic 4** (story 4.6). L'ajouter maintenant ferait échouer le démarrage : Prisma n'est pas installé.
- ❌ **Ne pas ajouter de service Umami** au compose → **Epic 7**, ressource Coolify **séparée** (décision arrêtée n°5).
- ❌ **Ne pas ajouter de `deploy.yml` GitHub Actions** : déploiement par **webhook Coolify natif**, aucun secret SSH côté GitHub (PLAN §5.5, décision D8 Doshwork).
- ❌ **Ne pas toucher au code applicatif** (`src/`).

### Pourquoi la production n'a pas de service `db` (AC1)

Décision arrêtée n°2 : **Postgres mutualisé** sur le service Coolify existant, base `portfolio_prod` créée en story 2.4. Ajouter un conteneur Postgres ici violerait le garde-fou « coût VPS additionnel nul » (AGENTS.md §1) et dupliquerait une instance déjà en place.

### Fenêtre de détection de panne (AC4, NFR18)

`interval: 15s` × `retries: 5` → une panne est détectée en **~75 s** au pire. `start_period: 30s` laisse au conteneur le temps de démarrer sans être compté en échec. C'est ce healthcheck qui rend le redémarrage automatique de Coolify possible — l'objectif énoncé dès la story 2.1.

### Testing standards

Aucun test automatisé. La validation se fait par **`docker compose config`** (résolution et syntaxe), **relecture ligne à ligne** du fichier contre chaque AC, et **grep anti-secret** pour l'AC5. Le fichier ne sera réellement éprouvé qu'au premier déploiement, en story 2.6.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.5]
- [Source: _bmad-output/planning-artifacts/epics.md — NFR16 : aucun secret réel versionné, `.env.production.example` sert de checklist sans valeur]
- [Source: _bmad-output/planning-artifacts/epics.md — NFR18 : `start_period: 30s`, `interval: 15s`, `retries: 5`]
- [Source: PLAN_REFONTE_2026.md §5.3 — fichier `docker-compose.prod.yml` de référence]
- [Source: PLAN_REFONTE_2026.md §5.4 — Secrets Coolify, `.env.production.example` comme checklist versionnée]
- [Source: PLAN_REFONTE_2026.md §5.5 — pas de `deploy.yml`, webhook Coolify natif]
- [Source: PLAN_REFONTE_2026.md §8.6 — `NEXT_PUBLIC_SITE_URL` inlinée au build, rebuild obligatoire]
- [Source: AGENTS.md §2 — ne jamais committer un secret]
- [Source: .gitignore — `.env.production` ignoré, `!.env.production.example` déjà autorisé]
- [Source: Dockerfile étage `production` — story 2.2] · [Source: src/app/api/health/route.ts — story 2.1]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

- `docker compose -f docker-compose.prod.yml config` → **résolu sans erreur de syntaxe**. Sortie vérifiée : `container_name: portfolio_web`, `target: production`, `restart: unless-stopped`, un seul service `web`, `networks.coolify.external: true`, volume `portfolio_uploads → /app/uploads`, healthcheck `wget` / `interval 15s` / `timeout 5s` / `retries 5` / `start_period 30s`
- Avertissements `"NEXT_PUBLIC_SITE_URL" variable is not set` et `"DATABASE_URL" variable is not set` → **attendus**, ces valeurs ne vivent que dans les Secrets Coolify
- `git diff --quiet docker-compose.yml` → **inchangé** (compose de dev intact)
- `grep -rniE "(password|secret|api[_-]?key|token)[:=]\S"` sur les deux fichiers → **aucune valeur** après un champ sensible
- Toutes les lignes de `.env.production.example` se terminent par `=` → **aucune valeur renseignée**
- `git check-ignore -q .env.production.example` → code **1** (non ignoré) · `git add --dry-run` → `add '.env.production.example'` ✅
- `git add --dry-run .env.production` (fichier témoin) → **`The following paths are ignored by one of your .gitignore files`** ✅ puis témoin supprimé
- `ls uploads` → **absent** (piège n°4 respecté)
- `npx tsc --noEmit` → 0 erreur · `npm run build` → `✓ Compiled successfully` · `npm run lint` → seul warning `Testimonials.tsx:83`, pré-existant

### Completion Notes List

- **Tâche 0 — décisions prises par Jeevons** : `.env.production.example` **exhaustif** (toutes les variables du §5.3, annotées de l'epic qui les active) car l'AC5 vise « chaque variable attendue » par la cible et non par l'état courant ; en revanche le bloc `environment` du compose reste **minimal** (`NODE_ENV`, `DATABASE_URL`) pour ne pas déclarer des variables que rien ne lit encore. Les deux fichiers ont donc volontairement des périmètres différents.
- **Piège n°1 respecté** : `NEXT_PUBLIC_SITE_URL` est en **`build.args`**, jamais en `environment`. Next l'inline dans le bundle au `next build` — la placer en `environment` n'aurait aucun effet. **Conséquence à retenir : changer de domaine impose un rebuild, pas un restart.**
- **Piège n°2 assumé** : `networks.coolify.external: true` fait que `docker compose -f docker-compose.prod.yml up` **échouera en local** (`network coolify ... could not be found`). C'est normal, ce réseau appartient à Coolify. La validation a donc été faite par `config`, comme la story l'exige — **aucun `up` n'a été tenté**.
- **Piège n°3 respecté** : healthcheck en **`wget`** et non `curl`. `node:22-alpine` embarque BusyBox sans `curl` ; un healthcheck en `curl` aurait échoué en `command not found`, marqué le conteneur `unhealthy` et provoqué un redémarrage en boucle sur une application parfaitement saine. `wget` a d'ailleurs été **testé réellement en story 2.2** (`docker exec ... wget -qO- http://127.0.0.1:3000/api/health` → réponse correcte).
- **Piège n°4 respecté** : **aucun dossier `uploads/` créé** dans le dépôt. Docker créera le point de montage au démarrage, et le volume nommé le masquerait de toute façon.
- **AC5 vérifiée dans les deux sens**, pas seulement par relecture : `.env.production.example` est bien **versionnable** (`git add --dry-run` l'accepte, la règle de ré-inclusion `!.env.production.example` fonctionne) et un vrai `.env.production` est bien **refusé par git**. Le `.gitignore` était déjà correct — il a été **vérifié, pas réécrit**.
- **Étanchéité dev/prod** : `docker-compose.yml` (dev) n'a pas été touché. Le compose de dev garde son service `db`, celui de prod n'en a **pas** — ce n'est pas une incohérence mais la décision arrêtée n°2 : Postgres est **mutualisé** sur le service Coolify existant (base `portfolio_prod`, story 2.4), ce qui maintient le garde-fou « coût VPS additionnel nul ».
- **Fenêtre de détection de panne (NFR18)** : `interval 15s` × `retries 5` → panne détectée en **~75 s** au pire, avec `start_period 30s` de grâce au démarrage. C'est ce healthcheck qui rend possible le redémarrage automatique par Coolify, objectif annoncé dès la story 2.1.
- ⚠️ **Le fichier ne sera réellement éprouvé qu'au premier déploiement (story 2.6)** : `docker compose config` valide la syntaxe et la résolution, pas le comportement en conditions réelles.
- Périmètre respecté : **deux fichiers créés, aucun modifié**. Pas de déploiement Coolify, pas de FQDN, pas de `.env.production` réel, pas de `prisma migrate deploy`, pas de service Umami, pas de `deploy.yml` GitHub Actions, aucune touche à `src/`.

### File List

- `docker-compose.prod.yml` (créé)
- `.env.production.example` (créé)

### Change Log

| Date | Description |
|------|-------------|
| 2026-07-21 | Story 2.5 — Ajout de `docker-compose.prod.yml` : service `web` unique (`portfolio_web`) sur l'étage `production`, sans base de données, rattaché au réseau externe `coolify`, avec volume persistant `portfolio_uploads:/app/uploads` et healthcheck `wget` sur `/api/health` (15s / 5 tentatives / 30s de grâce). Ajout de `.env.production.example` comme checklist de déploiement, toutes valeurs vides. |
