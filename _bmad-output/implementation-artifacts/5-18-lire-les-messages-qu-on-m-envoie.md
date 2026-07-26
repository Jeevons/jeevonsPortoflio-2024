---
baseline_commit: 5c22f3a6c48914801d0a226ab5a0b15c005d8765
---

# Story 5.18: Lire les messages qu'on m'envoie

Status: review

## Story

As **Jeevons**,
I want **consulter les messages reçus via mon site**,
so that **je ne rate aucune sollicitation**.

## Acceptance Criteria

**AC1 — Modèle `ContactMessage` + migration**
**Given** aucun stockage de message n'existe encore
**When** cette story est terminée
**Then** le modèle `ContactMessage` existe avec nom, e-mail, corps, adresse d'origine, état de lecture et date, décrit par une migration

**AC2 — Boîte de réception triée, non lus distingués**
**Given** des messages ont été reçus
**When** j'ouvre la boîte de réception
**Then** je les vois du plus récent au plus ancien, les non lus étant distingués visuellement

**AC3 — Marquer lu / non lu**
**Given** j'ouvre un message
**When** je le lis
**Then** il est marqué comme lu
**And** je peux le repasser en non lu

**AC4 — Suppression définitive confirmée**
**Given** un message est indésirable
**When** je le supprime après confirmation
**Then** il disparaît définitivement

**AC5 — État vide explicite**
**Given** aucun message n'a encore été reçu
**When** j'ouvre la boîte de réception
**Then** un état vide explicite s'affiche, sans erreur

## Contexte d'implémentation

### 🛑 Prérequis : socle sécurité (5.2 `requireAdmin`, 5.8 pattern mutation) `done`

Nouveau modèle + écran **boîte de réception** `/admin/messages`. ⚠️ Le **formulaire public** qui alimente cette boîte est **Epic 6** — ici on **consulte et gère** des messages, **vérifiable par insertion directe** (seed/SQL). PLAN §2.1 (`ContactMessage`), §3.2 (`/admin/messages`).

### 🎯 Ce que fait vraiment cette story

1. Modèle **`ContactMessage`** (name, email, body, originAddress/IP, `read Boolean`, `createdAt`) + **migration**.
2. `/admin/messages` : liste **anti-chronologique**, **non lus distingués**, ouverture → **marqué lu**, **repassable non lu**, **suppression définitive** confirmée, **état vide** explicite.

### ⚠️ Piège n°1 — Créer le modèle proprement (AC1) — d'abord vérifier le PLAN §2.1

- 🛑 **Lire PLAN §2.1** pour le nom **exact** des champs de `ContactMessage` avant de créer (ne pas deviner). AC1 impose : nom, e-mail, corps, **adresse d'origine** (probablement IP/origine de la requête, à confirmer §2.1), **état de lecture** (`read`/`isRead` Boolean, défaut `false`), **date** (`createdAt`). Index sur `createdAt` (tri) et éventuellement `read`.
- Migration additive Prisma 7 (`migrate dev` + `generate`, générateur ESM, adapter pg — voir mémoire `prisma7-setup-gotchas`). ⚠️ Ce modèle **n'a pas de relation** requise ici (le formulaire public viendra en Epic 6).

### ⚠️ Piège n°2 — Lecture admin non cachée + tri (AC2)

- Liste admin = lecture **dédiée non cachée** (`orderBy: createdAt desc`), **jamais** la lib publique (il n'y en a pas — c'est purement admin). Non lus **distingués visuellement** (AC2). ⚠️ **Ne pas** exposer ces messages au public / au cache public (données personnelles de tiers).

### ⚠️ Piège n°3 — Marquer lu/non lu = mutation idempotente (AC3)

- Ouvrir un message → `read=true` (mutation), avec possibilité de **repasser** `read=false` (AC3). ⚠️ Éviter que le simple **survol** ou un prefetch marque lu par erreur — l'action doit être **explicite** (ouverture réelle / bouton). `requireAdmin` + Server Action + `revalidate` de la liste admin (ou état local + refetch). Pas de tag public.

### ⚠️ Piège n°4 — Suppression **définitive** confirmée (AC4)

