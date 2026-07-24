---
baseline_commit: 5c22f3a6c48914801d0a226ab5a0b15c005d8765
---

# Story 5.4: Conserver un moyen d'entrer si je perds mon téléphone

Status: ready-for-dev

## Story

As **Jeevons**,
I want **disposer de codes de secours**,
so that **la perte de mon téléphone ne me coupe pas définitivement l'accès à mon propre site**.

## Acceptance Criteria

**AC1 — 8 codes présentés une seule fois à l'activation**
**Given** je viens d'activer mon second facteur
**When** l'activation se termine
**Then** huit codes de récupération me sont présentés
**And** ils ne sont affichés qu'une seule fois, avec un avertissement clair invitant à les conserver

**AC2 — Codes hachés argon2id en base**
**Given** ces codes sont stockés
**When** j'inspecte leur enregistrement
**Then** ils sont hachés en argon2id, jamais lisibles en base

**AC3 — Connexion par code de récupération, usage unique**
**Given** je n'ai pas accès à mon application d'authentification
**When** je saisis un code de récupération valide à l'étape du second facteur
**Then** ma session s'ouvre normalement
**And** ce code est immédiatement invalidé et ne peut plus resservir
**And** le nombre de codes restants m'est indiqué

**AC4 — Régénération quand les codes sont épuisés**
**Given** tous mes codes sont épuisés
**When** je consulte l'administration
**Then** je suis averti et je peux en régénérer un nouveau jeu

## Contexte d'implémentation

### 🛑 Prérequis : story 5.3 `done` (2FA activable, champ `recoveryCodes` créé)

5.3 a créé le champ `recoveryCodes Json?` et l'activation du TOTP. 5.4 **remplit** ce champ (8 codes) au moment de l'activation, permet la connexion par code, et la régénération. PLAN §9.3 (« ne pas sauter cette étape »).

### 🎯 Ce que fait vraiment cette story

À l'**activation** (5.3, AC4) : générer **8 codes** à usage unique, les **afficher une seule fois** (avertissement), les **stocker hachés argon2id**. Permettre de **se connecter avec un code** à l'étape 2FA (usage unique, décompte restant). Permettre la **régénération** quand tous sont épuisés.

### ⚠️ Piège n°1 — Réutiliser argon2 de 5.1, pas de nouvelle dépendance

- Les codes sont hachés **argon2id** (AC2) — même lib `argon2` que les mots de passe (5.1). ❌ Aucune dépendance nouvelle.
- `recoveryCodes Json?` (créé en 5.3) stocke un **tableau d'objets** `{ hash: string, usedAt: DateTime | null }` (ou un tableau de hash + un ensemble d'utilisés). ⚠️ Ne jamais stocker le code en clair (AC2).

### ⚠️ Piège n°2 (CENTRAL) — Affichés une seule fois (AC1)

