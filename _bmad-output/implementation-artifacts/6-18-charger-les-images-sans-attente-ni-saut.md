---
baseline_commit: c408eae7818fb33ef915a70085775688fbf80640
---

# Story 6.18: Charger les images sans attente ni saut

Status: review

## Story

As **visiteur du portfolio**,
I want **des images qui s'affichent vite et sans faire sauter la page**,
so that **la consultation reste fluide, y compris en connexion lente**.

## Acceptance Criteria

**AC1 — Formats modernes et tailles adaptées à l'écran**
**Given** les images sont aujourd'hui servies dans un format unique
**When** cette story est terminée
**Then** elles sont servies dans des formats modernes et à des tailles adaptées à l'écran

**AC2 — Aperçu flouté et absence de saut de mise en page**
**Given** une image met du temps à charger
**When** la page se rend
**Then** un aperçu flouté occupe sa place
**And** la mise en page ne saute pas à l'arrivée de l'image

**AC3 — Les images de la bibliothèque bénéficient du même traitement**
**Given** les illustrations viennent désormais de la bibliothèque de médias
**When** elles s'affichent sur le site public
**Then** elles bénéficient du même traitement que les images intégrées au projet

**AC4 — Chaque fichier conservé dans le dépôt est effectivement utilisé**
**Given** des images restent dans le dépôt après la purge de l'Epic 1
**When** j'inventorie ce qui subsiste
**Then** chaque fichier conservé est effectivement utilisé

## Contexte d'implémentation

### 🛑 Cette story a DEUX moitiés indépendantes — ne pas les confondre

🛑 **À lire d'abord.** Les images du site ont **deux origines**, traitées par **deux chaînes totalement différentes**, et les AC ne s'appliquent pas de la même façon :

| Origine | Chemin | Traitement actuel | Ce que cette story doit faire |
|---|---|---|---|
| **A. Assets du dépôt** (`src/assets/images/*`) | imports statiques | `next/image` (Hero, About, Testimonials) **ou** `<Image>` sans `sizes` (repli projets) | ✅ **AC1 + AC2 + AC4** |
| **B. Bibliothèque de médias** (uploads, story 5.12/5.13) | `<img>` via `/api/media/[...path]` | ✅ **déjà** WebP, redimensionné 1600 px, `width`/`height`, `blurDataUrl`, `loading="lazy"` | ⚠️ **AC3 = surtout une VÉRIFICATION** |

- 🛑 **La moitié B est en grande partie déjà faite** — et c'est une bonne nouvelle qu'il faut lire correctement (voir piège n°2). ❌ **Ne pas la refaire.**

### 🛑 Piège n°1 (CENTRAL) — AC3 : le piège serait de faire passer les uploads dans `next/image`

- 🛑 **C'est le contresens à éviter absolument.** AC3 dit « **le même traitement** que les images intégrées au projet ». La lecture naïve : « les assets passent par `next/image`, donc les uploads doivent y passer aussi ». ❌ **Faux, et le dépôt le documente déjà.**
- ✅ Vérifié — `ProjectCard.tsx:158-167` porte le commentaire de la **story 5.12** :
  > « `<img>` et NON `next/image` : le fichier est **déjà normalisé en WebP et redimensionné par sharp** au téléversement, **le repasser dans l'optimiseur de Next le retraiterait sans gain**. »
- ✅ Vérifié — `lib/media/process.ts` : `.resize({ width: 1600, withoutEnlargement: true })` + `.webp({ quality: 82 })`, et un `blurDataUrl` généré (`resize({ width: 16 })` → base64 WebP) stocké dans la colonne `Media.blurDataUrl`.
- ✅ Vérifié — l'affichage porte déjà `width`/`height` explicites **et** le `blurDataUrl` en `backgroundImage` : **AC2 est déjà satisfait pour la moitié B**, avec un commentaire qui l'énonce (« le navigateur connaît le ratio AVANT le chargement et réserve la place »).
- 🛑 ✅ **Donc AC3 se lit ainsi** : « **même NIVEAU de traitement** » — format moderne ✅, taille bornée ✅, aperçu flouté ✅, dimensions réservées ✅. ⚠️ **Le travail d'AC3 est de VÉRIFIER que c'est vrai à tous les points d'affichage public**, et de **combler les écarts** s'il en reste. ❌ **Pas de migrer les uploads vers `next/image`** — ce serait défaire un travail livré et **doubler** le coût de traitement.
- ⚠️ **Les écarts possibles, à chercher** : un média affiché **sans `blurDataUrl` en fond**, **sans `width`/`height`**, ou **sans `loading="lazy"`** ailleurs que dans `ProjectCard`. ⚠️ La **story 5.14** a ajouté les médias sur les **entrées de parcours** (relation `Media` ↔ timeline), et les stories **6.9** (déroulé vertical) et **6.10** (page projet) en affichent aussi. 🛑 **Inventorier TOUS les points d'affichage public d'un `Media` sur `DEV` au moment de l'implémentation** — ❌ pas se fier à cette liste, qui date de la baseline.
- ⚠️ 🛑 **Écart connu à traiter** : `MAX_WIDTH = 1600` est une **taille unique**. AC1 dit « à des tailles **adaptées à l'écran** ». ⚠️ Servir 1600 px à un téléphone est un gaspillage réel. 🛑 **Décider et documenter** : ✅ **recommandé — s'en tenir à `sizes`/`srcset` côté A** et considérer que 1600 px borné + WebP + lazy satisfait AC1 pour B ; ⚠️ générer **plusieurs tailles à l'upload** serait une modification du pipeline de la story 5.12 — 🛑 **débordement Epic 5, arrêter et demander** avant de l'entreprendre.

