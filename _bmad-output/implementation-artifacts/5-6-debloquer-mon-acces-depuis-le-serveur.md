---
baseline_commit: 5c22f3a6c48914801d0a226ab5a0b15c005d8765
---

# Story 5.6: Débloquer mon accès depuis le serveur

Status: ready-for-dev

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

- [ ] **Tâche 0 — Prérequis** (AC: 1)
  - [ ] 5.1-5.5 `done`. Comprendre l'exécution node-sans-Bun en prod (4.6).
- [ ] **Tâche 1 — Script de reset** (AC: 1 ; pièges n°1, 4)
  - [ ] Script (`scripts/admin-reset-2fa.ts`) : efface `totpSecret`, `totpEnabledAt=null`, vide `recoveryCodes` pour `ADMIN_EMAIL`/argument. Bundle node (`.mjs`) copié dans l'image. 🛑 Trancher forme finale avec Jeevons.
- [ ] **Tâche 2 — Confirmation + traçabilité** (AC: 2 ; pièges n°2, 3)
  - [ ] Confirmation explicite (flag `--confirm` sûr en `docker exec`). Log serveur horodaté sans secret (AuditLog reporté à 5.19).
- [ ] **Tâche 3 — Runbook `docs/ops/`** (AC: 3 ; piège n°5)
  - [ ] Procédure pas à pas + commande exacte VPS + suite (ré-enrôlement). Sans secret.
- [ ] **Tâche 4 — Vérification locale** (AC: 1, 2 ; piège n°6)
  - [ ] Reset local → champs effacés → ré-enrôlement forcé au login. Sans `--confirm` → refus. Pas de secret loggé.
- [ ] **Tâche 5 — Definition of Done** (AGENTS.md §8)
  - [ ] lint 0 / tsc 0 / build OK (+ bundle script si applicable). `git diff DEV` : script + bundling + copie image + runbook — rien d'autre.
  - [ ] `File List` + `Completion Notes` + `Change Log` · `sprint-status.yaml`.

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
