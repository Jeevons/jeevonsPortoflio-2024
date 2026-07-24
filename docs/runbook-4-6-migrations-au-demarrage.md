# Runbook — Migrations + seed automatiques au démarrage du conteneur (Story 4.6)

Au démarrage du conteneur de **production**, l'entrypoint applique les migrations
Prisma puis le seed idempotent **avant** que le serveur ne serve du trafic :

```
1. prisma migrate deploy   (applique les migrations en attente)
2. seed idempotent         (n'écrase jamais de contenu existant)
3. node server.js          (le serveur commence à écouter)
```

Si (1) ou (2) échoue, le démarrage est interrompu (`exit 1`) : le serveur n'écoute
jamais, donc le healthcheck reste rouge et l'orchestrateur ne route aucun trafic
vers une application dont la base serait incohérente.

> Aucun secret dans ce runbook. Ne collez jamais la `DATABASE_URL` réelle ni un
> mot de passe dans un ticket ou un log. Les messages d'erreur Prisma exposent au
> plus l'hôte:port de la base, jamais les identifiants.

## 🛑 Prérequis production (à faire UNE fois sur le VPS)

- **`GRANT ALL ON SCHEMA public`** doit avoir été appliqué sur `portfolio_prod`
  (story 2.4). Sans ce grant, `prisma migrate deploy` échoue avec
  `permission denied for schema public` → le conteneur ne démarrera pas.
  ✅ Confirmé appliqué (décision Jeevons, story 4.6).
- `DATABASE_URL` est fournie au conteneur par l'environnement (compose / Coolify),
  jamais écrite dans l'image.

## Comment ça marche (implémentation)

- **Entrypoint** : `apps/web/docker-entrypoint.sh` (câblé en `ENTRYPOINT` de
  l'étage `production`). `set -e` → tout échec migrate/seed interrompt le démarrage.
- **Toolchain Prisma isolé** : l'étage Docker `migrator` installe la CLI `prisma`
  dans un préfixe dédié (avec le schema-engine `linux-musl` et toutes ses
  dépendances). L'étage `production` la copie sous `/app/prisma-tools` — sans
  toucher au `node_modules` minimal du standalone Next.
- **Config prod** : `prisma/prod.config.js` (CJS, chargeable par node sans Bun ni
  TypeScript) est copié dans l'image sous `prisma.config.js` ; il lit
  `datasource.url` depuis `process.env.DATABASE_URL`. Il ne coexiste jamais avec
  `prisma.config.ts` (réservé au dev/CI sur l'hôte).
- **Seed exécutable par node** : `bun run build:seed` transpile `prisma/seed.ts`
  en un bundle autonome `prisma/seed.mjs` (au build du conteneur ; `pg` reste
  externe car présent dans le standalone). En prod, plus besoin de Bun.
- **`/api/health` inchangé** : il ne teste PAS la base. Le gating vient de
  l'**ordre de démarrage** (serveur lancé seulement après migrate+seed), pas d'un
  check DB (un hoquet DB transitoire ne doit pas tuer un conteneur sain).

## Vérification en local (sans toucher la prod)

L'agent/le VPS ne sont pas requis : on construit l'étage `production` et on le
lance contre un Postgres jetable.

### 0. Construire l'image de production

```bash
cd apps/web
# --network=host : next/font récupère les polices Google au build.
docker build --network=host --target production \
  --build-arg NEXT_PUBLIC_SITE_URL=https://portfolio.doshwork.com \
  -t portfolio-web:test .
```

### 1. Postgres jetable VIDE + réseau

```bash
docker network create pf-test
docker run -d --name pf-test-db --network pf-test \
  -e POSTGRES_USER=portfolio -e POSTGRES_PASSWORD=portfolio \
  -e POSTGRES_DB=portfolio_test postgres:16-alpine
# attendre pg_isready
```

### 2. AC1 — migrate → seed → serveur

```bash
docker run -d --name pf-test-web --network pf-test \
  -e DATABASE_URL="postgresql://portfolio:portfolio@pf-test-db:5432/portfolio_test?schema=public" \
  -p 3010:3000 portfolio-web:test

docker logs -f pf-test-web   # observer la séquence
```

**Attendu :**
```
[entrypoint] 1/3 — Application des migrations (prisma migrate deploy)…
Applying migration `…_init_projects`  (+ les suivantes)
All migrations have been successfully applied.
[entrypoint] 2/3 — Seed idempotent…
Seed OK — Project: 6, Highlight: 18, Stack: 7, TimelineEntry: 5, Hobby: 7, SiteSetting: 9
[entrypoint] 3/3 — Démarrage du serveur Next (node server.js)…
✓ Ready in …
```
Puis `curl http://localhost:3010/api/health` → `200`, et la page d'accueil sert le
contenu réel (issu de la base fraîchement seedée).

### 3. AC2 — échec de migration = démarrage interrompu, healthcheck rouge

Pointer le conteneur vers une base injoignable :

```bash
docker run -d --name pf-test-fail --network pf-test \
  -e DATABASE_URL="postgresql://portfolio:portfolio@hote-injoignable:5432/portfolio_test?schema=public" \
  -p 3011:3000 portfolio-web:test
```

**Attendu :**
- Log : `Error: P1001: Can't reach database server at ...` (message explicite,
  sans identifiants).
- `docker ps -a` → conteneur **`Exited (1)`**.
- `curl http://localhost:3011/api/health` → **aucune réponse** (`000` : personne
  n'écoute) → le healthcheck ne passe jamais au vert.

### 4. AC3 — rejouabilité sans effet de bord

```bash
for n in 1 2 3; do docker restart pf-test-web; sleep 5; done
# compter les lignes
docker exec pf-test-db psql -U portfolio -d portfolio_test \
  -tAc 'SELECT count(*) FROM "Project";'      # attendu : 6, stable
docker exec pf-test-db psql -U portfolio -d portfolio_test \
  -tAc 'SELECT count(*) FROM "_prisma_migrations";'  # attendu : 3, stable
```

**Attendu :** comptes **identiques** après chaque redémarrage. `migrate deploy`
devient un no-op (`No pending migrations`), le seed re-`upsert` sans créer de
doublon (clés naturelles `slug`/`name`/`key`, highlights remplacés).

### 5. Nettoyage

```bash
docker rm -f pf-test-web pf-test-fail pf-test-db
docker network rm pf-test
docker rmi portfolio-web:test
```

## Notes d'exploitation

- **`start_period` du healthcheck** (`docker-compose.prod.yml`, `30s`) : les
  migrations du portfolio sont courtes (~1–2 s en local). Si un jour une migration
  devenait longue, augmenter `start_period` pour couvrir le temps de migration.
- **Mono-conteneur** : un seul service `web` → pas de course entre plusieurs
  entrypoints lançant migrate/seed en parallèle. (`migrate deploy` prend de toute
  façon un verrou d'avis côté Postgres.) Un verrou applicatif serait nécessaire
  seulement le jour où plusieurs réplicas démarreraient ensemble — hors périmètre
  aujourd'hui.
- **Déploiement Coolify** : déclenché par Jeevons (`git push` → rebuild). Après
  cette story, migrations + seed sont automatiques au démarrage : plus besoin de
  se connecter au VPS pour lancer une migration à la main.