- Les 8 codes en clair n'existent **qu'au moment de la génération** (à l'activation, 5.3). On les **affiche une fois**, puis on ne stocke que les hash → impossible de les réafficher (AC1). Avertissement clair (« conservez-les, ils ne seront plus montrés »).
- ⚠️ Ne pas les remettre dans un log, un AuditLog (5.19 l'interdit), un e-mail, ou une réponse ultérieure. Une seule sortie : l'écran de génération.

### ⚠️ Piège n°3 — Usage unique + anti-course (AC3)

- À l'étape 2FA (5.5) : si l'entrée saisie n'est pas un code TOTP à 6 chiffres valide, tenter la **comparaison argon2** contre chaque hash non encore utilisé. Si l'un correspond → ouvrir la session **et marquer ce code utilisé immédiatement** (persister `usedAt`), avant de renvoyer le succès. Un code utilisé ne resservira jamais (AC3), même dans sa « fenêtre ».
- ⚠️ **Anti-course** : marquer l'usage dans la **même transaction**/écriture que la validation, pour qu'une double soumission simultanée ne consomme pas deux fois le même code (mono-utilisateur → risque faible, mais l'écriture atomique reste correcte).
- Indiquer le **nombre restant** après usage (AC3).

### ⚠️ Piège n°4 — Régénération (AC4)

- Quand **0 code restant** : bandeau d'avertissement dans l'admin + action « régénérer un nouveau jeu » → 8 nouveaux codes, affichés une fois, remplaçant intégralement l'ancien jeu (les anciens hash sont écrasés). AC4.
- ⚠️ La régénération est une action **sensible** : la protéger par `requireAdmin` (5.2) et la tracer (5.19) — sans jamais tracer les codes eux-mêmes.

### ⚠️ Piège n°5 — Couplage avec 5.3 (activation) et 5.5 (login)

- **Point de couplage 5.3** : la génération des 8 codes se fait **au même instant** que l'activation du TOTP (AC1 « je viens d'activer »). Concrètement : l'action de confirmation de 5.3 (poser `totpEnabledAt`) génère aussi les codes et bascule vers leur écran d'affichage. ⚠️ Ordonnancement : cette story dépend de 5.3 ; si 5.3 est déjà `done`, brancher la génération dans son flux d'activation sans le casser.
- **Point de couplage 5.5** : la **saisie** d'un code de récupération se fait à l'étape 2FA du login (5.5). 5.4 fournit la **fonction de validation** (`verifyRecoveryCode(user, input): boolean + consume`) ; 5.5 l'appelle. Si 5.5 n'est pas encore fait, exposer/tester la fonction et documenter le point d'intégration.

### ⚠️ Piège n°6 — Vérification locale

- Activer le 2FA (5.3) → 8 codes affichés **une fois** (AC1). Vérifier en base : `recoveryCodes` = hash illisibles (AC2). Se déconnecter, se reconnecter, saisir un code de récupération → session ouverte, code **invalidé** (réessai refusé), reste affiché à 7 (AC3). Épuiser/forcer 0 restant → avertissement + régénération (AC4).

## Tasks / Subtasks

- [ ] **Tâche 0 — Prérequis** (AC: 1)
  - [ ] 5.3 `done` (champ `recoveryCodes` créé, activation TOTP). Réutiliser `argon2` (5.1).
- [ ] **Tâche 1 — Génération à l'activation** (AC: 1, 2 ; pièges n°1, 2, 5)
  - [ ] Générer 8 codes aléatoires ; stocker hash argon2id (`{hash, usedAt}`) ; afficher **une seule fois** + avertissement.
- [ ] **Tâche 2 — Validation & consommation d'un code** (AC: 3 ; pièges n°1, 3)
  - [ ] `verifyRecoveryCode` : compare argon2 contre les hash non utilisés ; si match → marque `usedAt` (atomique) ; renvoie succès + reste. Exposé à 5.5.
- [ ] **Tâche 3 — Régénération** (AC: 4 ; piège n°4)
  - [ ] Détection 0 restant → avertissement admin + action « régénérer » (protégée `requireAdmin`, tracée sans les codes).
- [ ] **Tâche 4 — Vérification locale** (AC: 1-4 ; piège n°6)
  - [ ] 8 codes une fois ; hash en base ; login par code (usage unique, reste décrémenté) ; régénération à 0.
- [ ] **Tâche 5 — Definition of Done** (AGENTS.md §8)
  - [ ] lint 0 / tsc 0 / build OK. `git diff DEV` : génération/validation/régénération codes + écran d'affichage — rien d'autre.
  - [ ] `File List` + `Completion Notes` + `Change Log` · `sprint-status.yaml`.

## Dev Notes

### Périmètre — verrouillé

**8 codes de récupération générés à l'activation, affichés une fois, hachés argon2id ; validation à usage unique avec décompte restant ; régénération quand épuisés.**

**Hors périmètre — ne pas faire :**
- ❌ **Le flux de saisie du code au login (session partielle, écran 2FA)** → 5.5 (5.4 fournit la fonction de validation, pas l'écran de login).
- ❌ **Script de secours serveur** → 5.6.
- ❌ **Rate-limit** de l'étape 2FA → 5.5.
- ❌ **Dépendance nouvelle** (réutiliser `argon2`).

### Le vrai enjeu

Sans codes de secours, un téléphone perdu = admin **définitivement inaccessible**, seule issue `docker exec` + SQL manuel (PLAN §9.3). Deux invariants : les codes ne sont montrés **qu'une fois** (sinon fuite) et ne sont **jamais lisibles en base** (hash argon2id) ni dans un log/audit. La fonction de validation posée ici est le second point d'entrée du login 2FA (5.5).

### Testing standards

Vérification **manuelle en local**. Affichage unique (AC1), hash en base (AC2), login par code à usage unique + reste (AC3), régénération (AC4). tsc/lint/build verts.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.4]
- [Source: PLAN_REFONTE_2026.md §9.3 — 8 codes générés à l'enrôlement, affichés une seule fois, stockés hashés, usage unique]
- [Source: _bmad-output/implementation-artifacts/5-3-activer-la-double-authentification-a-ma-premiere-connexion.md — champ `recoveryCodes` créé, activation TOTP (point de couplage)]
- [Source: _bmad-output/implementation-artifacts/5-1-me-connecter-au-back-office.md — argon2id (réutilisé pour les codes)]
- [Source: _bmad-output/implementation-artifacts/5-2-verrouiller-l-acces-a-l-administration.md — `requireAdmin` pour la régénération]
- [Source: AGENTS.md §6 — secrets/codes jamais loggés ; §9 — zéro dépendance non prévue]
