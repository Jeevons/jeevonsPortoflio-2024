---
baseline_commit: c408eae7818fb33ef915a70085775688fbf80640
---

# Story 6.11: Consulter et télécharger le CV

Status: review

## Story

As **recruteur**,
I want **lire le CV directement dans mon navigateur**,
so that **je n'aie pas à télécharger un fichier pour y jeter un œil**.

## Acceptance Criteria

**AC1 — Une page dédiée qui affiche le CV, bouton de téléchargement conservé**
**Given** le CV n'est aujourd'hui accessible que par un lien de téléchargement direct
**When** cette story est terminée
**Then** une page dédiée l'affiche dans le navigateur
**And** un bouton de téléchargement reste proposé

**AC2 — La page suit le CV courant, sans redéploiement**
**Given** le CV courant est géré depuis l'administration
**When** Jeevons en téléverse une nouvelle version
**Then** cette page sert la nouvelle version sans changement de code

**AC3 — Repli explicite si l'affichage intégré échoue**
**Given** mon navigateur ne peut pas afficher le document intégré
**When** j'ouvre la page
**Then** un message clair et le lien de téléchargement me sont proposés

**AC4 — Utilisable sur téléphone**
**Given** je consulte sur téléphone
**When** j'ouvre la page
**Then** le document reste lisible ou le téléchargement est proposé d'emblée

## Contexte d'implémentation

### 🛑 Prérequis : stories 6.1 (tokens) et 6.2 (socle motion) `done`

L'identité de la page (fond, accent, rayons) passe par les **tokens 6.1**. Aucune animation n'est requise ici, mais toute transition ajoutée relève du **socle 6.2**. PLAN §4.3 : « **`/cv`** : viewer PDF inline + bouton téléchargement (au lieu du lien brut actuel) ».

### ✅ Excellente nouvelle — toute la plomberie existe déjà (story 5.17)

La story 5.17 a livré **exactement** ce dont AC2 a besoin. Vérifié dans `lib/cv.ts` et `app/api/cv/route.ts` :

| Besoin | Existant | Fichier |
|---|---|---|
| URL publique stable du PDF | **`CV_PUBLIC_URL = "/api/cv"`** ✅ | `lib/cv.ts` |
| Service du PDF courant | route `GET /api/cv` ✅ (résout `cv.current` en base **à chaque requête**) | `app/api/cv/route.ts` |
| Lecture publique cachée | **`getPublicCv()`** ✅ (`unstable_cache`, tag `settings`) | `lib/cv.ts` |
| Vignette 1ʳᵉ page + dimensions | `thumbnailUrl` / `thumbnailWidth` / `thumbnailHeight` ✅ | `lib/cv.ts` |
| Absence de CV gérée | `getPublicCv()` renvoie **`null`** ✅ | `lib/cv.ts` |

🛑 **AC2 est donc satisfait par construction si — et seulement si — la page consomme `getPublicCv()` / `CV_PUBLIC_URL`.** L'URL `/api/cv` ne change **jamais** ; c'est la référence `cv.current` en base qui est repointée à chaque téléversement. ❌ **Ne jamais coder en dur un chemin de fichier**, ni construire une URL depuis `value.path` : ce serait exactement le couplage que 5.17 a démonté (son « piège n°2 »).

🛑 **Aucune migration Prisma, aucune Server Action, aucun écran admin dans cette story.** Si vous pensez avoir besoin de l'un des trois, relisez `lib/cv.ts` — et si le besoin est réel, **arrêtez-vous et demandez** (AGENTS.md §9 règle 2).

### 🛑 Piège n°1 (CENTRAL) — AC1 « affiche dans le navigateur » ≠ écrire un lecteur PDF

- 🛑 **Le risque de dérapage n°1 de cette story est d'installer une bibliothèque de rendu PDF** (`react-pdf`, `pdf.js`, `pdfjs-dist`…). ❌ **Interdit sans validation explicite de Jeevons** (AGENTS.md §9 règle 6). Une telle dépendance pèse plusieurs centaines de Ko de JS, contredit les cibles Lighthouse ≥ 95 du PLAN §4.4, et **n'est pas nécessaire** : tous les navigateurs modernes affichent nativement un PDF servi en `Content-Type: application/pdf`.
- ✅ **La voie attendue** : intégrer `/api/cv` dans un **`<object type="application/pdf" data="/api/cv">`** (ou `<iframe>`), le navigateur faisant le rendu. C'est **zéro dépendance, zéro JS**.
- ✅ **Pourquoi `<object>` plutôt qu'`<iframe>` — c'est le point clé de l'AC3** : `<object>` rend **son contenu enfant** quand le type MIME n'est pas gérable par le navigateur. Le repli d'AC3 devient alors **purement déclaratif**, sans JavaScript ni détection de navigateur :
  ```html
  <object data="/api/cv" type="application/pdf" …>
    <!-- rendu UNIQUEMENT si le navigateur ne sait pas afficher le PDF (AC3) -->
    <p>message clair</p> + <a href="/api/cv" download>lien de téléchargement</a>
  </object>
  ```
  ⚠️ Un `<iframe>` **n'a pas** ce comportement de repli : son contenu enfant n'est jamais rendu. Le choisir obligerait à détecter l'échec en JS — plus fragile, et inutile.
