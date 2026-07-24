---
baseline_commit: 5c22f3a6c48914801d0a226ab5a0b15c005d8765
---

# Story 5.5: Me connecter en deux temps

Status: ready-for-dev

## Story

As **Jeevons**,
I want **fournir mon code à usage unique après mon mot de passe**,
so that **un mot de passe volé ne suffise jamais à entrer chez moi**.

## Acceptance Criteria

**AC1 — Session partielle en attente de 2FA, sans accès admin, expire en 5 min**
**Given** mon second facteur est activé
**When** je fournis des identifiants valides
**Then** j'obtiens une session partielle en attente de second facteur
**And** cette session ne donne accès à aucune page d'administration
**And** elle expire au bout de cinq minutes si je ne vais pas au bout

**AC2 — Code valide → session complète**
**Given** je suis dans cette session partielle
**When** je saisis un code à six chiffres valide
**Then** ma session devient complète et l'administration m'est ouverte

**AC3 — Tolérance de dérive ±1 pas**
**Given** l'horloge de mon téléphone peut légèrement dériver
**When** je saisis un code correspondant au pas précédent ou suivant
**Then** il est accepté
**And** un code plus ancien ou plus lointain est refusé

**AC4 — Anti-rejeu**
**Given** un code vient d'être utilisé
**When** je tente de le réutiliser
**Then** il est refusé, même s'il est encore dans sa fenêtre de validité

**AC5 — Rate-limit + verrou temporaire sur le code**
**Given** un attaquant tente de deviner un code
**When** il dépasse cinq tentatives en quinze minutes depuis une même adresse
**Then** les tentatives suivantes sont refusées et le compte est temporairement verrouillé

## Contexte d'implémentation

### 🛑 Prérequis : stories 5.1-5.4 `done` — CLÔTURE du socle sécurité (hors 5.6)

5.5 assemble le **login en deux temps** : mot de passe (5.1) → session partielle → code TOTP (5.3) **ou** code de récupération (5.4) → session complète (5.2). C'est la dernière brique fonctionnelle de l'accès sécurisé avant le secours serveur (5.6). PLAN §9.1 (« flux de connexion en 2 temps »).

### 🎯 Ce que fait vraiment cette story

