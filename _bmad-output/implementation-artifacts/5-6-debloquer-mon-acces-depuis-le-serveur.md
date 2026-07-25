---
baseline_commit: 5c22f3a6c48914801d0a226ab5a0b15c005d8765
---

# Story 5.6: Débloquer mon accès depuis le serveur

Status: review

## Story

As **Jeevons**,
I want **une commande de secours exécutable sur le VPS**,
so that **je ne sois jamais réduit à modifier ma base de production à la main**.

## Acceptance Criteria

**AC1 — Commande qui désactive le 2FA + force un ré-enrôlement**
**Given** j'ai perdu à la fois mon téléphone et mes codes de récupération
**When** j'exécute la commande de réinitialisation du second facteur dans le conteneur
**Then** le second facteur de mon compte est désactivé et son secret effacé
**And** ma connexion suivante me redirige de force vers un nouvel enrôlement

**AC2 — Confirmation explicite + traçabilité**
**Given** cette commande contourne une protection de sécurité
**When** elle s'exécute
**Then** elle exige une confirmation explicite et ne peut pas se déclencher par accident
**And** son exécution est tracée

**AC3 — Runbook pas à pas**
**Given** cette procédure ne servira que dans un moment de panique
**When** je consulte la documentation d'exploitation
**Then** la marche à suivre est écrite pas à pas, avec la commande exacte à lancer sur le VPS

## Contexte d'implémentation

### 🛑 Prérequis : stories 5.1-5.5 `done` — DERNIÈRE brique du socle sécurité

5.5 a livré le login 2FA complet. 5.6 est le **filet de dernier recours** : si Jeevons perd téléphone **et** codes, une commande dans le conteneur réinitialise le 2FA — sans SQL manuel en prod. Après 5.6, le socle sécurité (5.1-5.6) est **complet** → les écrans de gestion (5.7+) peuvent commencer. PLAN §9.3 (`bun run admin:reset-2fa`, `docs/ops/`).

### 🎯 Ce que fait vraiment cette story

Un **script CLI de secours** exécutable dans le conteneur de prod (`bun run admin:reset-2fa` — PLAN §9.3) qui : (1) efface `totpSecret`, remet `totpEnabledAt = null`, vide `recoveryCodes` du compte → au login suivant, **ré-enrôlement forcé** (via le guard de 5.3, AC1) ; (2) exige une **confirmation explicite** (pas d'exécution accidentelle) et **trace** l'opération (AC2) ; (3) est documenté **pas à pas** dans un runbook `docs/ops/` (AC3).

### ⚠️ Piège n°1 (CENTRAL) — Exécutable dans l'étage `production` SANS Bun [[prisma7-setup-gotchas]]

- 🛑 Rappel story 4.6 : l'étage `production` du Dockerfile lance `node server.js` **sans Bun**, `node_modules` minimal (standalone). PLAN §9.3 nomme `bun run admin:reset-2fa`, mais **Bun n'est pas dans l'image de prod**. Le script doit tourner avec ce qui **existe dans le conteneur** :
  - Réutiliser l'infra de 4.6 : le seed prod est bundlé en `seed.mjs` (node ESM) et un toolchain Prisma est copié (étage `migrator`). Le script de reset peut être **bundlé de la même façon** (`admin-reset-2fa.mjs`) et lancé par `node`, ou réutiliser la CLI Prisma via `prisma db execute`/script.
  - 👉 Concrètement : ajouter un script (ex. `apps/web/scripts/admin-reset-2fa.ts`) + une entrée de bundling (comme `build:seed`) produisant un `.mjs` node-exécutable, copié dans l'image. La commande **réelle** sur le VPS sera `docker exec … node …/admin-reset-2fa.mjs` (documenter la commande exacte, AC3). 🛑 **Trancher la forme finale avec Jeevons** (script bundlé node vs. commande Prisma), car « Bun dans le conteneur » n'est pas disponible.
- Accès DB : via `DATABASE_URL` de l'environnement du conteneur (adapter-pg), même chemin que le seed prod. Cibler le compte par `ADMIN_EMAIL` (ou argument).

### ⚠️ Piège n°2 — Confirmation explicite, anti-déclenchement accidentel (AC2)

- La commande **contourne une protection** : exiger une confirmation non ambiguë — soit une **saisie interactive** (`êtes-vous sûr ? tapez l'e-mail`), soit un **flag explicite** (`--confirm` / variable). ❌ Ne jamais réinitialiser sur simple exécution sans confirmation (AC2 « ne peut pas se déclencher par accident »).
- ⚠️ En `docker exec`, l'interactivité TTY peut manquer : prévoir le **flag explicite** comme voie sûre, documentée.

### ⚠️ Piège n°3 — Traçabilité (AC2) — attention à l'ordre avec 5.19

- L'exécution est **tracée** (AC2). Le modèle `AuditLog` est créé en **5.19** (plus tard dans l'epic). ⚠️ Deux options :
  - **(a)** Tracer via un **log serveur explicite** (stdout du conteneur, horodaté, sans secret) — suffisant pour AC2 et indépendant de 5.19.
  - **(b)** Écrire dans `AuditLog` — mais le modèle n'existe pas encore (ordre des stories).
  - 👉 Recommandation : **(a)** log serveur horodaté (« [admin:reset-2fa] 2FA réinitialisé pour <email> le <date> »), **jamais** le secret ni un code. Noter en Completion Notes qu'un enregistrement AuditLog pourra s'ajouter quand 5.19 sera fait (ne pas créer `AuditLog` ici — hors périmètre, anti-scope-creep).

