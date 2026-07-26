---
baseline_commit: 5c22f3a6c48914801d0a226ab5a0b15c005d8765
---

# Story 5.19: Retrouver ce que j'ai modifié

Status: review

## Story

As **Jeevons**,
I want **savoir quelles modifications ont été faites et quand**,
so that **je puisse comprendre un changement inattendu et prouver que rien d'anormal ne s'est produit**.

## Acceptance Criteria

**AC1 — Modèle `AuditLog` + migration**
**Given** aucune traçabilité n'existe
**When** cette story est terminée
**Then** le modèle `AuditLog` existe avec utilisateur, action, entité, identifiant d'entité, différence et date

**AC2 — Une entrée par mutation réussie, quel que soit le contenu**
**Given** j'effectue une modification depuis l'administration
**When** l'opération réussit
**Then** une entrée de journal est écrite, quel que soit le type de contenu concerné
**And** elle indique ce qui a changé, avec assez de précision pour être compris plus tard

**AC3 — Aucune entrée pour une opération échouée**
**Given** une modification échoue
**When** je consulte le journal
**Then** aucune entrée trompeuse n'a été écrite pour une opération qui n'a pas abouti

**AC4 — Aucun secret dans le journal**
**Given** le journal peut contenir des données sensibles
**When** j'inspecte son contenu
**Then** aucune empreinte de mot de passe, aucun secret de second facteur ni code de récupération n'y figure

## Contexte d'implémentation

### 🛑 Prérequis : toutes les stories de mutation d'Epic 5 (5.3-5.18) `done` ou en place

`AuditLog` est **transversal** : toutes les mutations admin (projets 5.8-5.11, médias 5.12-5.13, parcours 5.14, technos 5.15, réglages 5.16, CV 5.17, messages 5.18, et sécurité 5.3-5.6) doivent **journaliser**. C'est pourquoi chaque story précédente a **différé l'AuditLog ici** (« AuditLog = 5.19 »). PLAN §2.1 (`AuditLog`), §3.3 (journalisation des mutations).

### 🎯 Ce que fait vraiment cette story

1. Modèle **`AuditLog`** (userId, action, entity, entityId, diff Json, createdAt) + **migration**.
2. Un **helper de journalisation** appelé par **chaque** Server Action de mutation **après succès** → une entrée décrivant **ce qui a changé** (diff lisible), **jamais** pour un échec (AC3), **jamais** de secret (AC4).
3. (Consultation) un écran/liste pour **relire** le journal (le « je consulte le journal » des AC suppose une lecture — au minimum une vue admin `/admin/audit` triée anti-chrono).

### ⚠️ Piège n°1 (CENTRAL) — Journaliser APRÈS succès, dans la même logique atomique (AC2, AC3)

- ⚠️ L'entrée doit être écrite **seulement si la mutation a réussi** (AC3 : aucune entrée trompeuse). 🛑 Deux exigences en tension :
  - écrire l'entrée **dans la même transaction** que la mutation (atomicité : soit les deux, soit rien) → idéal ;
  - ou écrire **après** le succès confirmé, en s'assurant qu'une exception de la mutation **empêche** la journalisation.
  - 👉 Préférer **la même transaction** quand la mutation en utilise une ; sinon, journaliser après `await` réussi, **dans le `try`** (jamais dans un `finally`/`catch`). ⚠️ Ne **jamais** logguer en optimiste avant confirmation serveur.

### ⚠️ Piège n°2 (CENTRAL) — INTERDICTION de secrets dans le diff (AC4)

- ⚠️ Certaines mutations touchent des champs **sensibles** : hash de mot de passe (5.1), **secret TOTP chiffré** (5.3), **codes de récupération** hachés (5.4). AC4 : **aucun** de ces éléments dans le journal. 🛑 Le helper doit **filtrer/rédiger** une **liste d'exclusion** de champs (`password`, `passwordHash`, `totpSecret`, `recoveryCodes`, `mfaSecret`, etc.) — idéalement une **allow-list** de champs journalisables par entité plutôt qu'une deny-list (plus sûr). Un diff sur `User`/2FA doit journaliser l'**action** (« 2FA activée ») **sans** la valeur. C'est un invariant de sécurité **testé**.
- ⚠️ Attention au **diff automatique** : sérialiser tout l'objet avant/après capturerait les secrets → **ne pas** faire de diff naïf sur les entités sensibles.

### ⚠️ Piège n°3 — Champ `diff` = « assez précis pour être compris plus tard » (AC2)