1. Après identifiants valides sur un compte **2FA activé** : **session partielle** `mfaPending`, sans accès `/admin`, TTL 5 min.
2. Écran de saisie du **code à 6 chiffres** (TOTP) — accepte aussi un **code de récupération** (5.4).
3. Code valide → **session complète** (accès admin).
4. Tolérance **±1 pas** (dérive d'horloge), **anti-rejeu** (dernier counter mémorisé), **rate-limit** 5/15 min/IP + verrou temporaire.

### ⚠️ Piège n°1 (CENTRAL) — Session partielle `mfaPending` : modéliser l'état intermédiaire

- Auth.js v5 JWT : encoder dans le token un flag `mfaPending: true` (ou `mfaSatisfied: false`) tant que le 2ᵉ facteur n'est pas franchi. ⚠️ Le **guard de 5.2/5.3** doit traiter une session `mfaPending` **comme non autorisée** sur toute route `/admin` sauf l'écran de saisie du code (AC1). C'est le point de décision unique prévu en 5.3 (piège n°3) : le brancher ici.
- Distinguer trois états : (a) pas de session ; (b) `mfaPending` (mot de passe OK, code attendu) ; (c) complète. `totpEnabledAt=null` (enrôlement) reste géré par 5.3.
- TTL **5 min** de la session partielle (AC1) : encoder une expiration courte propre à l'état partiel, indépendante de la durée de session complète.

### ⚠️ Piège n°2 — Tolérance ±1 pas, PAS plus (AC3)

- `otplib` : configurer `window = 1` (accepte pas précédent/suivant, ±30 s). ❌ Ne pas élargir (une grande fenêtre affaiblit le 2FA). Un code hors ±1 pas est refusé (AC3).

### ⚠️ Piège n°3 — Anti-rejeu (AC4)

- Mémoriser le **dernier `counter`/pas validé** pour l'utilisateur et **refuser sa réutilisation** (PLAN §9.1 « mémoriser le dernier counter validé »). Même dans sa fenêtre de validité, un code déjà consommé est refusé (AC4).
- ⚠️ Stockage du dernier counter : champ sur `User` (ex. `totpLastCounter Int?`) → **migration additive** (piège Prisma 7 : `migrate dev` + `generate`). Ou dans le JWT si l'usage unique par session suffit — mais l'AC vise un rejeu **cross-session**, donc **persister** est plus sûr. 🛑 Trancher : un petit champ persisté est le plus robuste.

### ⚠️ Piège n°4 — Réutiliser la validation des codes de récupération (5.4)

- À l'étape de saisie : si l'entrée est un code TOTP à 6 chiffres → vérifier via otplib (±1 pas, anti-rejeu). Sinon → tenter `verifyRecoveryCode` (5.4, usage unique). L'un OU l'autre ouvre la session complète (AC2). ❌ Ne pas réimplémenter la logique de récupération.

### ⚠️ Piège n°5 — Rate-limit du code : réutiliser le mécanisme de 5.2 (AC5)

- Même compteur mémoire (5.2, piège n°4) mais **clé distincte** (tentatives de code, pas de mot de passe) : 5/15 min/IP → verrou temporaire auto-levé. IP réelle via `X-Forwarded-For` (Traefik). ❌ Pas de Redis. Retour explicite (« trop de tentatives »).
- ⚠️ Le verrou frappe la **paire (compte, IP)** ; comme le compte est unique, ne pas laisser un attaquant verrouiller Jeevons indéfiniment : le verrou est **temporaire** (se lève seul, AC5) — cohérent avec 5.2.

### ⚠️ Piège n°6 — Vérification locale

- Compte 2FA activé : mot de passe OK → session **partielle**, tenter `/admin/xxx` → refusé/redirigé vers saisie code (AC1) ; attendre 5 min sans saisir → session partielle expirée (AC1). Code à 6 chiffres valide → admin ouverte (AC2). Code ±1 pas → accepté ; code vieux/futur → refusé (AC3). Réutiliser un code consommé → refusé (AC4). 6 codes faux en < 15 min → verrouillage temporaire puis auto-levée (AC5). Code de récupération (5.4) → ouvre aussi.

## Tasks / Subtasks

- [ ] **Tâche 0 — Prérequis** (AC: 1)
  - [ ] 5.1-5.4 `done`. Réutiliser guard (5.2/5.3), `verifyRecoveryCode` (5.4), rate-limit mémoire (5.2).
- [ ] **Tâche 1 — Session partielle `mfaPending`** (AC: 1 ; piège n°1)
  - [ ] Flag JWT + TTL 5 min ; guard traite `mfaPending` comme non autorisé sur `/admin` sauf écran code.
- [ ] **Tâche 2 — Écran de saisie + validation TOTP** (AC: 2, 3, 4 ; pièges n°2, 3, 4)
  - [ ] otplib `window=1` (±1 pas). Anti-rejeu (dernier counter persisté — migration additive si champ). Récupération via 5.4.
  - [ ] Code valide → promotion en session complète.
- [ ] **Tâche 3 — Rate-limit du code** (AC: 5 ; piège n°5)
  - [ ] Compteur mémoire (clé code), 5/15 min/IP (X-Forwarded-For), verrou temporaire auto-levé.
- [ ] **Tâche 4 — Vérification locale** (AC: 1-5 ; piège n°6)
  - [ ] Session partielle sans accès + expiration 5 min ; code valide → complète ; ±1 pas ; anti-rejeu ; rate-limit ; code de récupération.
- [ ] **Tâche 5 — Definition of Done** (AGENTS.md §8)
  - [ ] lint 0 / tsc 0 / build OK. `git diff DEV` : session partielle, écran code, validation TOTP+rejeu, rate-limit, éventuelle migration counter — rien d'autre.
  - [ ] `File List` + `Completion Notes` + `Change Log` · `sprint-status.yaml`.

## Dev Notes

### Périmètre — verrouillé

**Login en deux temps : session partielle (5 min, sans accès admin) → code TOTP (±1 pas, anti-rejeu) ou code de récupération → session complète ; rate-limit du code (5/15 min/IP, verrou temporaire).**

**Hors périmètre — ne pas faire :**
- ❌ **Enrôlement / génération des codes** → 5.3 / 5.4 (déjà faits).
- ❌ **Script de secours serveur** → 5.6.
- ❌ **Redis** (réutiliser le rate-limit mémoire de 5.2).
- ❌ **Élargir la fenêtre TOTP** au-delà de ±1 pas.
- ❌ **Dépendance nouvelle** (otplib/argon2 déjà là).

### Le vrai enjeu

C'est la brique qui rend un **mot de passe volé insuffisant** (l'intention de tout l'Epic 5 côté sécurité). Le piège central est l'**état intermédiaire** `mfaPending` : une session partielle qui laisserait passer une route `/admin` viderait le 2FA de son sens (AC1). Anti-rejeu + ±1 pas strict + rate-limit ferment les attaques restantes. Après 5.5, seule la panne « téléphone ET codes perdus » subsiste → traitée par 5.6.

### Testing standards

Vérification **manuelle en local** avec une vraie app TOTP. Les 5 AC un par un (session partielle+TTL, promotion, tolérance, rejeu, rate-limit) + chemin code de récupération. tsc/lint/build verts.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.5]
- [Source: PLAN_REFONTE_2026.md §9.1 — flux en 2 temps (mfaPending, session partielle 5 min sans accès /admin), fenêtre ±1 pas, anti-rejeu (dernier counter), rate-limit 5/15 min/IP]
- [Source: _bmad-output/implementation-artifacts/5-3-activer-la-double-authentification-a-ma-premiere-connexion.md — point de décision unique du guard (à brancher)]
- [Source: _bmad-output/implementation-artifacts/5-4-conserver-un-moyen-d-entrer-si-je-perds-mon-telephone.md — `verifyRecoveryCode` (usage unique)]
- [Source: _bmad-output/implementation-artifacts/5-2-verrouiller-l-acces-a-l-administration.md — rate-limit mémoire, X-Forwarded-For]
- [Source: memory prisma7-setup-gotchas — migration additive (champ counter) : `migrate dev` + `generate`]
- [Source: AGENTS.md §6 — logique serveur ; §9 — zéro dépendance non prévue]
