---
baseline_commit: 43e1e458b22cdbaaab761e933ce4021bd15301ad
---

# Story 2.3: Développer en local dans les mêmes conditions qu'en production

Status: review

## Story

As **Jeevons**,
I want **lancer le site et sa base d'une seule commande sur ma machine**,
so that **je travaille dans un environnement proche de la production sans installer Postgres localement**.

## Acceptance Criteria

**AC1 — La stack de développement démarre en une commande**
**Given** `docker-compose.yml` décrit l'environnement de développement
**When** je lance la stack
**Then** un service **`db`** en **`postgres:16-alpine`** démarre, avec son port publié **uniquement sur `127.0.0.1:5432`**
**And** ce service déclare un **healthcheck fondé sur `pg_isready`**
**And** un service **`web`** démarre sur l'étage **`development`** et n'accepte les connexions **qu'une fois la base saine**

**AC2 — Rechargement à chaud fonctionnel**
**Given** je modifie un fichier source
**When** je regarde le navigateur
**Then** le **rechargement à chaud fonctionne**, grâce au montage du code source
**And** les volumes **`node_modules`** et **`.next`** du conteneur sont **préservés du montage**, afin de ne pas être écrasés par l'hôte

**AC3 — Le README documente la commande unique**
**Given** je découvre le projet
**When** je suis les instructions du README
**Then** **une seule commande** suffit à obtenir un site fonctionnel en local

## Contexte d'implémentation

### 🛑 Prérequis : la story 2.2 doit être `done`

Ce compose consomme l'étage **`development`** du Dockerfile créé en 2.2. Vérifier d'abord que `Dockerfile` existe et contient bien cet étage.

### État actuel

- Aucun `docker-compose.yml`.
- **Aucune base de données dans le projet** : Prisma et Postgres arrivent à l'**Epic 4**. Le service `db` est donc posé **par anticipation** — il démarrera sans qu'aucun code applicatif ne s'y connecte. C'est **normal et voulu** par l'AC1.
- `README.md` est aujourd'hui un texte de présentation personnelle (« A Vision for the Future », centres d'intérêt) — il **ne contient aucune instruction d'installation**. L'AC3 impose d'en ajouter.

### ⚠️ Piège n°1 — le montage des volumes (AC2), l'erreur classique

Monter `.:/app` écrase `/app/node_modules` **du conteneur** par celui de l'hôte. Or celui de l'hôte est compilé pour **macOS/arm64**, pas pour **Alpine/Linux** : le conteneur crashe au démarrage avec des erreurs de binaires natifs illisibles.

La parade est le **volume anonyme**, qui « masque » le chemin et préserve le contenu de l'image :
```yaml
volumes:
  - .:/app                # code source → hot reload
  - /app/node_modules     # ⚠️ volume anonyme : préserve celui du conteneur
  - /app/.next            # ⚠️ idem : évite les conflits de cache de build
```
L'ordre est important : les volumes anonymes doivent venir **après** le montage du code.

### ⚠️ Piège n°2 — `depends_on` seul ne suffit pas (AC1)

`depends_on: [db]` attend que le conteneur **démarre**, pas que Postgres soit **prêt à accepter des connexions**. L'AC1 exige explicitement « qu'une fois la base saine » → il faut la forme longue avec condition :
```yaml
depends_on:
  db:
    condition: service_healthy
```

### ⚠️ Piège n°3 — le binding `127.0.0.1:5432` (AC1)

`ports: ["5432:5432"]` expose Postgres sur **toutes les interfaces réseau** de la machine. Sur un réseau Wi-Fi public, la base devient joignable depuis l'extérieur. L'AC exige la forme restreinte :
```yaml
ports: ["127.0.0.1:5432:5432"]
```

### ⚠️ Piège n°4 — le hot reload en conteneur

Le rafraîchissement de Next repose sur les événements du système de fichiers, qui **traversent mal** la couche de virtualisation de Docker Desktop sur macOS. Si le hot reload ne se déclenche pas, ajouter dans le service `web` :
```yaml
environment:
  WATCHPACK_POLLING: "true"
```
💡 **N'ajouter cette variable que si le problème se manifeste** — le polling consomme du CPU en continu.

### Squelette de `docker-compose.yml`

