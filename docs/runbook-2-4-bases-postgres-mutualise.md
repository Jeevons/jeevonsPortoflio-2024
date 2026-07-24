# Runbook — Story 2.4 : créer les bases du portfolio sur le Postgres mutualisé

> **À exécuter par Jeevons sur le VPS.** Opération sur le Postgres de **production**, celui qui héberge Doshwork.
> Toutes les commandes ci-dessous sont **additives** : aucun `DROP`, `ALTER` ni `REVOKE` sur l'existant.

**Objectif** — créer deux bases avec utilisateurs dédiés et isolés :

| Base | Utilisateur | Usage |
|---|---|---|
| `portfolio_prod` | `portfolio_user` | Le portfolio (Epic 4) |
| `umami` | `umami_user` | Analytics self-hosted (Epic 7) |

La base `umami` est créée maintenant pour **n'ouvrir la session `psql` de production qu'une seule fois** — chaque intervention manuelle sur une base de production est un risque. Elle restera vide jusqu'à l'Epic 7.

## Les trois pièges à connaître avant de commencer

**0. Il n'y a pas de rôle `postgres` sur un Postgres Coolify.** Coolify ne provisionne pas le
superuser par défaut : il crée celui déclaré dans `POSTGRES_USER` — ici `doshwork_user`.
Toute commande `-U postgres` échoue avec `role "postgres" does not exist`. Récupérer le bon
nom via `docker exec <conteneur> env | grep -iE '^POSTGRES_(USER|DB)='`.
Corollaire : le conteneur porte un **ID Coolify** (ex. `n8ynmmu1qu1i8fjzq45ka67d`), pas un nom
lisible — le filtrer par image (`--filter ancestor=postgres:16-alpine`), jamais par nom.
Attention aussi : `cmd > fichier` avec `sudo` crée un fichier **vide** si la commande échoue —
toujours contrôler code retour, taille, **et** la dernière ligne du dump.

## Les deux pièges à connaître avant de commencer

**1. Le `\c` avant chaque `GRANT`.** Depuis PostgreSQL 15, `CREATE DATABASE` ne donne plus au propriétaire le droit de créer des objets dans le schéma `public`. Un `GRANT ALL ON SCHEMA public` lancé depuis la **mauvaise base** porte sur le mauvais schéma — **sans lever la moindre erreur**. Le symptôme n'apparaîtra qu'en Epic 4 : `prisma migrate deploy` échouera avec `permission denied for schema public`, des semaines plus tard, dans un contexte sans rapport apparent. D'où l'étape 4 : on ne se contente pas d'exécuter le `GRANT`, on **prouve** qu'une table peut réellement être créée.

**2. À l'étape 5, un échec est le résultat attendu.** Le test d'isolation croisée doit **échouer**. S'il réussit, l'AC1 est violée : l'utilisateur a accès à une base qui ne lui appartient pas.

---

## Étape 0 — Sauvegarde et accès

```bash
# 1. Identifier le conteneur Postgres de Coolify
docker ps | grep postgres

# 2. Sauvegarde de sécurité AVANT toute opération
docker exec <conteneur_postgres> pg_dumpall -U postgres > ~/backup-avant-portfolio-$(date +%F).sql
ls -lh ~/backup-avant-portfolio-*.sql   # vérifier que le fichier n'est pas vide

# 3. Générer les DEUX mots de passe (distincts, jamais réutilisés d'un autre service)
openssl rand -base64 32   # -> mot de passe portfolio_user
openssl rand -base64 32   # -> mot de passe umami_user
```

> 🛑 Ces mots de passe vont **uniquement** dans ton gestionnaire de mots de passe et dans les Secrets Coolify.
> Jamais dans un fichier du dépôt, jamais dans un commit, jamais transmis à l'agent.

Le mot de passe `postgres` se trouve dans Coolify : service Postgres → Environment Variables.

```bash
# 4. Ouvrir psql
docker exec -it <conteneur_postgres> psql -U postgres
```

---

## Étape 1 — Inventaire AVANT (preuve pour l'AC3)

```sql
\l
\du
```

👉 **Copier ces deux sorties** dans un fichier local : c'est la preuve « avant », à comparer à l'étape 6.
👉 Noter le **nom exact de la ou des bases Doshwork** — elles ne doivent jamais être touchées.

---

## Étape 2 — Créer bases et utilisateurs (AC1)

