---
baseline_commit: 43e1e458b22cdbaaab761e933ce4021bd15301ad
---

# Story 2.4: Héberger les données du portfolio sur le Postgres mutualisé

Status: ready-for-dev

## Story

As **Jeevons**,
I want **une base dédiée au portfolio sur le Postgres que Coolify héberge déjà**,
so that **je n'ajoute aucun coût ni conteneur supplémentaire à mon VPS**.

## 🛑 Story d'exploitation — pas de code, opération sur un serveur de PRODUCTION

Cette story ne produit **aucun code applicatif**. Elle consiste à exécuter des commandes SQL sur le Postgres du VPS, **sur lequel Doshwork tourne en production**.

**Conséquences directes :**
- 🛑 **L'agent n'a pas accès au VPS.** Ces commandes sont exécutées **par Jeevons**, via SSH ou la console Coolify. Le rôle de l'agent est de **préparer les commandes exactes, les faire valider, guider l'exécution et vérifier les résultats** — pas de tenter une connexion.
- 🛑 **AGENTS.md §2** : « Ne jamais toucher aux ressources Coolify de Doshwork ». On **ajoute** des bases, on ne modifie **rien** d'existant.
- 🛑 **Aucun mot de passe généré ne doit être écrit dans un fichier du dépôt**, ni dans cette story, ni dans un commit. Ils vont dans les **Secrets Coolify** et dans le gestionnaire de mots de passe de Jeevons.
- 💡 **Sauvegarde recommandée avant toute opération** : un `pg_dump` des bases Doshwork existantes, même si les commandes ci-dessous sont purement additives. Coût quasi nul, filet de sécurité réel.

## Acceptance Criteria

**AC1 — Deux bases avec utilisateurs dédiés**
**Given** le service Postgres de Coolify héberge déjà la base de Doshwork
**When** je crée les nouvelles bases
**Then** une base **`portfolio_prod`** existe avec un utilisateur dédié **`portfolio_user`**
**And** une base **`umami`** existe avec un utilisateur dédié **`umami_user`**, en prévision de l'Epic 7
**And** **chaque utilisateur n'a de droits que sur sa propre base**

**AC2 — Droits sur le schéma public vérifiés par la preuve**
**Given** Postgres 15 et suivants restreignent le schéma public par défaut
**When** je vérifie les droits de chaque nouvel utilisateur
**Then** **`GRANT ALL ON SCHEMA public`** a été appliqué sur sa base
**And** l'utilisateur **peut effectivement y créer une table**, ce qui est **vérifié explicitement**

**AC3 — Doshwork intact**
**Given** les bases de Doshwork sont en production
**When** j'ai terminé l'opération
**Then** les **bases et utilisateurs existants de Doshwork sont intacts**
**And** le **service Doshwork continue de répondre normalement**

## Contexte d'implémentation

### ⚠️ Le piège central : `GRANT ALL ON SCHEMA public` (AC2)

Depuis **PostgreSQL 15**, `CREATE DATABASE` ne donne plus au propriétaire le droit de créer des objets dans le schéma `public` — ce droit a été retiré de `PUBLIC` pour des raisons de sécurité.

**Symptôme si on l'oublie** : tout paraît fonctionner (l'utilisateur se connecte sans erreur), puis **`prisma migrate deploy` échoue en Epic 4** avec `permission denied for schema public`. Le lien de cause à effet est alors très difficile à faire — des semaines plus tard, dans un autre contexte.

👉 D'où l'AC2 : ne pas se contenter d'exécuter le `GRANT`, mais **prouver** qu'une table peut réellement être créée.

⚠️ **Le `GRANT` doit être exécuté en étant connecté à la base cible**, pas à `postgres`. Un `GRANT ... ON SCHEMA public` lancé depuis la mauvaise base porte sur le mauvais schéma et ne sert à rien — sans lever d'erreur.

### Commandes à exécuter (à valider avec Jeevons avant lancement)

**Étape 0 — accéder à Postgres.** Récupérer le mot de passe `postgres` dans Coolify (service Postgres → Environment Variables), puis :
```bash
# Sur le VPS
docker exec -it <conteneur_postgres_coolify> psql -U postgres
```
💡 `docker ps | grep postgres` donne le nom du conteneur.