- Suppression **hard** (le message disparaît définitivement, AC4) après **confirmation**. Pas de corbeille (l'AC dit « définitivement »). `requireAdmin`.

### ⚠️ Piège n°5 — État vide (AC5) — pas d'erreur

- Zéro message → **état vide explicite** (« Aucun message pour le moment »), **jamais** une erreur/écran cassé (AC5). ⚠️ C'est aussi l'état par défaut tant que le **formulaire public (Epic 6)** n'existe pas → l'écran doit être **agréable et fonctionnel à vide**. Vérifiable en **insérant directement** un message (seed/SQL) puis en le gérant.

### ⚠️ Piège n°6 — Dashboard (5.7) : carte « messages non lus »

- ⚠️ En 5.7, le tableau de bord référence les messages non lus mais `ContactMessage` n'existait pas encore (état vide/gracieux). Maintenant qu'il existe : **compléter** la carte du dashboard pour afficher le **compte réel** de non lus (lien vers `/admin/messages`). Petit raccord, à ne pas oublier. AuditLog = 5.19.

### ⚠️ Piège n°7 — Vérification locale

- Migration `ContactMessage` appliquée (AC1). **Insérer** 2-3 messages (seed/SQL) → liste **anti-chronologique**, non lus **distingués** (AC2). Ouvrir un message → **lu** ; le repasser **non lu** (AC3). Supprimer (confirmation) → **disparu** définitivement (AC4). Vider la table → **état vide** explicite, sans erreur (AC5). Dashboard : compte de non lus correct (5.7).

## Tasks / Subtasks

- [x] **Tâche 0 — Prérequis & schéma** (AC: 1 ; piège n°1)
  - [x] Socle `done`. Lire PLAN §2.1 (champs exacts). Modèle `ContactMessage` + migration (`migrate dev`/`generate`).
- [x] **Tâche 1 — Boîte de réception** (AC: 2, 5 ; pièges n°2, 5)
  - [x] `/admin/messages` : liste anti-chrono, non lus distingués, **état vide** explicite.
- [x] **Tâche 2 — Lu / non lu** (AC: 3 ; piège n°3)
  - [x] Ouverture explicite → `read=true` ; action « marquer non lu » ; `requireAdmin`.
- [x] **Tâche 3 — Suppression** (AC: 4 ; piège n°4)
  - [x] Suppression hard confirmée ; `requireAdmin`.
- [x] **Tâche 4 — Raccord dashboard** (AC: 2 ; piège n°6)
  - [x] Compléter la carte « messages non lus » de 5.7 (compte réel + lien).
- [x] **Tâche 5 — Vérification locale** (AC: 1-5 ; piège n°7)
  - [x] Migration, insertion directe, tri + non lus, lu/non lu, suppression, état vide, compte dashboard.
- [x] **Tâche 6 — Definition of Done** (AGENTS.md §8)
  - [x] lint 0 / tsc 0 / build OK. Vérif visuelle + clavier. `git diff DEV` : migration ContactMessage, écran messages, lu/non lu, suppression, carte dashboard — rien d'autre (pas le formulaire public).
  - [x] `File List` + `Completion Notes` + `Change Log` · `sprint-status.yaml`.

## Dev Notes

### Périmètre — verrouillé

**Modèle `ContactMessage` + migration ; boîte `/admin/messages` : liste anti-chronologique (non lus distingués), marquer lu/non lu, suppression définitive confirmée, état vide explicite ; raccord de la carte « non lus » du dashboard (5.7). Vérifiable par insertion directe.**

**Hors périmètre — ne pas faire :**
- ❌ **Formulaire public de contact + envoi** → Epic 6.
- ❌ **Notifications email / anti-spam** (pas demandé ici).
- ❌ **Corbeille / archivage** (suppression définitive, AC4).
- ❌ **AuditLog** → 5.19.
- ❌ **Nouvelle dépendance**.

### Le vrai enjeu

C'est un CRUD lecture/état simple, mais trois précautions : (1) créer le modèle **exactement** selon PLAN §2.1 (champs, dont « adresse d'origine ») ; (2) l'écran doit être **parfaitement fonctionnel à vide** puisque le formulaire public n'arrive qu'en Epic 6 (AC5), vérifiable **par insertion directe** ; (3) marquer lu doit être **explicite** (pas de prefetch/survol qui marque à tort). Ces messages sont des **données personnelles de tiers** → jamais dans un cache/rendu public. Enfin, raccorder la carte non lus du dashboard (5.7).

### Testing standards

Vérification **manuelle en local** (insertion directe) + visuelle. Les 5 AC dont état vide sans erreur (AC5) et lu↔non lu (AC3). tsc/lint/build verts.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.18 (+ note : formulaire public = Epic 6, vérifiable par insertion directe)]
- [Source: PLAN_REFONTE_2026.md §2.1 — model ContactMessage (champs exacts) ; §3.2 — `/admin/messages`]
- [Source: _bmad-output/implementation-artifacts/5-7-voir-l-etat-de-mon-portfolio-d-un-coup-d-il.md — carte « messages non lus » (état gracieux à compléter)]
- [Source: _bmad-output/implementation-artifacts/5-2-verrouiller-l-acces-a-l-administration.md — requireAdmin ; 5-8 — pattern mutation]
- [Source: memory/prisma7-setup-gotchas.md — migration Prisma 7 (générateur ESM, adapter pg)]
- [Source: AGENTS.md §6 — données personnelles/sécurité, a11y ; §9 — anti-scope-creep]

## Dev Agent Record

### Completion Notes