### ⚠️ Piège n°4 — Réutiliser le guard de ré-enrôlement (AC1)

- Après reset (`totpEnabledAt=null`), le **guard de 5.3** redirige déjà de force vers l'enrôlement au login suivant (AC1). ❌ Ne rien réimplémenter côté web : le script ne touche que la base ; le comportement de ré-enrôlement est **déjà** garanti par 5.3.

### ⚠️ Piège n°5 — Runbook `docs/ops/` pas à pas, sans secret (AC3)

- Cohérent avec le style runbook des stories d'exploitation (ex. `docs/runbook-4-6-…`). Écrire dans `docs/ops/` (PLAN §9.3) : contexte (« téléphone ET codes perdus »), **commande exacte** à lancer sur le VPS (`docker exec <conteneur> node <chemin>/admin-reset-2fa.mjs --confirm …`), effet attendu, et la marche à suivre après (se reconnecter → ré-enrôler). ❌ **Aucun secret** dans le runbook (ni `DATABASE_URL`, ni mot de passe).

### ⚠️ Piège n°6 — Vérification locale (pas de VPS)

- 🛑 L'agent n'a pas accès au VPS (comme 4.6/2.6). Vérifier **en local** : lancer le script contre la DB `docker-compose` sur un compte 2FA activé → `totpSecret` effacé, `totpEnabledAt=null`, `recoveryCodes` vidés. Se reconnecter → **ré-enrôlement forcé** (AC1). Vérifier que sans confirmation, le script **refuse** d'agir (AC2). ❌ Ne pas exécuter sur la prod (déclenché par Jeevons).

## Tasks / Subtasks

- [x] **Tâche 0 — Prérequis** (AC: 1)
  - [x] 5.1-5.5 `done`. Comprendre l'exécution node-sans-Bun en prod (4.6).
- [x] **Tâche 1 — Script de reset** (AC: 1 ; pièges n°1, 4)
  - [x] Script (`scripts/admin-reset-2fa.ts`) : efface `totpSecret`, `totpEnabledAt=null`, vide `recoveryCodes` pour `ADMIN_EMAIL`/argument. Bundle node (`.mjs`) copié dans l'image. 🛑 Trancher forme finale avec Jeevons.
    - ✅ **Décision Jeevons** : bundle `.mjs` (même infra que le seed 4.6) + **argument e-mail obligatoire valant confirmation** (pas `ADMIN_EMAIL`).
    - ✅ `totpLastCounter` remis à `null` en plus des 3 champs prévus (sinon le compteur anti-rejeu de 5.5 fausserait la validation du nouvel enrôlement).
- [x] **Tâche 2 — Confirmation + traçabilité** (AC: 2 ; pièges n°2, 3)
  - [x] Confirmation explicite (flag `--confirm` sûr en `docker exec`). Log serveur horodaté sans secret (AuditLog reporté à 5.19).
- [x] **Tâche 3 — Runbook `docs/ops/`** (AC: 3 ; piège n°5)
  - [x] Procédure pas à pas + commande exacte VPS + suite (ré-enrôlement). Sans secret.
