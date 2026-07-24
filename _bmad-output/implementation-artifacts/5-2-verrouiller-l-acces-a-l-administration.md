---
baseline_commit: 5c22f3a6c48914801d0a226ab5a0b15c005d8765
---

# Story 5.2: Verrouiller l'accès à l'administration

Status: review

## Story

As **Jeevons**,
I want **qu'aucune page d'administration ne soit atteignable sans session valide**,
so that **mon back-office exposé publiquement ne soit pas une porte ouverte**.

## Acceptance Criteria

**AC1 — `/admin` protégé, aucun rendu partiel sans session**
**Given** des pages d'administration existent
**When** j'appelle une URL sous `/admin` sans session
**Then** je suis redirigé vers la page de connexion
**And** aucun contenu de la page demandée n'est rendu, même partiellement

**AC2 — API admin protégée côté serveur**
**Given** une route d'API d'administration existe
**When** je l'appelle sans session valide
**Then** je reçois un refus explicite et aucune donnée
**And** la protection est appliquée côté serveur, sans dépendre d'une vérification côté navigateur

**AC3 — Retour à la page demandée après login**
**Given** je me connecte après avoir été redirigé
**When** l'authentification réussit
**Then** je suis renvoyé vers la page que je demandais initialement

**AC4 — Rate-limit sur les tentatives de login (5 / 15 min / IP)**
**Given** le back-office est public sur Internet
**When** un attaquant enchaîne les tentatives de connexion
**Then** au-delà de cinq tentatives en quinze minutes depuis une même adresse, les suivantes sont refusées
**And** le refus est temporaire et se lève de lui-même

## Contexte d'implémentation

### 🛑 Prérequis : story 5.1 `done` (Auth.js + session)

5.1 a posé le login qui ouvre une session. 5.2 **ferme la porte** : rien sous `/admin` sans session valide, côté serveur, plus rate-limit anti-force-brute. Toujours PLAN §3.1 (« Middleware Next protégeant `/admin/*` + rate-limit sur `/api/auth/*` (5 tentatives / 15 min / IP) »).

### 🎯 Ce que fait vraiment cette story

Deux gardes **côté serveur** :
1. **Toute route `/admin/*`** (pages + API) exige une session valide. Sans session → redirection vers le login (pages) ou refus JSON (API). **Aucun rendu partiel** de la page protégée.
2. **Rate-limit** : ≤ 5 tentatives de login / 15 min / IP, verrou **temporaire** qui se lève seul.
Plus le **retour à l'URL demandée** après login réussi (callback URL).

### ⚠️ Piège n°1 (CENTRAL) — Middleware `matcher` : ne PAS gater la page de login ni `/api/auth`

