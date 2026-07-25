---
baseline_commit: 5c22f3a6c48914801d0a226ab5a0b15c005d8765
---

# Story 5.16: Modifier les textes de mon site

Status: ready-for-dev

## Story

As **Jeevons**,
I want **changer mon accroche, mon statut et mes coordonnées depuis l'administration**,
so that **je n'aie plus jamais un texte périmé sur mon portfolio**.

## Acceptance Criteria

**AC1 — Écran de réglages éditable**
**Given** je suis sur l'écran des réglages
**When** la page s'affiche
**Then** je peux modifier le titre et le sous-titre de l'accroche, le badge de statut, mes coordonnées et mes liens sociaux

**AC2 — Modification reflétée côté public après revalidation**
**Given** j'enregistre une modification
**When** la revalidation s'effectue
**Then** le site public affiche le nouveau texte

**AC3 — Validation serveur des liens/adresses**
**Given** je saisis un lien ou une adresse mal formée
**When** j'enregistre
**Then** la saisie est refusée avec une explication
**And** la validation est appliquée côté serveur

**AC4 — Correction sans commit ni redéploiement**
**Given** ce sont ces textes qui étaient périmés avant l'Epic 1
**When** j'utilise cet écran
**Then** je peux corriger chacun d'eux sans commit ni redéploiement

## Contexte d'implémentation

### 🛑 Prérequis : socle sécurité + Epic 4 (`SiteSetting` servi côté public) `done`

Le modèle **`SiteSetting`** (key @id, value Json) existe déjà et **alimente le public** (story 4.x « servir réglages depuis la DB »). 5.16 ajoute l'**écran d'édition** `/admin/settings`. PLAN §3.2 (`/admin/settings` : réglages du site) et §3.3 (revalidation ciblée).

### 🎯 Ce que fait vraiment cette story

`/admin/settings` : **formulaire** éditant les clés `SiteSetting` (accroche titre/sous-titre, badge de statut, coordonnées, liens sociaux), **validation serveur** (Zod : URL/email bien formés), **enregistrement** → `revalidateTag('settings')` → public à jour. La finalité (« plus jamais de texte périmé », AC4) : tout se corrige **sans commit ni redéploiement**.

### ⚠️ Piège n°1 (CENTRAL) — `SiteSetting.value` est du **JSON** (key @id) — préserver la forme exacte

- ⚠️ Schéma : `SiteSetting { key @id, value Json }`. C'est un **magasin clé→JSON**, pas des colonnes typées. Le **public lit ces clés avec une forme précise** (`settings.ts`, Epic 4). 🛑 **Recenser d'abord les clés et leurs formes exactes** telles que le seed les écrit et que le public les lit (ex. `hero` = `{ title, subtitle }`, `status` = `{...}`, `contacts` = `{ email, phone? }`, `social` = `[{ label, url }]` — **à vérifier dans le seed et `settings.ts`**, ne pas deviner). L'écran doit **réécrire la même structure** sous peine de casser le rendu public.
- ⚠️ Chaque champ du formulaire mappe une **portion** d'une clé JSON. Valider **par clé** avec un **schéma Zod dédié** reflétant la forme lue par le public.

### ⚠️ Piège n°2 — Validation serveur URL/email (AC3)

- ❌ Validation navigateur contournable → **Zod côté serveur** : liens sociaux = URL valides (`z.string().url()`), email = `z.string().email()`, téléphone = format toléré. Refus **explicite** par champ (AC3). Cohérent avec l'exigence « validation serveur » de tout Epic 5.

### ⚠️ Piège n°3 — Revalidation ciblée `settings` (AC2)

- Après enregistrement → `revalidateTag('settings')` (le tag couvre les `SiteSetting`, décision Epic 4). ⚠️ Vérifier **où** ces textes sont rendus côté public (hero, badge de statut, footer/contacts, liens sociaux) pour confirmer que `settings` invalide bien toutes ces surfaces. AC2 : nouveau texte visible après revalidation.

### ⚠️ Piège n°4 — Cohérence fallback statique (Epic 4)

- ⚠️ Le repli statique (`src/content/*.ts`, 4.5) sert de secours si la DB est injoignable. L'édition modifie la **DB** ; le fallback reste la **valeur historique**. Ne pas casser `readWithFallback`. (Ne pas chercher à réécrire le fichier de fallback — hors périmètre.)

### ⚠️ Piège n°5 — Upsert par clé + pattern mutation 5.8

