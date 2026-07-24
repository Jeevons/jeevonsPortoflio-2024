---
baseline_commit: 5c22f3a6c48914801d0a226ab5a0b15c005d8765
---

# Story 5.3: Activer la double authentification à ma première connexion

Status: ready-for-dev

## Story

As **Jeevons**,
I want **être obligé de configurer un second facteur dès ma première connexion**,
so that **mon back-office ne reste jamais protégé par un simple mot de passe**.

## Acceptance Criteria

**AC1 — Champs 2FA sur `User` + migration ; seed sans 2FA**
**Given** le modèle `User` doit porter l'état du second facteur
**When** cette story est terminée
**Then** il porte un secret, une date d'activation et un jeu de codes de récupération, décrits par une migration
**And** le compte issu du seed démarre sans second facteur activé

**AC2 — Redirection forcée vers l'enrôlement**
**Given** mon compte n'a pas encore de second facteur
**When** je me connecte avec mes identifiants
**Then** je suis redirigé de force vers l'écran d'enrôlement
**And** aucune autre page d'administration ne m'est accessible tant que l'enrôlement n'est pas terminé

**AC3 — QR code + secret en clair**
**Given** je suis sur l'écran d'enrôlement
**When** la page s'affiche
**Then** un QR code lisible par une application d'authentification standard m'est présenté
**And** le secret est aussi affiché en clair, pour une saisie manuelle

**AC4 — Activation confirmée par un premier code valide (anti-lock-out)**
**Given** j'ai scanné le QR code
**When** je saisis un premier code valide
**Then** le second facteur est activé et la date d'activation enregistrée
**And** tant que je n'ai pas fourni ce code valide, le second facteur reste inactif — ce qui m'évite de me verrouiller dehors

**AC5 — Secret chiffré au repos**
**Given** le secret est stocké en base
**When** j'inspecte son enregistrement
**Then** il est chiffré au repos avec une clé dérivée du secret d'application
**And** un extrait de base volé ne permet pas de générer des codes valides

## Contexte d'implémentation

### 🛑 Prérequis : stories 5.1 + 5.2 `done`

5.1 = login/session ; 5.2 = protection `/admin`. 5.3 **impose le TOTP dès la première connexion**. PLAN §9 (2FA obligatoire, décision 4) est la source de vérité — le PLAN §3.1 disait « optionnel », **corrigé en obligatoire** (§ décisions 4).

### 🎯 Ce que fait vraiment cette story

L'**enrôlement TOTP** : ajouter les champs `totpSecret` / `totpEnabledAt` / `recoveryCodes` au `User`, forcer un compte sans 2FA vers l'écran d'enrôlement (QR + secret en clair), activer **seulement après** un premier code valide (anti-lock-out), et **chiffrer le secret au repos**. La **génération/affichage des 8 codes de récupération** est portée par 5.4 (mais le champ `recoveryCodes` est créé ici par la migration). La **connexion en deux temps** (saisie du code à chaque login) est 5.5.

### 🔑 Dépendance à ajouter (PLAN §9.1) : `otplib`

- `otplib` (`@otplib/preset-default`) — TOTP RFC 6238, compatible Google Authenticator/Authy/1Password/Bitwarden. **Seule** dépendance de cette story (prévue par le PLAN → autorisée).

### ⚠️ Piège n°1 — Migration additive sur `User` (piège Prisma 7) [[prisma7-setup-gotchas]]

- Ajouter au `model User` : `totpSecret String?`, `totpEnabledAt DateTime?`, `recoveryCodes Json?` (PLAN §9.1). Tous **nullable** (le compte seedé démarre `totpEnabledAt = null`, AC1).
- `bunx prisma migrate dev --name add_user_totp` PUIS `bunx prisma generate` avant tout usage. Le seed de 5.1 **ne remplit pas** ces champs (démarrage sans 2FA — AC1).

### ⚠️ Piège n°2 (CENTRAL) — Chiffrement du secret au repos (AC5), clé dérivée d'`AUTH_SECRET`