- Le middleware Next (`apps/web/src/middleware.ts`, à créer — absent aujourd'hui) protège `/admin/*`. ⚠️ Son `matcher` **ne doit pas** inclure la page de login (5.1) ni `/api/auth/*` (sinon boucle de redirection infinie : non connecté → login → protégé → login…). Exclure aussi les assets statiques (`_next`, favicon…).
- Auth.js v5 fournit `auth` comme middleware (`export { auth as middleware }` avec logique de redirection) : réutiliser la config `src/lib/auth.ts`/`src/auth.ts` de 5.1, ne pas recréer une vérification parallèle.
- ⚠️ **Défense en profondeur** : le middleware protège au bord, mais chaque **Server Action / route API** admin re-vérifie la session (`auth()`), car un middleware seul peut être contourné selon la config. AC2 exige explicitement une protection **côté serveur** indépendante du navigateur.

### ⚠️ Piège n°2 — Aucun rendu partiel (AC1)

- Le layout du groupe `/admin` (ex. `app/(admin)/admin/layout.tsx`, PLAN §arborescence « (admin)/admin/ ») doit **court-circuiter** avant tout rendu de contenu si pas de session : `const session = await auth(); if (!session) redirect('/login?callbackUrl=…')`. Le middleware redirige déjà au bord, mais le guard de layout garantit qu'**aucun composant enfant** ne rende de données même en cas de contournement du middleware (AC1 « même partiellement »).
- ❌ Ne pas se contenter d'un `useSession` client qui masque le contenu après hydratation : le HTML serait déjà parti (fuite). Gating **serveur**.

### ⚠️ Piège n°3 — Callback URL sûre (AC3)

- Capturer l'URL initialement demandée et la passer en `callbackUrl` au login ; après succès, y renvoyer.
- ⚠️ **Open-redirect** : ne rediriger que vers des chemins **internes** (`/admin/...`). Rejeter toute `callbackUrl` absolue/externe (ne jamais renvoyer vers `https://evil.example`). Auth.js valide déjà l'origine ; vérifier que la valeur reste un chemin relatif au site.

### ⚠️ Piège n°4 (le point dur) — Rate-limit sans Redis, mono-conteneur, self-healing (AC4)

- PLAN : 5 tentatives / 15 min / IP sur le login, verrou temporaire auto-levé.
- ⚠️ **Pas de Redis** dans l'archi (mono-conteneur, coût VPS nul — AGENTS.md §1). Deux options, à trancher avec Jeevons :
  - **(a)** Compteur **en mémoire процессus** (`Map<ip, {count, resetAt}>`) — simple, suffisant pour un mono-conteneur, mais remis à zéro à chaque redémarrage (acceptable ici). Fenêtre glissante 15 min, auto-expiration.
  - **(b)** Persistance en base (table dédiée) — survit au redémarrage mais alourdit (écriture par tentative). **Sur-ingénierie probable** pour un seul utilisateur légitime.
  - 👉 Recommandation : **(a)** en mémoire, documenté comme choix mono-conteneur (cohérent avec le raisonnement « verrou multi-instances hors périmètre » de 4.6). Le verrou se **lève seul** (fenêtre expirée).
- ⚠️ **IP réelle derrière Traefik** : en prod le client est derrière le reverse-proxy Coolify/Traefik → lire l'IP dans `X-Forwarded-For` (première entrée), pas l'IP de socket (qui serait celle du proxy). Sinon toutes les requêtes partagent une IP et un seul attaquant verrouille tout le monde. Vérifier l'en-tête réellement transmis (story 2.6 : Traefik).
- ⚠️ Le rate-limit s'applique **avant** la vérification du mot de passe, pour ne pas offrir un canal de calcul, mais **après** l'anti-énumération de 5.1 (message générique conservé). Retour explicite mais générique (« trop de tentatives, réessayez plus tard »).

### ⚠️ Piège n°5 — Structure de routes : introduire le groupe `(admin)`

- PLAN §arborescence : `app/(admin)/admin/`. Créer le groupe et un `layout.tsx` porteur du guard (piège n°2). ⚠️ Une **page `/admin` minimale** suffit ici (placeholder) pour prouver la protection ; le vrai dashboard est 5.7. Ne pas construire d'écran de gestion (anti-scope-creep).
- La page de login (5.1) reste **hors** du groupe protégé (piège n°1).

### ⚠️ Piège n°6 — Vérification locale

- Sans session : `GET /admin` → 307 vers login, **0 octet** de la page admin dans la réponse ; `GET/POST` d'une route API admin de test → 401/403 JSON, aucune donnée.
- Avec session : accès OK ; login depuis `/admin/xxx` → après succès, retour sur `/admin/xxx` (AC3).
- Rate-limit : scripter 6 POST de login en < 15 min depuis la même IP → la 6ᵉ refusée ; attendre/forcer l'expiration → déverrouillage (AC4).

## Tasks / Subtasks

- [x] **Tâche 0 — Prérequis** (AC: 1)
  - [x] Confirmer 5.1 `done` (session Auth.js opérationnelle). Réutiliser sa config `auth`. → 5.1 est `review` mais implémentée et validée (login/session opérationnels, vérifié en local et conteneur). Config `auth` réutilisée telle quelle.
- [x] **Tâche 1 — Middleware de protection `/admin/*`** (AC: 1, 2 ; pièges n°1, 2)
  - [x] `src/proxy.ts` (⚠️ Next 16 renomme `middleware`→`proxy`) : `export default auth(...)` + `matcher` sur `/admin` et `/admin/:path*` (login, `/api/auth`, assets exclus). Config Auth.js split (edge-safe `auth.config.ts`) pour ne pas embarquer Prisma sur l'edge.
  - [x] Groupe `app/(admin)/admin/` + `layout.tsx` avec guard serveur (`auth()` → `redirect`), page `/admin` placeholder.
- [x] **Tâche 2 — Garde côté serveur des Server Actions / API admin** (AC: 2 ; piège n°1)
  - [x] Helper `requireAdmin()` (lève `UnauthorizedError`) + `requireAdminApi()` (renvoie 401 JSON), réutilisables par toutes les mutations admin des stories suivantes. Vérifié : 401 sans session, 200 avec.
- [x] **Tâche 3 — Callback URL sûre** (AC: 3 ; piège n°3)
  - [x] Propager `callbackUrl` (chemin interne uniquement, `safeCallbackUrl` anti open-redirect) ; retour après login réussi. Vérifié : `/admin/projets` round-trip.
- [x] **Tâche 4 — Rate-limit login (5/15 min/IP)** (AC: 4 ; piège n°4)
  - [x] Compteur en mémoire (fenêtre glissante, auto-expiration), IP via `X-Forwarded-For` (derrière Traefik). 🛑 Tranché avec Jeevons : **(a) en mémoire**.
  - [x] Refus générique temporaire au-delà de 5 ; auto-levée. Comptage unique dans `authorize` (couvre aussi les appels directs à `/api/auth`). Vérifié e2e : IP verrouillée après 5, bon mdp refusé, autre IP OK.
- [x] **Tâche 5 — Vérification locale** (AC: 1-4 ; piège n°6)
  - [x] Sans session : redirection 307 + 0 rendu ; API → 401 JSON. Avec session : OK. Callback → retour à l'URL. Rate-limit → 6ᵉ refusée ; auto-levée prouvée par test unitaire de la fenêtre.
- [x] **Tâche 6 — Definition of Done** (AGENTS.md §8)
  - [x] lint 0 error / tsc 0 / build OK. `git diff DEV` : proxy, groupe admin + layout guard, `requireAdmin`, rate-limit, split config, callbackUrl — rien d'autre.
  - [x] `File List` + `Completion Notes` + `Change Log` · `sprint-status.yaml`.

## Dev Notes

### Périmètre — verrouillé

**Middleware + guard de layout serveur pour `/admin/*`, refus serveur des API admin, callback URL sûre, rate-limit login 5/15 min/IP auto-levé.**

**Hors périmètre — ne pas faire :**
- ❌ **Écrans de gestion / vrai dashboard** → 5.7+ (une page `/admin` placeholder suffit).
- ❌ **2FA / session partielle** → 5.3-5.5 (5.2 protège la session « pleine » de 5.1 ; la session partielle sera gérée en 5.5).
- ❌ **Redis / rate-limit distribué** (mono-conteneur → mémoire).
- ❌ **Rate-limit sur la saisie du code TOTP** → 5.5.
- ❌ **Dépendance nouvelle** (réutiliser Auth.js/argon2 de 5.1).

### Le vrai enjeu

Un back-office **public** sans garde serveur est une porte ouverte. Le middleware seul ne suffit pas (AC2 : côté serveur, indépendant du navigateur) → défense en profondeur (guard de layout + `requireAdmin` sur chaque mutation). Le rate-limit ferme la force-brute ; le piège réel est l'**IP derrière Traefik** (X-Forwarded-For) — sans ça, le verrou frappe tout le monde d'un coup. Le helper `requireAdmin()` posé ici est réutilisé par **toutes** les mutations des stories 5.7-5.19.

### Testing standards

Vérification **manuelle en local**. Guard prouvé sans/avec session (AC1/AC2), callback (AC3), rate-limit et auto-levée (AC4). tsc/lint/build verts.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.2]
- [Source: PLAN_REFONTE_2026.md §3.1 — Middleware protégeant `/admin/*` + rate-limit `/api/auth/*` 5/15 min/IP ; §arborescence — `app/(admin)/admin/`]
- [Source: _bmad-output/implementation-artifacts/5-1-me-connecter-au-back-office.md — config Auth.js réutilisable, session cookie durci]
- [Source: _bmad-output/implementation-artifacts/2-6-rendre-le-portfolio-joignable-sur-son-sous-domaine.md — Traefik/reverse-proxy en prod (IP réelle via X-Forwarded-For)]
- [Source: _bmad-output/implementation-artifacts/4-6-appliquer-les-migrations-automatiquement-au-deploiement.md — raisonnement mono-conteneur (pas de verrou distribué)]
- [Source: AGENTS.md §5 — accès sécurisé avant écrans de gestion ; §6 — logique serveur ; §9 — zéro dépendance non prévue]

