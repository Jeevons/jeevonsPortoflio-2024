---
baseline_commit: 5c22f3a6c48914801d0a226ab5a0b15c005d8765
---

# Story 5.4: Conserver un moyen d'entrer si je perds mon téléphone

Status: review

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

- [x] **Tâche 0 — Prérequis** (AC: 1)
  - [x] 5.3 `done` (champ `recoveryCodes` créé, activation TOTP). Réutiliser `argon2` (5.1).
- [x] **Tâche 1 — Génération à l'activation** (AC: 1, 2 ; pièges n°1, 2, 5)
  - [x] Générer 8 codes aléatoires ; stocker hash argon2id (`{hash, usedAt}`) ; afficher **une seule fois** + avertissement.
- [x] **Tâche 2 — Validation & consommation d'un code** (AC: 3 ; pièges n°1, 3)
  - [x] `verifyRecoveryCode` : compare argon2 contre les hash non utilisés ; si match → marque `usedAt` (atomique) ; renvoie succès + reste. Exposé à 5.5.
- [x] **Tâche 3 — Régénération** (AC: 4 ; piège n°4)
  - [x] Détection 0 restant → avertissement admin + action « régénérer » (protégée `requireAdmin`, tracée sans les codes).
- [x] **Tâche 4 — Vérification locale** (AC: 1-4 ; piège n°6)
  - [x] 8 codes une fois ; hash en base ; login par code (usage unique, reste décrémenté) ; régénération à 0.
- [x] **Tâche 5 — Definition of Done** (AGENTS.md §8)
  - [x] lint 0 / tsc 0 / build OK. `git diff DEV` : génération/validation/régénération codes + écran d'affichage — rien d'autre.
  - [x] `File List` + `Completion Notes` + `Change Log` · `sprint-status.yaml`.

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

## Dev Agent Record

### Implementation Plan

Deux décisions validées par Jeevons avant implémentation :

1. **Écran de sécurité à deux modes** plutôt qu'une route dédiée. `/admin/settings/security` sert l'enrôlement quand `totpEnabledAt` est `null`, et la gestion des codes (décompte, avertissement, régénération) une fois la 2FA active. Conséquence : le guard du layout ne renvoie plus cette route vers `/admin` après activation.
2. **Compare-and-swap sur la colonne JSON** pour l'atomicité de la consommation, plutôt qu'une transaction interactive Prisma. `updateMany` avec `where: { recoveryCodes: { equals: <valeur relue> } }` : Postgres évalue le prédicat au moment de l'écriture, donc une soumission concurrente touche 0 ligne et est refusée. Aucune migration, pas de `SELECT FOR UPDATE`.

**Génération couplée à l'activation** : les 8 codes et `totpEnabledAt` sont écrits dans la **même requête** `prisma.user.update`. C'est ce qui rend impossible l'état bâtard « 2FA active sans aucun code de secours » — précisément le lock-out que la story existe pour empêcher.