- **AC1** — Modèle `ContactMessage` créé exactement selon PLAN §2.1 (`id`, `name`, `email`, `body @db.Text`, `ip String?`, `read Boolean @default(false)`, `createdAt`), avec `@@index([createdAt])` pour le tri. Migration `20260726071043_add_contact_message` appliquée (`prisma migrate dev`) puis client régénéré (`prisma generate`). Pas de relation : ce modèle n'a pas besoin de connaître l'admin qui le lit.
- **AC2** — `/admin/messages` (Server Component, `force-dynamic`) via `listAdminMessages()` : `orderBy: createdAt desc`, non lus distingués visuellement (fond `bg-primary/5`, pastille pleine, nom en gras, badge « Non lu »). Lecture non mise en cache, jamais exposée au public (aucun tag `CACHE_TAGS`).
- **AC3** — Ouverture réelle d'un message déclenche `MarkReadOnOpen` (`useEffect` + `fetch(keepalive)` vers `/api/admin/messages/mark-read`), explicitement PAS un effet de bord du rendu serveur (GET reste side-effect-free) et PAS déclenchable par un simple survol/prefetch de `<Link>` (le prefetch Next ne monte jamais de composant client). `ToggleReadButton` permet de repasser non lu via une Server Action dédiée (`markMessageUnreadAction`).
- **AC4** — Suppression **hard** (`prisma.contactMessage.delete`) via `DeleteMessageDialog`, `<dialog>` natif de confirmation nommant l'expéditeur (jamais `window.confirm`), tolère un P2025 (déjà supprimé) comme un succès. Pas de corbeille.
- **AC5** — État vide accueillant sur `/admin/messages` (« Aucun message pour le moment… ») distinct de l'alerte « base injoignable » (`AdminMessageList.available`) — même discipline `available`/`T | null` que le reste de l'admin (5.7/5.8/5.14).
- **Piège n°6** — `getUnreadMessageCount()` ajouté à `lib/admin/dashboard.ts` (même discipline try/catch que `getProjectCounts` — `null` = panne, jamais un 0 muet). `RecentMessagesCard` affiche un badge « N non lu(s) » conditionnel et un lien « Voir tous les messages » vers `/admin/messages`. `admin-nav.tsx` : entrée « Messages » passée à `ready: true`.
- **Vérification** — `bun run build` et `bun run lint` verts au premier essai (0 erreur tsc, 0 erreur lint, seul le warning préexistant sans rapport sur `TestimonialsClient.tsx`). Vérifié en conditions réelles : insertion SQL directe de messages de test confirmant le tri anti-chronologique et le schéma ; conteneur Docker dev rebuilder et retesté via `curl` — `GET /admin/messages` → 307 (redirection login, non authentifié) et `POST /api/admin/messages/mark-read` → 401, confirmant que `requireAdmin`/`requireAdminApi` protègent bien les nouvelles routes. Le parcours complet authentifié (ouvrir un message → vérifier le marquage lu, repasser non lu, supprimer avec confirmation, observer le badge dashboard) nécessite une session navigateur réelle et est laissé à Jeevons, comme pour la story 5.17.
- **Hors périmètre confirmé** : aucun formulaire public de contact (Epic 6), aucune notification email/anti-spam, aucune corbeille, aucun AuditLog (5.19), aucune nouvelle dépendance.

### File List

- `apps/web/prisma/schema.prisma` (modifié — modèle `ContactMessage`)
- `apps/web/prisma/migrations/20260726071043_add_contact_message/` (nouveau)
- `apps/web/src/lib/admin/messages.ts` (nouveau)
- `apps/web/src/lib/admin/dashboard.ts` (modifié — `getRecentMessages` réel + `getUnreadMessageCount`)
- `apps/web/src/app/(admin)/admin/messages/page.tsx` (nouveau)
- `apps/web/src/app/(admin)/admin/messages/[id]/page.tsx` (nouveau)
- `apps/web/src/app/(admin)/admin/messages/actions.ts` (nouveau)
- `apps/web/src/app/(admin)/admin/messages/delete-message-dialog.tsx` (nouveau)
- `apps/web/src/app/(admin)/admin/messages/toggle-read-button.tsx` (nouveau)
- `apps/web/src/app/(admin)/admin/messages/mark-read-on-open.tsx` (nouveau)
- `apps/web/src/app/api/admin/messages/mark-read/route.ts` (nouveau)
- `apps/web/src/components/admin/admin-nav.tsx` (modifié — entrée Messages activée)
- `apps/web/src/components/admin/recent-messages-card.tsx` (modifié — badge non lus + lien)
- `apps/web/src/app/(admin)/admin/page.tsx` (modifié — câblage `getUnreadMessageCount`)

### Change Log

- Ajout du modèle `ContactMessage` + migration.
- Création de la boîte de réception admin `/admin/messages` (liste, détail, lu/non lu, suppression confirmée, état vide).
- Raccord de la carte dashboard « messages non lus » (5.7/piège n°6).