- ⚠️ La route sert le PDF en **`Content-Disposition: inline`** (`api/cv/route.ts`), ce qui est **exactement** ce que l'affichage intégré demande. ❌ **Ne pas modifier cet en-tête** : le passer en `attachment` casserait AC1 en forçant le téléchargement.
- ⚠️ Un `<object>`/`<iframe>` doit porter un **`title`** ou un `aria-label` : sans lui, un lecteur d'écran annonce un cadre anonyme.
- 🛑 **`Cache-Control: no-cache`** sur la route est **délibéré** (5.17, AC2 : fraîcheur du CV). ❌ Ne pas « optimiser » cet en-tête : ce serait risquer de servir l'ancien CV après un téléversement, en violation directe d'AC2.

### 🛑 Piège n°2 — Le cas « aucun CV » n'est PAS une panne, et il n'est pas dans les AC

- 🛑 Vérifié : `getPublicCv()` renvoie **`null`** tant qu'aucun PDF n'a été téléversé — et `/api/cv` renvoie alors un **404**. **Aucun AC ne décrit ce cas**, mais la page doit s'y comporter proprement : sans traitement, elle afficherait un cadre PDF vide ou un 404 intégré.
- ✅ Le dépôt a déjà **le bon précédent, à reproduire** : `AboutClient.tsx` affiche « CV bientôt disponible. » — un **état neutre**, pas un lien mort, pas un message d'erreur. `lib/cv.ts` le documente : « un CV absent n'est pas une panne DB, c'est un état de départ légitime ».
- 🛑 **Décision à prendre et documenter** : `cv === null` → **page rendue avec un état neutre** (✅ recommandé, cohérent avec `AboutClient` et avec « ne jamais tomber en erreur », AGENTS.md §3) **ou** `notFound()`. ⚠️ Si `notFound()` est retenu, il faut assumer qu'un lien de navigation vers `/cv` mènerait à un 404 tant que Jeevons n'a rien téléversé.
- ⚠️ ❌ **Pas de `readWithFallback` ici** : `lib/cv.ts` explique pourquoi (« il n'existe pas de CV par défaut »). `getPublicCv()` gère déjà son propre `try/catch` et renvoie `null` si la base est injoignable. ✅ **Consommer la fonction telle quelle**, ne pas la réenrober.

### 🛑 Piège n°3 — AC4 : sur mobile, l'affichage intégré d'un PDF est notoirement mauvais

- 🛑 **C'est le piège technique le plus concret de la story.** Sur iOS Safari et de nombreux navigateurs Android, un PDF dans un `<object>`/`<iframe>` s'affiche **tronqué, non défilable, ou pas du tout** — et **sans déclencher le repli enfant** de l'`<object>` (le navigateur *prétend* savoir afficher le type). Une page « qui marche sur desktop » peut donc être **inutilisable sur téléphone** tout en passant les tests locaux.
- ✅ C'est précisément pourquoi AC4 offre **deux issues acceptables** : « le document reste lisible **ou** le téléchargement est proposé d'emblée ». 🛑 **La seconde est la plus sûre.**
- ✅ **Approche recommandée, sans JS ni détection d'agent utilisateur** : rendre le **bouton de téléchargement et la vignette** (`cv.thumbnailUrl`, déjà générée en 5.17) **toujours visibles et placés avant le cadre**, et **masquer le cadre intégré en dessous d'un point de rupture** (`hidden md:block`). Sur téléphone : vignette + bouton, immédiatement — AC4 satisfait par la seconde branche. Sur desktop : le document intégré — AC1 satisfait.
- ❌ **Ne pas détecter le navigateur ou l'OS en JavaScript** pour décider : fragile, non testable, et cela rendrait la page cliente sans nécessité.
- ⚠️ **Anti-CLS** : la vignette DOIT porter ses `width`/`height` réels (`thumbnailWidth`/`thumbnailHeight`, fournis par `getPublicCv()`). Le pattern exact est dans `AboutClient.tsx` (`<img>` natif + dimensions, **pas `next/image`** : le fichier est déjà normalisé en WebP par sharp). ✅ Le reprendre, commentaire compris.
- ⚠️ Le cadre intégré doit avoir une **hauteur explicite** (ex. `min-height` en `vh`) : un `<object>` sans hauteur s'effondre à quelques pixels.

### ⚠️ Piège n°4 — Le « bouton de téléchargement » (AC1) et l'attribut `download`

- ✅ Un `<a href="/api/cv" download="cv-jeevons.pdf">` stylé en bouton suffit. ❌ **Pas de `<button onClick>`** qui déclencherait une navigation en JS : inutile, et cela casserait le clic-milieu / « ouvrir dans un nouvel onglet ».
- ⚠️ La route pose déjà `Content-Disposition: inline; filename="cv-jeevons.pdf"`. L'attribut `download` **côté client prime** sur `inline` **pour les URLs de même origine** — c'est le cas ici (`/api/cv`). ✅ Le nom de fichier reste `cv-jeevons.pdf`, stable, sans numéro de version (contrat 5.17).
- ⚠️ ❌ **`/api/cv` est de même origine : ne pas y mettre `target="_blank"` + `rel="noopener noreferrer"`** par réflexe. Ce n'est pas un lien sortant ; la règle AGENTS.md §6 vise les liens externes. Un `download` sur un lien externe ne fonctionnerait d'ailleurs pas.
- ⚠️ **Accessibilité** : le lien doit être focusable, avec un focus visible (tokens 6.1) et un libellé explicite (« Télécharger le CV (PDF) » plutôt que « Télécharger »).

### ⚠️ Piège n°5 — Route, statique/dynamique, et métadonnées

- ✅ Créer `src/app/cv/page.tsx`. ⚠️ **Ne pas la placer dans `(admin)`** : c'est une page **publique**, elle doit vivre à la racine du groupe public, comme `/preview`.
- 🛑 **Discipline ISR obligatoire** (AGENTS.md §3, garde-fou `page.tsx:16-29`) : poser **`export const revalidate = 3600`** — un **littéral**, jamais un import de `REVALIDATE_SECONDS` (Next analyse statiquement le segment). ✅ La page ne lit que `getPublicCv()`, déjà cachée sous le tag `settings` : un téléversement admin appelle `revalidateTag('settings')` et la page se rafraîchit. **C'est le second pilier d'AC2.**
- ⚠️ 🛑 **Vérifier au build que `/cv` sort en `○ (Static)`** — et que **`/` reste `○ (Static, 1h)`**. Toute bascule en `ƒ (Dynamic)` signale une lecture dynamique introduite par inadvertance.
- ✅ **Métadonnées** : exporter `metadata` (title/description) sur la page. ⚠️ `layout.tsx` définit déjà `metadataBase` — ✅ le réutiliser par fusion, ❌ ne pas le redéfinir.
- ⚠️ **Sitemap** : `sitemap.ts` est modifié par la **story 6.10**. 🛑 **Décision à prendre et documenter** : y ajouter `/cv` ici, ou laisser 6.10 seule propriétaire du fichier. ⚠️ Si 6.10 n'est pas encore fusionnée, **relire l'état réel du fichier** avant d'y toucher (AGENTS.md §9 règle 1 : deux stories, deux branches). ✅ Ajouter une entrée statique `/cv` est trivial et sans risque de conflit sémantique — mais **le signaler dans les notes de complétion**.
- ⚠️ **`robots.ts`** interdit `/admin` et `/preview`. ✅ `/cv` doit rester **autorisé** — ❌ ne pas toucher au fichier.

### ⚠️ Piège n°6 — Le lien vers `/cv` : où le poser, et ce qu'il remplace

- ⚠️ `AboutClient.tsx` contient **déjà** la carte « CV » avec un `<a href={cv.url} target="_blank">` qui pointe **directement sur le PDF**. 🛑 **Décision à prendre et documenter** : la faire pointer vers **`/cv`** (✅ recommandé — c'est le sens de « au lieu du lien brut actuel », PLAN §4.3) ou la laisser telle quelle.
- 🛑 ⚠️ Si vous la repointez vers `/cv` : **`target="_blank"` et `rel="noopener noreferrer"` doivent DISPARAÎTRE** — `/cv` est une page interne du site, pas un lien sortant. ✅ Et utiliser **`next/link`** pour une navigation interne, pas un `<a>` nu.
- ⚠️ Le texte d'indication « (Cliquez sur le cv pour l'ouvrir) » de `CardHeader` reste juste dans les deux cas. ✅ Vérifier qu'il ne devient pas trompeur.
- ❌ **Ne pas ajouter d'entrée « CV » dans le `Header`** : la navigation est un menu d'ancres de la page unique (`#hero`, `#projects`, `#parcours`, `#about`, `#contact`) ; y glisser un lien de page **casserait le repérage de section de la story 6.5**. Hors périmètre — si Jeevons le veut, c'est une décision à part.
- ⚠️ **La carte CV de `AboutClient` est touchée par la story 6.15** (grille modulaire de la section À propos) : **deux stories, deux branches**. Se limiter au strict `href` et **relire l'état réel du fichier** avant de commencer.

### ⚠️ Piège n°7 — Périmètre

- ❌ **Hors périmètre** : **toute dépendance de rendu PDF** · **toute migration Prisma** · l'écran `/admin/settings` et son téléverseur (story 5.17, **terminé**) · `api/cv/route.ts` (déjà correct) · `lib/cv.ts` (déjà correct) · formulaire de contact (6.12) · section stack (6.13) · chiffres (6.14) · grille À propos (6.15) · `robots.ts` · **entrée « CV » dans le `Header`**.
- ⚠️ Cette story est **la plus petite du lot** — c'est une page de consommation. 🛑 **Si elle grossit, c'est qu'elle déborde.** Le signal d'alarme : toucher à `lib/cv.ts`, à la route API, ou installer quoi que ce soit.

### ⚠️ Piège n°8 — Vérification locale, les 4 AC

- **AC1** : `/cv` s'ouvre, **le PDF est visible dans la page** (pas téléchargé), **et** un bouton de téléchargement est présent et fonctionne (le fichier arrive nommé `cv-jeevons.pdf`).
- **AC2** : 🛑 **Test décisif** — téléverser un **nouveau** PDF depuis `/admin/settings`, puis recharger `/cv` **sans redémarrer ni rebuilder** : le **nouveau** document s'affiche. C'est la validation du couple `revalidateTag('settings')` + `no-cache`.
- **AC3** : forcer le repli. ⚠️ Le plus simple : rendre temporairement la ressource inaffichable (par exemple en pointant l'`<object>` sur une URL invalide en local, ou en testant dans un navigateur sans lecteur PDF) → **le message et le lien de téléchargement doivent apparaître**. 🛑 Vérifier que ce repli est **du HTML enfant de l'`<object>`**, pas une détection JS.
- **AC4** : 🛑 **Test décisif** — ouvrir `/cv` sur **un vrai téléphone** (ou l'émulation mobile des outils de développement) : soit le document est lisible et défilable, soit **la vignette + le bouton de téléchargement sont visibles d'emblée, sans défilement**. ❌ Un cadre gris vide est un échec.
- **Cas hors AC** : base vide / aucun CV téléversé → **état neutre**, jamais une page en erreur ni un cadre vide.
- 🛑 **Non-régression** : `/` toujours **`○ (Static, 1h)`** · `/cv` en **`○`** · la carte CV de `/#about` fonctionne toujours · `bun run build` OK.

## Tasks / Subtasks

- [x] **Tâche 0 — Prérequis & décisions** (AC: 1, 2, 3)
  - [x] 6.1 et 6.2 `done`. 🛑 **Décider et documenter** : comportement si `cv === null` (état neutre recommandé) · ajout de `/cv` au sitemap ou non (⚠️ fichier partagé avec 6.10) · repointage du lien de la carte `AboutClient` vers `/cv` (recommandé).
  - [x] 🛑 Confirmer : **aucune dépendance ajoutée**, `lib/cv.ts` et `api/cv/route.ts` **non modifiés**.
- [x] **Tâche 1 — Page `/cv`** (AC: 1, 2 ; pièges n°1, n°5)
  - [x] `src/app/cv/page.tsx`, publique, **`export const revalidate = 3600`** (littéral). Lit **`getPublicCv()`** ; l'intégration pointe **`CV_PUBLIC_URL`** (`/api/cv`). ❌ Aucun chemin de fichier en dur.
  - [x] Intégration par **`<object type="application/pdf">`** avec `title`/`aria-label` et **hauteur explicite**. Identité tokenisée (6.1), `<h1>`, contrastes AA.
  - [x] **Bouton de téléchargement** : `<a href={CV_PUBLIC_URL} download>` stylé, focusable, libellé explicite. ❌ Pas de `target="_blank"` (même origine).
  - [x] `metadata` (title/description), `metadataBase` du layout réutilisé.
- [x] **Tâche 2 — Repli AC3** (AC: 3 ; piège n°1)
  - [x] Message clair **+ lien de téléchargement** en **contenu enfant de l'`<object>`**. 🛑 **Aucune détection JavaScript.**
- [x] **Tâche 3 — Mobile** (AC: 4 ; piège n°3)
  - [x] **Vignette** (`thumbnailUrl` + `width`/`height` réels, pattern `AboutClient`, `<img>` natif) **et bouton de téléchargement visibles d'emblée** ; cadre intégré **masqué sous le point de rupture**. ❌ Aucune détection d'agent utilisateur.
- [x] **Tâche 4 — État « aucun CV »** (hors AC ; piège n°2)
  - [x] `cv === null` → état neutre (décision de la tâche 0), **jamais** une page en erreur ni un cadre vide. Reprendre le ton de `AboutClient` (« CV bientôt disponible. »).
- [x] **Tâche 5 — Lien depuis la carte À propos** (piège n°6)
  - [x] Si décidé : `AboutClient` → **`next/link` vers `/cv`**, 🛑 **`target="_blank"` et `rel` retirés**. ⚠️ Relire l'état réel du fichier (stories 6.15/6.11 concurrentes). ❌ Aucune entrée « CV » dans le `Header`.
- [x] **Tâche 6 — Vérification locale** (AC: 1-4 ; piège n°8)
  - [x] Structure vérifiée sur le **HTML servi**, puis **avec le vrai CV de Jeevons en base** : `<object data="/api/cv#toolbar=0&navpanes=0&view=Fit">` + repli enfant, `download="cv-jeevons.pdf"`, vignette servie du volume, `href="/cv"` sur la carte À propos. `/api/cv` → **200 `application/pdf` 116 Ko**.
  - [x] 🛑 **AC2 VALIDÉ EN CONDITIONS RÉELLES** : Jeevons a téléversé un PDF depuis `/admin/settings` ; `/cv` a servi le nouveau document **sans rebuild ni redémarrage**. La chaîne `revalidateTag('settings')` + `no-cache` est éprouvée de bout en bout.
  - [x] Cas « aucun CV » vérifié en conditions réelles (page 200, état neutre, aucun cadre vide).
  - [x] **Ajustement visuel demandé par Jeevons après revue** (« le style du viewer est très moche, pas dans la DA »), puis validé par lui : voir les notes de complétion.
  - [ ] ⚠️ **DUES PAR JEEVONS** : **AC4 sur un vrai téléphone** · **AC3** dans un navigateur sans lecteur PDF · **clavier** (focus visible sur le bouton et le retour) · rendu sous **Firefox/Safari** (qui ignorent `#toolbar=0`).
- [x] **Tâche 7 — Definition of Done** (AGENTS.md §8)
  - [x] `bun run lint` 0 / `bunx tsc --noEmit` 0 / `bun run build` OK (**`/` toujours `○ (Static, 1h)`**, **`/cv` en `○` 1h**).
  - [x] `git diff DEV` : `app/cv/page.tsx` (+ `sitemap.ts` et le `href` de `AboutClient`). ❌ **Aucune dépendance**, aucune migration, `lib/cv.ts` / `api/cv/route.ts` / `robots.ts` / `Header.tsx` intacts.
  - [x] `File List` + `Completion Notes` + `Change Log` · `sprint-status.yaml`.

## Dev Notes

### Périmètre — verrouillé

**Créer la page publique statique `/cv` qui affiche le CV courant intégré dans le navigateur via un `<object type="application/pdf">` pointant l'URL stable `/api/cv`, avec un bouton de téléchargement toujours proposé, un repli déclaratif en contenu enfant de l'`<object>` si le navigateur ne sait pas l'afficher, et une présentation mobile qui met la vignette et le téléchargement en avant — en consommant tel quel tout ce que la story 5.17 a déjà livré, sans aucune dépendance ni modification de la plomberie CV.**

**Hors périmètre — ne pas faire :**
- ❌ **Installer une bibliothèque de rendu PDF** (`react-pdf`, `pdfjs-dist`…) — AGENTS.md §9 règle 6 : **arrêter et demander**.
- ❌ **Modifier `lib/cv.ts` ou `app/api/cv/route.ts`** — 5.17 est terminée et correcte ; `Cache-Control: no-cache` et `Content-Disposition: inline` sont **délibérés**.
- ❌ **Coder en dur un chemin de fichier** ou reconstruire une URL depuis `value.path` (contredit AC2 et le piège n°2 de 5.17).
- ❌ **Détecter le navigateur / l'OS en JavaScript** pour AC3 ou AC4.
- ❌ **`revalidate` non littéral** · rendre la page dynamique · casser `/` en `ƒ`.
- ❌ **`target="_blank"` sur `/api/cv`** (même origine) · **entrée « CV » dans le `Header`** (casserait 6.5).
- ❌ Toute migration Prisma · écran `/admin/settings` · `robots.ts` · contact (6.12) · stack (6.13) · chiffres (6.14) · grille À propos (6.15).

### Le vrai enjeu

Cette story est **courte parce que 5.17 a fait le travail difficile**. L'URL publique stable, la résolution du CV courant, la vignette anti-CLS, la gestion de l'absence : tout est là. Le seul vrai risque est donc **le sur-engineering** — installer un lecteur PDF alors qu'`<object>` suffit, écrire une détection de navigateur alors que le repli d'`<object>` est déclaratif, ou recréer une lecture alors que `getPublicCv()` existe. Les deux points qui demandent réellement de la vigilance sont ailleurs : **AC4**, parce que l'affichage intégré d'un PDF sur mobile est mauvais **sans déclencher le repli** (d'où vignette + téléchargement mis en avant sous le point de rupture), et **AC2**, dont la validation n'est pas visuelle mais opérationnelle — téléverser un nouveau CV et vérifier qu'il apparaît **sans rebuild**, ce qui éprouve la chaîne `revalidateTag('settings')` + `no-cache` de bout en bout.

### Testing standards

Vérification **manuelle** des 4 AC, avec deux tests décisifs : **téléverser un nouveau CV depuis `/admin/settings` et recharger `/cv` sans rebuild** (AC2), et **ouvrir la page sur un vrai téléphone** pour constater que le document est lisible ou que le téléchargement est proposé d'emblée (AC4). Plus le repli AC3 en contenu enfant de l'`<object>`, le cas « aucun CV téléversé » (état neutre), le clavier sur le bouton de téléchargement, et les non-régressions : `/` toujours `○ (Static, 1h)`, `/cv` en `○`, carte CV de `/#about` fonctionnelle. `lint`/`tsc`/`build` verts.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.11]
- [Source: PLAN_REFONTE_2026.md §4.3 — « **`/cv`** : viewer PDF inline + bouton téléchargement (au lieu du lien brut actuel) » ; §4.4 — Lighthouse ≥ 95, CLS < 0,05]
- [Source: AGENTS.md §3 — pages publiques statiques + ISR, ne jamais tomber en erreur ; §6 — images avec dimensions explicites, focus visible, contrastes AA ; §9 règle 6 — zéro dépendance sans validation]
- [Source: apps/web/src/lib/cv.ts — `CV_PUBLIC_URL = "/api/cv"`, `getPublicCv()` (cachée tag `settings`, renvoie `null` si aucun CV, `try/catch` intégré, **pas de `readWithFallback` à ajouter**), `PublicCv` = url + thumbnailUrl + thumbnailWidth/Height]
- [Source: apps/web/src/app/api/cv/route.ts — résout `cv.current` à chaque requête ; `Content-Disposition: inline; filename="cv-jeevons.pdf"` et `Cache-Control: no-cache` sont DÉLIBÉRÉS (AC2 de 5.17) : NE PAS MODIFIER]
- [Source: apps/web/src/sections/AboutClient.tsx — carte « CV » : lien actuel `target="_blank"` vers le PDF brut (à repointer vers `/cv`) ; état neutre « CV bientôt disponible. » à reproduire ; pattern vignette `<img>` natif + `width`/`height` (anti-CLS, pas `next/image`)]
- [Source: apps/web/src/app/page.tsx:16-29 — `revalidate` littéral obligatoire (analyse statique du segment), garde-fou anti-rendu-dynamique]
- [Source: apps/web/src/app/layout.tsx — `metadataBase` à réutiliser par fusion]
- [Source: apps/web/src/app/sitemap.ts — fichier PARTAGÉ avec la story 6.10 : relire son état réel avant d'y toucher]
- [Source: apps/web/src/app/robots.ts — `/admin` et `/preview` interdits, `/cv` doit rester autorisé : NE PAS MODIFIER]
- [Source: apps/web/src/sections/Header.tsx — menu d'ancres de la page unique : ne pas y ajouter `/cv` (repérage de section, story 6.5)]
- [Source: apps/web/package.json — aucune bibliothèque de rendu PDF installée ; `pdf-to-img` est une dépendance SERVEUR de 5.17 (génération de vignette), pas un lecteur client]

## Dev Agent Record

### Agent Model Used

claude-opus-5 (Claude Code)

### Completion Notes

**Page publique `/cv` créée — `○ (Static)` avec revalidation d'1 h, zéro dépendance, zéro JavaScript.**

**Les 3 décisions de la tâche 0, tranchées par Jeevons (les 3 recommandations retenues) :**
1. **`cv === null` → état neutre**, pas `notFound()`. La page répond 200 et affiche « CV bientôt disponible. » (ton repris de `AboutClient`). Un 404 aurait rendu mort le lien de la carte « CV » tant que rien n'est téléversé, à rebours d'AGENTS.md §3.
2. **`/cv` AJOUTÉ au sitemap.** ⚠️ `sitemap.ts` est partagé avec la story 6.10 : son état réel a été relu avant modification, l'entrée est posée **dans le tableau `root`** (donc listée même si la lecture des projets échoue) et **ne touche pas** la logique projets de 6.10. Vérifié sur `/sitemap.xml` servi : 8 `<loc>` = racine + `/cv` + les 6 projets publiés, aucun brouillon.
3. **Carte « CV » de `AboutClient` repointée vers `/cv`** via `next/link`, **`target="_blank"` et `rel="noopener noreferrer"` RETIRÉS** (page interne, pas un lien sortant — AGENTS.md §6 ne s'applique pas). Le texte « (Cliquez sur le cv pour l'ouvrir) » du `CardHeader` reste juste.

**Choix techniques (les pièges de la story) :**
- 🛑 **`<object type="application/pdf">` et NON `<iframe>`** — c'est le point clé d'AC3 : `<object>` rend son **contenu enfant** quand le navigateur ne sait pas afficher le type, donc **le repli est purement déclaratif, sans une ligne de JavaScript ni détection de navigateur**. Un `<iframe>` n'a pas ce comportement.
- 🛑 **Aucune bibliothèque de rendu PDF installée** (`react-pdf`/`pdfjs-dist`…). C'était le risque de dérapage n°1 de la story : plusieurs centaines de Ko de JS pour ce que le navigateur fait nativement. `git diff` de `package.json` : **vide**.
- 🛑 **AC4 par CSS pur, sans détection d'agent utilisateur** : vignette + bouton **AVANT** le cadre dans le DOM, visibles d'emblée sur mobile (`md:hidden` sur la vignette), cadre intégré `hidden md:block`. C'est la seconde branche d'AC4 (« le téléchargement est proposé d'emblée »), la plus sûre — l'affichage intégré d'un PDF sur iOS/Android est mauvais **sans déclencher le repli** de l'`<object>`.
- ✅ **AC2 par construction** : la page consomme `getPublicCv()` (cachée sous le tag `settings`) et pointe `CV_PUBLIC_URL` (`/api/cv`, URL stable). Aucun chemin de fichier en dur, aucune URL reconstruite depuis `value.path`. `revalidate = 3600` **littéral**.
- ✅ `<a download="cv-jeevons.pdf">`, pas de `<button onClick>` ; ni `target="_blank"` ni `rel` (même origine).
- ❌ **`lib/cv.ts`, `api/cv/route.ts`, `robots.ts` et `Header.tsx` INTACTS** (absents du diff). Aucune migration, aucune Server Action, aucun écran admin.

**Vérifications exécutées :** lint **0 erreur 0 warning** · `tsc` **0** · `build` **OK**. Table de routes : **`/cv` en `○` 1h**, **`/` reste `○` 1h**, les 6 fiches `/projects/[slug]` en `●` inchangées. Sur le HTML **servi** : `<h1>` rendu côté serveur, `<object data="/api/cv">` avec son repli enfant, `download="cv-jeevons.pdf"` (présent deux fois : bouton principal + repli), vignette avec `width="595" height="842"` réels. Cas « aucun CV » vérifié **en conditions réelles** (la base ne contient aucun `cv.current`) : page **200**, état neutre, **aucun cadre vide**.

✅ **AC2 VALIDÉ EN CONDITIONS RÉELLES (le test décisif est passé).** Jeevons a téléversé un vrai CV depuis `/admin/settings` : `/api/cv` répond **200 `application/pdf`, 116 300 octets**, et `/cv` a servi le nouveau document **sans rebuild ni redémarrage**. La chaîne `revalidateTag('settings')` → `unstable_cache` (tag `settings`) → `Cache-Control: no-cache` de la route est donc éprouvée de bout en bout, pas seulement « par construction ».

🛑 **BUG PRÉEXISTANT DE LA STORY 5.17 DÉCOUVERT ET CORRIGÉ EN CHEMIN — `next.config.mjs`.** Le premier téléversement a échoué en **500** : `TypeError: Object.defineProperty called on non-object` sur l'`await import("pdf-to-img")` de `lib/media/pdf.ts:79`. Isolé par `bun -e "import('pdf-to-img')"` → **import OK hors Next**, ce qui désignait le bundler. Cause : `next.config.mjs` déclarait bien `outputFileTracingIncludes` (**présence** des fichiers dans le standalone) mais **pas** `serverExternalPackages` (**mode de chargement**) ; webpack transpilait `pdfjs-dist`, un ESM qui manipule ses propres exports et charge un binaire natif. Correctif : `serverExternalPackages: ["pdf-to-img", "pdfjs-dist", "@napi-rs/canvas"]`. ⚠️ **Ce bug rendait TOUT téléversement de CV impossible en production** ; il était invisible parce que la clé `cv.current` n'avait jamais existé — le chemin de code n'était jamais emprunté. **Hors périmètre de 6.11, corrigé sur décision explicite de Jeevons, commité séparément et rattaché à la story 5.17.**

🎨 **RESTYLAGE DU LECTEUR, demandé par Jeevons après revue** (« le style du viewer est très moche, pas du tout dans la DA du site ») puis validé par lui. ⚠️ **La barre grise est le lecteur PDF NATIF du navigateur : elle est hors d'atteinte du CSS** — aucune règle ne peut la styler. Ce qui a été fait, à la place : `#toolbar=0&navpanes=0` dans le **fragment** (jamais envoyé au serveur ; honoré par Chrome/Edge, **ignoré silencieusement par Firefox/Safari** — dégradation acceptée), cadre habillé aux jetons 6.1 (`rounded-card`, `bg-surface-raised`, bordure `white/10`). Puis, sur la demande « pouvoir tout voir sans scroller » : **`view=Fit` et NON `FitH`** (`FitH` ajuste à la *largeur* et fait déborder la page en hauteur, obligeant à défiler *dans* le lecteur), cadre en **`aspect-[1/1.414]`** (ratio A4) au lieu d'une hauteur en `vh`, vignette masquée en desktop (redondante avec le lecteur juste en dessous), entête replié sur une ligne et marges resserrées. **Limite énoncée à Jeevons et acceptée :** le zéro-défilement *de page* est impossible tant qu'un header, un titre et un bouton occupent le haut de l'écran au-dessus d'un cadre au ratio A4.

✅ **Base de données rendue à son état initial.** Pour exercer la branche « CV présent » avant que Jeevons ne téléverse, une ligne de test `cv.current` avait été insérée (clé **inexistante** auparavant : `AVANT: null`) puis un stub temporaire de `getPublicCv()` utilisé. **Le stub a été retiré** (`git diff` de `lib/cv.ts` vide) et **la ligne de test supprimée** une fois la base joignable (`APRES nettoyage: null`), avant le téléversement du vrai CV.

⚠️ **VÉRIFICATIONS DUES PAR JEEVONS :** **AC4 sur un vrai téléphone** · **AC3** dans un navigateur sans lecteur PDF · **clavier** sur le bouton de téléchargement et sur « Retour au site » · rendu sous **Firefox/Safari** (qui ignorent `#toolbar=0` : la barre native y restera visible) · rendu à **375 px** · non-régression de la carte « CV » de `/#about`.

### File List

- `apps/web/src/app/cv/page.tsx` *(nouveau)* — page publique statique du CV.
- `apps/web/src/app/sitemap.ts` *(modifié)* — entrée `/cv` ajoutée au tableau `root`. ⚠️ Fichier partagé avec la story 6.10.
- `apps/web/src/sections/AboutClient.tsx` *(modifié)* — carte « CV » repointée vers `/cv` (`next/link`, `target`/`rel` retirés). ⚠️ Fichier également touché par la story 6.15.
- `apps/web/next.config.mjs` *(modifié)* — 🛑 **hors périmètre 6.11** : `serverExternalPackages` ajouté, correctif d'un bug préexistant de la **story 5.17**. Commit séparé.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` *(modifié)* — statut de la story.
- `_bmad-output/implementation-artifacts/6-11-consulter-et-telecharger-le-cv.md` *(modifié)* — Dev Agent Record.

### Change Log

- 2026-07-26 — Story 6.11 implémentée : page publique `/cv` (`<object type="application/pdf">` + repli déclaratif enfant, bouton de téléchargement, vignette et téléchargement mis en avant sous le point de rupture mobile, état neutre si aucun CV), `/cv` ajouté au sitemap, carte « CV » de la section À propos repointée vers la page. Aucune dépendance, aucune migration, plomberie CV de la story 5.17 consommée telle quelle. lint/tsc/build verts, `/cv` en `○` 1h, `/` inchangée.
- 2026-07-26 — **AC2 validé en conditions réelles** après téléversement d'un vrai CV par Jeevons (`/api/cv` → 200, 116 Ko, servi sans rebuild). Base de test nettoyée (`cv.current` supprimée, retour à `null`).
- 2026-07-26 — **Correctif hors périmètre, story 5.17** : `serverExternalPackages` dans `next.config.mjs`. Sans lui, tout téléversement de CV échouait en 500 (`pdfjs-dist` cassé par le bundling webpack). Commit séparé.
- 2026-07-26 — **Restylage du lecteur** sur retour de Jeevons : `#toolbar=0&navpanes=0`, `view=Fit`, cadre `aspect-[1/1.414]` aux jetons 6.1, vignette masquée en desktop, entête et marges resserrés. Validé par Jeevons.