```sql
CREATE USER portfolio_user WITH PASSWORD 'COLLER_MOT_DE_PASSE_1';
CREATE DATABASE portfolio_prod OWNER portfolio_user;

CREATE USER umami_user WITH PASSWORD 'COLLER_MOT_DE_PASSE_2';
CREATE DATABASE umami OWNER umami_user;
```

Attendu : `CREATE ROLE` et `CREATE DATABASE`, deux fois chacun.

---

## Étape 3 — Droits sur le schéma public (AC2)

> ⚠️ **Le `\c` avant chaque `GRANT` est obligatoire** (piège n°1).
> Vérifier l'invite `psql` : elle doit afficher le nom de la base cible avant de lancer le `GRANT`.

```sql
\c portfolio_prod
GRANT ALL ON SCHEMA public TO portfolio_user;

\c umami
GRANT ALL ON SCHEMA public TO umami_user;

\q
```

---

## Étape 4 — Prouver la création de table (AC2) — ne pas sauter

Depuis le shell du VPS (plus dans `psql`) :

```bash
docker exec -it <conteneur_postgres> psql -U portfolio_user -d portfolio_prod \
  -c "CREATE TABLE _probe(id int); DROP TABLE _probe;"

docker exec -it <conteneur_postgres> psql -U umami_user -d umami \
  -c "CREATE TABLE _probe(id int); DROP TABLE _probe;"
```

Attendu : `CREATE TABLE` puis `DROP TABLE`, sans erreur.

❌ Si `ERROR: permission denied for schema public` → l'étape 3 a été faite depuis la mauvaise base. **Recommencer l'étape 3.**

Vérifier qu'il ne reste rien :

```bash
docker exec -it <conteneur_postgres> psql -U portfolio_user -d portfolio_prod -c "\dt"
# Attendu : "Did not find any relations." — base vide, c'est normal, Prisma arrive en Epic 4
```

---

## Étape 5 — Isolation croisée (AC1) — ne pas sauter

> 🛑 **Ici, un échec est le résultat attendu.**

### 5.a — Retirer `CONNECT` à `PUBLIC` (obligatoire, sinon 5.b réussit)

Par défaut, PostgreSQL accorde `CONNECT` au pseudo-rôle `PUBLIC` sur toute base dont les
`Access privileges` sont vides. **Sans ce `REVOKE`, n'importe quel rôle du cluster peut se
connecter à n'importe quelle base et en énumérer les tables** — constaté en exécution réelle
le 2026-07-21 : `portfolio_user` listait les 27 tables de `doshwork_prod`.

Vérifier d'abord qu'aucun autre rôle que le propriétaire n'est connecté :

```bash
docker exec <conteneur_postgres> psql -U <superuser> -d postgres -c \
  "SELECT DISTINCT usename, datname FROM pg_stat_activity WHERE datname IS NOT NULL;"
```

Puis appliquer :

```sql
REVOKE CONNECT ON DATABASE doshwork_prod  FROM PUBLIC;
REVOKE CONNECT ON DATABASE portfolio_prod FROM PUBLIC;
REVOKE CONNECT ON DATABASE umami          FROM PUBLIC;
GRANT  CONNECT ON DATABASE doshwork_prod  TO doshwork_user;
GRANT  CONNECT ON DATABASE portfolio_prod TO portfolio_user;
GRANT  CONNECT ON DATABASE umami          TO umami_user;
```

Aucune table ni donnée touchée. Contrôle immédiat de non-régression :

```bash
docker exec -it <conteneur_postgres> psql -U <superuser> -d doshwork_prod -c "SELECT count(*) FROM users;"
curl -sS -o /dev/null -w "%{http_code}\n" https://doshwork.com
```

Rollback si besoin : `GRANT CONNECT ON DATABASE doshwork_prod TO PUBLIC;`

Vérification dans `\l` : `PUBLIC` ne doit plus conserver que `=T/...` (TEMPORARY),
sans le `c` de CONNECT.

### 5.b — Tester l'isolation

```bash
# portfolio_user ne doit PAS voir la base Doshwork
docker exec -it <conteneur_postgres> psql -U portfolio_user -d <base_doshwork> -c "\dt"
# Attendu : FATAL: permission denied for database ...

# umami_user ne doit PAS voir portfolio_prod
docker exec -it <conteneur_postgres> psql -U umami_user -d portfolio_prod -c "\dt"
# Attendu : échec également
```

