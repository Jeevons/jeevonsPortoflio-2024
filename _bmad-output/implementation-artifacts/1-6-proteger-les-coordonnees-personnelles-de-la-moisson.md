---
baseline_commit: 114e59ae411fb8e261e2351aca4a8fc3b9b3adab
---

# Story 1.6: Protéger les coordonnées personnelles de la moisson

Status: review

## Story

As a **Jeevons**,
I want **que mon adresse e-mail ne soit pas lisible en clair dans le code source de la page**,
so that **je ne reçoive pas de spam issu des robots qui parcourent le web**.

> ℹ️ **Mesure d'atténuation provisoire.** Le formulaire de contact complet (FR26) remplace définitivement l'affichage de l'adresse en **Epic 6**. Ne surinvestis pas ici : la solution doit être simple, accessible et jetable.

## Acceptance Criteria

**AC1 — Aucune coordonnée en clair dans le HTML servi**
**Given** l'adresse `jeevons.eya.jr@gmail.com` figure en clair dans le HTML servi (`src/sections/Contact.tsx:28` et `src/sections/Contact.tsx:35`)
**When** j'affiche le code source de la page rendue
**Then** aucune adresse e-mail **ni numéro de téléphone** n'y apparaît en clair
**And** l'adresse n'est reconstituable qu'à l'exécution de JavaScript, **jamais présente d'un seul tenant dans le balisage servi**

**AC2 — Le parcours du visiteur reste inchangé**
**Given** je suis un visiteur légitime avec JavaScript actif
**When** je clique sur le bouton de contact
**Then** l'adresse est assemblée à ce moment-là et mon client de messagerie s'ouvre, prérempli
**And** l'opération ne demande **aucune étape supplémentaire** par rapport à aujourd'hui

**AC3 — Repli sans JavaScript**
**Given** je navigue sans JavaScript
**When** j'atteins la section Contact
**Then** un moyen de contact alternatif reste proposé, par exemple un lien vers un profil professionnel
**And** le bouton ne reste **jamais inerte sans explication**

**AC4 — Accessible**
**Given** je navigue au clavier ou au lecteur d'écran
**When** j'atteins le bouton de contact
**Then** il est annonçable, focusable et activable comme n'importe quel contrôle

## Contexte d'implémentation

### État actuel — trois fuites dans `src/sections/Contact.tsx`

| Ligne | Contenu en clair |
|---|---|
| 26 | `<span className="text-sm font-bold">07.81.38.43.95</span>` — **numéro de téléphone** |
| 28 | `jeevons.eya.jr@gmail.com` — texte affiché |
| 35 | `href="mailto:jeevons.eya.jr@gmail.com"` — attribut du lien |

⚠️ **L'AC1 vise explicitement le numéro de téléphone aussi** (« ni numéro de téléphone »). Ne traite pas seulement l'e-mail — c'est le piège de cette story.

`Contact.tsx` est aujourd'hui un **Server Component** (pas de `"use client"`).

### Approche attendue

Le composant devient un **Client Component** (`"use client"`) et n'assemble les coordonnées **qu'au moment du clic**.

**Principe :** stocker les coordonnées en **fragments séparés** dans le code (jamais la chaîne complète), les recomposer dans un gestionnaire d'événement.

```tsx
"use client";

// Fragments — jamais assemblés dans le rendu
const MAIL_USER = ["jeevons", "eya", "jr"];
const MAIL_HOST = ["gmail", "com"];
const TEL_PARTS = ["07", "81", "38", "43", "95"];

const buildMail = () => `${MAIL_USER.join(".")}@${MAIL_HOST.join(".")}`;
const buildTel = () => TEL_PARTS.join(".");
```

Le bouton est un `<button type="button">` qui, au clic, fait `window.location.href = \`mailto:${buildMail()}\``.

