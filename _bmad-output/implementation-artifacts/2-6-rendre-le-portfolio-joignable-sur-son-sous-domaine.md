---
baseline_commit: 43e1e458b22cdbaaab761e933ce4021bd15301ad
---

# Story 2.6: Rendre le portfolio joignable sur son sous-domaine

Status: ready-for-dev

## Story

As a **recruteur**,
I want **atteindre le portfolio via une adresse web publique et sécurisée**,
so that **je puisse le consulter en confiance depuis n'importe quel navigateur**.

## 🛑 Story d'exploitation — mise en production réelle

Aucun code applicatif n'est produit. Cette story met le site **en ligne**, sur le VPS où **Doshwork tourne en production**.

- 🛑 **L'agent n'a pas accès au VPS, ni au registrar, ni à Coolify.** Ces étapes sont exécutées **par Jeevons**. Le rôle de l'agent : préparer chaque geste, en donner l'ordre exact, fournir les commandes de vérification et en interpréter les résultats.
- 🛑 **Le point de non-retour est l'ordre des opérations.** Poser le FQDN dans Coolify **avant** que le DNS ne réponde déclenche un échec Let's Encrypt. Au-delà de **5 échecs par heure**, Traefik entre en back-off : il faut alors **attendre une heure**, sans aucun moyen d'accélérer.
- 🛑 **Le portfolio doit être une application Coolify DISTINCTE.** Ne jamais éditer une ressource `doshwork-api` / `doshwork-web` (AGENTS.md §2). L'unique symptôme listé au plan §8.5 sous le nom « Doshwork tombe » vient précisément de là.

## Acceptance Criteria

**AC1 — DNS d'abord, et vérifié**
**Given** le domaine `doshwork.com` est déjà géré chez le registrar
**When** je crée l'enregistrement DNS
**Then** un enregistrement **`A`** fait pointer **`portfolio`** vers l'IP du VPS, avec un **TTL de 300 secondes**
**And** **`dig +short portfolio.doshwork.com A` renvoie cette IP avant toute étape suivante**

**AC2 — Coolify seulement après propagation**
**Given** Let's Encrypt limite les tentatives infructueuses à **cinq par heure**
**When** je configure le domaine dans Coolify
**Then** je ne le fais **qu'après confirmation de la propagation DNS**, afin d'éviter une mise en attente forcée

**AC3 — Le site répond en HTTPS avec un certificat valide**
**Given** le domaine est configuré sur le service `web`
**When** je visite `https://portfolio.doshwork.com`
**Then** le **portfolio s'affiche**
**And** `curl` sur **`/api/health` renvoie 200**
**And** le **certificat TLS est émis pour ce nom exact** et valide **environ 90 jours**

**AC4 — Redirection HTTP → HTTPS**
**Given** une requête arrive en HTTP simple
**When** elle atteint le proxy
**Then** elle est **redirigée vers HTTPS**

**AC5 — Doshwork intact**
**Given** Doshwork tourne en production sur la même IP
**When** j'ai terminé la configuration
**Then** **`doshwork.com` et `api.doshwork.com` répondent toujours normalement**
**And** le portfolio a été créé comme **application Coolify distincte**, **sans modification d'aucune ressource Doshwork existante**

**AC6 — `NEXT_PUBLIC_SITE_URL` fournie au build**
**Given** l'adresse publique est désormais connue
**When** je vérifie la configuration de l'application
**Then** **`NEXT_PUBLIC_SITE_URL` vaut `https://portfolio.doshwork.com`** et a été **fournie au moment de la construction de l'image**

## Contexte d'implémentation

### 🛑 Prérequis — toutes les stories précédentes de l'Epic 2