- [x] **Tâche 4 — Vérification locale** (AC: 1, 2 ; piège n°6)
  - [x] Reset local → champs effacés → ré-enrôlement forcé au login. Sans `--confirm` → refus. Pas de secret loggé.
  - [x] Vérifié **en plus** dans l'étage `production` réel (conteneur sans Bun, Postgres jetable) : la commande exacte du runbook fonctionne de bout en bout.
- [x] **Tâche 5 — Definition of Done** (AGENTS.md §8)
  - [x] lint 0 / tsc 0 / build OK (+ bundle script si applicable). `git diff DEV` : script + bundling + copie image + runbook — rien d'autre.
  - [x] `File List` + `Completion Notes` + `Change Log` · `sprint-status.yaml`.

## Dev Notes

### Périmètre — verrouillé

**Script de secours (node-exécutable en prod) qui désactive le 2FA et force un ré-enrôlement, protégé par une confirmation explicite, tracé (log serveur), documenté pas à pas dans `docs/ops/`.**

**Hors périmètre — ne pas faire :**
- ❌ **Créer le modèle `AuditLog`** → 5.19 (traçabilité ici = log serveur).
- ❌ **Réimplémenter le ré-enrôlement web** (déjà garanti par le guard de 5.3).
- ❌ **Exécuter sur la prod / toucher le VPS** → déclenché par Jeevons.
- ❌ **Ajouter Bun à l'image de prod** (contrainte 4.6 : node-only).
- ❌ **Écran admin de reset** (c'est un secours **serveur**, hors interface).

### Le vrai enjeu

Sans ce filet, « téléphone + codes perdus » = admin définitivement mort, seule issue `docker exec` + SQL manuel sur la prod (PLAN §9.3). Le vrai piège technique est l'**exécution sans Bun** dans l'étage production (4.6) : la commande doit tourner avec node/toolchain déjà présents. Confirmation explicite + trace = une opération de contournement qui ne se déclenche jamais par accident et laisse une trace. **Cette story clôt le socle sécurité (5.1-5.6)** : les écrans de gestion peuvent démarrer.

### Testing standards

Vérification **manuelle en local** (DB `docker-compose`) : reset → ré-enrôlement forcé (AC1), refus sans confirmation (AC2), aucun secret loggé. Runbook relu (AC3). tsc/lint/build verts. ❌ Pas de prod.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.6]
- [Source: PLAN_REFONTE_2026.md §9.3 — script de secours `admin:reset-2fa`, documenté dans `docs/ops/`]
- [Source: _bmad-output/implementation-artifacts/4-6-appliquer-les-migrations-automatiquement-au-deploiement.md — étage production node sans Bun, bundling `.mjs` (build:seed), toolchain Prisma copié, style runbook `docs/`]
- [Source: _bmad-output/implementation-artifacts/5-3-activer-la-double-authentification-a-ma-premiere-connexion.md — guard ré-enrôlement (`totpEnabledAt=null`)]
- [Source: memory prisma7-setup-gotchas — DATABASE_URL runtime via adapter-pg, `generate` avant usage]
- [Source: AGENTS.md §5 — socle sécurité avant écrans ; §6 — secrets par env ; §9 — anti-scope-creep]

## Dev Agent Record

### Decisions

Deux arbitrages tranchés avec Jeevons avant l'implémentation (piège n°1 : PLAN §9.3 nomme `bun run admin:reset-2fa`, mais **Bun n'existe pas dans l'étage `production`**) :

1. **Forme du script → bundle `.mjs` exécuté par `node`**, exactement l'infra du seed de 4.6 (`bun build --target node --format esm --external pg`), plutôt qu'un `prisma db execute` sur un fichier SQL. Le SQL pur ne permettait ni la confirmation explicite ni la trace horodatée demandées par AC2, et rendait le ciblage par e-mail malcommode. La commande réelle sur le VPS est donc `docker exec <conteneur> node scripts/admin-reset-2fa.mjs --confirm <email>`.
2. **Confirmation → argument e-mail obligatoire** (`--confirm <email>`) plutôt que `ADMIN_EMAIL` de l'environnement + un simple flag. Une seule saisie porte alors **deux** garde-fous : impossible de déclencher par accident, et impossible de réinitialiser le mauvais compte sans le savoir. Aucune interactivité TTY (indisponible en `docker exec`).