```yaml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: portfolio
      POSTGRES_PASSWORD: portfolio      # dev local uniquement
      POSTGRES_DB: portfolio_dev
    ports: ["127.0.0.1:5432:5432"]      # AC1 — jamais 0.0.0.0
    volumes: [portfolio_db_data:/var/lib/postgresql/data]
    healthcheck:                         # AC1
      test: ["CMD-SHELL", "pg_isready -U portfolio -d portfolio_dev"]
      interval: 10s
      timeout: 5s
      retries: 5

  web:
    build:
      context: .
      target: development                # AC1 — étage du Dockerfile (story 2.2)
    ports: ["3000:3000"]
    volumes:
      - .:/app
      - /app/node_modules                # AC2
      - /app/.next                       # AC2
    depends_on:
      db:
        condition: service_healthy       # AC1
    environment:
      DATABASE_URL: postgresql://portfolio:portfolio@db:5432/portfolio_dev?schema=public

volumes:
  portfolio_db_data:
```

💡 **Sur les mots de passe** : ceux-ci sont des identifiants de **développement local**, sans valeur, jamais utilisés en production. Les écrire en clair ici est acceptable et conforme à l'usage. AGENTS.md §2 interdit de committer des **secrets réels** — ce n'en sont pas. En cas de doute, valider avec Jeevons.

💡 **`?schema=public`** est requis par Prisma 7 (PLAN §5.4) — le poser dès maintenant évite une reprise en Epic 4.

⚠️ **Ne pas déclarer `version:`** en tête de fichier : l'attribut est **obsolète** depuis Docker Compose v2 et produit un avertissement à chaque lancement.

### README (AC3)

Ajouter une section **« Démarrage »** en tête, **sans supprimer** le contenu existant :

````markdown
## 🚀 Démarrage

Prérequis : Docker Desktop.

```bash
docker compose up
```

Le site est disponible sur http://localhost:3000 et la base Postgres sur `127.0.0.1:5432`.
````

⚠️ **`docker compose` (avec un espace)**, pas `docker-compose` : la v1 avec tiret est obsolète.

## Tasks / Subtasks

- [x] **Tâche 1 — Vérifier le prérequis**
  - [x] `Dockerfile` existe et contient un étage `development` (story 2.2 `done`).
- [x] **Tâche 2 — Écrire `docker-compose.yml`** (AC: 1, 2)
  - [x] Service `db` : `postgres:16-alpine`, port **`127.0.0.1:5432:5432`** (piège n°3), volume nommé pour la persistance des données.
  - [x] Service `db` : healthcheck **`pg_isready`** avec `interval`, `timeout`, `retries` (AC1).
  - [x] Service `web` : `build.target: development` (AC1), port 3000.
  - [x] Service `web` : montage `.:/app` + **volumes anonymes** `/app/node_modules` et `/app/.next` (AC2, piège n°1).
  - [x] Service `web` : `depends_on.db.condition: service_healthy` (AC1, piège n°2).
  - [x] ❌ Ne pas déclarer `version:`.
- [x] **Tâche 3 — Vérifier le démarrage** (AC: 1)
  - [x] `docker compose up` → les deux services démarrent, **aucun avertissement** dans la sortie.
  - [x] `docker compose ps` → `db` en état **`healthy`**, `web` en `running`.
  - [x] Vérifier dans les logs que `web` **a attendu** que `db` soit sain avant de démarrer (AC1).
  - [x] `docker compose exec db pg_isready -U portfolio` → `accepting connections`.
  - [x] `nc -zv 127.0.0.1 5432` → ouvert. Puis vérifier avec l'IP LAN de la machine (`ipconfig getifaddr en0`) que le port **n'est PAS** joignable de l'extérieur (AC1, piège n°3).
- [x] **Tâche 4 — Vérifier le hot reload** (AC: 2) — 🛑 **cœur de la story**
  - [x] Ouvrir `localhost:3000` : le site s'affiche **avec ses styles et images**.
  - [x] Modifier un texte visible dans `src/sections/Hero.tsx`, sauvegarder → **le navigateur se met à jour sans rechargement manuel**.
  - [x] ⚠️ Si rien ne bouge : ajouter `WATCHPACK_POLLING: "true"` (piège n°4) et **le documenter en Completion Notes**. → **non nécessaire**, voir Completion Notes
  - [x] **Annuler la modification de test** — elle ne doit pas se retrouver dans le diff.
  - [x] `docker compose exec web ls node_modules | head` → non vide (les volumes anonymes ont fonctionné, AC2).
  - [x] `docker compose down && docker compose up` → redémarrage propre, données de la base conservées.
- [x] **Tâche 5 — Documenter le README** (AC: 3)
  - [x] Ajouter la section « Démarrage » avec **`docker compose up`** comme commande unique.
  - [x] ❌ **Ne pas supprimer** le contenu existant du README (texte personnel de Jeevons).
  - [x] **Test à blanc** : relire les instructions comme un nouvel arrivant — une seule commande suffit-elle vraiment ? (AC3)