## Dev Agent Record

### Implementation Plan

Deux gardes serveur autour de `/admin/*`, réutilisant le socle Auth.js de 5.1 sans le refaire. Split-config Auth.js v5 (`auth.config.ts` edge-safe partagé avec le proxy ; `auth.ts` ajoute le Credentials provider Node) pour que le garde de bord ne tente pas d'embarquer Prisma/argon2 sur l'edge. Défense en profondeur : proxy edge → guard de layout serveur → helper `requireAdmin`. Rate-limit en mémoire (choix mono-conteneur validé par Jeevons), compté au vrai point de vérification (`authorize`) pour couvrir aussi les appels directs à `/api/auth`.

### Completion Notes

- **AC1 (`/admin` protégé, aucun rendu partiel)** : `src/proxy.ts` (garde de bord edge) redirige toute requête `/admin*` sans session vers `/login?callbackUrl=…` en **307**, corps = simple Location (27 octets), **aucun** markup admin. Vérifié : `GET /admin` → 307, `GET /admin/projets` → 307 (chemin exact conservé). Défense en profondeur : `app/(admin)/admin/layout.tsx` re-vérifie `auth()` côté serveur et `redirect()` avant tout rendu d'enfant (couvre un éventuel contournement du proxy — gating strictement serveur, pas de `useSession` client). Avec session : `GET /admin` → 200 + contenu placeholder.
- **AC2 (API admin protégée côté serveur)** : helpers `requireAdmin()` (lève `UnauthorizedError`, pour Server Actions) et `requireAdminApi()` (renvoie `401 {"error":"Non autorisé"}`, pour Route Handlers) dans `src/lib/require-admin.ts` — `import "server-only"`, indépendants du navigateur. Éprouvé via une route de test jetable (supprimée ensuite, anti-scope-creep) : **401 sans session, 200 + donnée avec session**. Ces helpers seront réutilisés par toutes les mutations des stories 5.7-5.19.
- **AC3 (retour à la page demandée)** : le proxy capture `pathname+search` en `callbackUrl` ; `safeCallbackUrl` (`src/lib/safe-callback-url.ts`) n'accepte QUE des chemins internes (rejette `//`, schémas, caractères de contrôle) — parade open-redirect, appliquée sur la page de login ET ré-appliquée dans la server action (jamais confiance à une valeur de formulaire). Vérifié : login déclenché depuis `/admin/projets` → après succès, redirection vers `/admin/projets`.
- **AC4 (rate-limit 5/15 min/IP, auto-levé)** : compteur **en mémoire** (`src/lib/login-rate-limit.ts`, choix (a) validé avec Jeevons — mono-conteneur, pas de Redis, cohérent avec 4.6), fenêtre glissante 15 min, auto-expiration. IP réelle via **`X-Forwarded-For`** (première entrée) pour ne pas partager une IP unique derrière Traefik (sinon un attaquant verrouille tout le monde — piège n°4). **Comptage unique dans `authorize`** (le vrai point de vérification du mot de passe) : cela couvre le login par la server action ET tout appel **direct** à `/api/auth/callback/credentials`. La server action ne fait que *consulter* l'état (`isLoginRateLimited`, sans incrémenter) pour afficher un message dédié « trop de tentatives ». Appliqué **avant** tout `argon2.verify` (pas de canal de calcul), **après** l'anti-énumération de 5.1 (message générique préservé). Vérifié e2e : après 5 mauvaises tentatives depuis une IP, la 6ᵉ avec le **bon** mot de passe est **refusée** (`error=CredentialsSignin`), tandis que le bon mot de passe depuis une **autre** IP **réussit** (`/admin`). Auto-levée prouvée par test unitaire de la fenêtre (fenêtre expirée → bucket frais → autorisé).