Un troisième choix a été fait en cours d'implémentation : **`totpLastCounter` est aussi remis à `null`**, en plus des trois champs prévus par la story. Le laisser conserverait le compteur anti-rejeu de 5.5 (ex. 12345) face à un secret tout neuf, ce qui aurait faussé la validation des premiers codes du nouvel enrôlement.

### Points d'attention

- **Rien réimplémenté côté web** (piège n°4). Le script ne touche QUE la base ; le ré-enrôlement forcé est assuré par le guard existant de 5.3 (`apps/web/src/app/(admin)/admin/layout.tsx:85`). Vérifié de bout en bout, pas seulement déduit.
- **`Prisma.DbNull`, pas `null`.** `recoveryCodes` est une colonne `Json?` : Prisma distingue le NULL SQL du `null` JSON et **refuse un `null` nu** (erreur TS2322, détectée par `tsc`). `Prisma.DbNull` écrit un vrai NULL SQL — l'état exact d'un compte fraîchement seedé, que `parseStoredRecoveryCodes` (5.4) lit déjà comme « aucun code ». Vérifié en base : la colonne est bien `IS NULL`, pas la chaîne `null`.
- **Traçabilité : un `docker exec` n'alimente PAS `docker logs`.** Piège découvert en vérifiant le runbook : la sortie d'un `exec` va dans le flux de sa propre session, pas dans le log du conteneur. Une trace qui disparaît avec le terminal est une trace faible pour AC2 — d'autant qu'on est par définition dans un moment de panique. Le script écrit donc **aussi** sur la sortie du processus 1 (`/proc/1/fd/1`), ce qui rend la trace visible dans `docker logs` et durable. L'écriture est tolérante à l'échec : hors conteneur (exécution locale via Bun), elle est ignorée silencieusement — une réinitialisation ne doit jamais échouer pour un problème de log.
- **Les refus sont tracés aussi**, pas seulement les succès : une tentative avortée est une information d'exploitation.
- **Aucun secret manipulé.** Le script efface le secret TOTP, il ne le déchiffre jamais → il n'a pas besoin d'`AUTH_SECRET`. Aucun secret n'est loggué (vérifié par recherche active de fuites dans la sortie).
- **`AuditLog` non créé** (piège n°3, anti-scope-creep) : le modèle appartient à la story 5.19. La trace est volontairement un log conteneur.
- **Le bundle `.mjs` est exclu d'ESLint.** Sans cela, `bun run lint` tentait d'analyser 5,3 Mo de code généré (avertissement Babel « deoptimised »). Même traitement que `prisma/seed.mjs` (4.6).

### Debug Log

Vérification en local uniquement — **aucune action sur la production** (piège n°6). Aucun secret n'a été lu depuis `.env` ni affiché : les identifiants ont été chargés dans l'environnement du shell (`set -a; . ./.env`) puis consommés par les commandes sans jamais être imprimés.

La vérification s'est faite en **deux étages**, le second étant le seul qui prouve l'AC :

1. **Sur l'hôte (Bun + Postgres du `docker-compose`)** : refus, succès, état en base, connexion réelle au flux Auth.js (`/api/auth/csrf` → `callback/credentials`) pour observer la redirection forcée avec une vraie session.
2. **Dans l'étage `production` réel** : image construite (`--target production`), lancée contre un Postgres jetable, et **absence de Bun confirmée** (`command -v bun` → absent) avant de lancer la commande exacte du runbook. C'est cet étage qui valide le piège n°1 ; le tester seulement sur l'hôte (où Bun existe) n'aurait rien prouvé.

Deux défauts trouvés et corrigés grâce à ces vérifications :

1. **`recoveryCodes: null` rejeté par Prisma** (TS2322). Mes premiers essais passaient malgré tout car Bun n'effectue aucun contrôle de types à l'exécution : ils écrivaient un `null` JSON au lieu d'un NULL SQL. Corrigé via `Prisma.DbNull`, puis re-vérifié en distinguant explicitement les deux en SQL.
2. **Runbook faux à l'étape 5.** J'avais écrit « vérifiez avec `docker logs | grep` » — or la trace n'y apparaissait pas (voir Points d'attention). Corrigé dans le code (écriture vers PID 1) plutôt qu'en abaissant le runbook, puis re-vérifié après reconstruction de l'image : les deux lignes (refus + succès) apparaissent bien dans `docker logs`.

