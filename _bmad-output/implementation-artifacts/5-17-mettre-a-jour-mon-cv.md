---
baseline_commit: 5c22f3a6c48914801d0a226ab5a0b15c005d8765
---

# Story 5.17: Mettre à jour mon CV

Status: ready-for-dev

## Story

As **Jeevons**,
I want **téléverser une nouvelle version de mon CV**,
so that **les recruteurs téléchargent toujours la version à jour, sans que j'aie à versionner un fichier de plus**.

## Acceptance Criteria

**AC1 — Upload PDF → version courante + vignette auto**
**Given** je suis sur l'écran des réglages
**When** je téléverse un nouveau CV au format PDF
**Then** il est enregistré et devient la version courante
**And** une vignette de sa première page est générée automatiquement

**AC2 — Remplacement servi immédiatement + lien stable**
**Given** un CV courant existe déjà
**When** j'en téléverse un nouveau
**Then** le site public sert immédiatement le nouveau après revalidation
**And** le lien de téléchargement reste stable, sans référence à un numéro de version

**AC3 — Refus des non-PDF (serveur)**
**Given** je téléverse un fichier qui n'est pas un PDF
**When** le téléversement démarre
**Then** il est refusé avec un message explicite

**AC4 — Aucun fichier CV dans le dépôt Git**
**Given** l'ancienne manière imposait de versionner sept fichiers dans le dépôt
**When** j'utilise cet écran
**Then** aucun fichier de CV n'a besoin d'entrer dans le dépôt Git

## Contexte d'implémentation

### 🛑 Prérequis : story 5.12 (infra upload/volume) + 5.16 (écran réglages) `done`

Réutilise l'**infra de 5.12** (volume persistant, écriture runtime, route de service, validation serveur) pour un **PDF** au lieu d'une image, et s'insère dans l'écran **réglages** (5.16). PLAN §3.2 (upload CV + vignette), §3.3 (lien stable, revalidation).

### 🎯 Ce que fait vraiment cette story

Sur `/admin/settings` : **téléverser un PDF** → devient le **CV courant**, **vignette de la 1ʳᵉ page** générée automatiquement, servi au public via un **lien stable** (sans numéro de version), **remplacement immédiat** après revalidation, **refus serveur** des non-PDF. Finalité : **plus aucun CV versionné dans Git** (AC4 — remplace les 7 fichiers historiques).

### ⚠️ Piège n°1 (CENTRAL) — Vignette de la 1ʳᵉ page d'un PDF = nouvelle capacité (dépendance ?)