**Étape 1 — inventaire AVANT (indispensable pour prouver l'AC3)**
```sql
\l
\du
```
👉 **Copier ces deux sorties** : elles constituent la preuve « avant » à comparer en fin d'opération.

**Étape 2 — création (purement additive)**
```sql
CREATE USER portfolio_user WITH PASSWORD '<mot-de-passe-généré>';
CREATE DATABASE portfolio_prod OWNER portfolio_user;

CREATE USER umami_user WITH PASSWORD '<autre-mot-de-passe-généré>';
CREATE DATABASE umami OWNER umami_user;
```
⚠️ Générer chaque mot de passe avec `openssl rand -base64 32`, **deux mots de passe distincts**, jamais réutilisés d'un autre service.

**Étape 3 — droits sur le schéma public (AC2)**
```sql
\c portfolio_prod
GRANT ALL ON SCHEMA public TO portfolio_user;

\c umami
GRANT ALL ON SCHEMA public TO umami_user;
```
⚠️ Le `\c` **avant chaque `GRANT`** — c'est là que se joue le piège.

**Étape 4 — preuve de création de table (AC2)** — 🛑 **ne pas sauter**
```bash
# En tant que portfolio_user, sur sa propre base
psql -U portfolio_user -d portfolio_prod -c "CREATE TABLE _probe(id int); DROP TABLE _probe;"
# Puis idem pour umami_user / umami
```
Attendu : `CREATE TABLE` puis `DROP TABLE`, sans erreur. **C'est la vérification explicite exigée par l'AC2.** La table de test est supprimée immédiatement.

**Étape 5 — isolation croisée (AC1 : « droits que sur sa propre base »)** — 🛑 **ne pas sauter**
```bash
psql -U portfolio_user -d <base_doshwork> -c "\dt"
# Attendu : ÉCHEC — permission denied / accès refusé
```
👉 Un **échec est ici le résultat attendu**. S'il réussit, l'AC1 est **violée** : `portfolio_user` a accès à la base de Doshwork → corriger avant d'aller plus loin.

**Étape 6 — inventaire APRÈS (AC3)**
```sql
\l
\du
```
👉 Comparer avec l'étape 1 : les lignes Doshwork doivent être **strictement identiques**, avec exactement 2 bases et 2 utilisateurs **ajoutés**, aucun modifié, aucun supprimé.

**Étape 7 — Doshwork répond toujours (AC3)**
```bash
curl -sS -o /dev/null -w "%{http_code}\n" https://doshwork.com
curl -sS -o /dev/null -w "%{http_code}\n" https://api.doshwork.com
```
Attendu : les deux répondent normalement, comme avant l'opération.

### Format de la `DATABASE_URL` (à préparer pour les stories 2.5 / Epic 4)

```
postgresql://portfolio_user:<mot-de-passe>@<host-postgres-coolify>:5432/portfolio_prod?schema=public
```
⚠️ **`?schema=public` est requis par Prisma 7** (PLAN §5.4). L'oublier est un second piège, distinct du `GRANT`.
💡 Le `<host>` est le **nom du service Postgres dans le réseau Docker de Coolify**, pas `localhost` — le portfolio tournera dans un autre conteneur. Coolify propose une « Reference Resource » / variable interne pour cela : la privilégier.
🛑 Cette URL, **avec son mot de passe réel**, va **uniquement dans les Secrets Coolify**. Jamais dans le dépôt.

### Pourquoi créer `umami` maintenant (AC1)

Umami relève de l'**Epic 7** (analytics self-hosted, décision arrêtée n°5). Sa base est créée ici pour **n'ouvrir la session `psql` de production qu'une seule fois** — chaque intervention manuelle sur un Postgres de production est un risque. La base `umami` restera simplement vide jusqu'à l'Epic 7. C'est explicitement voulu par l'AC1 (« en prévision de l'Epic 7 »).

## Tasks / Subtasks

- [ ] **Tâche 0 — Préparation et validation** — 🛑 **BLOQUANT**
  - [ ] Confirmer avec Jeevons que **lui seul** exécute les commandes sur le VPS.
  - [ ] Lui faire **relire et valider** la séquence SQL complète avant tout lancement.
  - [ ] Générer les **deux mots de passe** (`openssl rand -base64 32`) et les stocker dans son gestionnaire de mots de passe. ❌ **Jamais dans un fichier du dépôt.**
  - [ ] Recommander un `pg_dump` de sauvegarde des bases Doshwork existantes.
- [ ] **Tâche 1 — Inventaire avant opération** (AC: 3)
  - [ ] `\l` et `\du` → **conserver les sorties** (preuve « avant »).
  - [ ] Noter le nom exact de la ou des bases Doshwork, à **ne jamais toucher**.
- [ ] **Tâche 2 — Créer bases et utilisateurs** (AC: 1)
  - [ ] `portfolio_user` + `portfolio_prod` (owner).
  - [ ] `umami_user` + `umami` (owner).
  - [ ] ❌ Aucune commande `DROP`, `ALTER` ou `REVOKE` sur un objet existant.
- [ ] **Tâche 3 — Appliquer les droits sur le schéma public** (AC: 2)
  - [ ] `\c portfolio_prod` **puis** `GRANT ALL ON SCHEMA public TO portfolio_user;`
  - [ ] `\c umami` **puis** `GRANT ALL ON SCHEMA public TO umami_user;`
  - [ ] ⚠️ Vérifier d'être bien connecté à la bonne base avant chaque `GRANT` (invite `psql`).