- `totpSecret` = secret base32, **chiffré AES-256-GCM** avec une clé dérivée d'`AUTH_SECRET` (PLAN §9.1). Un dump SQL volé ne suffit alors pas à générer des codes (AC5).
- Implémentation : `node:crypto` (`createCipheriv('aes-256-gcm', key, iv)`), clé = dérivation d'`AUTH_SECRET` (ex. `scrypt`/`hkdf`), stocker `iv` + `authTag` + ciphertext (ex. concaténés/encodés). **Pas de nouvelle dépendance** (crypto natif). Créer un utilitaire `src/lib/crypto/totp-secret.ts` (encrypt/decrypt) réutilisé en 5.5 (vérification du code).
- ⚠️ Ne **jamais** logguer le secret déchiffré ni l'inclure dans un AuditLog (5.19 l'interdit explicitement).

### ⚠️ Piège n°3 — Redirection forcée vers l'enrôlement (AC2), sans trou de sécurité

- Étendre le guard de 5.2 : une session dont l'utilisateur a `totpEnabledAt = null` **ne donne accès à aucune page `/admin`** sauf l'écran d'enrôlement (`/admin/settings/security` ou `/admin/enroll` — PLAN §9.2 : `/admin/settings/security`). Toute autre URL admin → redirection forcée vers l'enrôlement.
- ⚠️ Cohérence avec 5.5 : la « session complète » exigera 2FA validé. Ici (avant que 5.5 n'existe), on gate sur `totpEnabledAt`. Concevoir le guard pour que 5.5 s'y greffe sans réécriture (un seul point de décision : `session` → autorisé sur telle route ?).

### ⚠️ Piège n°4 — Activation seulement après confirmation (AC4, anti-lock-out)

- Générer le secret et l'afficher (QR + clair) **sans** l'activer. `totpEnabledAt` reste `null` tant que l'utilisateur n'a pas saisi un **premier code TOTP valide** vérifié contre le secret. À ce moment seulement : persister le secret **chiffré** + `totpEnabledAt = now()` (AC4).
- ⚠️ Où stocker le secret **en attente de confirmation** ? Ne pas le persister en clair. Deux options : (a) le garder chiffré dès sa génération, `totpEnabledAt` distinguant en-attente/actif ; (b) le transporter dans la session/formulaire d'enrôlement signé. 👉 Recommandation : persister **chiffré** immédiatement, `totpEnabledAt=null` = « pas encore confirmé » ; la confirmation ne fait que poser la date. Simple, et un secret non confirmé n'est de toute façon exploitable par personne d'autre.

### ⚠️ Piège n°5 — QR code sans dépendance lourde (AC3)

- URI `otpauth://totp/Portfolio:<email>?secret=<base32>&issuer=Portfolio` (PLAN §9.2). Le **secret en clair** est affiché à côté (saisie manuelle, AC3).
- ⚠️ **Rendre le QR** : éviter d'ajouter une lib QR lourde non prévue. Options : générer le SVG/PNG côté serveur avec un mini-générateur, ou — plus sobre — afficher l'URI + secret et un QR via un data-URI généré server-side. 🛑 **Trancher avec Jeevons** : si une micro-lib QR est nécessaire, la faire valider (AGENTS.md §9, zéro dépendance non prévue) ; sinon secret manuel + URI suffit à l'AC (« un QR code lisible » — privilégier une génération sans réseau, pas de service externe qui verrait le secret).

### ⚠️ Piège n°6 — Vérification locale

- Se connecter avec le compte seedé (`totpEnabledAt=null`) → **forcé** sur l'enrôlement, aucune autre page admin atteignable (AC2). Scanner le QR avec une vraie app (Authy…), saisir un code → activation + `totpEnabledAt` posé (AC4). Vérifier en base que `totpSecret` est **illisible** (chiffré, AC5). Vérifier qu'un code **avant** confirmation ne « pré-active » pas.

## Tasks / Subtasks

- [ ] **Tâche 0 — Prérequis & dépendance** (AC: 1)
  - [ ] 5.1 + 5.2 `done`. `bun add otplib` (seule autorisée, PLAN §9.1).
- [ ] **Tâche 1 — Champs 2FA + migration** (AC: 1 ; piège n°1)
  - [ ] `totpSecret String?`, `totpEnabledAt DateTime?`, `recoveryCodes Json?` sur `User`. `migrate dev` + `generate`. Seed inchangé (démarre `null`).
- [ ] **Tâche 2 — Chiffrement du secret au repos** (AC: 5 ; piège n°2)
  - [ ] Utilitaire AES-256-GCM (`node:crypto`), clé dérivée d'`AUTH_SECRET`. Jamais de secret en clair persisté/loggé.
- [ ] **Tâche 3 — Écran d'enrôlement (QR + secret clair)** (AC: 3 ; piège n°5)
  - [ ] `/admin/settings/security` : génère secret, affiche QR (`otpauth://…`) + secret en clair. 🛑 Trancher rendu QR avec Jeevons.
- [ ] **Tâche 4 — Redirection forcée** (AC: 2 ; piège n°3)
  - [ ] Guard : `totpEnabledAt=null` → seul l'enrôlement est accessible sous `/admin`. Point de décision extensible pour 5.5.
- [ ] **Tâche 5 — Activation après premier code valide** (AC: 4 ; piège n°4)
  - [ ] Vérifier le code (otplib) ; si valide → poser `totpEnabledAt`. Sinon → inactif.
- [ ] **Tâche 6 — Vérification locale** (AC: 1-5 ; piège n°6)
  - [ ] Login compte seedé → enrôlement forcé ; scan + code → activation ; `totpSecret` illisible en base ; pas de pré-activation.
- [ ] **Tâche 7 — Definition of Done** (AGENTS.md §8)
  - [ ] lint 0 / tsc 0 / build OK. `git diff DEV` : migration, crypto util, écran enrôlement, guard étendu, `otplib` — rien d'autre.
  - [ ] `File List` + `Completion Notes` + `Change Log` · `sprint-status.yaml`.

## Dev Notes

### Périmètre — verrouillé

**Champs 2FA + migration ; enrôlement TOTP (QR + secret clair) ; activation confirmée par un premier code ; secret chiffré au repos ; redirection forcée du compte sans 2FA vers l'enrôlement.**

**Hors périmètre — ne pas faire :**
- ❌ **Générer/afficher les 8 codes de récupération** → story 5.4 (le champ `recoveryCodes` est créé ici, pas rempli).
- ❌ **Connexion en deux temps / session partielle / saisie du code à chaque login** → story 5.5.
- ❌ **Script de secours `admin:reset-2fa`** → story 5.6.
- ❌ **Régénération d'un nouveau jeu de codes** → 5.4.
- ❌ **Dépendance hors `otplib`** (QR : trancher, ne pas ajouter sans validation).

### Le vrai enjeu

Le back-office est **public** : mot de passe seul insuffisant (PLAN §9). Deux pièges tuent les implémentations naïves : (1) activer le 2FA **avant** confirmation → l'utilisateur se verrouille dehors s'il a mal scanné (AC4 l'interdit) ; (2) stocker le secret **en clair** → un dump SQL suffit à générer des codes (AC5 exige le chiffrement). L'utilitaire crypto et le guard posés ici servent 5.4, 5.5, 5.6.

### Testing standards

Vérification **manuelle en local** avec une vraie app d'authentification (Authy/Google Authenticator). Enrôlement forcé (AC2), QR+clair (AC3), activation confirmée (AC4), secret chiffré vérifié en base (AC5). tsc/lint/build verts.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.3]
- [Source: PLAN_REFONTE_2026.md §9.1 — otplib, champs `totpSecret`/`totpEnabledAt`/`recoveryCodes`, chiffrement AES-256-GCM clé dérivée d'AUTH_SECRET ; §9.2 — écran `/admin/settings/security`, URI otpauth, confirmation par premier code ; §9.4 — seed démarre `totpEnabledAt=null`, redirection forcée au 1er login ; décision 4 — 2FA obligatoire]
- [Source: _bmad-output/implementation-artifacts/5-1-me-connecter-au-back-office.md — AUTH_SECRET posé, model User minimal]
- [Source: _bmad-output/implementation-artifacts/5-2-verrouiller-l-acces-a-l-administration.md — guard `/admin` à étendre]
- [Source: memory prisma7-setup-gotchas — migration additive, `migrate dev` + `generate` avant usage]
- [Source: AGENTS.md §6 — secrets par env, jamais loggés ; §9 — zéro dépendance non prévue]