❌ Si l'une de ces commandes **réussit**, l'AC1 est violée → corriger les droits avant de poursuivre.

---

## Étape 6 — Inventaire APRÈS et non-régression Doshwork (AC3)

```bash
docker exec -it <conteneur_postgres> psql -U postgres
```
```sql
\l
\du
```

👉 Comparer **ligne à ligne** avec l'étape 1 :
- exactement **2 bases ajoutées** (`portfolio_prod`, `umami`)
- exactement **2 rôles ajoutés** (`portfolio_user`, `umami_user`)
- toutes les lignes Doshwork **strictement identiques** — aucune modifiée, aucune supprimée

```bash
curl -sS -o /dev/null -w "doshwork.com: %{http_code}\n" https://doshwork.com
curl -sS -o /dev/null -w "api.doshwork.com: %{http_code}\n" https://api.doshwork.com
```

👉 Vérifier aussi dans Coolify que `doshwork-api` et `doshwork-web` sont toujours **healthy**, et que leur historique de déploiement ne montre **aucune modification**.

---

## Étape 7 — Format de la `DATABASE_URL` (pour la story 2.6 / Epic 4)

```
postgresql://portfolio_user:<MOT_DE_PASSE>@<host-postgres-coolify>:5432/portfolio_prod?schema=public
```

- **`?schema=public` est requis par Prisma 7** — l'oublier est un second piège, distinct du `GRANT`.
- `<host>` = nom du service Postgres **dans le réseau Docker de Coolify**, pas `localhost` : le portfolio tournera dans un autre conteneur. Coolify propose une « Reference Resource » / variable interne pour cela — la privilégier.
- 🛑 Cette URL complète, avec son mot de passe réel, va **uniquement dans les Secrets Coolify**. Jamais dans le dépôt.

Le fichier `.env.production.example` (story 2.5) sert de checklist des variables à renseigner, toutes valeurs vides.

> ⚠️ Dans Coolify, cocher **`Available at Buildtime`** sur `DATABASE_URL` même si la variable est purement
> runtime : `docker-compose.prod.yml` la référence dans son bloc `environment:`, et Docker Compose résout
> tout le fichier au moment du `build`. Sans cette case, le build échoue sur
> `The "DATABASE_URL" variable is not set` (exit 255). Sans impact sécurité : la variable n'est jamais
> déclarée en `build.args`, elle sert uniquement au parsing du compose.

---

## Résultats à consigner pour clore la story

1. Les 2 bases et 2 rôles apparaissent-ils dans le `\l` / `\du` d'après ? *(étape 6)*
2. Les 2 `CREATE TABLE _probe` ont-ils réussi ? *(étape 4)*
3. Les 2 tests d'isolation ont-ils bien **échoué** ? *(étape 5)*
4. Les lignes Doshwork sont-elles identiques avant/après, et les 2 `curl` normaux ? *(étape 6)*

> ❌ **Ne consigner aucun mot de passe ni `DATABASE_URL` complète** — uniquement les résultats des vérifications.

---

## Diagnostic

| Symptôme | Cause probable | Action |
|---|---|---|
| `permission denied for schema public` à l'étape 4 | `GRANT` lancé depuis la mauvaise base | Refaire l'étape 3 en vérifiant l'invite `psql` après chaque `\c` |
| L'étape 5 **réussit** au lieu d'échouer | Droits trop larges sur l'utilisateur | Corriger avant de poursuivre : l'AC1 est violée |
| `prisma migrate deploy` échoue en Epic 4 | `GRANT` de l'étape 3 jamais réellement appliqué | Rejouer les étapes 3 et 4 |
| Doshwork ne répond plus | Une ressource Doshwork a été modifiée | **Rollback Coolify immédiat** sur l'app Doshwork |

## Références

- Story 2.4 — `_bmad-output/implementation-artifacts/2-4-heberger-les-donnees-du-portfolio-sur-le-postgres-mutualise.md`
- `PLAN_REFONTE_2026.md` §5.4 (base `portfolio_prod`, `DATABASE_URL` en Secret Coolify), §7 décision 2 (Postgres mutualisé, coût VPS nul), §10.4 (base `umami`)
- `AGENTS.md` §2 — ne jamais committer un secret, ne jamais toucher aux ressources Coolify de Doshwork
- PostgreSQL 15+ — retrait du droit `CREATE` sur le schéma `public` pour `PUBLIC`