| Story | Fournit | Sans quoi |
|---|---|---|
| 2.1 | `/api/health` | Le healthcheck échoue → redémarrage en boucle |
| 2.2 | Dockerfile étage `production` | Rien à construire |
| 2.4 | `portfolio_prod` + `DATABASE_URL` | Secret manquant (tolérable aujourd'hui : le code ne lit pas encore la base) |
| 2.5 | `docker-compose.prod.yml` | Coolify n'a pas de descripteur |

### Ordre des opérations — non négociable

```
1. DNS chez le registrar  →  2. dig confirme  →  3. Coolify (app + secrets + deploy)
                                                 →  4. FQDN + Force HTTPS  →  5. Redeploy  →  6. Vérifs
```
🛑 **L'étape 4 ne commence jamais avant que l'étape 2 ne réponde l'IP du VPS.** C'est l'objet même des AC1 et AC2.

### Étape 1 — DNS (chez le registrar, PLAN §8.2)

| Type | Nom / Host | Valeur | TTL |
|------|-----------|--------|-----|
| `A` | `portfolio` | `89.167.90.7` | `300` |

💡 Le champ « Nom » attend en général **`portfolio`** seul — le registrar complète avec le domaine. En cas de doute : **copier exactement le format de la ligne `api` existante**.
💡 TTL à **300 s** pour pouvoir corriger vite ; il repassera à 3600 s en story **2.7**.

### Étape 2 — Vérifier la propagation (AC1) — 🛑 barrière

```bash
dig +short portfolio.doshwork.com A     # doit renvoyer 89.167.90.7
dig +short api.doshwork.com A           # référence : même IP
```
Compter **5 à 30 minutes**. Tant que la première commande ne renvoie pas l'IP, **ne pas passer à l'étape suivante**.

⚠️ **Piège du cache DNS local** : un résolveur peut renvoyer une réponse mise en cache. Confirmer avec un résolveur public :
```bash
dig +short @1.1.1.1 portfolio.doshwork.com A
dig +short @8.8.8.8 portfolio.doshwork.com A
```
👉 Ne franchir la barrière que si **les trois** répondent l'IP du VPS.

### Étape 3 — Application Coolify (PLAN §5.4, §8.3)

1. **Nouvelle application** de type **Docker Compose**, dans le projet Coolify — 🛑 **jamais en éditant une ressource Doshwork** (AC5).
2. Source : **GitHub App déjà installée**. Branche : ⚠️ le plan dit **`PROD`**, mais le renommage `Production` → `PROD` est la story **3.5**, pas encore faite. 👉 **Utiliser `Production`** (branche actuelle) et **le noter comme dette** pour la story 3.5. Confirmer avec Jeevons quelle branche déployer.
3. Fichier de composition : **`docker-compose.prod.yml`**.
4. **Secrets** : renseigner en s'appuyant sur `.env.production.example` (story 2.5) comme checklist.
   - 🛑 **`NEXT_PUBLIC_SITE_URL=https://portfolio.doshwork.com`** doit être disponible **au build** (AC6) — voir le piège ci-dessous.
   - `DATABASE_URL` : valeur préparée en story 2.4, avec **`?schema=public`**.
5. **Premier déploiement** *sans domaine* : vérifier que le conteneur devient **healthy** avant d'ajouter le FQDN. Cela isole un éventuel problème de build d'un problème TLS.

### ⚠️ Piège n°1 — `NEXT_PUBLIC_SITE_URL` doit être un secret **de build** (AC6)

Coolify distingue les variables **runtime** des **build args**. Renseignée en simple variable runtime, elle **n'atteint jamais le `next build`** : le bundle garde la valeur de repli codée en story 1.10.

👉 Dans Coolify, cocher **« Build Variable »** / « Available at build time » sur cette variable. Le compose la câble déjà en `build.args` (story 2.5), mais Coolify doit encore accepter de la transmettre.

💡 **Bonne nouvelle** : la story 1.10 a codé `https://portfolio.doshwork.com` en **valeur de repli**. Même mal transmise, le site sera correct. 🛑 **Mais l'AC6 exige de vérifier qu'elle a bien été fournie au build** — ne pas se contenter du repli. La vérification est en tâche 6.

### Étape 4 — Domaine et TLS (AC3, AC4)

Sur le service **`web`** (port interne 3000) → section **Domains / FQDN** :
- Saisir **`https://portfolio.doshwork.com`** — **avec le `https://`**, Coolify s'en sert pour configurer Traefik.
- Activer **Force HTTPS** (AC4).
- **Save**, puis **Redeploy** — c'est le redéploiement qui déclenche l'émission du certificat.

### Étape 5 — Vérifications (PLAN §8.4)

```bash
# AC3 — le site et le healthcheck
curl -sS -o /dev/null -w "%{http_code}\n" https://portfolio.doshwork.com
curl -sS -o /dev/null -w "%{http_code}\n" https://portfolio.doshwork.com/api/health

# AC3 — certificat émis pour le bon nom, ~90 jours
echo | openssl s_client -connect portfolio.doshwork.com:443 -servername portfolio.doshwork.com 2>/dev/null \
  | openssl x509 -noout -dates -subject

# AC4 — redirection HTTP → HTTPS
curl -sSI http://portfolio.doshwork.com | head -1     # attendu : 301 ou 308

# AC5 — Doshwork intact
curl -sS -o /dev/null -w "%{http_code}\n" https://doshwork.com
curl -sS -o /dev/null -w "%{http_code}\n" https://api.doshwork.com
```

### Diagnostic (PLAN §8.5)

| Symptôme | Cause probable | Action |
|---|---|---|
| `dig` ne renvoie rien | DNS non propagé ou nom mal saisi | Attendre ; vérifier le format du champ « Nom » |
| Erreur de certificat | FQDN posé **avant** que le DNS ne pointe | Corriger le DNS, attendre, **Redeploy**. En back-off Let's Encrypt : **patienter une heure** |
| `404` Traefik | FQDN sur le mauvais service, ou pas de redeploy après Save | Vérifier que le FQDN est sur `web`, redéployer |
| `502 Bad Gateway` | Conteneur démarré mais pas healthy | `docker ps` sur le VPS ; tester `/api/health` en interne ; vérifier `HOSTNAME=0.0.0.0` (story 2.2) |
| **Doshwork tombe** | Édition du FQDN d'un service Doshwork au lieu d'une nouvelle app | **Rollback Coolify immédiat** sur l'app Doshwork |

## Tasks / Subtasks

- [ ] **Tâche 0 — Préparation** — 🛑 **BLOQUANT**
  - [ ] Confirmer que les stories 2.1, 2.2, 2.4 et 2.5 sont terminées.
  - [ ] Confirmer avec Jeevons que **lui seul** opère registrar / Coolify / VPS.
  - [ ] Trancher la **branche à déployer** : `Production` (actuelle) — le renommage en `PROD` est la story 3.5.
  - [ ] Relire ensemble l'ordre des opérations et **la barrière DNS** (AC2).
- [ ] **Tâche 1 — Créer l'enregistrement DNS** (AC: 1)
  - [ ] Chez le registrar : `A` / `portfolio` → `89.167.90.7` / TTL **300**.
  - [ ] ❌ Ne modifier **aucun** enregistrement existant (`@`, `api`, MX…).
- [ ] **Tâche 2 — Attendre et vérifier la propagation** (AC: 1, 2) — 🛑 **BARRIÈRE**
  - [ ] `dig +short portfolio.doshwork.com A` → IP du VPS.
  - [ ] Confirmer via `@1.1.1.1` **et** `@8.8.8.8` (piège du cache local).
  - [ ] `dig +short api.doshwork.com A` → même IP (référence).
  - [ ] 🛑 **Ne pas poursuivre** tant que ces commandes ne concordent pas.
- [ ] **Tâche 3 — Créer l'application Coolify** (AC: 5)
  - [ ] **Nouvelle** application Docker Compose — ❌ **jamais** en éditant `doshwork-api` / `doshwork-web`.
  - [ ] Source GitHub, branche retenue en tâche 0, fichier `docker-compose.prod.yml`.
  - [ ] Renseigner les Secrets depuis `.env.production.example`.
  - [ ] `NEXT_PUBLIC_SITE_URL=https://portfolio.doshwork.com` marquée **« disponible au build »** (piège n°1, AC6).
- [ ] **Tâche 4 — Premier déploiement, sans domaine** (AC: 3)
  - [ ] Lancer le déploiement → **build réussi**.
  - [ ] Le conteneur `portfolio_web` atteint l'état **healthy** (le healthcheck de la story 2.5 interroge `/api/health`).
  - [ ] ⚠️ S'il reste `unhealthy` : diagnostiquer **avant** de poser le domaine — un problème d'application se corrige sans consommer de quota Let's Encrypt.
- [ ] **Tâche 5 — Poser le domaine et le TLS** (AC: 3, 4)
  - [ ] FQDN `https://portfolio.doshwork.com` sur le service **`web`**, **Force HTTPS** activé.
  - [ ] **Save** puis **Redeploy** (c'est le redeploy qui émet le certificat).
- [ ] **Tâche 6 — Vérifier la mise en ligne** (AC: 3, 4, 6)
  - [ ] `curl` sur la racine → **200**. `curl` sur `/api/health` → **200** (AC3).
  - [ ] `openssl s_client` → `subject=CN=portfolio.doshwork.com`, expiration à **~90 jours** (AC3).
  - [ ] `curl -sSI http://portfolio.doshwork.com` → **301/308** vers HTTPS (AC4).
  - [ ] **Vérification navigateur** : le site s'affiche **avec images, CSS et polices**, cadenas présent, aucune alerte de contenu mixte.
  - [ ] Contrôler les acquis de l'Epic 1 : ancre `#projects`, Témoignages, liens externes, bouton « Visiter le site », favicon.
  - [ ] **AC6** : `curl -s https://portfolio.doshwork.com | grep -o 'https://portfolio.doshwork.com' | head` → l'URL apparaît dans les balises OG **servies**. Puis `curl -s https://portfolio.doshwork.com/robots.txt` et `/sitemap.xml` → ils portent bien ce domaine (preuve que la valeur a été inlinée au build).
- [ ] **Tâche 7 — Vérifier la non-régression Doshwork** (AC: 5) — 🛑 **critique**
  - [ ] `curl` sur `doshwork.com` et `api.doshwork.com` → réponses normales.
  - [ ] Dans Coolify : `doshwork-api` et `doshwork-web` toujours **healthy**, **aucune modification** dans leur historique de déploiement.
  - [ ] Vérifier en navigateur que le certificat de `doshwork.com` est **inchangé**.
- [ ] **Tâche 8 — Consigner**
  - [ ] Completion Notes : IP, TTL, horodatage de propagation, dates du certificat, résultats des vérifications AC3 à AC6.
  - [ ] ❌ **Aucun secret**, aucune `DATABASE_URL` complète, aucun mot de passe.
  - [ ] Noter la **dette branche `Production` → `PROD`** pour la story 3.5.
  - [ ] ⏱️ **Démarrer la fenêtre d'observation de 48 h** exigée par la story **2.7** : noter la date et l'heure exactes de mise en ligne.
  - [ ] `git status` propre (aucun fichier du dépôt modifié) · `sprint-status.yaml` mis à jour.

## Dev Notes

### Périmètre — verrouillé

**Aucun fichier de code créé ou modifié.** Seules la story (Completion Notes) et `sprint-status.yaml` évoluent.

**Hors périmètre — ne pas faire :**
- ❌ **Ne pas supprimer le projet Vercel**, ne pas retirer le DNS de secours → story **2.7**, après **48 h** de production stable.
- ❌ **Ne pas remonter le TTL à 3600 s** → story **2.7**.
- ❌ **Ne pas modifier le `Dockerfile` ni les composes** (stories 2.2, 2.3, 2.5). Si un correctif s'impose, **s'arrêter et signaler**.
- ❌ **Ne pas installer Umami** ni configurer `analytics.doshwork.com` → **Epic 7**.
- ❌ **Ne pas renommer les branches** `Production`/`develop` → story **3.5**.
- ❌ **Ne pas créer de `ci.yml`** → story **3.6**. Déploiement par **webhook Coolify natif**, jamais par GitHub Actions (PLAN §5.5).
- ❌ **Ne pas ajouter de second domaine** ni de redirection → **§8.6**, quand Jeevons achètera son domaine définitif.
- ❌ **Ne pas toucher au code applicatif** (`src/`).

### Pourquoi le DNS avant Coolify (AC1, AC2)

Traefik demande le certificat à Let's Encrypt par le challenge **HTTP-01** : Let's Encrypt appelle `http://portfolio.doshwork.com/.well-known/...`. Si le DNS ne pointe pas encore vers le VPS, l'appel n'arrive nulle part et le challenge échoue. **Cinq échecs par heure** suffisent à déclencher un back-off d'une heure — pendant laquelle rien ne peut être fait. D'où la barrière stricte de la tâche 2.

### Ce que cette story débloque

- Story **2.7** : la fenêtre de 48 h démarre à la fin de cette story.
- Story **1.10** : la validation des aperçus sociaux (LinkedIn Post Inspector, Twitter Card Validator), **reportée faute d'URL publique**, redevient possible. 💡 À signaler à Jeevons — ce n'est pas dans les AC de cette story, mais c'est le moment.

### Testing standards

Aucun test automatisé. Vérification par **`dig`** (propagation), **`curl`** (codes HTTP, redirection), **`openssl s_client`** (certificat), et **contrôle visuel navigateur**. L'AC5 se vérifie en interrogeant Doshwork **avant et après**.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.6]
- [Source: PLAN_REFONTE_2026.md §8.2 — enregistrement `A` `portfolio` → `89.167.90.7`, TTL 300]
- [Source: PLAN_REFONTE_2026.md §8.3 — FQDN avec `https://` sur le service `web`, Force HTTPS, Save puis Redeploy]
- [Source: PLAN_REFONTE_2026.md §8.4 — vérifications `curl` et `openssl s_client`, ~90 jours]
- [Source: PLAN_REFONTE_2026.md §8.5 — tableau de diagnostic, back-off Let's Encrypt 5 échecs/heure]
- [Source: PLAN_REFONTE_2026.md §8.6 — `NEXT_PUBLIC_SITE_URL` inlinée au build : rebuild obligatoire]
- [Source: PLAN_REFONTE_2026.md §5.4 — application Docker Compose Coolify, GitHub App, Secrets]
- [Source: AGENTS.md §2 — ne jamais poser un FQDN avant vérification DNS ; ne jamais toucher aux ressources Doshwork]
- [Source: docker-compose.prod.yml — story 2.5] · [Source: Dockerfile — story 2.2] · [Source: src/app/api/health/route.ts — story 2.1]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

### Change Log