**Sortie unique du clair** : les codes en clair remontent par la valeur de retour de la server action (`EnrollState.recoveryCodes` / `RegenerateState.recoveryCodes`), consommée immédiatement par le composant d'affichage. Jamais d'URL (fuite dans l'historique / les logs de proxy), jamais de log, jamais de persistance. C'est pour cela que `confirmEnrollmentAction` ne fait plus de `redirect("/admin")` sur succès : une redirection tuerait l'unique occasion d'afficher les codes.

### Debug Log

- **`tsc` — `TS2322` sur le filtre JSON du compare-and-swap.** Passer `recoveryCodes: user.recoveryCodes` directement en filtre ne compile pas : Prisma attend un `JsonNullableFilter`, pas une valeur brute. Corrigé en forme explicite `{ equals: user.recoveryCodes as Prisma.InputJsonValue }`, avec `import type { Prisma } from "@/generated/prisma/client"`.
- **Vérification impossible via `bun run <script>` seul.** Les modules du domaine importent `server-only`, qui lève hors condition d'export `react-server`. Contourné avec `bun --conditions=react-server` pour l'exécution des scripts de vérification (jetables, hors dépôt).
- **Cas oublié repéré à la relecture** : sous l'ancien guard, `confirmEnrollmentAction` faisait `redirect("/admin")` quand la 2FA était déjà active. La page restant désormais accessible dans ce cas, ce chemin aurait pu être atteint par double soumission — et régénérer un jeu à l'insu de l'utilisateur. Remplacé par un retour neutre (`{ error: null }`) : la régénération est **exclusivement** une action explicite et confirmée.

### Completion Notes

**Vérification exécutée contre la base de dev réelle** (script jetable en scratchpad, supprimé après coup ; le dépôt n'a pas de framework de test et la story interdit toute nouvelle dépendance — son standard est « vérification manuelle en local »). **26 contrôles, tous verts** :

- **AC1** — 8 codes générés, tous distincts, format `XXXX-XXXX` ; l'écran affiche les 8 codes, annonce « ne vous seront plus jamais affichés » dans un `role="alert"`, section labellisée, retour de copie en `aria-live="polite"`, aucun contrôle interactif imbriqué.
- **AC2** — tous les hash commencent par `$argon2id$` ; `argon2.verify` valide le code correspondant ; **aucun code en clair présent dans la valeur persistée**, vérifié aussi par relecture brute de la colonne en base.
- **AC3** — code valide accepté et reste annoncé à 7 ; **le même code est refusé au second essai** ; décompte persisté ; saisie tolérante (casse, espace, tiret manquant) acceptée ; code inconnu refusé **sans rien consommer** ; **anti-course : sur deux soumissions simultanées du même code, une seule réussit et un seul code est consommé**.
- **AC4** — épuisement détecté (`remaining: 0`, `exhausted: true`) ; régénération produisant 8 nouveaux codes ; **les anciens codes deviennent invalides** ; les nouveaux fonctionnent.
- **Robustesse** — `recoveryCodes` `null` → `[]` ; entrées malformées ignorées plutôt que de casser l'authentification ; saisie de longueur invalide rejetée.

`bunx tsc --noEmit` → 0 erreur. `bun run lint` → 0 erreur (1 warning **pré-existant** sur `src/sections/TestimonialsClient.tsx`, fichier non touché par cette story — `git diff DEV` le confirme). `bun run build` → succès.

**Point d'intégration 5.5** (la story ne livre pas l'écran de login, hors périmètre) : `verifyAndConsumeRecoveryCode(email, input)` est prête et documentée dans `src/lib/auth/recovery-codes.ts`. À l'étape du second facteur, si `verifyTotpCode` échoue, appeler cette fonction avec la même saisie ; `ok: true` autorise la session et `remaining` est le décompte à afficher.

**⚠️ Reste à faire par Jeevons — vérification visuelle navigateur.** Je n'ai pas eu accès au navigateur pendant cette session ; le rendu a été validé par rendu serveur du balisage, pas dans Chrome. La base de dev est actuellement dans l'état « 2FA active, 0 code » : en te connectant à `/admin`, tu dois voir le **bandeau rouge d'avertissement**, puis pouvoir régénérer un jeu depuis `/admin/settings/security` et voir les 8 codes affichés une seule fois.

**Dette assumée** : la traçabilité de la régénération (5.19) est préparée par un commentaire mais pas implémentée — le modèle `AuditLog` n'existe pas encore. Quand il arrivera, y consigner « jeu régénéré » + horodatage, **jamais les codes**.

### File List

- `apps/web/src/lib/auth/recovery-codes.ts` *(nouveau)* — source unique : génération, hachage argon2id, vérification/consommation atomique, décompte, remplacement du jeu.
- `apps/web/src/app/(admin)/admin/settings/security/recovery-codes-panel.tsx` *(nouveau)* — écran d'affichage unique des codes (avertissement, copie, a11y).
- `apps/web/src/app/(admin)/admin/settings/security/regenerate-form.tsx` *(nouveau)* — régénération avec confirmation explicite en deux temps.
- `apps/web/src/app/(admin)/admin/settings/security/actions.ts` *(modifié)* — génération des codes dans la même écriture que l'activation ; `regenerateRecoveryCodesAction` ; suppression du `redirect` post-activation.
- `apps/web/src/app/(admin)/admin/settings/security/page.tsx` *(modifié)* — page à deux modes (enrôlement / gestion des codes).
- `apps/web/src/app/(admin)/admin/settings/security/enroll-form.tsx` *(modifié)* — bascule sur l'écran de codes après activation réussie.
- `apps/web/src/app/(admin)/admin/layout.tsx` *(modifié)* — le guard n'expulse plus l'écran de sécurité une fois la 2FA active.
- `apps/web/src/app/(admin)/admin/page.tsx` *(modifié)* — bandeau d'avertissement « plus de codes » + décompte (AC4).
- `apps/web/prisma/schema.prisma` *(modifié)* — documentation de la forme de `recoveryCodes`. **Aucune migration** : le champ `Json?` existant accueille la structure telle quelle.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` *(modifié)* — statut de la story.

### Change Log

| Date | Changement |
|---|---|
| 2026-07-25 | Story 5.4 implémentée : 8 codes de récupération générés à l'activation du TOTP et affichés une seule fois (AC1), hachés argon2id (AC2), validation à usage unique avec consommation atomique et décompte des restants (AC3), régénération protégée avec avertissement à l'épuisement (AC4). Aucune dépendance ajoutée, aucune migration. Statut `ready-for-dev` → `review`. |