- Les clés peuvent **exister ou non** en base → **upsert** par `key`. `requireAdmin` + Server Action + Zod par clé + `revalidateTag('settings')`. Lectures admin dédiées (lire toutes les clés éditables, non caché). AuditLog = 5.19.
- ⚠️ **Le CV n'est pas ici** : la story 5.17 (upload PDF) est distincte, même si l'écran est aussi « réglages ». Ne gérer que **textes/liens/coordonnées** ici.

### ⚠️ Piège n°6 — Vérification locale

- Ouvrir `/admin/settings` → tous les champs (accroche titre+sous-titre, statut, coordonnées, liens sociaux) éditables (AC1). Saisir une **URL/email invalide** → refus serveur explicite (AC3). Enregistrer une correction valide → **home publique** à jour après revalidation (AC2). Confirmer qu'aucun **commit/redéploiement** n'est requis (AC4). Vérifier que la **forme JSON** relue par le public est intacte (pas de rendu cassé).

## Tasks / Subtasks

- [ ] **Tâche 0 — Prérequis & recensement des clés** (AC: 1 ; piège n°1)
  - [ ] Socle `done`. Recenser clés `SiteSetting` + formes JSON exactes (seed + `settings.ts`).
- [ ] **Tâche 1 — Formulaire réglages** (AC: 1 ; pièges n°1, 5)
  - [ ] `/admin/settings` : champs accroche/statut/coordonnées/social ; lecture admin de toutes les clés éditables.
- [ ] **Tâche 2 — Validation + enregistrement** (AC: 2, 3 ; pièges n°2, 3, 5)
  - [ ] Zod serveur (URL/email) par clé ; upsert par `key` ; `revalidateTag('settings')`.
- [ ] **Tâche 3 — Vérification locale** (AC: 1-4 ; piège n°6)
  - [ ] Édition complète, refus URL/email invalide (serveur), public à jour, forme JSON préservée, sans commit/redeploy.
- [ ] **Tâche 4 — Definition of Done** (AGENTS.md §8)
  - [ ] lint 0 / tsc 0 / build OK. Vérif visuelle + clavier. `git diff DEV` : écran settings, Zod, upsert, revalidation `settings` — rien d'autre (pas le CV).
  - [ ] `File List` + `Completion Notes` + `Change Log` · `sprint-status.yaml`.

## Dev Notes

### Périmètre — verrouillé

**Écran `/admin/settings` éditant les clés texte de `SiteSetting` (accroche titre/sous-titre, badge de statut, coordonnées, liens sociaux) ; validation serveur (URL/email) ; upsert par `key` ; revalidateTag('settings') ; correction sans commit ni redéploiement.**

**Hors périmètre — ne pas faire :**
- ❌ **CV (upload PDF + vignette)** → 5.17.
- ❌ **Réécrire le fallback statique `src/content/*.ts`** (4.5).
- ❌ **Changer le schéma `SiteSetting`** (key/value Json existant).
- ❌ **AuditLog** → 5.19.
- ❌ **Nouvelle dépendance**.

### Le vrai enjeu

`SiteSetting.value` est du **JSON par clé**, pas des colonnes : l'écran doit **réécrire exactement la forme** que le public lit (`settings.ts`/seed), sinon le rendu casse — d'où le recensement préalable et des schémas Zod **par clé**. La **validation serveur** des URL/email (AC3) est non contournable. Toute correction se fait **sans commit ni redéploiement** (AC4, la raison d'être de l'admin). Le CV, bien que « réglage », est traité séparément (5.17).

### Testing standards

Vérification **manuelle en local** + visuelle. Les 4 AC dont refus serveur d'URL/email (AC3) et préservation de la forme JSON. tsc/lint/build verts.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.16]
- [Source: PLAN_REFONTE_2026.md §3.2 — `/admin/settings` réglages du site ; §3.3 — revalidation ciblée]
- [Source: apps/web/prisma/schema.prisma — SiteSetting (key @id, value Json)]
- [Source: apps/web/src/lib/settings.ts — lecture publique des clés (formes JSON à préserver) ; apps/web/src/lib/cache-tags.ts — tag `settings` ; apps/web/src/lib/read-with-fallback.ts + src/content/*.ts — repli statique (4.5)]
- [Source: _bmad-output/implementation-artifacts/5-8-gerer-mes-projets.md — pattern mutation requireAdmin + revalidateTag]
- [Source: AGENTS.md §6 — validation serveur, a11y ; §9 — anti-scope-creep]