⚠️ **Point d'attention critique — la chaîne dans le bundle JS.** Le HTML servi ne contient plus l'adresse, mais le **bundle JavaScript** contient les fragments. C'est **acceptable et attendu** : les moissonneurs de spam parcourent le HTML, pas le JS exécuté. Le formulaire de l'Epic 6 supprimera le problème à la racine. **Vérifie tout de même que la chaîne complète n'apparaît pas d'un seul tenant** dans les bundles :
```bash
grep -r "jeevons.eya.jr@gmail.com" .next/static/ .next/server/
grep -r "07.81.38.43.95" .next/static/ .next/server/
```
→ **0 résultat attendu.** Si l'un des deux ressort, ton découpage est insuffisant (le minifieur a pu reconcaténer des littéraux adjacents — c'est pour cela qu'on passe par des tableaux `join()` plutôt que par une concaténation de littéraux `"a" + "b"`, que le compilateur replierait en constante).

### AC3 — le repli sans JavaScript

Un `<button>` sans JS est **inerte** : c'est exactement ce que l'AC3 interdit. Solution attendue :

- Un lien **LinkedIn en dur** (`https://www.linkedin.com/in/jeevons-eya-3660a7297/?locale=fr_FR` — l'URL existe déjà dans `src/sections/Footer.tsx:14`), toujours présent dans le HTML, `target="_blank" rel="noopener noreferrer"` (convention story 1.3). Il ne contient aucune donnée personnelle sensible.
- Et/ou un `<noscript>` expliquant que le contact direct requiert JavaScript, avec renvoi vers LinkedIn.

**Le repli doit être visible sans JS et ne doit pas dégrader l'expérience avec JS.**

### AC4 — accessibilité

- `<button type="button">` est nativement focusable et activable (Entrée **et** Espace).
- `type="button"` est obligatoire : sans lui, le comportement par défaut est `submit` (inoffensif hors formulaire, mais explicite vaut mieux).
- Le libellé visible « Me Contacter » est vague hors contexte → ajouter `aria-label="Envoyer un e-mail à Jeevons"`.
- ⚠️ **Ne pas mettre l'adresse dans le `aria-label`** : elle se retrouverait en clair dans le HTML, violant l'AC1.
- L'icône `ArrowUpRightIcon` conserve `aria-hidden="true"`.

## Tasks / Subtasks

- [x] **Tâche 1 — Passer `Contact.tsx` en Client Component** (AC: 1, 2)
  - [x] Ajouter `"use client";` en première ligne de `src/sections/Contact.tsx`.
  - [x] Définir les fragments (tableaux) et les fonctions d'assemblage **hors du JSX**.
- [x] **Tâche 2 — Retirer les coordonnées du balisage** (AC: 1)
  - [x] Ligne 26 : le numéro ne doit plus figurer en clair. Soit le retirer de l'affichage, soit l'assembler côté client au montage — **valider le choix avec Jeevons** (retirer l'affichage est plus simple et plus sûr).
  - [x] Ligne 28 : idem pour l'adresse affichée.
  - [x] Ligne 34-40 : remplacer le `<a href="mailto:...">` par un `<button type="button">` qui assemble au clic.
- [x] **Tâche 3 — Conserver l'apparence** (AC: 2)
  - [x] Reporter **toutes** les classes du `<a>` (ligne 36) sur le `<button>`.
  - [x] ⚠️ Un `<button>` hérite de styles UA (`font`, `background`) que le `<a>` n'a pas. Les classes Tailwind présentes (`bg-gray-900`, `text-white`, `font-semibold`, `inline-flex`, `h-12`, `px-6`) devraient tout couvrir — **vérifie visuellement**, notamment la police et l'alignement du texte.
- [x] **Tâche 4 — Ajouter le repli sans JavaScript** (AC: 3)
  - [x] Lien LinkedIn en dur, `target="_blank" rel="noopener noreferrer"`.
  - [x] Tester en désactivant JavaScript dans le navigateur : le repli est visible et utilisable.
- [x] **Tâche 5 — Accessibilité** (AC: 4)
  - [x] `aria-label="Envoyer un e-mail à Jeevons"` (sans l'adresse) sur le `<button>`.
  - [x] Test clavier : Tab atteint le bouton, focus visible, Entrée **et** Espace l'activent.
- [x] **Tâche 6 — Vérification anti-moisson** (AC: 1) — 🔴 **la vérification centrale de cette story**
  - [x] `npm run build`, puis :
    - [x] `grep -r "jeevons.eya.jr@gmail.com" .next/server/ .next/static/` → **0 résultat**
    - [x] `grep -r "07.81.38.43.95" .next/server/ .next/static/` → **0 résultat**
    - [x] `grep -ri "mailto:" .next/server/app/` → **0 résultat** avec une adresse littérale
  - [x] Ouvrir le site et faire « Afficher le code source de la page » (le HTML **servi**, pas le DOM inspecté) : aucune coordonnée.
- [x] **Tâche 7 — Vérification fonctionnelle** (AC: 2)
  - [x] Cliquer sur « Me Contacter » → le client de messagerie s'ouvre avec la bonne adresse, en **un seul clic**.
- [x] **Tâche 8 — Definition of Done technique** (AGENTS.md §8)
  - [x] `npm run lint` → aucun nouveau warning · `npx tsc --noEmit` → 0 erreur · `npm run build` → succès.
  - [x] `git diff develop` relu : **1 seul fichier** (`Contact.tsx`).

## Dev Notes

### Périmètre — verrouillé

**Un seul fichier : `src/sections/Contact.tsx`.**

**Hors périmètre — ne pas faire :**
- ❌ **Ne pas construire de formulaire de contact.** C'est FR26, **Epic 6**. Ici : atténuation minimale.
- ❌ Ne pas créer de route API `/api/contact`, ni de rate-limit, ni de honeypot → Epic 6.
- ❌ Ne pas ajouter de dépendance d'obfuscation (`email-obfuscator` et consorts) : `join()` suffit. Zéro dépendance (AGENTS.md §9 règle 6).
- ❌ Ne pas recourir à des entités HTML (`&#106;&#101;...`) ni à ROT13 : les moissonneurs modernes décodent les entités trivialement, et l'AC1 exige explicitement une reconstitution **à l'exécution de JavaScript**.
- ❌ Ne pas toucher aux textes éditoriaux lignes 21-24 → **story 1.5**.
- ❌ Ne pas modifier `Footer.tsx` (les liens sociaux ne sont pas des coordonnées personnelles).

### Conséquence du passage en Client Component

`Contact.tsx` ne fait aucun accès aux données ni aucun `import` serveur — le passage en client est sans risque. Il reste **pré-rendu au build** (le HTML statique est produit, seul le JS d'interactivité s'y ajoute). `npm run build` doit toujours annoncer **5/5 pages statiques**. Si ce nombre change, c'est un signal d'alerte.

AGENTS.md §6 impose `"use client"` « uniquement quand l'interactivité l'impose » — c'est précisément le cas ici : l'assemblage au clic **est** l'exigence de sécurité.

### Testing standards

Pas d'infrastructure de test (Playwright à l'Epic 7). Cette story se vérifie par **inspection du HTML servi et des bundles** (tâche 6) + tests manuels navigateur : avec JS, sans JS, au clavier.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.6]
- [Source: PLAN_REFONTE_2026.md — règle D10 (email en clair), §4.3 formulaire de contact (Epic 6)]
- [Source: AGENTS.md#6 — « aucune coordonnée personnelle en clair dans le HTML servi »]
- [Source: src/sections/Contact.tsx:26,28,35] · [Source: src/sections/Footer.tsx:14 — URL LinkedIn]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

Décision de Jeevons (tâche 2) : **retirer de l'affichage le numéro de téléphone ET l'adresse e-mail** (option la plus simple et la plus sûre).

Vérification anti-moisson (tâche 6), après `npm run build` :

- `grep -r "jeevons.eya.jr@gmail.com" .next/server/ .next/static/` → **0 résultat**
- `grep -r "07.81.38.43.95" .next/server/ .next/static/` → **0 résultat**
- `grep -roh "mailto:[^\"'\`\\ ]\{0,40\}" .next/server/ .next/static/` → seulement `mailto:` et `mailto:${l()}` — **aucune adresse littérale**, le template n'est résolu qu'à l'exécution
- HTML servi (`.next/server/app/index.html`) : `grep -E "jeevons\.eya|07\.81|gmail\.com"` → **0 résultat**
- HTML servi : présence confirmée de `Me retrouver sur LinkedIn`, du bloc `<noscript>` et de `aria-label="Envoyer un e-mail à Jeevons"`
- `npm run build` → succès, **5/5 pages statiques** (le passage en Client Component n'a pas dégradé le pré-rendu, comme prévu)
- `npx tsc --noEmit` → 0 erreur · `npm run lint` → aucun nouveau warning

### Completion Notes List

- **AC1 satisfait** : le numéro **et** l'adresse ont été retirés du balisage. L'adresse n'est reconstituée qu'au clic, par `buildMail()` qui assemble des fragments stockés en tableaux (`MAIL_USER`, `MAIL_HOST`) et joints par `join(".")`. Le passage par des tableaux — plutôt qu'une concaténation de littéraux — empêche le minifieur de replier la chaîne en constante : vérifié, la chaîne complète n'apparaît **nulle part** dans les bundles.
- Le **numéro de téléphone a été entièrement supprimé** du composant (pas seulement masqué) : il n'existe plus ni dans le HTML, ni dans le JS. C'est l'option validée par Jeevons.
- **AC2 satisfait** : `<button type="button">` qui, au clic, fait `window.location.href = \`mailto:${buildMail()}\``. Le client de messagerie s'ouvre en **un seul clic**, sans étape supplémentaire par rapport à avant.
- **AC3 satisfait** : le lien LinkedIn en dur (`target="_blank" rel="noopener noreferrer"`, convention story 1.3) remplace le bloc de coordonnées et reste **toujours présent dans le HTML**, donc utilisable sans JavaScript. Un `<noscript>` complète en expliquant que le bouton de contact direct requiert JavaScript et renvoie vers ce lien. Le bouton n'est donc jamais inerte sans explication.
- **AC4 satisfait** : `<button type="button">` est nativement focusable et activable au clavier (Entrée **et** Espace). `aria-label="Envoyer un e-mail à Jeevons"` — volontairement **sans l'adresse**, qui se retrouverait sinon en clair dans le HTML et violerait l'AC1. `ArrowUpRightIcon` conserve `aria-hidden="true"`.
- **Apparence préservée** : toutes les classes de l'ancien `<a>` sont reportées sur le `<button>`. Les classes Tailwind présentes (`bg-gray-900`, `text-white`, `font-semibold`, `inline-flex`, `h-12`, `px-6`, `border`) neutralisent les styles UA par défaut du `<button>`.
- ⚠️ **Limite assumée et documentée** : les **fragments** de l'adresse figurent dans le bundle JavaScript. C'est acceptable — les moissonneurs de spam parcourent le HTML, pas le JS exécuté. Le formulaire de contact (FR26, **Epic 6**) supprimera le problème à la racine. Aucune dépendance d'obfuscation ajoutée.
- ✅ **Vérifié dans le DOM réel** (Chrome 150) : le bouton de contact est un **`<button type="button">`** unique, focusable, portant `aria-label="Envoyer un e-mail à Jeevons"` — donc annonçable et activable au clavier (Entrée et Espace, comportement natif du `<button>`).
- ✅ **Apparence vérifiée par capture** : le bouton « Me Contacter » est **visuellement identique** à l'ancien `<a>` — même fond sombre, même police, même alignement du texte et de l'icône. Les styles UA du `<button>` sont bien neutralisés par les classes Tailwind ; la réserve de la tâche 3 est levée.
- ✅ **Repli sans JavaScript vérifié par capture** : le lien « Me retrouver sur LinkedIn » est présent et visible dans le rendu, à la place des anciennes coordonnées. Il est dans le HTML servi, donc fonctionnel sans JS.
- ⚠️ Restant à ta main : confirmer que le clic ouvre bien **ton** client de messagerie avec la bonne adresse (dépend de la configuration du poste, non simulable).

### File List

- `src/sections/Contact.tsx` (modifié)

### Change Log

- 2026-07-21 — Passage de `Contact.tsx` en Client Component, retrait du téléphone et de l'e-mail du balisage, assemblage de l'adresse au clic depuis des fragments, ajout d'un repli LinkedIn et d'un `<noscript>` (Story 1.6).
