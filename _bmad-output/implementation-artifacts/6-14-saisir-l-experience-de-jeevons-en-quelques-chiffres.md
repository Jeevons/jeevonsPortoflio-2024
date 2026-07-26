---
baseline_commit: c408eae7818fb33ef915a70085775688fbf80640
---

# Story 6.14: Saisir l'expérience de Jeevons en quelques chiffres

Status: ready-for-dev

## Story

As **recruteur**,
I want **quelques chiffres marquants sur le parcours de Jeevons**,
so that **j'aie un repère immédiat avant d'entrer dans le détail**.

## Acceptance Criteria

**AC1 — Une section de chiffres clés, calculés depuis les données réelles**
**Given** aucune section de ce type n'existe
**When** cette story est terminée
**Then** une section présente les chiffres clés du portfolio
**And** ils sont calculés à partir des données réelles plutôt que saisis à la main, quand c'est possible

**AC2 — Compteurs animés, une seule fois par visite**
**Given** la section entre à l'écran
**When** je la découvre
**Then** les nombres défilent jusqu'à leur valeur finale
**And** ils ne s'animent qu'une seule fois par visite

**AC3 — Valeurs finales directes sous mouvement réduit**
**Given** le réglage de mouvement réduit est actif
**When** la section entre à l'écran
**Then** les valeurs finales s'affichent directement

## Contexte d'implémentation

### 🛑 Prérequis : stories 6.1 (tokens), 6.2 (socle motion) et 6.4 (révélation au défilement) `done`

AC3 s'appuie **entièrement** sur le socle de neutralisation de **6.2** (`useReducedMotion` de `motion/react`). Le déclenchement à l'entrée à l'écran (AC2) partage le motif `IntersectionObserver`/`whileInView` posé en **6.4** et repris en **6.9**. Les chiffres et libellés reprennent les **tokens 6.1**. PLAN §4.2 (P2 n°10 : « **Compteurs animés** dans une nouvelle section stats (projets livrés, technos, années de code) ») et §4.3 (« **Section « Chiffres »** : compteurs animés »).

### 🛑 DÉCISION — quels chiffres, et lesquels sont réellement calculables ?

AC1 dit « **calculés à partir des données réelles plutôt que saisis à la main, quand c'est possible** ». La clause « quand c'est possible » est déterminante : voici ce que le dépôt permet **réellement**, vérifié dans le schéma et les lectures existantes.