Ressources de test intégralement supprimées (conteneurs `pf56-*`, réseau, image `portfolio-web:5-6-test`, cookies de session du scratchpad).

⚠️ **Effet de bord sur la base de DEV** : le compte admin local a sa 2FA réinitialisée (état légitime — la prochaine connexion à `/admin` proposera simplement un nouvel enrôlement).

### Completion Notes

**11/11 vérifications au vert**, dont 6 dans le conteneur de production réel :

| AC | Vérification | Où | Résultat |
|----|--------------|-----|----------|
| AC1 | `totpSecret`, `totpEnabledAt`, `totpLastCounter`, `recoveryCodes` effacés | hôte + prod | ✅ NULL SQL réel |
| AC1 | Session authentifiée → redirection forcée vers l'enrôlement | hôte | ✅ 307 → `/admin/settings/security` |
| AC1 | Écran d'enrôlement joignable et en mode « Activer la double authentification » | hôte | ✅ 200 |
| AC2 | Sans `--confirm` → refus, `exit 1`, **zéro écriture** | hôte + prod | ✅ état inchangé |
| AC2 | `--confirm` suivi d'un flag (`--force`) → refus | hôte | ✅ non interprété comme e-mail |
| AC2 | E-mail inconnu → refus, `exit 1`, zéro écriture | hôte + prod | ✅ |
| AC2 | Trace horodatée visible dans `docker logs` (refus **et** succès) | prod | ✅ |
| AC2 | Aucun secret dans la sortie (recherche active de fuites) | prod | ✅ |
| AC3 | Commande exacte du runbook exécutée telle quelle | prod | ✅ |
| — | Bun réellement absent de l'image de production | prod | ✅ `bun ABSENT` |
| — | Bundle `.mjs` exécutable par `node` nu (v26) | hôte + prod | ✅ |

**Portes de qualité :** `bunx tsc --noEmit` → 0 erreur · `bun run lint` → 0 erreur (1 avertissement **préexistant** dans `TestimonialsClient.tsx`, fichier non touché par cette story — introduit en 4.2) · `bun run build` → succès · `docker build --target production` → succès · `git diff DEV` relu : script + bundling + copie image + runbook, rien d'autre.

**Zéro dépendance ajoutée** : `@prisma/adapter-pg` et le client Prisma étaient déjà présents (Epic 4) ; `node:fs` est natif.

**Reporté à 5.19 (assumé)** : enregistrer cette opération dans `AuditLog` en plus du log conteneur, quand le modèle existera. La trace actuelle reste soumise à la rotation des logs Docker.

**Socle sécurité 5.1-5.6 complet** → les écrans de gestion (5.7+) peuvent démarrer.

### File List

**Créés**
- `apps/web/scripts/admin-reset-2fa.ts` — script de secours : réinitialise le second facteur, confirmation explicite par e-mail, trace horodatée (stdout + log conteneur)
- `docs/ops/runbook-5-6-reset-2fa-secours.md` — runbook pas à pas (nouveau dossier `docs/ops/`, PLAN §9.3) : quand l'utiliser, commande VPS exacte, table des refus, marche à suivre après le reset

**Modifiés**
- `apps/web/package.json` — scripts `build:reset-2fa` (bundle node) et `admin:reset-2fa` (usage local)
- `apps/web/Dockerfile` — bundling du script à l'étage `builder` + copie dans l'étage `production`, à côté de `server.js`
- `apps/web/.gitignore` — ignore l'artefact généré `scripts/admin-reset-2fa.mjs`
- `apps/web/eslint.config.mjs` — exclut ce même bundle de l'analyse ESLint

> Non versionné : `apps/web/scripts/admin-reset-2fa.mjs` (généré par `bun run build:reset-2fa` au build du conteneur).

### Change Log

| Date | Version | Description |
|------|---------|-------------|
| 2026-07-25 | 1.0 | Story 5.6 implémentée : commande de secours `admin-reset-2fa` exécutable par `node` dans l'étage production (sans Bun), confirmation explicite par e-mail obligatoire, trace horodatée visible dans `docker logs`, runbook `docs/ops/`. 11/11 vérifications au vert dont 6 dans le conteneur de production réel. Clôt le socle sécurité 5.1-5.6. |