- [ ] **Tâche 4 — Prouver la création de table** (AC: 2) — 🛑 **exigé explicitement par l'AC**
  - [ ] `portfolio_user` sur `portfolio_prod` : `CREATE TABLE _probe(id int); DROP TABLE _probe;` → succès.
  - [ ] `umami_user` sur `umami` : idem → succès.
  - [ ] Vérifier qu'**aucune table `_probe` ne subsiste** (`\dt`).
- [ ] **Tâche 5 — Vérifier l'isolation** (AC: 1)
  - [ ] `portfolio_user` tente d'accéder à la base Doshwork → **doit échouer**.
  - [ ] `umami_user` tente d'accéder à `portfolio_prod` → **doit échouer**.
  - [ ] ⚠️ Un succès ici est un **échec de l'AC1** : corriger les droits avant de poursuivre.
- [ ] **Tâche 6 — Vérifier la non-régression Doshwork** (AC: 3) — 🛑 **critique**
  - [ ] `\l` et `\du` → comparer **ligne à ligne** avec la tâche 1 : Doshwork strictement inchangé.
  - [ ] `curl` sur `doshwork.com` et `api.doshwork.com` → réponses normales.
  - [ ] Vérifier dans Coolify que les ressources `doshwork-api` / `doshwork-web` sont toujours **healthy**.
- [ ] **Tâche 7 — Consigner sans divulguer**
  - [ ] Noter en **Completion Notes** : bases et utilisateurs créés, `GRANT` appliqués, **résultats des preuves** (tâches 4, 5, 6). ❌ **Aucun mot de passe**, aucune `DATABASE_URL` complète.
  - [ ] Préparer le **format** de la `DATABASE_URL` (avec `?schema=public`) pour la story 2.5 — **valeur masquée**.
  - [ ] ⚠️ `git status` doit rester **propre** : cette story ne modifie aucun fichier du dépôt hors la story elle-même (AGENTS.md §2).
  - [ ] `sprint-status.yaml` mis à jour.

## Dev Notes

### Périmètre — verrouillé

**Aucun fichier de code créé ou modifié.** Seule la story elle-même est mise à jour (Completion Notes), plus `sprint-status.yaml`.

**Hors périmètre — ne pas faire :**
- ❌ **Ne pas installer Umami** → **Epic 7**. On crée sa base, rien d'autre.
- ❌ **Ne pas ajouter Prisma**, ni schéma, ni migration, ni seed → **Epic 4**. Les bases restent **vides** à l'issue de cette story, et c'est correct.
- ❌ **Ne pas créer de tables** hors la table de test `_probe`, immédiatement supprimée.
- ❌ **Ne pas modifier `docker-compose.yml`** (dev, story 2.3) : sa base locale est indépendante de celle du VPS.
- ❌ **Ne pas créer `.env.production.example`** → story **2.5**.
- ❌ **Ne pas configurer le domaine ni le DNS** → story **2.6**.
- ❌ **Ne pas toucher aux ressources Coolify de Doshwork** — interdiction absolue (AGENTS.md §2, PLAN §8.5).
- ❌ **Ne pas ajouter de conteneur Postgres** au VPS : l'intérêt de la story est justement la mutualisation (coût nul, décision arrêtée n°2).

### Ce que cette story débloque

- Story **2.5** : `DATABASE_URL` figure dans `.env.production.example` (nom seul, sans valeur).
- **Epic 4** : `prisma migrate deploy` s'exécutera sur `portfolio_prod` — c'est là que le `GRANT` de l'AC2 sera réellement mis à l'épreuve.
- **Epic 7** : Umami pointera sur sa base via une Reference Resource Coolify.

### Ordre au sein de l'Epic 2

Cette story est **indépendante des stories 2.1 à 2.3** (aucun code partagé) mais doit précéder la **2.5**, qui référence `DATABASE_URL`. Elle peut être menée en parallèle du travail Docker si Jeevons a une fenêtre d'intervention sur le VPS.

### Testing standards