| Chiffre candidat (PLAN §4.2) | Calculable ? | Depuis quoi |
|---|---|---|
| **Projets livrés** | ✅ **Oui** | nombre de `Project` **publiés** — 🛑 attention aux **deux catégories** (voir piège n°1) |
| **Technologies** | ✅ **Oui** | nombre de `Stack` (`getPublicStacks()`, **aucun filtre `published` : le modèle n'en a pas**) |
| **Années de code / d'expérience** | ⚠️ **Dérivable** | le **plus petit `startYear`** des `TimelineEntry` publiées → `année courante − min(startYear)`. ⚠️ Un **calcul**, pas une donnée : à documenter |
| Étapes de parcours | ✅ Oui | nombre de `TimelineEntry` publiées |
| Clients, années d'entreprise, lignes de code… | ❌ **Non** | aucune donnée en base — ❌ **ne pas inventer** |

- 🛑 **Décision à prendre et documenter** : la **liste exacte** des chiffres retenus. ✅ **Recommandé** : s'en tenir aux chiffres **entièrement calculables** (projets publiés, technologies, et l'année dérivée du parcours). ❌ **Ne pas coder en dur un chiffre flatteur** (« 10 clients ») : AC1 l'exclut explicitement, et un chiffre faux sur un portfolio de recrutement est un risque en soi.
- 🛑 Si Jeevons veut un chiffre **non calculable**, cela signifie **une nouvelle clé `SiteSetting` + un champ dans `/admin/settings`** — un débordement sur l'Epic 5. ⚠️ **Arrêter et demander** avant de l'entreprendre. ⚠️ Et ❌ **ne pas étendre `SETTING_KEYS`/`SETTING_DEFAULTS` de `lib/settings.ts`** : ce contrat porte une **garde de cohérence qui jette au chargement du module** en cas de dérive avec `content/settings.ts` (c'est exactement pourquoi la story 5.17 a **délibérément gardé la clé `cv.current` hors de ce contrat** — relire le commentaire de `lib/cv.ts`).
- ⚠️ **Zéro migration Prisma** dans cette story. Tout ce qui est calculable l'est par des **comptages** sur des modèles existants.

### 🛑 Piège n°1 (CENTRAL) — « nombre de projets » : les lectures existantes sont PAR CATÉGORIE

- 🛑 Vérifié : `getPublishedProjects(category)` prend une **catégorie obligatoire** (`ProjectCategory`), et la page rend **deux sections distinctes** — `ProjectsSection` et `SelfProjectsSection`. **Il n'existe aucune lecture « tous projets publiés, toutes catégories ».**
- 🛑 **Décision à prendre et documenter** : le chiffre compte-t-il **les deux catégories** (✅ recommandé — « les chiffres clés du **portfolio** ») ou une seule ? ⚠️ Appeler deux fois `getPublishedProjects` et additionner **fonctionne**, mais charge tous les projets et leurs relations pour n'en garder que le nombre.
- ✅ **La voie propre** : écrire **une lecture d'agrégats dédiée** dans `lib/`, qui fait des **`count`** plutôt que des `findMany`. 🛑 Elle **doit reproduire le contrat 4.4/4.5 ligne pour ligne**, comme la story 6.10 l'a fait pour la lecture par slug :
  1. `published: true` **DANS la requête** (jamais un filtre en JS) ;
  2. `prisma.project.count()` / `prisma.stack.count()` / lecture minimale des `startYear` — ❌ pas de `findMany` complet pour compter ;
  3. enrobage dans **`unstable_cache`** avec les tags **`CACHE_TAGS.projects` ET `CACHE_TAGS.timeline`** (la lecture croise les deux domaines — ⚠️ **sans les deux tags, une mutation de parcours ne rafraîchirait jamais le chiffre des années**) ;
  4. `revalidate: REVALIDATE_SECONDS` ;
  5. enrobage dans **`readWithFallback`** (4.5, NFR17).
- ⚠️ 🛑 **`readWithFallback` n'accepte qu'UN domaine** (`"projects" | "timeline" | "settings"`) — c'est son unique paramètre de journalisation. ✅ **Choisir le domaine dominant et le documenter** ; ❌ ne pas modifier la signature du module (il est partagé par toutes les lectures publiques).
- ⚠️ **Le repli** : `fallbackProjects` est **par catégorie**, `fallbackStacks` renvoie six entrées, `fallbackTimeline` est complet. ✅ Un repli d'agrégats est donc calculable à partir d'eux — 🛑 **mais les chiffres du repli ne seront PAS ceux de la base**. ⚠️ C'est **acceptable** (le site reste debout, NFR17) **à condition de le documenter** : base injoignable = chiffres du contenu statique.

### 🛑 Piège n°2 — AC2 : « une seule fois par visite » n'est pas « une seule fois par montage »

- 🛑 **C'est la subtilité de la story.** Un `whileInView` de `motion` **rejoue** à chaque entrée dans la zone visible : un visiteur qui descend, remonte et redescend verrait les compteurs **repartir de zéro** — ce qu'AC2 interdit.
- ✅ **Le remède minimal** : `viewport={{ once: true }}` (motif `motion`) **ou** un `IntersectionObserver` qui se **déconnecte après le premier déclenchement**. ✅ Suffisant pour la lecture raisonnable d'AC2, et cohérent avec le motif de 6.4/6.9.
- ⚠️ **« par visite » au sens strict** (survivre à une navigation vers `/projects/[slug]` puis retour) demanderait un `sessionStorage`. 🛑 **Décider et documenter** : ✅ `once: true` **recommandé** (simple, sans état persistant, sans risque d'hydratation) ; le `sessionStorage` n'est justifié que si Jeevons le demande explicitement. ⚠️ Si retenu, attention à l'**hydratation** : lire `sessionStorage` au premier rendu provoque une divergence serveur/client.
- 🛑 ⚠️ **Piège d'accessibilité méconnu** : un nombre qui défile dans le DOM produit **des dizaines de mutations textuelles par seconde**. Si le conteneur est dans une région `aria-live` (ou en devient une), un lecteur d'écran **annoncerait chaque valeur intermédiaire** — inondation totale. ✅ **La valeur finale doit être la seule annoncée** : marquer le nombre animé `aria-hidden="true"` et exposer la valeur finale en texte accessible, ❌ **jamais d'`aria-live` sur un compteur**. ⚠️ La story 6.7 porte un avertissement jumeau pour le texte alterné du hero (« sans les inonder de mises à jour ») : **même discipline**.

### 🛑 Piège n°3 — AC3 : la valeur finale, pas une animation accélérée

- 🛑 « les **valeurs finales** s'affichent directement » — ❌ pas « plus vite », **directement**. Sous `useReducedMotion`, le compteur ne doit **jamais** partir de zéro : il rend sa valeur finale **au premier rendu**.
- 🛑 ⚠️ **Le piège structurel de 6.4 s'applique ici avec force** : si l'état initial du composant est `0` et que l'animation est neutralisée par la règle CSS globale de 6.2 (`animation-duration: 0.01ms`), **le compteur resterait bloqué à 0** — c'est-à-dire un **contenu faux affiché en permanence**, bien pire qu'une animation. ✅ **La neutralisation doit se faire par l'ÉTAT INITIAL** (`shouldReduceMotion ? valeurFinale : 0`), ❌ pas seulement par la durée.
- ⚠️ C'est exactement le principe que la story 6.2 formalise (AC2 : « le contenu reste présenté dans son état final, jamais masqué ») et que 6.4 applique (« neutralisation par absence d'état initial masquant »). ✅ **S'y conformer.**
- ⚠️ **Le rendu serveur doit contenir la valeur finale.** Un compteur qui rend `0` côté serveur affiche des zéros aux moteurs, aux aperçus de partage, et pendant tout le temps d'hydratation. ✅ **Décider et documenter** : le HTML servi porte la valeur réelle, l'animation ne fait que la parcourir côté client.
- ⚠️ **Anti-CLS** : un nombre qui grandit de « 0 » à « 128 » **change la largeur du bloc** et fait sauter la mise en page (cible PLAN §4.4 : CLS < 0,05). ✅ Réserver la largeur (`tabular-nums`, largeur minimale, ou dimensionnement sur la valeur finale).
- ⚠️ **Formatage des nombres en français** (séparateur de milliers) : ✅ `Intl.NumberFormat("fr-FR")`. 🛑 ⚠️ Formater **de façon identique côté serveur et côté client**, sinon divergence d'hydratation.

### ⚠️ Piège n°4 — Le calcul « années de code » est une dérivation, pas une donnée

- ⚠️ `TimelineEntry` porte `startYear` / `endYear` (`endYear` nullable = « aujourd'hui », comme la story 6.9 le documente). ✅ « années » = `année courante − min(startYear des entrées publiées)`.
- 🛑 ⚠️ **`new Date()` dans le rendu d'une page statique gèle l'année au moment du build.** Avec `revalidate = 3600`, la page se régénère au moins toutes les heures — donc le chiffre se corrigera de lui-même en pratique. ✅ **Acceptable, mais à documenter** ; ❌ ne pas rendre la page dynamique pour ça.
- ⚠️ **Cas limite** : **aucune** entrée de parcours publiée → `min` sur un tableau vide. 🛑 Le chiffre doit alors être **omis**, ❌ pas affiché à `0`, ❌ pas `NaN`, ❌ pas `-Infinity`. **Tester ce cas.**
- ⚠️ Même vigilance pour tous les autres chiffres : **un compteur à `0` est-il présentable ?** 🛑 **Décider et documenter** : masquer une tuile dont la valeur est `0` (✅ recommandé — un portfolio affichant « 0 projets » dessert son propriétaire) ou l'afficher. ⚠️ Et **que devient la section si TOUTES les tuiles sont vides ?** ✅ La masquer entièrement (`return null`), selon le standard « section absente plutôt que vide » déjà appliqué dans `ProjectCard.tsx`.

### ⚠️ Piège n°5 — Où poser la section, statique/dynamique

- ✅ Motif **conteneur serveur `async`** (lecture d'agrégats) **+ vue cliente** pour l'animation — comme `About.tsx` / `AboutClient.tsx`. 🛑 Le calcul reste **côté serveur** ; seul le compteur est client.
- ⚠️ Insertion dans `page.tsx` **et `/preview`** (story 5.11) — ⚠️ vérifier les deux.
- 🛑 **Discipline ISR** : la page reste **`○ (Static, 1h)`**. La lecture d'agrégats est cachée/taguée ✅ ; ❌ aucune API dynamique dans le rendu.
- 🛑 **Identifiant de section unique** (AGENTS.md §6) si la section en porte un — ❌ ne réutiliser aucun `id` existant. ❌ **Aucune entrée ajoutée au `Header`** : le menu est le socle du repérage de section de la **story 6.5**, et la section peut être absente (piège n°4).
- ⚠️ **Emplacement dans la page** : « **avant d'entrer dans le détail** » (la story) plaide pour une position **haute**, après le hero. 🛑 **Décider et documenter** — ⚠️ et attention à l'ordre des sections, que les stories 6.9/6.13/6.15 déplacent aussi.

### ⚠️ Piège n°6 — Périmètre

- ❌ **Hors périmètre** : **toute migration Prisma** · `/admin/settings` et `lib/settings.ts` (**garde de cohérence, ne pas étendre**) · la signature de `readWithFallback` · les lectures `getPublishedProjects` / `getPublicStacks` / `getPublishedTimeline` existantes (**à ne pas modifier**) · `/cv` (6.11) · contact (6.12) · stack (6.13) · grille À propos (6.15) · le `Header` · **toute dépendance** (`motion` est **déjà** installé — ❌ pas de bibliothèque de compteur).
- ⚠️ 🛑 **Le piège de dérive** : « les chiffres, c'est simple » — sauf que le vrai travail est la **lecture d'agrégats cachée et résiliente**, pas l'animation. Ne pas partir sur un composant animé sophistiqué avant d'avoir la donnée juste.

### ⚠️ Piège n°7 — Vérification locale, les 3 AC

- **AC1** : les chiffres affichés **correspondent à la base**. 🛑 **Test décisif** — publier ou dépublier un projet en administration, puis recharger la page publique **sans rebuild** : le compteur bouge (chaîne `revalidateTag('projects')`). Idem en ajoutant une technologie. 🛑 **Et vérifier le tag `timeline`** : modifier une entrée de parcours doit rafraîchir le chiffre des années.
- **AC2** : les nombres **défilent** à l'entrée à l'écran. 🛑 **Test décisif** — descendre, **remonter**, redescendre : ils **ne repartent PAS de zéro**.
- **AC3** : 🛑 mouvement réduit activé → les **valeurs finales** sont affichées **immédiatement**. ❌ Pas de zéros figés (piège n°3), pas d'animation accélérée.
- **Cas limites** : base **vidée** (aucun projet, aucune techno, aucun parcours) → tuiles à `0` masquées et/ou **section entière absente**, ❌ jamais `NaN` ni `-Infinity`.
- **Accessibilité** : au **lecteur d'écran**, seules les **valeurs finales** sont annoncées — ❌ aucune annonce intermédiaire.
- **Performance** : ❌ **aucun saut de mise en page** pendant le défilement des nombres (CLS).
- 🛑 **Non-régression** : **`/` toujours `○ (Static, 1h)`** · `/preview` intact · ancres du menu inchangées · aucune divergence d'hydratation en console.

## Tasks / Subtasks

- [ ] **Tâche 0 — Prérequis & décisions** (AC: 1, 2)
  - [ ] 6.1, 6.2 et 6.4 `done`. 🛑 **Décider et documenter** : la **liste exacte** des chiffres (✅ uniquement des chiffres calculables) · projets = **les deux catégories** ? · « une seule fois » = **`once: true`** (recommandé) ou `sessionStorage` · sort d'une tuile à `0` (masquer, recommandé) · emplacement dans la page.
  - [ ] 🛑 Si Jeevons veut un chiffre **non calculable** : **arrêter et demander** (nouvelle clé `SiteSetting` + écran admin = débordement Epic 5). ❌ **Ne pas étendre `SETTING_KEYS`/`SETTING_DEFAULTS`.**
- [ ] **Tâche 1 — Lecture d'agrégats** (AC: 1 ; piège n°1)
  - [ ] Nouvelle lecture dans `lib/` : **`count`** (❌ pas de `findMany` pour compter), `published: true` **dans la requête**, `unstable_cache` avec **les tags `projects` ET `timeline`**, `REVALIDATE_SECONDS`, `readWithFallback` (⚠️ domaine dominant choisi et documenté — ❌ ne pas modifier la signature du module).
  - [ ] Repli d'agrégats calculé depuis `content/*` ; 🛑 **documenter que ces chiffres diffèrent de la base**.
  - [ ] « Années » = `année courante − min(startYear publiés)` ; 🛑 **aucune entrée → chiffre OMIS**, ❌ jamais `0`/`NaN`/`-Infinity`.
- [ ] **Tâche 2 — Section & compteurs** (AC: 1, 2, 3 ; pièges n°2, n°3)
  - [ ] Conteneur **serveur** (calcul) + vue **cliente** (animation). Tokens 6.1, contrastes AA, `id` **unique**.
  - [ ] Déclenchement à l'entrée à l'écran, **`once: true`** (motif 6.4/6.9). 🛑 **Ne rejoue pas au re-défilement.**
  - [ ] 🛑 **AC3 par l'ÉTAT INITIAL** : `shouldReduceMotion ? valeurFinale : 0`. ❌ Jamais un compteur bloqué à `0`.
  - [ ] **Le HTML servi porte la valeur finale.** `Intl.NumberFormat("fr-FR")` **identique serveur/client** (hydratation). **Largeur réservée** (`tabular-nums`) — anti-CLS.
  - [ ] 🛑 Nombre animé **`aria-hidden`**, valeur finale exposée en texte. ❌ **Aucun `aria-live`.**
- [ ] **Tâche 3 — Intégration** (piège n°5)
  - [ ] `page.tsx` **et `/preview`**. ❌ **Aucune entrée ajoutée au `Header`**. Section entière **masquée (`return null`)** si toutes les tuiles sont vides.
- [ ] **Tâche 4 — Vérification locale** (AC: 1-3 ; piège n°7)
  - [ ] Les 3 AC un par un, dont **dépublier un projet sans rebuild** et **modifier une entrée de parcours** (AC1, les deux tags), **descendre/remonter/redescendre** (AC2), **mouvement réduit** (AC3). Base vidée. Lecteur d'écran. CLS.
- [ ] **Tâche 5 — Definition of Done** (AGENTS.md §8)
  - [ ] `bun run lint` 0 / `bunx tsc --noEmit` 0 / `bun run build` OK — 🛑 **`/` toujours `○ (Static, 1h)`**.
  - [ ] `git diff DEV` : nouvelle lecture d'agrégats + nouvelle section. ❌ **Aucune migration, aucune dépendance**, `lib/settings.ts` / `read-with-fallback.ts` / lectures existantes / `Header.tsx` intacts.
  - [ ] `File List` + `Completion Notes` + `Change Log` · `sprint-status.yaml`.

## Dev Notes

### Périmètre — verrouillé

**Ajouter une section de chiffres clés alimentée par une nouvelle lecture d'agrégats en `count`, cachée sous les tags `projects` ET `timeline` et résiliente selon le contrat 4.4/4.5, dont les compteurs défilent une seule fois à l'entrée à l'écran (`once: true`) et affichent directement leur valeur finale sous mouvement réduit grâce à un état initial non nul — sans migration, sans dépendance, et sans jamais coder en dur un chiffre non calculable.**

**Hors périmètre — ne pas faire :**
- ❌ **Coder en dur un chiffre** que la base ne permet pas de calculer (AC1 l'exclut) — si Jeevons en veut un : **arrêter et demander**.
- ❌ **Étendre `SETTING_KEYS`/`SETTING_DEFAULTS` de `lib/settings.ts`** : garde de cohérence qui **jette au chargement du module** (précédent : `cv.current` délibérément tenue hors du contrat en 5.17).
- ❌ **Compter avec `findMany`** au lieu de `count` · **filtrer `published` en JS** après la requête.
- ❌ **Oublier le tag `timeline`** sur la lecture d'agrégats (le chiffre des années ne se rafraîchirait jamais).
- ❌ **Modifier la signature de `readWithFallback`** (module partagé par toutes les lectures publiques).
- ❌ **Un compteur dont l'état initial est `0` sous mouvement réduit** — il resterait bloqué à `0` (contenu faux, pire qu'une animation).
- ❌ **`aria-live` sur un compteur** (inondation du lecteur d'écran) · rendre `0`/`NaN`/`-Infinity` visible.
- ❌ **Ajouter une entrée au `Header`** (repérage 6.5 ; la section peut être absente).
- ❌ Toute migration Prisma · toute dépendance (`motion` est déjà là) · `/cv` (6.11) · contact (6.12) · stack (6.13) · grille À propos (6.15).

### Le vrai enjeu

L'animation est la partie **facile** ; `motion` est déjà installé et le motif d'entrée à l'écran est posé depuis 6.4. Le travail réel est **la donnée**. AC1 impose des chiffres **calculés**, or aucune lecture existante ne compte quoi que ce soit : `getPublishedProjects` charge des projets **catégorie par catégorie**, avec leurs relations. Il faut donc une **lecture d'agrégats neuve**, en `count`, qui reproduise fidèlement le contrat de cache 4.4 et la résilience 4.5 — et dont l'unique subtilité est de porter **deux tags** (`projects` et `timeline`), faute de quoi une modification du parcours ne bougerait jamais le chiffre des années. Côté rendu, deux pièges se ressemblent sans se confondre : AC2 exige que les compteurs **ne rejouent pas** au re-défilement (`once: true`), et AC3 que la neutralisation passe par **l'état initial** et non par la durée — sinon la règle CSS globale de 6.2 laisserait des **zéros figés à l'écran**, c'est-à-dire un contenu faux. Enfin, un détail d'accessibilité que l'on découvre trop tard : un nombre qui défile est une pluie de mutations DOM ; sans `aria-hidden`, un lecteur d'écran les annonce toutes.

### Testing standards

Vérification **manuelle** des 3 AC, avec quatre tests décisifs : **dépublier un projet** puis recharger sans rebuild, **et** modifier une entrée de parcours, pour éprouver **les deux tags** de cache (AC1) ; **descendre, remonter, redescendre** pour vérifier que les compteurs ne repartent pas de zéro (AC2) ; **mouvement réduit** pour constater les valeurs finales immédiates et **l'absence de zéros figés** (AC3) ; **base vidée** pour vérifier qu'aucun `NaN`/`-Infinity` ni tuile à `0` ne s'affiche. Plus le lecteur d'écran (seules les valeurs finales annoncées), l'absence de saut de mise en page pendant le défilement, l'absence de divergence d'hydratation en console, et les non-régressions : `/` toujours `○ (Static, 1h)`, `/preview` intact, ancres du menu inchangées. `lint`/`tsc`/`build` verts.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.14]
- [Source: PLAN_REFONTE_2026.md §4.2 P2 n°10 — « Compteurs animés dans une nouvelle section stats (projets livrés, technos, années de code) » ; §4.3 — « Section « Chiffres » : compteurs animés » ; §4.4 — CLS < 0,05]
- [Source: AGENTS.md §3 — pages publiques statiques + ISR, ne jamais tomber en erreur (NFR17) ; §6 — `prefers-reduced-motion` sur toute animation, identifiants de section uniques, contrastes AA ; §9 — zéro migration/dépendance hors périmètre]
- [Source: apps/web/src/lib/projects.ts:18-45 — `getPublishedProjects(category)` prend une catégorie OBLIGATOIRE : aucune lecture « tous projets » n'existe ; contrat à reproduire (filtre dans la requête, `unstable_cache`, `readWithFallback`) ; :74-131 — `getPublicStacks()` (aucun filtre `published` : `Stack` n'a pas cette colonne)]
- [Source: apps/web/src/lib/timeline.ts — `getPublishedTimeline()` (tag `timeline`) : source de `startYear` pour le chiffre des années]
- [Source: apps/web/src/lib/cache-tags.ts — `CACHE_TAGS.projects` / `.timeline`, `REVALIDATE_SECONDS = 3600` : la lecture d'agrégats croise DEUX domaines, donc DEUX tags]
- [Source: apps/web/src/lib/read-with-fallback.ts — signature `(domain, read, fallback)` avec UN seul domaine (journalisation) : choisir le dominant, NE PAS modifier le module]
- [Source: apps/web/src/content/fallbacks.ts — `fallbackProjects` (PAR CATÉGORIE), `fallbackStacks` (six entrées), `fallbackTimeline` : base des agrégats de repli, dont les valeurs diffèrent de la base]
- [Source: apps/web/src/lib/settings.ts — GARDE DE COHÉRENCE qui JETTE au chargement si `SETTING_DEFAULTS` dérive de `content/settings.ts` : NE PAS étendre pour y loger un chiffre]
- [Source: apps/web/src/lib/cv.ts — précédent explicite : la clé `cv.current` a été VOLONTAIREMENT tenue hors de `SETTING_KEYS` pour ne pas rompre cette garde (story 5.17)]
- [Source: apps/web/src/sections/AboutClient.tsx — motif `useReducedMotion` de `motion/react` (socle 6.2) et conteneur serveur + vue cliente]
- [Source: apps/web/src/components/ProjectCard.tsx:114-138 — standard « section absente plutôt que vide » : à appliquer aux tuiles à `0` et à la section entière]
- [Source: apps/web/src/app/page.tsx:16-29 — `revalidate` littéral, garde-fou anti-rendu-dynamique ; section à intégrer aussi dans `/preview` (5.11)]
- [Source: apps/web/src/sections/Header.tsx — menu d'ancres : ne pas y ajouter cette section (repérage 6.5)]
- [Source: apps/web/package.json — `motion` 12 DÉJÀ installé : aucune bibliothèque de compteur à ajouter]

## Dev Agent Record

### Agent Model Used

### Completion Notes

### File List

### Change Log
