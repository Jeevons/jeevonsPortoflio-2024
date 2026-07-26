---
baseline_commit: c408eae7818fb33ef915a70085775688fbf80640
---

# Story 6.10: Consulter un projet en détail

Status: ready-for-dev

## Story

As **recruteur**,
I want **ouvrir la fiche complète d'un projet**,
so that **je comprenne le contexte, le rôle tenu et les technologies employées — ce qu'une simple carte ne peut pas dire**.

## Acceptance Criteria

**AC1 — Une page par projet publié, à son adresse propre**
**Given** aucune page dédiée aux projets n'existe
**When** cette story est terminée
**Then** chaque projet publié dispose d'une page à son adresse propre, construite sur son identifiant d'URL
**And** cette page présente le contexte, le rôle, les technologies, les illustrations et le lien vers le dépôt

**AC2 — Section absente plutôt que vide**
**Given** un projet n'a pas de résultat chiffré renseigné
**When** j'ouvre sa page
**Then** la section correspondante est simplement absente, sans espace vide ni mention d'information manquante

**AC3 — Un brouillon est introuvable sans session**
**Given** un projet est en brouillon
**When** j'ouvre son adresse sans être connecté
**Then** je reçois une page « non trouvée »

**AC4 — Adresse inconnue : page « non trouvée » soignée**
**Given** je demande une adresse qui ne correspond à aucun projet
**When** la page se rend
**Then** je reçois une page « non trouvée » soignée, avec un chemin de retour vers l'accueil

**AC5 — Métadonnées propres et présence au sitemap**
**Given** ces pages doivent être trouvables
**When** un moteur les explore
**Then** chacune porte ses propres métadonnées de titre, description et image de partage
**And** elles figurent dans le plan du site

**AC6 — Transition fluide depuis la carte, immédiate sous mouvement réduit**
**Given** je navigue depuis une carte vers la fiche
**When** la transition s'opère
**Then** elle est fluide plutôt qu'abrupte
**And** sous mouvement réduit, la navigation est immédiate et sans transition

## Contexte d'implémentation

### 🛑 Prérequis : stories 6.1 (tokens), 6.2 (socle motion) `done`

AC6 s'appuie sur le **socle de neutralisation** de 6.2. Les couleurs de la page « non trouvée » (AC4) utilisent les **tokens 6.1**. PLAN §4.3 (« `/projects/[slug]` : page détaillée par projet — contexte, rôle, stack, captures, résultats chiffrés, lien repo. **C'est le principal manque pour convaincre un recruteur** ») et §4.2 (P2 n°9 : transitions de page via `ViewTransition` de Next 16).

### 🎯 Ce que fait vraiment cette story

**La story la plus lourde de l'Epic 6** : elle crée une **route entièrement nouvelle** (`/projects/[slug]`), une **page « non trouvée »** (il n'en existe aucune aujourd'hui), étend le **sitemap** (aujourd'hui une seule entrée) et ajoute des **métadonnées par projet**. Six AC, dont trois relèvent du référencement et de la robustesse plutôt que du visuel.

### ✅ Bonne nouvelle — presque tout le modèle existe déjà

Vérifié dans `prisma/schema.prisma`, **aucune migration n'est nécessaire** :

| Besoin AC1 | Champ existant |
|---|---|
| identifiant d'URL | **`slug String @unique`** ✅ |
| contexte | **`description String? @db.Text`** ✅ (nullable) |
| lien vers le dépôt | **`repoUrl String?`** ✅ (nullable) |
| technologies | **`stacks Stack[] @relation("ProjectStacks")`** ✅ |
| illustrations | **`cover Media?`** ✅ (nullable) |
| résultat chiffré | **`outcome String?`** ✅ (nullable, AC2) |
| points forts | **`highlights Highlight[]`** ✅ |
| brouillon | **`published Boolean @default(false)`** ✅ (AC3) |

🛑 **Aucune migration Prisma dans cette story.** Si vous pensez en avoir besoin, relisez le schéma — et si le besoin est réel, **arrêtez-vous et demandez** (AGENTS.md §9 règle 2).