- ⚠️ `sharp` (5.12) **ne rend pas** nativement une page PDF en image (le support PDF de libvips dépend de `poppler`/`pdfium`, souvent absent dans l'image alpine). 🛑 **Trancher avec Jeevons** l'approche vignette :
  - (a) une lib de rendu PDF→image (ex. `pdf-to-img`/`pdfjs` en JS pur, pas de binaire natif) puis `sharp` pour la vignette WebP ;
  - (b) `poppler`/`pdftoppm` ajouté à l'image Docker (binaire système) ;
  - (c) libvips **compilé avec support PDF** (lourd).
  - 👉 Privilégier une solution **sans nouvelle dépendance système** si possible (JS pur), sinon documenter l'ajout Docker (comme `vips-dev` en 5.12). ⚠️ **Toute nouvelle dépendance doit être validée** (AGENTS.md §9). Vérifier le **build Docker** (dev+prod).

### ⚠️ Piège n°2 — Lien de téléchargement **stable** (AC2)

- ⚠️ Le lien public du CV ne doit **jamais** changer au fil des versions (AC2 « sans numéro de version »). Donc **découpler l'URL publique du nom de fichier physique** : URL stable (ex. `/api/cv` ou `/api/media/cv/current`) qui **résout toujours vers le CV courant**. Le « courant » est une **référence** en base (une clé `SiteSetting` ex. `cvMediaId`/`cvPath`, ou un `Media`/enregistrement dédié). Téléverser une nouvelle version **repointe** cette référence, l'URL reste identique. 🛑 Décider du stockage de la référence (clé `SiteSetting` vs table dédiée) — réutiliser `SiteSetting` (5.16) est le plus simple.
- ⚠️ Cache : contrairement aux images `immutable` (5.12), l'URL du CV est **stable mais son contenu change** → **ne pas** la servir `immutable` ; utiliser un cache **revalidable** (ou `no-cache`/court + `revalidateTag`) pour que le nouveau CV soit servi immédiatement (AC2). Bien distinguer du régime image de 5.12.

### ⚠️ Piège n°3 — Validation serveur : c'est bien un PDF (AC3)

- ❌ Extension `.pdf` insuffisante → vérifier le **type réel** (magic bytes `%PDF`, MIME `application/pdf`) **côté serveur** (AC3). Message explicite si non-PDF. Taille max raisonnable. Réutiliser le socle de validation serveur de 5.12.

### ⚠️ Piège n°4 — Zéro fichier CV dans Git (AC4) + volume

- Le PDF et sa vignette sont écrits sur le **volume persistant** (5.12), **hors image et hors dépôt**. ⚠️ Vérifier/retirer les **anciens CV versionnés** du dépôt (les 7 fichiers historiques) **du flux** — au minimum ne pas les réintroduire ; le nettoyage réel du dépôt peut être noté. Le `.gitignore` doit couvrir le répertoire d'uploads (déjà via volume). AC4 : plus aucun CV n'entre dans Git.

### ⚠️ Piège n°5 — Rendu public du bouton « Télécharger mon CV » + revalidation

- Le site public a déjà un bouton CV (Epic 1/4). ⚠️ Le faire pointer vers le **lien stable** ; afficher la **vignette** si le design l'utilise. Après upload → `revalidateTag` de la surface concernée (`settings` si la référence est une `SiteSetting`). Vérifier qu'un **CV absent** (première fois) est géré (bouton masqué ou état neutre).

### ⚠️ Piège n°6 — Vérification locale

- Téléverser un **PDF** → devient courant + **vignette 1ʳᵉ page** générée (AC1). Re-téléverser → public sert le **nouveau** immédiatement après revalidation, **même URL** (AC2). Téléverser un **non-PDF** (image, .docx) → **refus serveur** explicite (AC3). Confirmer que **rien** n'est ajouté au dépôt Git (fichiers sur volume) (AC4). Build Docker (dev+prod) avec la solution vignette OK.

## Tasks / Subtasks

- [ ] **Tâche 0 — Prérequis & décision vignette** (AC: 1 ; piège n°1)
  - [ ] 5.12 + 5.16 `done`. 🛑 Trancher la génération de vignette PDF (JS pur vs binaire Docker) ; valider toute dépendance. Vérifier build Docker.
- [ ] **Tâche 1 — Upload PDF + validation serveur** (AC: 1, 3 ; pièges n°3, 4)
  - [ ] Server Action/route : vérifier PDF réel (magic bytes/MIME), taille ; écriture sur volume (hors dépôt).
- [ ] **Tâche 2 — Vignette 1ʳᵉ page** (AC: 1 ; piège n°1)
  - [ ] Rendu 1ʳᵉ page → vignette WebP (sharp) sur volume.
- [ ] **Tâche 3 — CV courant + lien stable** (AC: 2 ; piège n°2)
  - [ ] Référence « CV courant » (clé `SiteSetting`) repointée à chaque upload ; URL publique **stable** (résout le courant) ; cache **revalidable** (pas immutable) ; `revalidateTag`.
- [ ] **Tâche 4 — Rendu public** (AC: 2 ; piège n°5)
  - [ ] Bouton « Télécharger mon CV » → lien stable ; vignette si utilisée ; état si CV absent.
- [ ] **Tâche 5 — Vérification locale** (AC: 1-4 ; piège n°6)
  - [ ] Upload PDF + vignette, remplacement immédiat même URL, refus non-PDF serveur, zéro fichier Git, build Docker.
- [ ] **Tâche 6 — Definition of Done** (AGENTS.md §8)
  - [ ] lint 0 / tsc 0 / build OK (+ docker build). Vérif visuelle. `git diff DEV` : upload CV, vignette, référence courant, lien stable, bouton public — rien d'autre.
  - [ ] `File List` + `Completion Notes` + `Change Log` · `sprint-status.yaml`.

## Dev Notes

### Périmètre — verrouillé

**Upload d'un CV PDF sur `/admin/settings` → devient le CV courant + vignette 1ʳᵉ page auto ; lien public stable (sans numéro de version) qui résout toujours le courant ; remplacement servi immédiatement après revalidation (cache revalidable, PAS immutable) ; refus serveur des non-PDF ; aucun fichier CV dans Git (volume persistant).**

**Hors périmètre — ne pas faire :**
- ❌ **Textes/liens des réglages** → 5.16.
- ❌ **Infra upload/volume/route de base** → 5.12 (réutiliser).
- ❌ **Historique/versions multiples de CV** (une seule version courante).
- ❌ **AuditLog** → 5.19.
- ❌ **Dépendance non validée** (la solution vignette doit être arbitrée).

### Le vrai enjeu

Deux points durs propres au PDF : (1) **la vignette de la 1ʳᵉ page** que `sharp` seul ne fournit pas → arbitrer une solution (idéalement JS pur, sinon binaire Docker documenté comme `vips-dev`) et **valider la dépendance** ; (2) le **lien stable** au contenu variable — l'inverse du régime image `immutable` de 5.12 : URL fixe qui **repointe** vers le CV courant (référence en `SiteSetting`), servie avec un cache **revalidable** pour un remplacement immédiat. Le tout hors dépôt Git (AC4, remplace les 7 fichiers historiques).

### Testing standards

Vérification **manuelle en local** + visuelle + **build Docker**. Les 4 AC dont refus serveur non-PDF (AC3), URL stable au contenu changé (AC2), zéro fichier Git (AC4). tsc/lint/build verts.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.17]
- [Source: PLAN_REFONTE_2026.md §3.2 — upload CV + vignette ; §3.3 — lien stable, revalidation]
- [Source: _bmad-output/implementation-artifacts/5-12-illustrer-mes-projets.md — infra upload, volume, validation serveur, route de service (régime `immutable` à NE PAS reprendre pour le CV)]
- [Source: _bmad-output/implementation-artifacts/5-16-modifier-les-textes-de-mon-site.md — écran réglages + `SiteSetting` (référence « CV courant »)]
- [Source: AGENTS.md §6 — validation serveur, sécurité ; §9 — dépendance validée, pas de fichiers lourds versionnés]
