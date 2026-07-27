---
baseline_commit: 5c22f3a6c48914801d0a226ab5a0b15c005d8765
---

# Story 5.5: Me connecter en deux temps

Status: review

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

- [x] **Tâche 0 — Prérequis** (AC: 1)
  - [x] 5.1-5.4 `done`. Réutiliser guard (5.2/5.3), `verifyRecoveryCode` (5.4), rate-limit mémoire (5.2).
- [x] **Tâche 1 — Session partielle `mfaPending`** (AC: 1 ; piège n°1)
  - [x] Flag JWT + TTL 5 min ; guard traite `mfaPending` comme non autorisé sur `/admin` sauf écran code.
- [x] **Tâche 2 — Écran de saisie + validation TOTP** (AC: 2, 3, 4 ; pièges n°2, 3, 4)
  - [x] otplib `window=1` (±1 pas). Anti-rejeu (dernier counter persisté — migration additive si champ). Récupération via 5.4.
  - [x] Code valide → promotion en session complète.
- [x] **Tâche 3 — Rate-limit du code** (AC: 5 ; piège n°5)
  - [x] Compteur mémoire (clé code), 5/15 min/IP (X-Forwarded-For), verrou temporaire auto-levé.
- [x] **Tâche 4 — Vérification locale** (AC: 1-5 ; piège n°6)
  - [x] Session partielle sans accès + expiration 5 min ; code valide → complète ; ±1 pas ; anti-rejeu ; rate-limit ; code de récupération.
- [x] **Tâche 5 — Definition of Done** (AGENTS.md §8)
  - [x] lint 0 / tsc 0 / build OK. `git diff DEV` : session partielle, écran code, validation TOTP+rejeu, rate-limit, éventuelle migration counter — rien d'autre.
  - [x] `File List` + `Completion Notes` + `Change Log` · `sprint-status.yaml`.

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

## Dev Agent Record

### Decisions

Trois arbitrages tranchés avec Jeevons avant l'implémentation :

1. **TTL des 5 min → échéance dans le JWT** (`mfaDeadline`, ms epoch) plutôt qu'une durée de cookie distincte. Un seul champ, comparé à `Date.now()` par tous les lecteurs ; pas de seconde durée de session à maintenir.
2. **Anti-rejeu → champ persisté `User.totpLastCounter`** (migration additive) plutôt qu'un compteur dans le JWT. L'AC4 vise un rejeu **cross-session** : un compteur en JWT ne bloquerait que la session courante et disparaîtrait au redémarrage du conteneur.
3. **Écran du second facteur → `/login/2fa`**, hors du groupe `(admin)`. Le guard admin n'a ainsi **aucune exception** à porter : toute route `/admin` reste interdite en session partielle, sans cas particulier à oublier.

### Points d'attention

- **Point de décision unique.** `mfaStateFromToken()` (`src/lib/auth.config.ts`) est la **seule** fonction qui décide entre `none` / `pending` / `full`. Elle est lue par le proxy edge, le layout admin, `requireAdmin` et `requireAdminApi` — quatre gardes, une seule règle. C'est la réponse au piège n°1 : impossible qu'un garde diverge des autres.
- **Défense en profondeur.** Le proxy redirige, mais le layout admin et `requireAdmin`/`requireAdminApi` re-vérifient. Une session partielle qui contournerait le proxy resterait bloquée côté serveur.
- **`timeStep` et fail-safe.** La façade `otplib` type `verify` comme l'union TOTP | HOTP ; la variante HOTP ne porte pas `timeStep`, qui disparaît du type narrowé. Importer `@otplib/totp` directement était exclu (dépendance **transitive** non déclarée, AGENTS.md §9). Le champ est donc relu défensivement et, **s'il manque, le code est REFUSÉ** : ouvrir une session sans pouvoir armer l'anti-rejeu laisserait un code rejouable.
- **Anti-course.** La consommation du pas TOTP passe par un `updateMany` filtré sur la valeur **exacte** relue (`where: { totpLastCounter: <valeur lue> }`). Deux soumissions simultanées du même code : la seconde touche 0 ligne et est refusée. Même schéma que le compare-and-swap de 5.4.
- **Clé de rate-limit distincte** (`mfa:` vs celle de 5.2). Sans préfixe séparé, les tentatives de **mot de passe** entameraient le quota des **codes** : après une connexion normale, Jeevons se verrouillerait lui-même au second facteur.
- **Défaut corrigé en cours de route.** Une soumission malformée du formulaire (posté hors du flux normal) produisait une **500** sur `formData.get(...)`. Corrigé par un refus propre : une pile d'erreur renvoyée sur un écran d'authentification est elle-même une fuite d'information.

### Debug Log

Vérification pilotée sur l'app réellement en marche (`docker compose` : `web` + `db`), via un harness Node/Bun exécuté **dans le conteneur** — `AUTH_SECRET`, `ADMIN_PASSWORD` et `DATABASE_URL` sont hérités de l'environnement du process : aucun secret n'a été lu depuis `.env` ni affiché.

Deux obstacles ont coûté l'essentiel du temps de vérification :