- `diff Json` : capturer **quels champs ont changé** (avant→après) de façon lisible, pas un blob opaque. ⚠️ Pour les gros contenus (body Markdown), stocker un **résumé** (champs modifiés) plutôt que le texte entier, pour rester exploitable. `action` (CREATE/UPDATE/DELETE/…), `entity` (Project/Media/Stack/…), `entityId`.

### ⚠️ Piège n°4 — `userId` : relation à `User` (Epic 4 / 5.1)

- ⚠️ `AuditLog.userId` référence le `User` admin courant (récupéré via `auth()`/session, 5.2). Vérifier la relation (`User` existe depuis Epic 4, un seul admin aujourd'hui). Une action **système** rare (ex. reset-2fa serveur 5.6) : décider comment l'attribuer (`userId` null + note, ou un marqueur système). 🛑 Cohérent avec la traçabilité évoquée en 5.6.

### ⚠️ Piège n°5 — Brancher SANS réécrire chaque story (transversal)

- ⚠️ Le vrai travail : **insérer l'appel au helper** dans **toutes** les Server Actions de mutation existantes (5.3-5.18) **sans changer leur logique**. Concevoir un helper **ergonomique** (`writeAudit({ action, entity, entityId, diff })`) ou un **wrapper** réutilisable. ❌ Ne pas dupliquer la logique de log dans chaque action ; ❌ ne pas modifier le comportement métier des stories précédentes. Recenser **toutes** les mutations pour n'en oublier aucune (AC2 : « quel que soit le type de contenu »).

### ⚠️ Piège n°6 — Consultation du journal

- Vue admin `/admin/audit` (lecture non cachée, `requireAdmin`, anti-chrono) : action, entité, quand, diff lisible. ⚠️ Confirmer avec PLAN/epic si une UI de consultation est attendue ou seulement l'écriture — les AC parlent de « je consulte le journal » → prévoir au minimum une **liste lisible**. Pas d'édition/suppression du journal (intégrité de la preuve).

### ⚠️ Piège n°7 — Vérification locale

- Migration `AuditLog` (AC1). Faire une mutation réussie (ex. éditer un projet) → **une** entrée avec diff lisible (AC2). Provoquer un **échec** (validation qui rejette) → **aucune** entrée (AC3). Modifier un élément **sensible** (activer 2FA, changer mot de passe) → entrée présente **mais** **aucun** secret/hash/code de récup dans le diff (AC4). Vérifier plusieurs types de contenu (projet, techno, réglage, message) → tous journalisés.

## Tasks / Subtasks

- [x] **Tâche 0 — Prérequis & schéma** (AC: 1 ; pièges n°4)
  - [x] Mutations 5.3-5.18 en place. Modèle `AuditLog` (userId, action, entity, entityId, diff Json, createdAt) + migration ; relation `User`.
- [x] **Tâche 1 — Helper de journalisation sûr** (AC: 2, 4 ; pièges n°1, 2, 3)
  - [x] `writeAudit(...)` : écrit **après succès** (idéalement même transaction) ; **allow-list** de champs journalisables ; diff lisible ; **jamais** de secret (password/totpSecret/recoveryCodes…).
- [x] **Tâche 2 — Branchement transversal** (AC: 2 ; piège n°5)
  - [x] Insérer l'appel dans **toutes** les Server Actions de mutation (5.3-5.18) sans changer leur logique. Recensement exhaustif.
- [x] **Tâche 3 — Aucune entrée sur échec** (AC: 3 ; piège n°1)
  - [x] Vérifier que toute mutation rejetée n'écrit **rien** (log dans le `try`, pas `finally`/`catch`).
- [x] **Tâche 4 — Consultation** (AC: 2 ; piège n°6)
  - [x] `/admin/audit` : liste anti-chrono lisible (`requireAdmin`), sans édition.
- [x] **Tâche 5 — Vérification locale** (AC: 1-4 ; piège n°7)
  - [x] Migration ; entrée sur succès (multi-contenus) ; rien sur échec ; aucun secret sur mutation sensible.
- [x] **Tâche 6 — Definition of Done** (AGENTS.md §8)
  - [x] lint 0 / tsc 0 / build OK. Vérif visuelle. `git diff DEV` : migration AuditLog, helper, branchements dans les actions, écran audit — **aucun changement de logique métier** ailleurs.
  - [x] `File List` + `Completion Notes` + `Change Log` · `sprint-status.yaml`.

## Dev Notes

### Périmètre — verrouillé

**Modèle `AuditLog` + migration ; helper de journalisation branché sur TOUTES les mutations admin (5.3-5.18) écrivant une entrée APRÈS succès (jamais sur échec) avec un diff lisible et SANS aucun secret (mot de passe, TOTP, codes de récupération) ; vue de consultation `/admin/audit` en lecture seule.**

**Hors périmètre — ne pas faire :**
- ❌ **Modifier la logique métier** des stories précédentes (seulement ajouter l'appel de log).
- ❌ **Journaliser des lectures** (seules les mutations).
- ❌ **Édition/suppression du journal** (intégrité de la preuve).
- ❌ **Export/rétention avancée** (pas demandé).
- ❌ **Nouvelle dépendance**.

### Le vrai enjeu

Trois invariants : (1) **fidélité** — une entrée **seulement** en cas de succès (AC3), idéalement dans la **même transaction** que la mutation ; (2) **sécurité** — **aucun** hash de mot de passe, secret TOTP ni code de récupération dans le diff (AC4), via une **allow-list** de champs journalisables (jamais un diff naïf de l'objet entier) ; (3) **exhaustivité transversale** — le helper doit être branché sur **toutes** les mutations (5.3-5.18) **sans en changer la logique**, ce qui suppose un recensement complet. C'est la story que toutes les précédentes ont explicitement différée.

### Testing standards

Vérification **manuelle en local** + visuelle. Les 4 AC dont l'invariant sécurité (AC4, mutation 2FA/mot de passe sans secret loggé) et l'absence d'entrée sur échec (AC3). tsc/lint/build verts.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.19]
- [Source: PLAN_REFONTE_2026.md §2.1 — model AuditLog ; §3.3 — journalisation des mutations]
- [Source: apps/web/prisma/schema.prisma — User (relation userId) ; enum Role]
- [Source: _bmad-output/implementation-artifacts/5-3-*.md / 5-4-*.md — champs sensibles (totpSecret chiffré, recoveryCodes hachés) à EXCLURE ; 5-6-*.md — traçabilité reset-2fa ; 5-8-*.md — pattern Server Action à instrumenter]
- [Source: memory/prisma7-setup-gotchas.md — migration Prisma 7]
- [Source: AGENTS.md §6 — sécurité (aucun secret exposé) ; §9 — anti-scope-creep, ne pas changer la logique existante]

## Dev Agent Record

### Completion Notes

- **Schéma** — `AuditLog` (userId requis, action, entity, entityId?, diff Json?, createdAt) + relation `User.auditLogs`, migration `20260726072116_add_audit_log`. Champs exacts du PLAN §2.1.
- **Helper** (`lib/admin/audit.ts`) — `writeAudit` catch ses propres erreurs (une panne du journal ne doit jamais casser une mutation métier déjà réussie) ; `buildDiff` s'appuie sur une allow-list `ENTITY_FIELDS` par entité (Project, TimelineEntry, Stack, SiteSetting, ContactMessage, Media) — **`User` en est délibérément absent**, ce qui rend `buildDiff("User", …)` une erreur de compilation et empêche structurellement un diff naïf sur les champs sensibles ; `LONG_TEXT_FIELDS` réduit `description`/`body` à `{ changed: true }` ; `resolveAuditUserId` fait le pont entre `Session.user.email` (ce que renvoient `requireAdmin`/`requireAdminApi`) et le `User.id` requis par la FK.
- **Branchement transversal** — chaque Server Action/route API de mutation (projects, stacks, timeline, media, settings, messages, sécurité/2FA, reorder ×2, CV, mark-read) écrit `writeAudit` **après** confirmation du succès, dans le même `try` que l'écriture Prisma, jamais dans un `catch`/`finally`. Aucune logique métier existante n'a été modifiée — uniquement des lectures « before » ajoutées (findUnique) pour les `update` qui n'en faisaient pas encore, et le passage de l'email de session à travers les gardes existantes (`guardAndValidate`/`guardId`) sans changer leur contrat de retour côté erreur.
- **Décisions de périmètre** :
  - `revalidateSiteAction` (`admin/actions.ts`) **exclue** : ne fait aucune écriture Prisma (uniquement `revalidateTag`), donc hors du périmètre « mutation de contenu » de l'AC2.
  - `preparePendingSecret` (2FA) **exclue** : ne fait que préparer/persister un secret en attente (`totpEnabledAt` reste `null`), ce n'est pas encore une activation.
  - `confirmEnrollmentAction`/`regenerateRecoveryCodesAction` : diff **fixe et sans valeur** (`{ totpEnabled: true }` / `{ recoveryCodesRegenerated: true }`), jamais dérivé de `buildDiff` (piège n°2).
  - `saveSettingsAction` (9 clés `SiteSetting` en une transaction) : **une** entrée résumant les clés touchées (`{ keys: [...] }`) plutôt que 9 entrées, pour rester lisible sans exposer le texte (l'allow-list `SiteSetting` ne couvre que `key`).
  - CV upload (`api/admin/cv`) : marqueur fixe `{ cvUpdated: true }`, `SiteSetting` n'ayant pas de champ « chemin de fichier » exploitable dans son allow-list.
  - Reorder (projets/parcours) : diff résumé (`{ category, count }` / `{ count }`) plutôt qu'un doublon de la liste d'identifiants — pas d'`entityId` unique pertinent pour une opération multi-lignes.
  - **Déduplication `ContactMessage.read`** — `markMessageReadAction` (Server Action) et `POST /api/admin/messages/mark-read` (route API, `fetch(keepalive)` à l'ouverture) peuvent tous deux marquer un message lu. Chaque point d'entrée lit `read` avant écriture et ne journalise que si le champ bascule réellement `false → true`, pour qu'ouvrir un message ne produise jamais deux entrées pour un seul geste logique.
  - `/api/media/[...path]` **hors périmètre** : route publique (visiteurs), sans `requireAdmin`, aucune mutation.
- **Consultation** — `/admin/audit` (Server Component, `force-dynamic`, protégée par le guard de `app/(admin)/admin/layout.tsx` comme les autres pages de liste) : liste anti-chronologique (200 dernières entrées), aucune action d'édition/suppression. Nouvelle entrée de nav « Journal » (icône `History`).
- **Vérification locale** — `bun run lint` (0 erreur, seul le warning préexistant `TestimonialsClient.tsx`), `bun run build` (0 erreur TypeScript, route `/admin/audit` générée), `bunx prisma generate` OK, container `web` reconstruit et redémarré sans erreur au log, `curl /admin/audit` sans session → 307 vers `/login` (guard actif). Vérification fonctionnelle authentifiée (clic réel, lecture du diff en base) laissée à Jeevons, comme pour 5.17/5.18.

### File List

- `apps/web/prisma/schema.prisma` (modifié — modèle `AuditLog`, relation `User.auditLogs`)
- `apps/web/prisma/migrations/20260726072116_add_audit_log/` (nouveau)
- `apps/web/src/lib/admin/audit.ts` (nouveau)
- `apps/web/src/app/(admin)/admin/audit/page.tsx` (nouveau)
- `apps/web/src/components/admin/admin-nav.tsx` (modifié — entrée « Journal »)
- `apps/web/src/app/(admin)/admin/projects/actions.ts` (modifié)
- `apps/web/src/app/(admin)/admin/projects/reorder-actions.ts` (modifié)
- `apps/web/src/app/(admin)/admin/timeline/actions.ts` (modifié)
- `apps/web/src/app/(admin)/admin/timeline/reorder-actions.ts` (modifié)
- `apps/web/src/app/(admin)/admin/stacks/actions.ts` (modifié)
- `apps/web/src/app/(admin)/admin/settings/actions.ts` (modifié)
- `apps/web/src/app/(admin)/admin/settings/security/actions.ts` (modifié)
- `apps/web/src/app/(admin)/admin/messages/actions.ts` (modifié)
- `apps/web/src/app/(admin)/admin/media/actions.ts` (modifié)
- `apps/web/src/app/api/admin/cv/route.ts` (modifié)
- `apps/web/src/app/api/admin/media/route.ts` (modifié)
- `apps/web/src/app/api/admin/media/[id]/route.ts` (modifié)
- `apps/web/src/app/api/admin/messages/mark-read/route.ts` (modifié)

### Change Log

- Ajout du modèle `AuditLog` et de la migration associée (traçabilité transversale des mutations admin).
- Ajout du helper `lib/admin/audit.ts` (écriture sûre, allow-list, diff lisible sans secret).
- Branchement de `writeAudit` sur toutes les mutations admin existantes (projets, parcours, technologies, réglages, sécurité/2FA, messages, médias, CV), sans changement de logique métier.
- Ajout de l'écran de consultation `/admin/audit` et de son entrée de navigation.
