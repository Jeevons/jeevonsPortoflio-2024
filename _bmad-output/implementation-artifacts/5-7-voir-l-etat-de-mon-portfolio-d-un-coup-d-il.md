---
baseline_commit: 5c22f3a6c48914801d0a226ab5a0b15c005d8765
---

# Story 5.7: Voir l'état de mon portfolio d'un coup d'œil

Status: ready-for-dev

## Story

As **Jeevons**,
I want **une page d'accueil d'administration qui me résume l'essentiel**,
so that **je sache quoi faire en arrivant, sans fouiller dans les écrans**.

## Acceptance Criteria

**AC1 — Compteurs + derniers messages + fréquentation**
**Given** je suis connecté avec une session complète
**When** j'arrive sur la page d'accueil de l'administration
**Then** je vois le nombre de projets publiés et le nombre de brouillons
**And** je vois les cinq derniers messages reçus, s'il en existe
**And** je vois la fréquentation des sept derniers jours, ou une mention explicite si la mesure n'est pas encore disponible

**AC2 — Bouton « Revalider le site »**
**Given** le site public est mis en cache
**When** je déclenche la revalidation depuis cette page
**Then** le contenu public est rafraîchi et un retour visuel me le confirme

**AC3 — État vide accueillant (portfolio neuf)**
**Given** je viens d'installer le site et n'ai encore rien saisi
**When** j'arrive sur cette page
**Then** les compteurs à zéro sont présentés comme un état normal, avec une invitation à créer un premier contenu
**And** aucune zone vide ni erreur ne s'affiche

## Contexte d'implémentation

### 🛑 Prérequis : socle sécurité 5.1-5.6 `done` — PREMIER écran de gestion

C'est le **premier écran admin** construit après le socle sécurité complet (AGENTS.md §5). Il établit le **layout admin** (navigation, coquille) que 5.8-5.20 réutiliseront. PLAN §3.2 (route `/admin` = Dashboard).

### 🎯 Ce que fait vraiment cette story

La **page d'accueil `/admin`** (session complète, guard 5.2/5.5) : compteurs projets publiés/brouillons, 5 derniers messages, fréquentation 7 j (**ou mention « indisponible »** — Umami est en Epic 7/§10), bouton **« Revalider le site »** (réutilise la route de 4.4), et un **état vide accueillant** sur portfolio neuf.

### ⚠️ Piège n°1 — Réutiliser la route de revalidation de 4.4, ne pas la recréer (AC2)

- Story 4.4 a posé `app/api/revalidate/route.ts` (secret `REVALIDATE_SECRET`, `revalidateTag(tag, {expire:0})`, échec fermé). Le bouton « Revalider » du dashboard **déclenche cette capacité** (PLAN §4.4 disait explicitement « déclenchement depuis l'admin = Epic 5 »).
- ⚠️ **Depuis l'admin authentifié**, le plus propre est une **Server Action** qui appelle directement `revalidateTag('projects')` + `'timeline'` + `'settings'` (l'utilisateur est déjà `requireAdmin`) — plutôt que de rappeler la route HTTP avec le secret. La route reste la surface externe ; le bouton admin peut invalider les 3 tags en une action serveur. 🛑 Trancher : Server Action directe (recommandé) vs. appel de la route. Retour visuel de confirmation (AC2).

### ⚠️ Piège n°2 — Messages & fréquentation : dépendances d'ordre (AC1)

- **5 derniers messages** : le modèle `ContactMessage` est créé en **5.18** (plus tard). ⚠️ Ordre : à la création de 5.7, `ContactMessage` n'existe **pas encore**. Options :
  - **(a)** Afficher la carte « derniers messages » avec un **état vide gracieux** tant que le modèle/données n'existent pas (« aucun message » / section masquée), et brancher la vraie lecture quand 5.18 sera fait.
  - 👉 L'AC dit « s'il en existe » → un état vide est **conforme**. Ne PAS créer `ContactMessage` ici (c'est le périmètre de 5.18, anti-scope-creep). Concevoir la carte pour se remplir sans réécriture quand 5.18 arrive.
- **Fréquentation 7 j** : Umami est **hors Epic 5** (§10, Epic 7). L'AC autorise explicitement « une mention si la mesure n'est pas encore disponible » → afficher **« Analytics non disponible »**. ❌ Ne pas installer/brancher Umami (hors périmètre).
- **Compteurs projets** : `Project` existe (Epic 4). Compter `published: true` vs `published: false` (brouillons) via `prisma.project.count`. C'est la partie **réellement** implémentable de bout en bout ici.

### ⚠️ Piège n°3 — Layout admin + shadcn/ui (fondation pour 5.8+)

- PLAN §arborescence : `components/{ui,site,admin}/`, styling **shadcn/ui** (PLAN §stack). ⚠️ shadcn/ui n'est **pas encore installé**. Cette story, en tant que premier écran, peut **initialiser shadcn/ui** (composants copiés dans `components/ui/`, pas une dépendance runtime lourde — c'est le modèle shadcn) si le PLAN le prévoit. 🛑 **Trancher avec Jeevons** l'introduction de shadcn/ui ici (init + quelques primitives : card, button) vs. le reporter — car c'est la fondation visuelle de tous les écrans admin. Rester sobre : n'ajouter que les primitives utiles au dashboard.
- Le layout `(admin)` (créé en 5.2) reçoit ici sa **navigation** (liens vers projets, parcours, stacks, réglages, messages, médias — pages construites plus tard, liens pouvant être présents/désactivés).

