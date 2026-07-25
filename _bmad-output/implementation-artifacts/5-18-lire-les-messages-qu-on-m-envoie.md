---
baseline_commit: 5c22f3a6c48914801d0a226ab5a0b15c005d8765
---

# Story 5.18: Lire les messages qu'on m'envoie

Status: ready-for-dev

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

- [ ] **Tâche 0 — Prérequis & schéma** (AC: 1 ; piège n°1)
  - [ ] Socle `done`. Lire PLAN §2.1 (champs exacts). Modèle `ContactMessage` + migration (`migrate dev`/`generate`).
- [ ] **Tâche 1 — Boîte de réception** (AC: 2, 5 ; pièges n°2, 5)
  - [ ] `/admin/messages` : liste anti-chrono, non lus distingués, **état vide** explicite.
- [ ] **Tâche 2 — Lu / non lu** (AC: 3 ; piège n°3)
  - [ ] Ouverture explicite → `read=true` ; action « marquer non lu » ; `requireAdmin`.
- [ ] **Tâche 3 — Suppression** (AC: 4 ; piège n°4)
  - [ ] Suppression hard confirmée ; `requireAdmin`.
- [ ] **Tâche 4 — Raccord dashboard** (AC: 2 ; piège n°6)
  - [ ] Compléter la carte « messages non lus » de 5.7 (compte réel + lien).
- [ ] **Tâche 5 — Vérification locale** (AC: 1-5 ; piège n°7)
  - [ ] Migration, insertion directe, tri + non lus, lu/non lu, suppression, état vide, compte dashboard.
- [ ] **Tâche 6 — Definition of Done** (AGENTS.md §8)
  - [ ] lint 0 / tsc 0 / build OK. Vérif visuelle + clavier. `git diff DEV` : migration ContactMessage, écran messages, lu/non lu, suppression, carte dashboard — rien d'autre (pas le formulaire public).
  - [ ] `File List` + `Completion Notes` + `Change Log` · `sprint-status.yaml`.

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