- [x] **Tâche 6 — Definition of Done technique** (AGENTS.md §8)
  - [x] `npm run lint` · `npx tsc --noEmit` · `npm run build` → verts (le code applicatif n'est pas touché, mais on vérifie l'absence de régression).
  - [x] `git diff develop` relu : `docker-compose.yml` créé + `README.md` modifié. **Rien d'autre** — surtout pas la modification de test de la tâche 4.
  - [x] ⚠️ `git status` : aucun `.env` réel (AGENTS.md §2).
  - [x] `File List` + `Completion Notes` + `Change Log` remplis · `sprint-status.yaml` mis à jour.

## Dev Notes

### Périmètre — verrouillé

**Un fichier créé** (`docker-compose.yml`), **un modifié** (`README.md`, ajout d'une section).

**Hors périmètre — ne pas faire :**
- ❌ **Ne pas créer `docker-compose.prod.yml`** → story **2.5**.
- ❌ **Ne pas modifier le `Dockerfile`** → story 2.2, déjà `done`. Si l'étage `development` est défaillant, **s'arrêter et signaler** plutôt que de le corriger ici.
- ❌ **Ne pas ajouter Prisma**, ni schéma, ni migration, ni seed → **Epic 4**. Le service `db` démarre vide : c'est attendu.
- ❌ **Ne pas connecter le code applicatif à la base** : aucune ligne de `src/` ne change dans cette story.
- ❌ **Ne pas créer `.env`** : les valeurs de dev sont dans le compose. `.env.production.example` relève de la story 2.5.
- ❌ **Ne pas ajouter d'outil d'administration de base** (pgAdmin, Adminer) : hors AC, conteneur supplémentaire non demandé.
- ❌ **Ne pas réécrire le README** en entier : ajout d'une section, rien de plus.

### Pourquoi une base qui ne sert encore à rien

L'AC1 l'exige, et c'est délibéré : quand l'Epic 4 branchera Prisma, l'environnement de développement sera **déjà prêt**. Cela évite d'avoir à déboguer simultanément la conteneurisation et l'accès aux données. Le service `db` est aussi ce qui permet à Jeevons de tenir la promesse « sans installer Postgres localement ».

### Différence assumée avec la production

Le compose de **développement** embarque une base ; celui de **production** (story 2.5) n'en a **pas** — Postgres y est mutualisé sur le service Coolify existant (décision arrêtée n°2, coût VPS nul). Ce n'est pas une incohérence : c'est le partage voulu entre les deux fichiers.

### Testing standards

Pas de test automatisé. Vérification par **lancement réel de la stack**, `docker compose ps` pour l'état de santé, test de port pour la restriction réseau, et **modification live d'un fichier source** pour le hot reload (AC2).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.3]
- [Source: PLAN_REFONTE_2026.md §5.2 — service `db` postgres:16-alpine, port `127.0.0.1:5432`, healthcheck `pg_isready`, service `web` target `development`, volumes source + `/app/node_modules` + `/app/.next`, `depends_on: db healthy`]
- [Source: PLAN_REFONTE_2026.md §5.4 — `?schema=public` requis pour Prisma 7]
- [Source: PLAN_REFONTE_2026.md §7 décision 2 — Postgres mutualisé en production]
- [Source: AGENTS.md §2 — « À partir de l'Epic 2, la stack de développement se lance aussi par `docker compose up` »]
- [Source: Dockerfile — étage `development` créé en story 2.2] · [Source: README.md] · [Source: .gitignore]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

- `docker compose up -d` → séquence observée : `db Starting` → `db Waiting` → **`db Healthy`** → `web Starting` → `web Started` (preuve directe de `service_healthy`)
- `docker compose ps` → `db: Up (healthy)` publié sur `127.0.0.1:5432->5432/tcp` · `web: Up`
- `docker compose exec db pg_isready -U portfolio` → `accepting connections`
- `nc -zv 127.0.0.1 5432` → `succeeded` · `nc -zv 192.168.1.186 5432` (IP LAN) → **`Connection refused`** ✅
- `curl localhost:3000` → 200, CSS servi `200 / 39226 o`
- `docker compose exec web ls node_modules | wc -l` → **371** paquets (volumes anonymes préservés)
- **Hot reload** : `Explorez mon travail` → `HOTRELOAD_TEST_JEEVONS` dans `Hero.tsx` → visible dans la réponse HTTP **après 2 s**, sans redémarrage
- Restauration : `git diff --quiet src/sections/Hero.tsx` → **aucune trace du test**, texte d'origine réaffiché
- **Persistance** : table témoin avec `id=42` créée → `docker compose down` → `docker compose up` → `SELECT id` renvoie **42** → table témoin supprimée
- **Test à blanc AC3** : `docker compose down -v` + suppression de l'image, puis **`docker compose up` seul** → site joignable en **10 s**, `/api/health` 200
- `docker compose config` → valide, **aucun avertissement Compose**
- `npx tsc --noEmit` → 0 erreur · `npm run build` → `✓ Compiled successfully` · `npm run lint` → seul warning `Testimonials.tsx:83`, pré-existant

### Completion Notes List

- **AC1 satisfaite intégralement** : service `db` en `postgres:16-alpine` avec healthcheck `pg_isready`, service `web` sur l'étage `development` du Dockerfile de la story 2.2. L'attente de la base saine a été **observée dans la sortie de démarrage**, pas seulement déclarée : `db Waiting → db Healthy → web Starting`.
- **Piège n°1 évité** : les volumes anonymes `/app/node_modules` et `/app/.next` sont déclarés **après** le montage `.:/app`. Vérifié concrètement — 371 paquets présents dans le `node_modules` du conteneur, donc l'install Alpine/Linux n'a pas été écrasée par celle de l'hôte macOS/arm64.
- **Piège n°2 évité** : forme longue `depends_on.db.condition: service_healthy`, et non `depends_on: [db]`.
- **Piège n°3 vérifié activement** : le port est ouvert sur `127.0.0.1:5432` mais **refusé depuis l'IP LAN** (`192.168.1.186`) — la base n'est pas exposée au réseau local.
- **Piège n°4 — `WATCHPACK_POLLING` NON ajouté, délibérément.** Le hot reload fonctionne nativement : la modification de `Hero.tsx` est apparue **en 2 s**. La story demande de n'ajouter cette variable **que si le problème se manifeste**, car le polling consomme du CPU en continu. Il ne s'est pas manifesté. ⚠️ Si un poste tiers rencontre un jour un hot reload muet, c'est le premier levier à activer.
- **Modification de test annulée et vérifiée** : `git diff --quiet src/sections/Hero.tsx` passe, aucune trace de `HOTRELOAD_TEST_JEEVONS` dans le dépôt.
- **AC3 vérifiée pour de vrai, pas seulement relue** : conteneurs, volume **et** image supprimés (`docker compose down -v` + `docker rmi`), puis `docker compose up` **seul** depuis cet état vierge → site fonctionnel en 10 s. Une seule commande suffit réellement.
- **Persistance des données confirmée** par une donnée témoin qui a survécu à un cycle `down`/`up` complet (volume nommé `portfolio_db_data`).
- **Avertissements observés au démarrage, tous hors périmètre** : deux proviennent de l'initialisation de Postgres (`no usable system locales`, `trust authentication for local connections`) — normaux pour une base de développement ; deux sont des warnings React sur les props `shouldSpin`/`spinDuration` de `src/sections/Hero.tsx:32`, **pré-existants** (introduits au commit `43e1e45` de l'Epic 1) et hors périmètre puisque cette story interdit de toucher à `src/`. **Aucun avertissement émis par Compose lui-même** (pas de `version:` obsolète).
- **Mots de passe en clair assumés** : `portfolio/portfolio` sont des identifiants de développement local, sans valeur et jamais utilisés en production (celle-ci passe par le Postgres mutualisé, story 2.4/2.5). AGENTS.md §2 n'interdit que les **secrets réels**.
- `?schema=public` posé dès maintenant dans `DATABASE_URL` (requis par Prisma 7) pour éviter une reprise en Epic 4. Aucun code applicatif ne s'y connecte encore : le service `db` démarre vide, **c'est attendu et voulu par l'AC1**.
- Périmètre respecté : **un fichier créé**, **un modifié** (ajout d'une section en tête du README, contenu personnel intact). Aucun compose de production, aucun Prisma, aucun `.env`, aucun outil d'administration de base.

### File List

- `docker-compose.yml` (créé)
- `README.md` (modifié — ajout de la section « 🚀 Démarrage » en tête)

### Change Log

| Date | Description |
|------|-------------|
| 2026-07-21 | Story 2.3 — Ajout de `docker-compose.yml` pour l'environnement de développement : service `db` (`postgres:16-alpine`, healthcheck `pg_isready`, port restreint à `127.0.0.1`) et service `web` (étage `development`, hot reload par montage du code source avec volumes anonymes préservant `node_modules` et `.next`), `web` démarrant seulement une fois la base saine. Documentation de la commande unique `docker compose up` dans le README. |