### ⚠️ Piège n°4 — Session complète requise (AC1)

- La page exige une session **complète** (pas `mfaPending`, 5.5). Le guard le garantit déjà ; s'appuyer dessus.

### ⚠️ Piège n°5 — État vide sans erreur (AC3)

- Portfolio neuf : compteurs à **0** présentés comme normaux + invitation (« créez votre premier projet »), **aucune** zone vide brute ni erreur (AC3). Cohérent avec l'esprit « ne jamais tomber en erreur » de l'Epic 4 (fallback).

### ⚠️ Piège n°6 — Vérification locale

- Connecté (session complète) : compteurs corrects (créer 1 brouillon + 1 publié via DB/seed pour vérifier), carte messages en état vide, mention analytics indisponible, bouton Revalider → confirmation visuelle + tag invalidé (vérifier qu'une modif DB apparaît sur le public après clic). Base vide → état d'accueil sans erreur.

## Tasks / Subtasks

- [ ] **Tâche 0 — Prérequis** (AC: 1)
  - [ ] 5.1-5.6 `done`. 🛑 Trancher shadcn/ui (init ici ?) avec Jeevons.
- [ ] **Tâche 1 — Layout & navigation admin** (AC: 1 ; pièges n°3, 4)
  - [ ] Coquille `(admin)` : nav (liens écrans à venir), primitives `components/ui/` (sobre). Session complète (guard).
- [ ] **Tâche 2 — Compteurs projets** (AC: 1 ; piège n°2)
  - [ ] `prisma.project.count` publiés vs brouillons.
- [ ] **Tâche 3 — Cartes messages & analytics (états gracieux)** (AC: 1 ; piège n°2)
  - [ ] Messages : état vide (ContactMessage = 5.18). Analytics : mention « non disponible » (Umami = Epic 7).
- [ ] **Tâche 4 — Bouton « Revalider le site »** (AC: 2 ; piège n°1)
  - [ ] Server Action `requireAdmin` → `revalidateTag` projects/timeline/settings + retour visuel. 🛑 Trancher forme.
- [ ] **Tâche 5 — État vide accueillant** (AC: 3 ; piège n°5)
  - [ ] Compteurs 0 = normal + invitation, aucune erreur.
- [ ] **Tâche 6 — Vérification locale** (AC: 1-3 ; piège n°6)
  - [ ] Compteurs, cartes gracieuses, revalidation effective, base vide sans erreur.
- [ ] **Tâche 7 — Definition of Done** (AGENTS.md §8)
  - [ ] lint 0 / tsc 0 / build OK. Vérif visuelle navigateur. `git diff DEV` : layout admin, dashboard, action revalidate, (éventuel init shadcn/ui) — rien d'autre.
  - [ ] `File List` + `Completion Notes` + `Change Log` · `sprint-status.yaml`.

## Dev Notes

### Périmètre — verrouillé

**Page d'accueil `/admin` (session complète) : compteurs projets publiés/brouillons, carte 5 derniers messages (état vide gracieux tant que 5.18 absent), fréquentation 7 j ou mention « indisponible », bouton Revalider (revalidateTag), état vide accueillant. Établit le layout/navigation admin.**

**Hors périmètre — ne pas faire :**
- ❌ **Créer `ContactMessage`** → 5.18 (carte en état vide ici).
- ❌ **Installer/brancher Umami** → Epic 7 (mention « non disponible »).
- ❌ **CRUD projets** → 5.8+.
- ❌ **Recréer la route revalidate** (réutiliser la capacité 4.4).
- ❌ **Dépendance runtime lourde** (shadcn/ui = composants copiés ; trancher).

### Le vrai enjeu

Premier écran de gestion → il pose la **fondation visuelle et le layout** de tout l'admin (5.8-5.20) et le pattern « bouton Revalider = revalidateTag », cœur de la souplesse ISR (PLAN §3.3). Le piège est l'**ordre des stories** : messages (5.18) et analytics (Epic 7) n'existent pas encore → cartes gracieuses, pas de scope-creep. Seuls les compteurs projets et la revalidation sont pleinement fonctionnels ici.

### Testing standards

Vérification **manuelle en local** + visuelle navigateur. AC1 (compteurs, cartes), AC2 (revalidation effective : une modif DB visible sur le public après clic), AC3 (base vide sans erreur). tsc/lint/build verts.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.7]
- [Source: PLAN_REFONTE_2026.md §3.2 — `/admin` Dashboard (compteurs, 5 derniers messages, vues 7 j, bouton Revalider) ; §arborescence — `components/{ui,site,admin}`, shadcn/ui ; §10 — Umami (Epic 7)]
- [Source: apps/web/src/app/api/revalidate/route.ts — capacité de revalidation (4.4), tags projects/timeline/settings]
- [Source: apps/web/src/lib/cache-tags.ts — `CACHE_TAGS`, contrat inter-stories repris en Epic 5]
- [Source: _bmad-output/implementation-artifacts/5-2-verrouiller-l-acces-a-l-administration.md — layout `(admin)`, `requireAdmin` ; 5-5 — session complète]
- [Source: AGENTS.md §5 — écrans après socle sécurité ; §6 — logique serveur, a11y ; §9 — anti-scope-creep]