1. **Encodage des Server Actions.** Reconstruire à la main le format de React (`$ACTION_ID_*`, références `$K1`) ne fonctionne pas. Le formulaire rendu porte en réalité `$ACTION_REF_1`, `$ACTION_1:0`, `$ACTION_1:1` et `$ACTION_KEY`. Solution : **recopier les champs cachés depuis le HTML réellement servi** au lieu de les fabriquer — plus fidèle, et ça teste le formulaire tel qu'il est rendu. Il faut aussi l'en-tête `origin` (protection CSRF de Next), sans quoi l'action est rejetée et `formData` n'arrive jamais.
2. **Rate-limit en mémoire persistant entre exécutions.** Les compteurs survivent d'un run à l'autre et faussaient l'AC5. Corrigé en redémarrant le conteneur et en donnant à chaque phase une **IP simulée distincte** (`X-Forwarded-For`, plage de test RFC 5737) : la phase qui épuise volontairement son quota ne perturbe plus les autres.

Fausse piste écartée : j'ai d'abord suspecté le compare-and-swap `where: { totpLastCounter: null }` (en SQL, `= NULL` ne matche jamais). Le test l'a infirmé — **Prisma traduit `{ field: null }` en `IS NULL`**, et la validation depuis une base NULL fonctionne.

Le harness était un artefact de test : il a été retiré du dépôt et du conteneur ; aucun `console.log` de débogage ne subsiste dans le code.

### Completion Notes

**13/13 vérifications au vert** contre l'app en marche, avec le vrai secret TOTP du compte :

| AC | Vérification | Résultat |
|----|--------------|----------|
| AC1 | Mot de passe seul → `/admin` refusé, redirigé vers `/login/2fa` | ✅ 307 |
| AC1 | Écran de saisie joignable en session partielle | ✅ 200 |
| AC1 | Session partielle expirée (> 5 min) → retour au login | ✅ |
| AC2 | Code TOTP valide → `/admin` ouverte | ✅ 303 → 200 |
| AC2 | Code de récupération (5.4) → `/admin` ouverte | ✅ 200 |
| AC2 | Code de récupération déjà consommé → refusé | ✅ 307 |
| AC3 | Code du pas précédent (−30 s) → accepté | ✅ |
| AC3 | Code lointain (−5 min) → refusé | ✅ |
| AC4 | Pas consommé persisté (`totpLastCounter`) | ✅ |
| AC4 | Rejeu du même code dans une autre session → refusé | ✅ |
| AC4 | Code consommé refusé malgré sa fenêtre encore valide | ✅ |
| AC5 | Verrou déclenché à la 6ᵉ tentative | ✅ |
| AC5 | Pendant le verrou, même un code valide est refusé | ✅ |

**Portes de qualité :** `tsc --noEmit` → 0 erreur · `bun run lint` → 0 erreur (1 avertissement **préexistant** dans `TestimonialsClient.tsx`, fichier non touché par cette story) · `bun run build` → OK, `/login/2fa` enregistrée en route dynamique.

**Zéro dépendance ajoutée** : `otplib`, `argon2` et `node:crypto` étaient déjà présents (5.1/5.3/5.4).

**Note pour la suite (5.6) :** le jeu de codes de récupération du compte admin a été **régénéré** pendant la vérification (l'ancien était épuisé) et **un code a été consommé** par le test. Il en reste 7, qui ne sont affichés nulle part — Jeevons devra en regénérer un jeu depuis `/admin/settings/security` s'il veut disposer de codes qu'il connaît.

### File List

**Créés**
- `apps/web/src/app/login/2fa/page.tsx` — écran du second facteur (server component ; redirige selon l'état de session)
- `apps/web/src/app/login/2fa/mfa-form.tsx` — vue cliente « bête » (`useActionState`)
- `apps/web/src/app/login/2fa/actions.ts` — server action de promotion en session complète
- `apps/web/src/lib/mfa-rate-limit.ts` — rate-limit 5/15 min/IP, clé distincte de 5.2
- `apps/web/src/types/next-auth.d.ts` — augmentation de types Auth.js (`mfaPending`, `mfaDeadline`, `mfaSatisfied`)
- `apps/web/prisma/migrations/20260725100900_add_user_totp_last_counter/migration.sql`

**Modifiés**
- `apps/web/prisma/schema.prisma` — champ additif `User.totpLastCounter Int?`
- `apps/web/src/lib/auth.config.ts` — `mfaStateFromToken`, callbacks `authorized` / `jwt` / `session`, constantes TTL et route
- `apps/web/src/lib/auth.ts` — `authorize` pose `mfaPending` ; export d'`unstable_update`
- `apps/web/src/lib/auth/totp.ts` — `looksLikeTotpCode`, `verifyTotpCodeWithStep` (anti-rejeu + `timeStep`)
- `apps/web/src/proxy.ts` — redirection des sessions partielles vers `/login/2fa`
- `apps/web/src/app/(admin)/admin/layout.tsx` — garde de défense en profondeur
- `apps/web/src/lib/require-admin.ts` — `requireAdmin` / `requireAdminApi` exigent une session complète

### Change Log

| Date | Version | Description |
|------|---------|-------------|
| 2026-07-25 | 1.0 | Story 5.5 implémentée : login en deux temps (session partielle 5 min → TOTP ou code de récupération → session complète), tolérance ±1 pas, anti-rejeu persisté, rate-limit 5/15 min/IP. 13/13 vérifications au vert. |
