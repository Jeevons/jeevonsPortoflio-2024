# Preuves d'exécution — Story 2.4 (bases Postgres mutualisées)

> Aucun secret dans ce fichier : ni mot de passe, ni `DATABASE_URL` complète.
> Exécution du 2026-07-21 par Jeevons sur le VPS Hetzner (Postgres Coolify partagé avec Doshwork).

## Contexte d'exécution

| Élément | Valeur |
|---|---|
| Conteneur Postgres (nom Docker Coolify) | `n8ynmmu1qu1i8fjzq45ka67d` |
| Image | `postgres:16-alpine` |
| État au moment de l'opération | `Up 2 months (healthy)` |
| Ports | `5432/tcp` — non publié sur l'hôte (pas de `0.0.0.0:`) |
| Superuser | `doshwork_user` (Coolify ne crée pas de rôle `postgres`) |
| Base Doshwork | `doshwork_prod` — **ne jamais toucher** |

> ⚠️ `pg_dumpall -U postgres` échoue avec `role "postgres" does not exist` :
> Coolify ne provisionne pas le superuser par défaut, il crée celui déclaré dans
> `POSTGRES_USER`. Utiliser `doshwork_user`.

## Étape 0 — Sauvegarde préalable

```
code retour: 0
-rw-rw-r-- 1 doshops doshops 8.9M Jul 21 21:35 /home/doshops/backup-avant-portfolio-2026-07-21.sql

-- PostgreSQL database cluster dump complete
```

✅ Les 3 critères réunis : code retour 0, taille 8.9 Mo, dump complet non tronqué.

## Étape 1 — Inventaire AVANT

### Rôles (`\du`)

```
                               List of roles
   Role name   |                         Attributes
---------------+------------------------------------------------------------
 doshwork_user | Superuser, Create role, Create DB, Replication, Bypass RLS
```

**1 rôle.**

### Bases (`\l`)

```
     Name      |     Owner     | Encoding | Locale Provider |  Collate   |   Ctype
---------------+---------------+----------+-----------------+------------+------------
 doshwork_prod | doshwork_user | UTF8     | libc            | en_US.utf8 | en_US.utf8
 postgres      | doshwork_user | UTF8     | libc            | en_US.utf8 | en_US.utf8
 template0     | doshwork_user | UTF8     | libc            | en_US.utf8 | en_US.utf8
 template1     | doshwork_user | UTF8     | libc            | en_US.utf8 | en_US.utf8
(4 rows)
```

**4 bases.** Ni `portfolio_prod` ni `umami` préexistants.

## Étapes 2-3 — Création et droits

3 rôles (`doshwork_user` inchangé, `portfolio_user`, `umami_user` — attributs vides)
et 6 bases (`portfolio_prod` owner `portfolio_user`, `umami` owner `umami_user`).
`doshwork_prod` strictement identique à l'inventaire d'avant.

`GRANT ALL ON SCHEMA public` exécuté après `\c` sur chaque base cible, invite vérifiée
(`portfolio_prod=#`, `umami=#`).

## Étape 4 — Preuve de création de table

```
CREATE TABLE
DROP TABLE      -- portfolio_user sur portfolio_prod
CREATE TABLE
DROP TABLE      -- umami_user sur umami
Did not find any relations.
```

✅ Piège n°1 (PG15 `public`) neutralisé : `prisma migrate deploy` passera en Epic 4.

## Étape 5 — Isolation croisée : ÉCART vs runbook

🛑 **Au premier passage, les deux tests d'isolation ont RÉUSSI au lieu d'échouer.**
`portfolio_user` énumérait les 27 tables de `doshwork_prod` (`users`, `sessions`,
`bank_accounts`, `password_reset_tokens`…).

**Cause** — comportement par défaut de PostgreSQL, non un réglage erroné : le pseudo-rôle
`PUBLIC` détient `CONNECT` sur toute base dont les `Access privileges` sont vides (visible
tel quel dans le `\l` d'avant). Le runbook postulait un `FATAL` immédiat : **ce postulat
était faux**. Lister les tables ne permettait pas de lire les données (tables détenues par
`doshwork_user`), mais l'énumération du schéma est déjà une fuite.

**Correctif appliqué** (seule opération du runbook portant sur un privilège lié à
`doshwork_prod` — précédée d'un contrôle `pg_stat_activity` ne montrant que
`doshwork_user`) :

```sql
REVOKE CONNECT ON DATABASE doshwork_prod  FROM PUBLIC;
REVOKE CONNECT ON DATABASE portfolio_prod FROM PUBLIC;
REVOKE CONNECT ON DATABASE umami          FROM PUBLIC;
GRANT  CONNECT ON DATABASE doshwork_prod  TO doshwork_user;
GRANT  CONNECT ON DATABASE portfolio_prod TO portfolio_user;
GRANT  CONNECT ON DATABASE umami          TO umami_user;
```

Aucune table, aucune donnée, aucun rôle nommé touché.

**Après correctif :**

```
portfolio_user -> doshwork_prod   : FATAL: permission denied (does not have CONNECT privilege)
umami_user     -> portfolio_prod  : FATAL: permission denied (does not have CONNECT privilege)
portfolio_user -> portfolio_prod  : Did not find any relations.   (accès légitime préservé)
```

## Non-régression Doshwork

```
SELECT count(*) FROM users;  ->  6
doshwork.com:     200
api.doshwork.com: 200
```

## Résultats à consigner

| # | Vérification | Résultat |
|---|---|---|
| 1 | 2 bases + 2 rôles ajoutés | ✅ 3 rôles / 6 bases |
| 2 | Les 2 `CREATE TABLE _probe` réussissent | ✅ |
| 3 | Les 2 tests d'isolation **échouent** | ✅ après `REVOKE CONNECT ... FROM PUBLIC` |
| 4 | Doshwork intact + 2 `curl` OK | ✅ users=6, 200/200 |

## À corriger dans le runbook

L'étape 5 doit inclure le `REVOKE CONNECT ... FROM PUBLIC` **en amont** du test, et non
présenter le `FATAL` comme acquis. Sans ce `REVOKE`, toute base créée sur ce cluster est
énumérable par n'importe quel rôle — y compris les futures bases des autres projets.