### 🛑 Piège n°2 — AC1/AC2 côté A : l'écart réel est `sizes`, et l'exception `HeroOrbit`

- ✅ **Ce qui est déjà acquis** : `next/image` avec un **import statique** fournit **automatiquement** `width`/`height` (donc **AC2 gratuit**, pas de CLS) et la conversion de format à la demande. Le site en a plusieurs usages : `Hero.tsx:106` (memoji), `AboutClient.tsx:160,168`, `TestimonialsClient.tsx:130`, `ProjectCard.tsx:184` (repli).
- 🛑 **Ce qui manque vraiment pour AC1** : **aucun de ces `<Image>` ne porte `sizes`**. Sans `sizes`, une image non-`fill` sert sa taille intrinsèque quel que soit l'écran — c'est exactement le « format unique » que l'AC dénonce. ✅ **Ajouter `sizes` sur les images dont la largeur rendue varie selon le point de rupture** (`md:` / `lg:`).
  - ⚠️ ❌ **Ne pas ajouter `sizes` sur les images à taille fixe** (le memoji est `size-[100px]` en toutes largeurs) : sans effet, et cela ajoute du bruit.
- 🛑 ⚠️ **`next.config.mjs` ne déclare AUCUN bloc `images`.** Le défaut Next inclut déjà AVIF+WebP dans `formats` selon la version ; ✅ **vérifier le comportement réel** (en-tête `Content-Type` de la réponse `/_next/image`) avant d'ajouter quoi que ce soit. ⚠️ Si un bloc `images` est ajouté, 🛑 **le faire par EXTENSION** — ❌ `next.config.mjs` porte le **loader `@svgr/webpack`** (story 3.3) et les **`outputFileTracingIncludes` de `pdf-to-img`** (story 5.17, indispensables au conteneur de production) : ❌ **ne rien en casser.**
- 🛑 ⚠️ **AVIF a un coût CPU d'encodage significatif** et le site tourne sur un **VPS Hetzner mutualisé** (AGENTS.md §1 : coût additionnel nul). ⚠️ L'optimiseur d'images de Next s'exécute **dans le conteneur**. 🛑 **Décider et documenter** si AVIF est activé — ✅ WebP seul est un choix défendable ici ; ❌ **ne pas activer AVIF sans mesurer le temps de première réponse**.
- ⚠️ 🛑 **`AboutClient.tsx:95` porte déjà un commentaire** expliquant un choix `<img>` plutôt que `next/image` (aligné sur les covers 5.12). ✅ **Le lire et le respecter** — ❌ ne pas « corriger » un choix documenté.
- 🛑 ⚠️ **`HeroOrbit` et les icônes SVG sont HORS SUJET** : les SVG passent par `@svgr/webpack` et deviennent des composants React, ❌ pas des images. **Ne pas y toucher.**
- ⚠️ **`grain.jpg` (177 Ko) est utilisé en `backgroundImage` CSS** dans trois fichiers (`Hero`, `ContactClient`, `Card`) — ❌ **pas optimisable par `next/image`** (ce n'est pas une balise `<img>`). ⚠️ Il est **utilisé**, donc AC4 ne le concerne pas. 🛑 ❌ **Ne pas tenter de le convertir en composant image** : c'est un fond répété, la refonte casserait trois sections. ⚠️ Le recompresser serait un gain (~177 Ko pour une texture) mais 🛑 **hors des AC** — ❌ ne pas le faire de sa propre initiative.

### 🛑 Piège n°3 — AC4 : l'inventaire est FAIT, et il est plus lourd qu'attendu

🛑 **Inventaire vérifié à la baseline** (`grep` de chaque nom de fichier dans tout `src/`, extensions `.ts`/`.tsx`/`.json`/`.prisma`) : sur **29 fichiers** de `src/assets/images/`, **13 ne sont référencés NULLE PART** — soit **≈ 2,5 Mo**.

| Fichier non référencé | Poids |
|---|---|
| `ai-startup-landing-page.png` | 980 Ko |
| `map.png` | 606 Ko |
| `light-saas-landing-page.png` | 317 Ko |
| `dark-saas-landing-page.png` | 250 Ko |
| `book-cover.png` | 212 Ko |
| `memoji-computer.png` | 100 Ko |
| `memoji-smile.png` | 92 Ko |
| `jeevons-avatar-neutral.webp` | 68 Ko |
| `quantumWebsite.webp` | 21 Ko |
| `memoji-avatar-1.png` … `-5.png` | ~60 Ko (5 fichiers) |
| `IMG_5500-removebg-preview_resultat.webp` | 7 Ko |

- 🛑 ⚠️ **NE PAS supprimer sur la foi de ce tableau.** Il date de la **baseline `c408eae`**, et **quinze stories de l'Epic 6 sont `ready-for-dev`** entre-temps — dont **6.15** (grille À propos), **6.13** (compétences) et **6.10** (page projet), qui peuvent parfaitement **avoir commencé à utiliser** un memoji ou une capture. ✅ **Refaire l'inventaire soi-même sur `DEV`** au moment de l'implémentation, **et le joindre aux notes de complétion**.
- 🛑 ⚠️ **Les pièges du `grep`, tous vérifiés comme réels ici** :
  - ❌ **Un nom de fichier peut être construit dynamiquement** — vérifié : il n'y en a pas dans ce dépôt (`projectImagesBySlug` dans `Projects.tsx` et `SelfProject.tsx` mappe des **imports statiques**, pas des chaînes). ✅ **Le revérifier quand même.**
  - 🛑 ⚠️ **Ne pas chercher que dans `src/`** : chercher aussi dans `public/`, `prisma/seed*`, `scripts/`, `content/`. ⚠️ **`public/assets/docs/photoIDD.jpg` existe** et n'est pas dans `src/assets` — 🛑 **vérifier son usage** (⚠️ il n'y en a peut-être aucun, mais ⚠️ un fichier de `public/` est **servi par son URL**, donc référençable depuis la **base** ou un contenu administré : ❌ **la prudence s'impose**).
  - 🛑 ⚠️ **Une image peut être référencée depuis la BASE** (colonne `Media.path`) — ⚠️ mais les médias vivent dans le **volume `uploads`**, ❌ pas dans `src/assets`. ✅ Les deux espaces sont disjoints, ce qui **simplifie AC4** : ✅ **AC4 ne concerne QUE les assets du dépôt**, ❌ pas la bibliothèque de médias (❌ **ne jamais supprimer de fichier du volume uploads** : c'est de la donnée de production, story 5.13 gère sa suppression avec une **garde d'intégrité**).
- ⚠️ ✅ **Le précédent existe** : la **story 1.9** a fait exactement ce travail pour les CV (13 fichiers, ~15 Mo). ✅ **Reprendre sa méthode** : lister, mesurer, vérifier chaque référence, supprimer, **rebuild** — ❌ pas de suppression « au jugé ».
- 🛑 **Le test qui tranche** : `bun run build` **doit passer**. Un import statique manquant est une **erreur de compilation**, ❌ pas un silence. ✅ C'est le filet de sécurité d'AC4 — mais ⚠️ il ne couvre **pas** les fichiers de `public/`, référencés par URL : ceux-là **échouent silencieusement en 404**. 🛑 **Redoubler de prudence sur `public/`.**

### ⚠️ Piège n°4 — AC2 côté A : le `blurDataURL` n'est PAS automatique en production

- ⚠️ ✅ `placeholder="blur"` avec un **import statique** fait générer le `blurDataURL` **au build** par Next — ✅ c'est gratuit et c'est la voie recommandée pour la moitié A.
- 🛑 ⚠️ **Mais il ne s'active pas tout seul** : sans l'attribut `placeholder="blur"`, aucune des images actuelles n'a d'aperçu flouté. ✅ **C'est le vrai travail d'AC2 côté A.**
- ⚠️ ❌ **`placeholder="blur"` sur une source dynamique (chaîne d'URL) exige un `blurDataURL` explicite**, sinon Next **jette à l'exécution**. ⚠️ Ne concerne pas les imports statiques — 🛑 mais **attention au repli `projectImagesBySlug`** si quelqu'un le rend dynamique.
- ⚠️ **Le placeholder alourdit le HTML** (base64 inline). ✅ Acceptable pour quelques images ; ⚠️ ❌ **ne pas l'appliquer à une longue liste** sans mesurer le poids du document.
- 🛑 **AC2 dit « la mise en page ne saute pas »** : c'est déjà acquis côté A (imports statiques = dimensions connues) ✅ et côté B (`width`/`height` explicites) ✅. 🛑 **Le vérifier, ne pas le supposer** — mesurer le **CLS** (cible PLAN §4.4 : **< 0,05**).
- ⚠️ 🛑 **`priority` sur l'image du hero** : le memoji est **au-dessus de la ligne de flottaison** et participe au **LCP** (cible < 2 s). ⚠️ **Le lazy-loading par défaut le retarde.** 🛑 **Décider et documenter** — ✅ `priority` y est probablement justifié, ⚠️ mais ❌ **jamais sur plus d'une ou deux images** (sinon la file de chargement se sature et le LCP **empire**).

### ⚠️ Piège n°5 — Périmètre

- ❌ **Hors périmètre** : **toute migration Prisma** · le **pipeline d'upload** (`lib/media/process.ts`, `MAX_WIDTH`, `sharp`) — ⚠️ **story 5.12, y toucher est un débordement Epic 5 : arrêter et demander** · la route `/api/media/[...path]` (⚠️ elle porte une **garde anti-traversée de chemin**, ❌ ne pas la modifier) · `/admin` (⚠️ ses `<img>` sont des **aperçus d'administration**, ❌ pas du site public) · **le volume `uploads`** (données de production) · les **SVG** (`@svgr/webpack`) · le **contenu éditorial** · le `Header` · **toute dépendance** (`sharp` et `next/image` suffisent).
- ⚠️ 🛑 **Le débordement le plus probable** : « tant qu'à optimiser les images, autant régénérer toutes les couvertures en plusieurs tailles ». ❌ **Non** — c'est modifier le pipeline de 5.12. **Une story, rien qu'une story, toute la story.**
- ⚠️ 🛑 **Le second débordement, plus insidieux** : « ce fichier a l'air inutilisé, je le supprime ». 🛑 ❌ **Aucune suppression sans inventaire refait sur `DEV` et build vert.** ⚠️ Une suppression de trop dans `public/` est une **404 silencieuse en production**.

### ⚠️ Piège n°6 — Vérification locale, les 4 AC

- **AC1** : 🛑 **Test décisif** — dans l'onglet Réseau, sur un viewport **mobile** puis **desktop** : les requêtes `/_next/image` portent des **`w=` différents** (c'est `sizes` qui opère) et un **`Content-Type` moderne** (`image/webp` ou `image/avif`). ❌ Servir la même taille partout = AC1 non satisfait.
- **AC2** : 🛑 **avec throttling réseau « Slow 3G »** — un **aperçu flouté** occupe la place, puis l'image arrive **sans que rien ne bouge**. 🛑 Mesurer le **CLS < 0,05**.
- **AC3** : 🛑 **Inventorier tous les points d'affichage public d'un média** (cartes projet, parcours 5.14/6.9, page projet 6.10…) et vérifier **un par un** : `width`/`height` ✅, `blurDataUrl` en fond ✅, `loading="lazy"` ✅ (sauf au-dessus de la ligne de flottaison). ❌ **Aucun média migré vers `next/image`.**
- **AC4** : 🛑 **Inventaire REFAIT sur `DEV`** (pas le tableau ci-dessus) · chaque suppression justifiée · `bun run build` **vert** · 🛑 **parcourir le site à l'œil** : ❌ aucune image manquante, ❌ aucune 404 dans l'onglet Réseau (le filet du build **ne couvre pas** `public/`).
- **Non-régression** : 🛑 **`/` toujours `○ (Static, 1h)`** · `/preview` intact · `/admin` **inchangé** · **build du conteneur** OK (⚠️ `next.config.mjs` porte le loader SVG **et** le traçage `pdf-to-img` — 🛑 **si ce fichier est modifié, le vérifier**) · **LCP** mesuré, ❌ pas dégradé.