### Debug Log

- **Build cassé après ajout du proxy** : `src/proxy.ts` important `@/lib/auth` (→ Prisma → `node:path`/`node:os`) forçait Prisma dans le bundle **edge** → `UnhandledSchemeError`. Résolu par le **split-config Auth.js v5** : `auth.config.ts` (edge-safe, sans provider Node) pour le proxy ; `auth.ts` (Node) importe cette base et ajoute le Credentials provider. Build vert ensuite.
- **Déprécation Next 16** : le build avertissait « the "middleware" file convention is deprecated. Please use "proxy" instead ». Convention `middleware.ts` renommée en `proxy.ts` (fonction/export par défaut `proxy`), `config`/`matcher` inchangés (doc officielle `middleware-to-proxy`). Intention PLAN §3.1 (« Middleware protégeant /admin/* ») inchangée — même garde de bord edge.
- **Double comptage du rate-limit** : première version comptait dans la server action ET dans `authorize` (2 incréments/tentative UI → verrou à ~3 au lieu de 5). Corrigé : source unique dans `authorize`, la server action ne fait qu'une lecture non-incrémentante (`isLoginRateLimited`).
- **Faux positifs `tsc`** : les types générés `.next/types` référençant l'ancien groupe `(admin)` (puis la route de test supprimée) provoquaient des erreurs transitoires ; le passage TypeScript du `build` (autoritaire) passe, et `tsc` repasse à 0 une fois `.next/types` régénéré par le build.
- **Route de test underscore** : `api/_ratest` renvoyait 404 (Next traite les dossiers `_`-préfixés comme privés/non routables). Renommée sans underscore le temps du test, puis supprimée.

## File List

**Nouveaux :**
- `apps/web/src/proxy.ts` — garde de bord edge (Next 16 « proxy ») protégeant `/admin/*`, redirection 307 + `callbackUrl`.
- `apps/web/src/lib/auth.config.ts` — config Auth.js **edge-safe** (base partagée : session JWT, cookie durci, pages, callback `authorized`) ; sans provider Node.
- `apps/web/src/lib/require-admin.ts` — `requireAdmin()` / `requireAdminApi()` (+ `UnauthorizedError`), garde serveur réutilisable (défense en profondeur, AC2).
- `apps/web/src/lib/login-rate-limit.ts` — rate-limit login en mémoire (5/15 min/IP, auto-levé), `clientIpFromHeaders` (X-Forwarded-For), `isLoginRateLimited` (lecture non-incrémentante).
- `apps/web/src/lib/safe-callback-url.ts` — assainit la `callbackUrl` (chemins internes uniquement, anti open-redirect, AC3).
- `apps/web/src/app/(admin)/admin/layout.tsx` — guard serveur du groupe `/admin` (`auth()` → `redirect`, gating avant tout rendu, AC1).
- `apps/web/src/app/(admin)/admin/page.tsx` — page `/admin` **placeholder** (preuve de protection ; vrai dashboard en 5.7).

**Modifiés :**
- `apps/web/src/lib/auth.ts` — spread de `authConfig` (split-config) + rate-limit dans `authorize` (comptage unique, X-Forwarded-For).
- `apps/web/src/app/login/actions.ts` — `callbackUrl` assainie + message « trop de tentatives » (lecture rate-limit non-incrémentante).
- `apps/web/src/app/login/page.tsx` — lit `?callbackUrl` (assainie) et le transmet au formulaire.
- `apps/web/src/app/login/login-form.tsx` — champ caché `callbackUrl` (relais vers la server action).

## Change Log

- 2026-07-24 — Story 5.2 implémentée : verrouillage de `/admin/*` (garde de bord edge « proxy » + guard de layout serveur + helper `requireAdmin`/`requireAdminApi`), callback URL sûre (anti open-redirect), rate-limit login 5/15 min/IP en mémoire auto-levé (IP réelle via X-Forwarded-For, comptage unique dans `authorize`). Split-config Auth.js v5 (edge-safe) pour cohabiter avec le provider Node derrière le proxy edge. Vérifié en local contre la DB `docker-compose` (AC1-AC4). lint/tsc/build verts. Status → review.