⚠️ **Sauf pour « le rôle tenu »** (AC1) : **aucun champ ne le porte**. 🛑 **Décision à prendre et documenter** : le couvrir par `description` (recommandé — c'est un texte libre `@db.Text`, administrable depuis la story 5.9), ou **arrêter et demander à Jeevons**. ❌ **Ne pas ajouter un champ `role`** de sa propre initiative.

### 🛑 Piège n°1 (CENTRAL) — La lecture publique existante ne sait PAS lire par slug

- 🛑 `lib/projects.ts` n'expose que `getPublishedProjects(category)` (liste par catégorie) et `getProjectsForPreview(category)`. **Il n'existe aucune lecture par `slug`.** Il faut l'écrire.
- ✅ La nouvelle lecture **doit reproduire le contrat 4.4/4.5** déjà en place, ligne pour ligne :
  1. requête Prisma avec **`published: true` DANS la requête** (jamais un filtre en JS après coup — c'est l'invariant d'AC3) ;
  2. `include` des relations nécessaires : `highlights` (ordonnés par `sortOrder`), `cover`, **`stacks`** ;
  3. enrobage dans **`unstable_cache`** avec le tag **`CACHE_TAGS.projects`** et `revalidate: REVALIDATE_SECONDS` — sans quoi une mutation admin ne rafraîchirait jamais ces pages ;
  4. 🛑 le `slug` **fait partie de la clé de cache** (comme `category` l'est pour la liste) ;
  5. enrobage dans **`readWithFallback`** (story 4.5, NFR17 : « ne jamais tomber en panne si la base est injoignable »).
- ✅ **Le repli statique est sûr pour AC3, et c'est vérifié** : `content/fallbacks.ts:41` force `published: true` sur chaque entrée du repli — le contenu figé ne contient donc **aucun brouillon**. ⚠️ Mais le repli est indexé **par catégorie**, pas par slug : une lecture par slug devra **filtrer le repli elle-même**. 🛑 Et si vous ajoutez des entrées au repli, **maintenir cet invariant** : un brouillon dans `content/projects.ts` deviendrait servable base injoignable = violation d'AC3.
- 🛑 **AC3 est une règle de sécurité, pas d'affichage** : un brouillon doit renvoyer un **404**, pas une page vide ni une redirection. ✅ La lecture renvoie `null` → `notFound()`.
- ⚠️ AC3 dit « **sans être connecté** ». ❌ **Ne pas construire un accès session sur cette route** : ce serait dupliquer la mécanique d'aperçu de la story 5.11, qui vit sur `/preview` **précisément pour ne pas rendre la home dynamique**. ✅ Le comportement attendu ici est simple : **brouillon = 404, point**. Documenter ce choix.

### 🛑 Piège n°2 — Statique ou dynamique : ne pas perdre l'ISR

- 🛑 Le projet a un garde-fou explicite (`page.tsx:20-29`) : la home doit rester `○ (Static, 1h)`. Les nouvelles pages projet doivent suivre **la même discipline**.
- ✅ Poser **`export const revalidate = 3600`** sur `/projects/[slug]/page.tsx` (littéral obligatoire, Next analyse statiquement le segment — voir le commentaire de `page.tsx:16-18`).
- ✅ Implémenter **`generateStaticParams()`** listant les slugs **publiés** : les pages sont alors pré-rendues au build. ⚠️ **La base doit être joignable au build** — vérifier que le `Dockerfile` / le build de production le permet ; sinon `generateStaticParams` renverra une liste vide et les pages seront rendues à la demande (acceptable, mais **à constater et documenter**, pas à découvrir en production).
- 🛑 ⚠️ **`dynamicParams`** : par défaut `true`, un slug hors liste est rendu à la demande — c'est ce qu'on veut (AC4 gère l'inconnu par un 404). ❌ Ne pas le passer à `false` sans mesurer l'effet sur AC4.
- ⚠️ 🛑 **`params` est asynchrone en Next 16** : `const { slug } = await params;`. Le typer en `Promise<{ slug: string }>`. Une signature synchrone est une erreur de type au build.
- ⚠️ Contrôler au build les marqueurs : `/` toujours `○`, et `/projects/[slug]` en `●` (SSG) ou `ƒ` selon ce qui aura été constaté — **le noter dans les notes de complétion**.

### 🛑 Piège n°3 — AC4 : il n'existe AUCUN `not-found.tsx` dans le dépôt

- 🛑 Vérifié : `find src -name "not-found*"` ne renvoie **rien**. Aujourd'hui, une URL inconnue affiche la page 404 **par défaut de Next** — une page blanche non stylée, sans en-tête, sans lien de retour. AC4 exige une page **soignée avec un chemin de retour vers l'accueil**.
- ✅ Créer un `not-found.tsx`. 🛑 **Où ?** Deux portées, à trancher et documenter :
  - `src/app/not-found.tsx` — **racine** : couvre `/projects/[slug]` **et toute autre URL inconnue du site**. ✅ **Recommandé** — c'est ce que « je demande une adresse qui ne correspond à aucun projet » suggère au sens large, et cela rattrape une lacune générale.
  - `src/app/projects/[slug]/not-found.tsx` — portée limitée à la route projet ; le reste du site garde la 404 nue.
- 🛑 ⚠️ **Un `not-found.tsx` racine s'applique aussi à `/admin` et `/login`.** Vérifier qu'il ne casse rien : il ne doit pas supposer un contexte public (pas de `Header` public sur une 404 d'admin, ou alors assumé). ⚠️ Le layout racine (`layout.tsx`) l'enveloppera dans tous les cas.
- ✅ La page doit être **cohérente avec l'identité** (tokens 6.1), porter un **lien de retour vers `/`**, et rester **accessible** (titre de niveau 1, contrastes AA, focus visible sur le lien).
- ⚠️ `notFound()` **doit être appelé côté serveur**, dans le composant de page, avant tout rendu.

### 🛑 Piège n°4 — AC5 : sitemap et métadonnées, deux fichiers existants à étendre

- 🛑 **`sitemap.ts` ne contient qu'une seule entrée** — et son commentaire le dit : « Le site est une page unique à sections ancrées : une seule entrée ». ⚠️ **Ce commentaire devient faux** avec cette story : le mettre à jour, pas seulement ajouter des lignes.
- ✅ Ajouter une entrée **par projet publié**. 🛑 `sitemap.ts` est aujourd'hui **synchrone** : il devra devenir **`async`** pour lire la base. ⚠️ Réutiliser la lecture cachée/taguée (piège n°1) — ❌ **pas un appel Prisma nu**, qui contournerait le cache et la résilience 4.5. ⚠️ **Si la base est injoignable**, le sitemap doit dégrader proprement (au minimum l'entrée racine) plutôt que renvoyer une erreur.
- ✅ **Métadonnées par page** : `generateMetadata({ params })` sur `/projects/[slug]/page.tsx` → `title`, `description`, `openGraph`, `twitter`. ⚠️ Le `layout.tsx` racine définit déjà `metadataBase` (ligne 21) : ✅ **le réutiliser**, ne pas le redéfinir. Les métadonnées de page **fusionnent** avec celles du layout.
- ⚠️ 🛑 **`generateMetadata` appelle la même lecture que la page** → deux requêtes ? Non : `unstable_cache` **déduplique** dans la même passe de rendu. ✅ Raison de plus pour passer par la lecture cachée du piège n°1 plutôt qu'un Prisma nu.
- 🛑 **`generateMetadata` sur un slug inconnu ou un brouillon** : elle s'exécute **avant** la page. Elle doit gérer le `null` **sans planter** (métadonnées génériques suffisent) — c'est la page qui appelle `notFound()`.
- ✅ **Image de partage** : le dépôt a `src/app/opengraph-image.tsx` (ImageResponse Satori, story 1.10) à la racine. ⚠️ Il s'applique **par segment** : sans fichier dédié, les pages projet héritent de l'image racine — **acceptable** pour AC5 (« porte son image de partage »). ⚠️ Une image par projet est possible (`opengraph-image.tsx` dans le segment) mais **coûteuse** ; si vous la faites, respecter les contraintes Satori documentées ligne 7 (**styles inline, `display: flex` explicite**). ✅ **Décider et documenter.**
- ⚠️ **`robots.ts`** interdit `/admin` et `/preview`. ✅ `/projects/*` doit rester **autorisé** — ne pas y toucher.

### ⚠️ Piège n°5 — AC6 : `ViewTransition` en Next 16 est derrière un drapeau, désactivé par défaut

- 🛑 Vérifié : `next/dist/server/config-shared.d.ts` déclare `experimental.viewTransition?: boolean` avec **`viewTransition: false`** par défaut. Il faut donc l'**activer explicitement** dans `next.config.mjs` pour utiliser l'API React.
- 🛑 ⚠️ **`next.config.mjs` est un fichier sensible** : il porte la configuration `webpack` avec le loader `@svgr/webpack` (le projet reste **délibérément sur webpack**, story 3.3) et `outputFileTracingIncludes` pour `pdf-to-img` (story 5.17). ❌ **Ne rien casser** en y ajoutant une clé. Une régression ici casse le build de production ou l'upload de CV.
- ✅ **Alternative sans drapeau expérimental** : la **CSS View Transitions API native** (`@view-transition { navigation: auto; }`) — ⚠️ support navigateur inégal, mais **dégradation gracieuse totale** (sans support, la navigation est simplement instantanée, ce qui reste conforme). ✅ **Décider et documenter** le choix : drapeau expérimental vs CSS native vs simple transition d'entrée.
- ⚠️ **Le plus important** : AC6 dit « fluide **plutôt qu'abrupte** » — c'est un critère **qualitatif**, sans exigence de technologie. ✅ Une transition d'entrée sobre sur la page de détail satisfait l'AC sans toucher à `next.config.mjs`. **C'est l'option la moins risquée.**
- 🛑 **Sous mouvement réduit, la navigation doit être « immédiate et sans transition »** — ❌ pas « plus rapide », **immédiate**. Une view transition CSS se neutralise par `@media (prefers-reduced-motion: reduce) { ::view-transition-group(*) { animation: none !important; } }` ; une transition React par `useReducedMotion` (socle 6.2). ⚠️ La règle globale de 6.2 met `animation-duration: 0.01ms` : ✅ suffisant en pratique, **mais à vérifier à l'œil** sur les pseudo-éléments `::view-transition-*`, qui vivent hors de l'arbre habituel et peuvent échapper au sélecteur `*, *::before, *::after`.
- ⚠️ **La carte projet doit devenir cliquable vers la fiche** (« je navigue depuis une carte vers la fiche »). 🛑 `ProjectCard` contient **déjà** un `<a>` (« Visiter le site », `target="_blank"`) : ❌ **ne JAMAIS imbriquer** un lien dans un lien — HTML invalide, explicitement interdit par AGENTS.md §6. ✅ Utiliser un lien couvrant en pseudo-élément (`after:absolute after:inset-0`) sur le titre, avec le bouton externe placé **au-dessus** en `z-index`, ou un lien distinct « Voir le projet ». ⚠️ `Card.tsx` utilise **déjà** un `after:` pour son liseré (story 1.8) — attention au conflit.
- ⚠️ ⚠️ `ProjectCard` est **partagé avec l'aperçu admin** (story 5.9, cf. story 6.8) : y ajouter un lien vers `/projects/[slug]` rendrait ce lien actif dans l'aperçu admin, vers un projet peut-être non publié → **404 en plein aperçu**. ✅ Rendre le lien **optionnel** (prop), activé par `ProjectList` uniquement.

### ⚠️ Piège n°6 — AC2 : chaque champ optionnel doit être traité

- 🛑 AC2 ne vise pas que `outcome` : **`description`, `repoUrl`, `cover`, `stacks`, `highlights` sont TOUS optionnels ou potentiellement vides**. La règle « section absente, sans espace vide ni mention d'information manquante » s'applique **à chacun**.
- ✅ Le dépôt a déjà le bon réflexe : `ProjectCard.tsx:114-138` ne rend ni bloc vide ni `<ul>` vide (« que les lecteurs d'écran annonceraient tout de même comme *liste, 0 élément* »). ✅ **Reproduire ce standard** sur la page de détail.
- ❌ Interdits explicites par AC2 : « Non renseigné », « — », un titre de section suivi de rien, un `<ul></ul>`.
- ⚠️ **Cas limite à tester** : un projet dont **tous** les champs optionnels sont vides. La page doit rester **présentable**, pas un titre isolé sur fond vide.
- ⚠️ `repoUrl` est un lien sortant : **`target="_blank"` + `rel="noopener noreferrer"`** obligatoires (AGENTS.md §6, story 1.3), et un `aria-label` explicite mentionnant le nouvel onglet — le pattern est dans `ProjectCard.tsx:144-148`.
- ⚠️ **Les images** : le pattern est établi dans `ProjectCard.tsx:157-182` — `<img>` natif avec `width`/`height` explicites et `blurDataUrl` en fond pour éviter le saut de page, **et non `next/image`** (le fichier est déjà normalisé par sharp). ✅ Le réutiliser, commentaire compris.

### ⚠️ Piège n°7 — Périmètre

- ❌ **Hors périmètre** : **toute migration Prisma** · écrans `/admin` · `/cv` (story 6.11) · formulaire de contact (6.12) · section stack/chiffres (6.13/6.14) · cartes projet — tilt et halo (6.8) · hero (6.7) · **modifier `robots.ts`** · **nouvelle dépendance**.
- ⚠️ La story **6.8** touche aussi `ProjectCard`/`ProjectList` : **deux stories, deux branches**. Relire l'état réel des fichiers avant de commencer.
- ⚠️ Cette story **crée** un dossier de route ; ne pas en profiter pour réorganiser l'arborescence existante.

### ⚠️ Piège n°8 — Vérification locale, les 6 AC

- **AC1** : `/projects/<slug-publié>` s'ouvre et montre **contexte, rôle, technologies, illustrations et lien vers le dépôt**. Vérifier avec un slug réel issu de la base.
- **AC2** : ouvrir un projet **sans `outcome`** → **aucune trace** de la section. Idem `repoUrl` vide, `cover` absente, `stacks` vide, `highlights` vide. 🛑 Tester le projet **le plus dépouillé** possible.
- **AC3** : dépublier un projet en administration, puis ouvrir son adresse **en navigation privée** → **404**. 🛑 **Test décisif** : c'est bien un 404 (code HTTP 404, vérifié dans l'onglet Réseau), pas une page vide en 200.
- **AC4** : `/projects/nimportequoi` → page « non trouvée » **soignée**, avec un lien de retour vers l'accueil qui **fonctionne** et est **focusable au clavier**.
- **AC5** : `/sitemap.xml` contient l'entrée racine **et une entrée par projet publié** (🛑 **aucun brouillon**). Voir le `<title>`/`<meta name="description">` propres à chaque page (source HTML). Vérifier l'image de partage.
- **AC6** : naviguer d'une carte vers la fiche → transition **fluide**. 🛑 Puis reduced-motion activé → navigation **immédiate, sans aucune transition**.
- 🛑 **Non-régression** : `/` toujours **`○ (Static)`** · **aperçu `/admin/projects/[id]` intact** (piège n°5) · aucune imbrication de liens (`bun run lint` + inspection DOM) · build de production OK (le `next.config.mjs` n'a pas été cassé).

## Tasks / Subtasks

- [ ] **Tâche 0 — Prérequis & décisions** (AC: 1, 4, 5, 6)
  - [ ] 6.1 et 6.2 `done`. 🛑 **Décider et documenter** : le « rôle » → `description` (❌ pas de nouveau champ) · portée du `not-found.tsx` (racine recommandée) · image de partage par projet ou héritée · technique de transition (transition d'entrée sobre recommandée, sans toucher `next.config.mjs`).
- [ ] **Tâche 1 — Lecture par slug** (AC: 1, 3 ; piège n°1)
  - [ ] `getPublishedProjectBySlug(slug)` dans `lib/projects.ts` : `published: true` **dans la requête**, `include` `highlights`/`cover`/`stacks`, `unstable_cache` tag `projects` avec le slug **dans la clé**, `readWithFallback`. ⚠️ Vérifier que le repli statique **ne contient aucun brouillon**.
- [ ] **Tâche 2 — Route `/projects/[slug]`** (AC: 1, 2, 3 ; pièges n°2, n°6)
  - [ ] `page.tsx` avec **`params` asynchrone** (Next 16), `export const revalidate = 3600` (littéral), `generateStaticParams()` sur les slugs publiés. `notFound()` si `null`. **Chaque champ optionnel : section absente, jamais vide.** `repoUrl` en `target="_blank" rel="noopener noreferrer"` + `aria-label`. Images selon le pattern `ProjectCard` (`<img>` + `width`/`height` + `blurDataUrl`).
- [ ] **Tâche 3 — Page « non trouvée »** (AC: 4 ; piège n°3)
  - [ ] `not-found.tsx` (portée décidée en tâche 0), identité tokenisée (6.1), **lien de retour vers `/`** focusable, `<h1>`, contrastes AA. ⚠️ Vérifier l'effet sur `/admin` et `/login` si placé à la racine.
- [ ] **Tâche 4 — Métadonnées & sitemap** (AC: 5 ; piège n°4)
  - [ ] `generateMetadata` par projet (title/description/openGraph/twitter), **tolérante au `null`**, `metadataBase` du layout réutilisé.
  - [ ] `sitemap.ts` passé en **`async`**, une entrée par projet **publié**, via la lecture cachée (❌ pas de Prisma nu), **dégradation propre** si la base est injoignable. ⚠️ **Mettre à jour le commentaire** devenu faux.
- [ ] **Tâche 5 — Lien depuis la carte + transition** (AC: 6 ; piège n°5)
  - [ ] Lien carte → fiche **sans imbriquer de lien** (le bouton « Visiter le site » existe déjà). 🛑 Lien **optionnel par prop**, activé par `ProjectList` seulement — **pas dans l'aperçu admin**.
  - [ ] Transition fluide ; sous reduced-motion **navigation immédiate** (vérifier à l'œil, y compris sur `::view-transition-*` si cette voie est retenue).
- [ ] **Tâche 6 — Vérification locale** (AC: 1-6 ; piège n°8)
  - [ ] Les 6 AC un par un, dont **code HTTP 404 réel** pour brouillon et slug inconnu, projet **le plus dépouillé**, `/sitemap.xml` **sans brouillon**, clavier sur la page 404, reduced-motion.
- [ ] **Tâche 7 — Definition of Done** (AGENTS.md §8)
  - [ ] `bun run lint` 0 / `bunx tsc --noEmit` 0 / `bun run build` OK (**`/` toujours `○ (Static)`**, noter le marqueur de `/projects/[slug]`).
  - [ ] `git diff DEV` : nouvelle route + `lib/projects.ts` + `sitemap.ts` + `not-found.tsx` (+ lien optionnel sur la carte). ❌ **Aucune migration**, aucun écran admin, `robots.ts` intact, **aucune dépendance**.
  - [ ] `File List` + `Completion Notes` + `Change Log` · `sprint-status.yaml`.

## Dev Notes

### Périmètre — verrouillé

**Créer la route publique `/projects/[slug]` alimentée par une nouvelle lecture par slug respectant le contrat de cache 4.4 et la résilience 4.5 (brouillon → 404), avec métadonnées par projet, entrées de sitemap par projet publié, une page « non trouvée » soignée qui n'existait pas, chaque champ optionnel masqué plutôt que vide, et une transition depuis la carte qui devient immédiate sous mouvement réduit — sans aucune migration Prisma.**

**Hors périmètre — ne pas faire :**
- ❌ **Toute migration Prisma** — `slug`, `description`, `repoUrl`, `stacks`, `cover`, `outcome`, `published` existent déjà. Ajouter un champ `role` : **arrêter et demander**.
- ❌ **Filtrer `published` en JS** après la requête (invariant d'AC3).
- ❌ **Appel Prisma nu** dans `sitemap.ts` ou `generateMetadata` (contourne cache 4.4 et repli 4.5).
- ❌ **Servir un brouillon depuis le repli statique** si la base est injoignable.
- ❌ **Accès session / mode aperçu** sur cette route (c'est `/preview`, story 5.11).
- ❌ **Imbriquer un lien dans un lien** sur la carte (HTML invalide, AGENTS.md §6).
- ❌ **Activer le lien vers la fiche dans l'aperçu admin** (404 sur brouillon).
- ❌ **Casser `next.config.mjs`** (webpack + `@svgr/webpack` story 3.3, `outputFileTracingIncludes` story 5.17).
- ❌ **`params` synchrone** (Next 16) · **`revalidate` non littéral** · modifier `robots.ts` · cartes (6.8), hero (6.7), `/cv` (6.11), contact (6.12), **nouvelle dépendance**.

### Le vrai enjeu

C'est la story la plus large de l'epic, et la moitié de sa difficulté est **invisible à l'écran**. AC3 est une **règle de sécurité** : un brouillon doit renvoyer un vrai 404 — le filtre `published` doit vivre **dans la requête**, et le repli statique de la story 4.5 doit être vérifié, sans quoi une base injoignable publierait du contenu non publié. AC5 oblige à toucher `sitemap.ts`, aujourd'hui synchrone et documenté « une seule entrée » : il faut le passer en `async` **en réutilisant la lecture cachée**, pas un Prisma nu qui contournerait tout le contrat 4.4. AC4 révèle une lacune préexistante — **il n'y a aucun `not-found.tsx` dans le dépôt**. Et AC6 cache le piège HTML classique : rendre la carte cliquable alors qu'elle contient déjà un lien externe, sur un composant **partagé avec l'aperçu admin** où le lien pointerait vers des projets non publiés. La bonne nouvelle, à ne pas gâcher : **le schéma est complet, aucune migration n'est nécessaire.**

### Testing standards

Vérification **manuelle** des 6 AC, avec trois tests décisifs : le **code HTTP 404 réel** (onglet Réseau) pour un brouillon en navigation privée et pour un slug inconnu ; le projet **le plus dépouillé** de la base pour AC2 ; `/sitemap.xml` **sans aucun brouillon** pour AC5. Plus clavier sur la page « non trouvée », reduced-motion pour AC6, et les non-régressions : `/` toujours `○ (Static)`, aperçu `/admin/projects/[id]` intact, build de production OK. `lint`/`tsc`/`build` verts.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.10]
- [Source: PLAN_REFONTE_2026.md §4.3 — `/projects/[slug]` (contexte, rôle, stack, captures, résultats, lien repo) : « le principal manque pour convaincre un recruteur » ; §4.2 — P2 n°9 (`ViewTransition` Next 16)]
- [Source: AGENTS.md §3 — pages publiques statiques + ISR, ne jamais tomber en erreur (NFR17) ; §6 — liens sortants `rel="noopener noreferrer"`, jamais de contrôle interactif imbriqué, images avec dimensions explicites ; §9 — zéro migration/dépendance hors périmètre]
- [Source: apps/web/prisma/schema.prisma — `Project.slug @unique`, `description String? @db.Text`, `repoUrl String?`, `stacks Stack[]`, `cover Media?`, `outcome String?`, `published Boolean @default(false)` : AUCUNE MIGRATION NÉCESSAIRE]
- [Source: apps/web/src/lib/projects.ts:18-45 — contrat à reproduire : filtre `published` dans la requête, `unstable_cache` + tag `projects`, `readWithFallback` (4.5) ; aucune lecture par slug n'existe]
- [Source: apps/web/src/lib/cache-tags.ts — `CACHE_TAGS.projects`, `REVALIDATE_SECONDS = 3600`]
- [Source: apps/web/src/app/sitemap.ts:7-15 — SYNCHRONE, une seule entrée, commentaire « page unique à sections ancrées » à corriger]
- [Source: apps/web/src/app/layout.tsx:20-37 — `metadataBase` et métadonnées racine à réutiliser (fusion), story 1.10]
- [Source: apps/web/src/app/opengraph-image.tsx:7 — contraintes Satori : styles inline, `display: flex` explicite]
- [Source: apps/web/src/app/robots.ts — `/admin` et `/preview` interdits, `/projects/*` doit rester autorisé : NE PAS MODIFIER]
- [Source: apps/web/src/app/page.tsx:16-29 — `revalidate` littéral obligatoire, garde-fou anti-rendu-dynamique]
- [Source: apps/web/src/components/ProjectCard.tsx:6-23 — composant PARTAGÉ avec l'aperçu admin (5.9) ; :114-138 — standard « section absente plutôt que vide » (AC2) ; :143-154 — lien externe déjà présent (imbrication interdite) ; :157-182 — pattern image `<img>` + `blurDataUrl`]
- [Source: apps/web/src/components/Card.tsx:13 — `after:` déjà utilisé pour le liseré (story 1.8) : conflit possible avec un lien couvrant]
- [Source: apps/web/next.config.mjs — webpack + `@svgr/webpack` (3.3) et `outputFileTracingIncludes` (5.17) : fichier sensible ; `experimental.viewTransition` vaut `false` par défaut en Next 16]

## Dev Agent Record

### Agent Model Used

### Completion Notes

### File List

### Change Log