## Tasks / Subtasks

- [x] **Tâche 0 — Inventaire & décisions** (AC: 1, 4)
  - [x] 🛑 **Refaire l'inventaire des assets sur `DEV`** (⚠️ pas le tableau de la baseline) : `src/assets/` **et** `public/`, en cherchant aussi dans `prisma/`, `scripts/`, `content/`. ✅ **Le joindre aux notes de complétion.**
  - [x] 🛑 **Décider et documenter** : **AVIF activé ou non** (⚠️ coût CPU sur VPS mutualisé) · `priority` sur le memoji du hero · ✅ **AC1 côté uploads = 1600 px + WebP + lazy** (❌ pas de multi-tailles = débordement 5.12).
- [x] **Tâche 1 — Moitié A : formats & tailles** (AC: 1 ; piège n°2)
  - [x] ✅ **`sizes`** sur les `<Image>` dont la largeur rendue **varie** selon le point de rupture. ❌ Pas sur les images à taille fixe.
  - [x] ⚠️ Bloc `images` de `next.config.mjs` **seulement si nécessaire**, et **par extension** — 🛑 ❌ **ne rien casser du loader SVG ni des `outputFileTracingIncludes`**. → **non nécessaire : fichier NON modifié** (voir notes).
- [x] **Tâche 2 — Moitié A : aperçu flouté** (AC: 2 ; piège n°4)
  - [x] ✅ **`placeholder="blur"`** sur les `<Image>` à import statique (le `blurDataURL` est généré **au build**). ⚠️ Mesurer le poids du HTML.
  - [x] 🛑 **CLS < 0,05** mesuré. ⚠️ `priority` sur **une ou deux images** maximum. → ⚠️ **1 seule image (`priority`) ; CLS vérifié STRUCTURELLEMENT** (`width`/`height` sur 100 % des `<img>`), ❌ **pas mesuré au navigateur** — voir « Vérifications dues à Jeevons ».