Aucun test automatisé possible : opération d'infrastructure. La vérification **est** la story — chaque AC est prouvée par une commande dont le résultat est consigné : création de table effective (AC2), échec d'accès croisé (AC1), inventaire avant/après identique côté Doshwork (AC3).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.4]
- [Source: _bmad-output/planning-artifacts/epics.md — « `GRANT ALL ON SCHEMA public` obligatoire depuis Postgres 15, sans quoi la création de tables échoue »]
- [Source: PLAN_REFONTE_2026.md §5.4 — base `portfolio_prod`, `DATABASE_URL` en Secret Coolify avec `?schema=public` pour Prisma 7]
- [Source: PLAN_REFONTE_2026.md §7 décision 2 — Postgres mutualisé, coût VPS nul]
- [Source: PLAN_REFONTE_2026.md §10.4 — création de la base `umami`, `APP_SECRET` via `openssl rand -base64 32`]
- [Source: PLAN_REFONTE_2026.md §8.5 — « Ne touche jamais aux ressources `doshwork-api` / `doshwork-web` »]
- [Source: AGENTS.md §1 — garde-fou « coût VPS additionnel nul (Postgres mutualisé) »]
- [Source: AGENTS.md §2 — interdiction de committer un secret, interdiction de toucher aux ressources Doshwork]
- [Source: PostgreSQL 15+ — retrait du droit `CREATE` sur le schéma `public` pour `PUBLIC`]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

- `docker ps | grep postgres` en local → seul le Postgres de **développement** (story 2.3) est visible. Le Postgres de Coolify n'est **pas accessible** depuis la machine de développement — conforme à l'énoncé de la story.

### Completion Notes List

⏸️ **Story NON terminée — exécution en attente de Jeevons.** Elle est bloquée sur sa tâche 0, qui exige que **Jeevons seul** opère sur le VPS.

**Position tenue par l'agent :** l'accès SSH a été proposé, il a été **décliné**. Trois raisons convergentes :
1. La story elle-même : « 🛑 L'agent n'a pas accès au VPS. Ces commandes sont exécutées **par Jeevons** […] pas de tenter une connexion. »
2. `AGENTS.md` §2 : « Ne jamais toucher aux ressources Coolify de Doshwork. »
3. Le Postgres visé héberge **Doshwork en production**, et l'AC3 porte entièrement sur « Doshwork intact ».

Le risque n'est pas le SQL (purement additif) mais son contexte : identification du bon conteneur, nom exact de la base Doshwork pour le test d'isolation, et surtout **manipulation de deux mots de passe en clair** dans des commandes qui transiteraient par les logs d'outils de l'agent — exactement ce que l'étape 0 interdit. Ces mots de passe doivent aller directement dans le gestionnaire de mots de passe de Jeevons et les Secrets Coolify, sans passer par l'agent.

**Livrable produit :** un runbook complet, commande par commande, avec sauvegarde `pg_dumpall` en préalable et les deux pièges balisés :
- le **`\c` avant chaque `GRANT`** (un `GRANT ALL ON SCHEMA public` lancé depuis la mauvaise base ne sert à rien **sans lever d'erreur**, et se manifestera seulement en Epic 4 par `permission denied for schema public`) ;
- le **test d'isolation croisée où l'échec est le résultat attendu** (un succès signifierait que l'AC1 est violée).

Le runbook couvre les 7 étapes : inventaire avant (preuve AC3), création des 2 bases + 2 rôles (AC1), `GRANT` sur le schéma public (AC2), **preuve de création de table** `_probe` (AC2), isolation croisée (AC1), inventaire après + `curl` Doshwork (AC3), et le format de `DATABASE_URL` avec `?schema=public` pour les stories 2.5 / Epic 4.

**À renvoyer par Jeevons pour clore la story** : (1) les 2 bases et 2 rôles présents dans le `\l`/`\du` d'après, (2) les 2 `CREATE TABLE _probe` réussis, (3) les 2 tests d'isolation bien **échoués**, (4) lignes Doshwork identiques avant/après et les 2 `curl` OK. ❌ **Aucun mot de passe ni URL complète ne doit être transmis** — seulement les résultats.

**📄 Runbook versionné — écart de périmètre assumé, sur demande explicite de Jeevons.** La section « Périmètre » de cette story prévoit « aucun fichier de code créé ou modifié ». Jeevons a demandé que le runbook soit déposé dans le dépôt plutôt que laissé dans un répertoire temporaire de session : il est donc versionné en **`docs/runbook-2-4-bases-postgres-mutualise.md`**. Cet emplacement est cohérent avec AGENTS.md §3, qui désigne `docs/` comme le dossier des runbooks d'exploitation. Vérifié : aucun secret en clair (11 placeholders à substituer), fichier versionnable par git, et `docs/` est exclu du `.dockerignore` — l'image n'est pas alourdie.

### File List

- `docs/runbook-2-4-bases-postgres-mutualise.md` (créé — runbook d'exécution, sur demande explicite de Jeevons)

### Change Log

| Date | Description |
|------|-------------|
| 2026-07-21 | Story 2.4 — Rédaction du runbook d'exécution des commandes SQL sur le Postgres mutualisé (création de `portfolio_prod` et `umami` avec utilisateurs dédiés et isolés, `GRANT ALL ON SCHEMA public`, preuves de création de table et d'isolation croisée, contrôles de non-régression Doshwork). Exécution sur le VPS restant à la main de Jeevons. |