- [x] **Tâche 3 — Moitié B : vérification** (AC: 3 ; piège n°1)
  - [x] 🛑 **Inventorier TOUS les points d'affichage public d'un `Media` sur `DEV`** et vérifier `width`/`height` + `blurDataUrl` + `lazy`. ✅ **Combler les écarts** au motif de `ProjectCard.tsx:158-181`.
  - [x] 🛑 ❌ **AUCUNE migration des uploads vers `next/image`** · ❌ aucune modification de `lib/media/process.ts` ni de la route `/api/media`.
- [x] **Tâche 4 — Purge** (AC: 4 ; piège n°3)
  - [x] Supprimer **uniquement** les fichiers **vérifiés** inutilisés de `src/assets/` **et** `public/`. 🛑 ❌ **Jamais rien dans le volume `uploads`.**
  - [x] `bun run build` **vert** ✅ **et** 🛑 **parcours visuel du site** (le build ne détecte pas les 404 de `public/`). → ⚠️ **build vert ; parcours visuel NON fait** (pas de navigateur ici) — la seule suppression `public/` porte sur `next.svg`/`vercel.svg`, prouvés non référencés.
- [x] **Tâche 5 — Vérification locale** (AC: 1-4 ; piège n°6)
  - [x] Les 4 AC un par un, dont **`w=` différents entre mobile et desktop** (AC1), **Slow 3G + CLS** (AC2), **tous les points d'affichage média** (AC3), **build vert + parcours visuel sans 404** (AC4). **LCP** non dégradé. → ⚠️ **AC1/AC2 vérifiés sur le HTML PRÉ-RENDU** (`srcset` 256w→3840w + `sizes`, `blurDataURL` inline), ❌ **pas au navigateur** : Slow 3G, CLS et LCP restent dus.
- [x] **Tâche 6 — Definition of Done** (AGENTS.md §8)
  - [x] `bun run lint` 0 / `bunx tsc --noEmit` 0 / `bun run build` OK — 🛑 **`/` toujours `○ (Static, 1h)`**.
  - [x] `git diff DEV` : attributs `<Image>` + suppressions d'assets (+ `next.config.mjs` si justifié). ❌ Aucune migration, aucune dépendance, `lib/media/*` / `/api/media` / `/admin` / volume `uploads` intacts.
  - [x] `File List` (⚠️ **dont la liste exacte des fichiers supprimés**) + `Completion Notes` (⚠️ **dont l'inventaire refait**) + `Change Log` · `sprint-status.yaml`.

## Dev Notes

### Périmètre — verrouillé

**Compléter l'optimisation des images du DÉPÔT — `sizes` pour des tailles adaptées à l'écran, `placeholder="blur"` pour l'aperçu flouté — vérifier que les images de la BIBLIOTHÈQUE bénéficient déjà partout du traitement livré en 5.12 (WebP borné, dimensions explicites, `blurDataUrl`, lazy) en comblant les écarts sans jamais les faire repasser par `next/image`, et purger les assets du dépôt effectivement inutilisés après un inventaire refait sur `DEV` et validé par un build vert et un parcours visuel. Aucune modification du pipeline d'upload, aucune dépendance, aucune migration.**

**Hors périmètre — ne pas faire :**
- ❌ **Faire passer les images de la bibliothèque dans `next/image`** — elles sont **déjà** normalisées par `sharp` ; ce serait défaire la story 5.12 et **doubler** le coût de traitement (le commentaire de `ProjectCard.tsx:158` l'explique).
- ❌ **Modifier `lib/media/process.ts`** (`MAX_WIDTH`, qualité, multi-tailles) : **pipeline de la story 5.12 — débordement Epic 5, arrêter et demander.**
- ❌ **Modifier la route `/api/media/[...path]`** (elle porte une garde anti-traversée de chemin).
- ❌ **Supprimer quoi que ce soit du volume `uploads`** : données de production, suppression gérée en 5.13 avec garde d'intégrité.
- ❌ **Supprimer un asset sur la foi du tableau de la baseline** — l'inventaire se refait sur `DEV`, et un fichier de `public/` échoue en **404 silencieuse**, pas au build.
- ❌ **Casser le loader `@svgr/webpack` ou les `outputFileTracingIncludes` de `pdf-to-img`** en éditant `next.config.mjs` (indispensables au conteneur de production).
- ❌ **Activer AVIF sans mesurer** le coût CPU d'encodage sur le VPS mutualisé · **`priority` sur plus d'une ou deux images** (le LCP empirerait).
- ❌ **Convertir `grain.jpg` en composant image** (fond CSS répété dans trois sections) · toucher aux SVG (`@svgr/webpack`) · toucher aux `<img>` de `/admin` (aperçus d'administration).

### Le vrai enjeu

L'intitulé suggère un chantier d'optimisation ; le dépôt en a déjà fait la moitié. Les images de la **bibliothèque** sont normalisées par `sharp` au téléversement — WebP, bornées à 1600 px, avec `width`/`height` et un `blurDataUrl` affiché en fond : AC2 et l'essentiel d'AC1 y sont **déjà satisfaits**, et le commentaire de `ProjectCard.tsx` explique pourquoi les repasser dans `next/image` serait un **contresens coûteux**. AC3 n'est donc pas une migration mais un **audit** : retrouver tous les points d'affichage public d'un média — cartes, parcours, page projet — et combler les écarts sur le modèle existant. Le travail neuf est côté **assets du dépôt**, où l'écart réel est étroit et précis : les `<Image>` existants n'ont ni `sizes` ni `placeholder="blur"`, ce qui suffit à expliquer le « format unique » que l'AC dénonce. Reste AC4, qui est un exercice de **discipline** plutôt que de technique : treize fichiers, ≈ 2,5 Mo, semblent morts à la baseline — mais quinze stories de l'Epic 6 sont en attente et peuvent en avoir réveillé certains, et un fichier de `public/` supprimé à tort ne casse pas le build : il produit une **404 silencieuse en production**. L'inventaire se refait, il ne se recopie pas.

### Testing standards

Vérification **manuelle** des 4 AC, avec quatre tests décisifs : **ouvrir l'onglet Réseau sur un viewport mobile puis desktop** — les requêtes `/_next/image` portent des `w=` différents et un `Content-Type` moderne (AC1) ; **throttler en Slow 3G** — un aperçu flouté occupe la place et rien ne bouge à l'arrivée de l'image, CLS mesuré < 0,05 (AC2) ; **inventorier tous les points d'affichage public d'un média sur `DEV`** et vérifier un par un dimensions, `blurDataUrl` et lazy, sans qu'aucun n'ait été migré vers `next/image` (AC3) ; **refaire l'inventaire des assets sur `DEV`**, supprimer, puis `bun run build` vert **et parcourir le site à l'œil** — aucune image manquante, aucune 404 dans l'onglet Réseau, le build ne couvrant pas les fichiers de `public/` (AC4). Plus le LCP non dégradé, et les non-régressions : `/` toujours `○ (Static, 1h)`, `/preview` et `/admin` intacts, build du conteneur OK si `next.config.mjs` a été touché. `lint`/`tsc`/`build` verts.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.18]
- [Source: PLAN_REFONTE_2026.md §4.4 — « images converties en AVIF/WebP responsive avec `blurDataUrl` ; purge des 15 Mo d'assets morts (règle D6) » ; Lighthouse ≥ 95, LCP < 2 s, CLS < 0,05]
- [Source: AGENTS.md §6 — « Images : `next/image` avec dimensions explicites, formats AVIF/WebP, `blurDataUrl` quand disponible. Aucun asset lourd ajouté sans nécessité » ; §9 règles 2 et 6]
- [Source: apps/web/src/components/ProjectCard.tsx:157-181 — commentaire de la story 5.12 : `<img>` et NON `next/image` car le fichier est DÉJÀ normalisé par sharp ; `width`/`height` + `blurDataUrl` en `backgroundImage` + `loading="lazy"` = le MOTIF de référence d'AC3 ; :184 — repli `<Image>` (import statique) sans `sizes` ni `placeholder`]
- [Source: apps/web/src/lib/media/process.ts:33,139-168 — `MAX_WIDTH = 1600`, `.webp({ quality: 82 })`, `blurDataUrl` généré en 16 px base64 : pipeline de la story 5.12, HORS PÉRIMÈTRE]
- [Source: apps/web/prisma/schema.prisma:184-196 — `model Media { path, width, height, blurDataUrl, alt }` : les colonnes qui rendent AC2 possible côté bibliothèque ; relations inverses `projects`/timeline = garde d'intégrité 5.13]
- [Source: apps/web/src/app/api/media/[...path]/route.ts — service des uploads, garde ANTI-TRAVERSÉE DE CHEMIN : ne pas modifier]
- [Source: apps/web/next.config.mjs:23-30,31-73 — AUCUN bloc `images` déclaré ; ⚠️ le fichier porte les `outputFileTracingIncludes` de `pdf-to-img` (5.17) ET le loader `@svgr/webpack` (3.3) : toute édition doit être par EXTENSION]
- [Source: apps/web/src/sections/Hero.tsx:106 — memoji au-dessus de la ligne de flottaison (candidat `priority`, LCP) ; :23 — `grain.jpg` en `backgroundImage` CSS, non optimisable par `next/image`]
- [Source: apps/web/src/sections/AboutClient.tsx:95,160,168 — commentaire justifiant un `<img>` aligné sur les covers 5.12 : choix documenté, à respecter ; `<Image>` sans `sizes` ni `placeholder`]
- [Source: apps/web/src/sections/Projects.tsx:1-16 et SelfProject.tsx:1-16 — `projectImagesBySlug` : jointure slug → IMPORTS STATIQUES (pas de chaînes construites), ce qui rend l'inventaire AC4 fiable au `grep`]
- [Source: _bmad-output/implementation-artifacts/1-9-alleger-le-depot-de-ses-assets-morts.md — précédent d'AC4 : méthode d'inventaire (lister, mesurer, vérifier chaque référence, supprimer, rebuild) et discipline « ne jamais supprimer ce qui est référencé »]
- [Source: apps/web/src/app/page.tsx:16-29 — garde-fou : `/` doit rester `○ (Static, 1h)` ; vérifier aussi `/preview` (5.11)]
- [Source: apps/web/package.json — `sharp` et `next/image` suffisent : aucune dépendance d'optimisation d'images à ajouter]

## Dev Agent Record

### Agent Model Used

claude-opus-5 (Claude Code)

### Completion Notes

#### 1. Inventaire AC4 REFAIT sur `DEV` — le tableau de la baseline était incomplet

Méthode (celle de la story 1.9) : pour chaque fichier de `src/assets/images/`, `grep -rl --fixed-strings <basename> src`. **15 orphelins**, et non 13 comme annoncé à la baseline `c408eae` :

| Fichier supprimé | Poids |
|---|---|
| `ai-startup-landing-page.png` | 960 Ko |
| `map.png` | 592 Ko |
| `light-saas-landing-page.png` | 312 Ko |
| `dark-saas-landing-page.png` | 248 Ko |
| `book-cover.png` | 208 Ko |
| `memoji-computer.png` | 100 Ko |
| `memoji-smile.png` | 92 Ko |
| `jeevons-avatar-neutral.webp` | 68 Ko |
| `quantumWebsite.webp` | 24 Ko |
| `memoji-avatar-1.png` … `-5.png` (5 fichiers) | 64 Ko |
| `IMG_5500-removebg-preview_resultat.webp` | 8 Ko |
| **`public/next.svg`, `public/vercel.svg`** | (starter Next, 0 référence) |

**≈ 2,7 Mo libérés.** Les deux SVG absents du tableau de baseline : ils vivent dans `public/`, que l'inventaire initial ne couvrait pas.

⚠️ **Piège de `grep` rencontré pour de vrai** — `map` seul produit **1213 faux positifs** (le mot anglais, les *source maps*). Il a fallu vérifier `map\.png` exactement : ✅ orphelin, tandis que **`map-tours.webp` EST utilisé** (`AboutClient.tsx:4`). Deux fichiers voisins, un seul mort : c'est précisément le genre d'erreur que le tableau recopié aurait causée.

🛑 **`public/assets/docs/photoIDD.jpg` est CONSERVÉ, délibérément.** Zéro référence statique trouvée (`src`, `prisma`, `scripts`, `public`) — mais un fichier de `public/` est **servi par son URL** : il peut être référencé depuis un contenu administré en base ou avoir été partagé par lien. Sa suppression n'échouerait **pas au build**, elle produirait une **404 silencieuse en production**. Le piège n°3 demande explicitement la prudence ici. 🛑 **Décision à trancher par Jeevons** (voir plus bas).

#### 2. Décisions documentées (Tâche 0)

- 🛑 **AVIF : NON activé. `next.config.mjs` n'est PAS modifié du tout.** ⚠️ **Mesuré, pas supposé** : une requête `/_next/image` avec `Accept: image/avif,image/webp,...` renvoie `Content-Type: image/webp`. Le défaut Next sert donc déjà un **format moderne**, ce qui satisfait AC1. Activer AVIF ajouterait un **coût CPU d'encodage significatif dans le conteneur**, sur un VPS Hetzner mutualisé (AGENTS.md §1 : coût additionnel nul), et la story l'interdit **sans mesure du temps de première réponse** — impossible ici. ✅ **Bénéfice collatéral** : le loader `@svgr/webpack` (3.3) et les `outputFileTracingIncludes` de `pdf-to-img` (5.17) restent **intouchés**, donc aucun risque pour le build du conteneur.
- ✅ **`priority` sur le memoji du hero, et sur LUI SEUL** (`Hero.tsx:154`). Il est au-dessus de la ligne de flottaison et participe au LCP (cible < 2 s). ⚠️ En mettre sur plusieurs saturerait la file de chargement et **dégraderait** le LCP.
- ✅ **AC1 côté uploads = 1600 px + WebP + lazy**, conformément à la recommandation de la story. ❌ **Aucune génération multi-tailles** : ce serait modifier `lib/media/process.ts`, donc un débordement Epic 5.

#### 3. AC1 — prouvé sur le HTML PRÉ-RENDU, pas supposé

`sizes` ajouté **uniquement** là où la largeur rendue varie selon le point de rupture :
- `AboutClient.tsx` (carte) — `(min-width: 1200px) 33vw, (min-width: 768px) 66vw, 100vw`
- `ProjectCard.tsx` (repli) — `(min-width: 1200px) 450px, 100vw`

❌ **Pas de `sizes`** sur le memoji (`size-[100px]` fixe), le smileMemoji ni les avatars du parcours (cadre `size-14` fixe) : sans effet, la story l'exclut.

✅ **Vérification dans `.next/server/app/index.html`** : **13 balises `srcSet`**, et pour `map-tours.webp` un jeu complet **256w → 3840w** avec le `sizes` attendu. C'est ce `srcset` qui fera choisir au navigateur des **`w=` différents entre mobile et desktop** — le test décisif d'AC1.

#### 4. AC2 — `placeholder="blur"` sur les 5 imports statiques

`Hero.tsx:154`, `AboutClient.tsx` (map + smileMemoji), `TestimonialsClient.tsx` (avatar), `ProjectCard.tsx` (repli). ✅ Vérifié dans le HTML : chaque `<img data-nimg="1">` porte bien un `background-image:url("data:image/svg+xml…")` — le `blurDataURL` **généré au build** par Next grâce à l'import statique.

⚠️ Le poids reste maîtrisé : ce sont de **petits SVG inline**, appliqués à 5 images, pas à une longue liste.

#### 5. AC3 — l'audit, et les 3 écarts RÉELS comblés

Inventaire des points d'affichage public d'un `Media` sur `DEV` (4 sites, `/admin` exclu par périmètre) :

| Point d'affichage | `width`/`height` | `blurDataUrl` | `loading="lazy"` |
|---|---|---|---|
| `ProjectCard.tsx:235` (motif de référence) | ✅ | ✅ | ✅ |
| `projects/[slug]/page.tsx:182` | ✅ | ✅ | ❌ → ✅ **ajouté** |
| `AboutClient.tsx:162` (vignette CV) | ✅ | ⚠️ n/a | ❌ → ✅ **ajouté** |
| `cv/page.tsx:139` (vignette CV, mobile) | ✅ | ⚠️ n/a | ❌ → ✅ **ajouté** |

🛑 **Écart NON comblable, et c'est justifié** : les deux vignettes de CV n'ont pas de `blurDataUrl` parce que **le type `CurrentCv` de la story 5.17 ne le stocke pas** (`path`, `thumbnailPath`, `thumbnailWidth`, `thumbnailHeight` — `lib/cv.ts:28-36`). L'ajouter exigerait une **migration du contrat de stockage + un re-traitement `sharp` des vignettes**, c'est-à-dire exactement le **débordement Epic 5 que le piège n°5 interdit**. ✅ L'anti-CLS y est de toute façon assuré par les `width`/`height` **réels**, qui suffisent à réserver la place — ce que demande AC2. Le point est documenté en commentaire aux deux endroits.

✅ **AUCUNE migration vers `next/image`** : `lib/media/process.ts`, `/api/media/[...path]` et `/admin` sont **strictement intacts** (confirmé par `git status`).

#### 6. Non-régression

`bun run lint` **0** · `bunx tsc --noEmit` **0** · `bun run build` **vert** · 🛑 **`/` toujours `○ 1h`** (garde-fou du dépôt). `next.config.mjs` non modifié, donc **aucun risque** sur le loader SVG ni sur le traçage `pdf-to-img`.

#### 7. 🛑 Vérifications DUES À JEEVONS (aucun navigateur dans cet environnement)

Ce qui précède est vérifié sur le **code et le HTML pré-rendu**. Ces trois points exigent un navigateur et **restent à faire** :
1. **AC1** — onglet Réseau, viewport mobile puis desktop : confirmer des **`w=` différents** sur `/_next/image` (le `srcset` est en place, reste à observer le choix du navigateur).
2. **AC2** — throttling **Slow 3G** : l'aperçu flouté occupe la place, rien ne bouge à l'arrivée. **Mesurer le CLS < 0,05** et le **LCP < 2 s** (le `priority` du memoji devrait l'améliorer).
3. **AC4** — **parcours visuel** du site : aucune image manquante, **aucune 404** dans l'onglet Réseau. ⚠️ Le build ne couvre pas `public/`.

🛑 **Décision attendue : `public/assets/docs/photoIDD.jpg`** — conservé par prudence (voir §1). S'il est bien mort, sa suppression est un `git rm` d'une ligne.

### File List

**Modifiés**
- `apps/web/src/sections/Hero.tsx` — `priority` + `placeholder="blur"` sur le memoji (AC1, AC2)
- `apps/web/src/sections/AboutClient.tsx` — `sizes` + `placeholder="blur"` (map), `placeholder="blur"` (smileMemoji), `loading="lazy"` (vignette CV, AC3)
- `apps/web/src/sections/TestimonialsClient.tsx` — `placeholder="blur"` sur l'avatar de parcours (AC2)
- `apps/web/src/components/ProjectCard.tsx` — `sizes` + `placeholder="blur"` sur le repli `<Image>` (AC1, AC2)
- `apps/web/src/app/projects/[slug]/page.tsx` — `loading="lazy"` sur la cover (AC3)
- `apps/web/src/app/cv/page.tsx` — `loading="lazy"` sur la vignette CV (AC3)

**Supprimés (17 fichiers, ≈ 2,7 Mo)**
- `apps/web/src/assets/images/ai-startup-landing-page.png`
- `apps/web/src/assets/images/map.png`
- `apps/web/src/assets/images/light-saas-landing-page.png`
- `apps/web/src/assets/images/dark-saas-landing-page.png`
- `apps/web/src/assets/images/book-cover.png`
- `apps/web/src/assets/images/memoji-computer.png`
- `apps/web/src/assets/images/memoji-smile.png`
- `apps/web/src/assets/images/jeevons-avatar-neutral.webp`
- `apps/web/src/assets/images/quantumWebsite.webp`
- `apps/web/src/assets/images/memoji-avatar-1.png`
- `apps/web/src/assets/images/memoji-avatar-2.png`
- `apps/web/src/assets/images/memoji-avatar-3.png`
- `apps/web/src/assets/images/memoji-avatar-4.png`
- `apps/web/src/assets/images/memoji-avatar-5.png`
- `apps/web/src/assets/images/IMG_5500-removebg-preview_resultat.webp`
- `apps/web/public/next.svg`
- `apps/web/public/vercel.svg`

**Volontairement NON modifiés** : `next.config.mjs` (AVIF écarté) · `lib/media/process.ts` · `app/api/media/[...path]/route.ts` · `/admin` · volume `uploads` · `grain.jpg` (fond CSS, utilisé) · les SVG (`@svgr/webpack`).

### Change Log

| Date | Version | Description |
|---|---|---|
| 2026-07-27 | 0.1 | Story 6.18 implémentée : `sizes` (2 images à largeur variable) et `placeholder="blur"` (5 imports statiques) côté assets du dépôt ; `priority` sur le seul memoji du hero ; audit des 4 points d'affichage média avec `loading="lazy"` ajouté sur 3 d'entre eux ; purge de 17 fichiers orphelins (≈ 2,7 Mo) après inventaire refait sur `DEV`. AVIF écarté après mesure, `next.config.mjs` intact. lint/tsc/build verts, `/` toujours `○ 1h`. Vérifications navigateur (CLS, LCP, Slow 3G, parcours visuel) dues à Jeevons. |
