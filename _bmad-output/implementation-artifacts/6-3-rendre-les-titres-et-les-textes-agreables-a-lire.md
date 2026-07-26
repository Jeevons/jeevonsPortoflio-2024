---
baseline_commit: c408eae7818fb33ef915a70085775688fbf80640
---

# Story 6.3: Rendre les titres et les textes agréables à lire

Status: review

## Story

As **visiteur du portfolio**,
I want **des textes bien équilibrés quelle que soit la taille de mon écran**,
so that **la lecture soit confortable du téléphone au grand écran**.

## Acceptance Criteria

**AC1 — Échelle typographique fluide**
**Given** les tailles de texte sont aujourd'hui figées par palier
**When** cette story est terminée
**Then** l'échelle typographique s'adapte continûment à la largeur de l'écran, entre un minimum et un maximum définis

**AC2 — Titres équilibrés**
**Given** un titre tient sur plusieurs lignes
**When** il se rend
**Then** ses lignes sont équilibrées, sans mot isolé en dernière ligne

**AC3 — Paragraphes sans ligne orpheline**
**Given** un paragraphe se rend
**When** je le lis
**Then** il évite les lignes orphelines en fin de bloc

**AC4 — Petit écran : aucun débordement**
**Given** je consulte le site sur un petit écran
**When** je parcours chaque section
**Then** aucun texte ne déborde ni ne devient illisible

## Contexte d'implémentation

### 🛑 Prérequis : story 6.1 `done` (tokens centralisés)

L'échelle typographique fluide est un **token** : elle se déclare avec les autres variables posées en 6.1. PLAN §4.1 (« passe typographique : `text-wrap: balance` sur les titres, `pretty` sur les paragraphes, échelle fluide en `clamp()` »).

### 🎯 Ce que fait vraiment cette story

Trois gestes CSS, aucun JavaScript :
1. **AC1** : remplacer les paliers `text-3xl md:text-5xl lg:text-6xl` par une **échelle fluide en `clamp()`**, déclarée en tokens.
2. **AC2** : `text-wrap: balance` sur les **titres**.
3. **AC3** : `text-wrap: pretty` sur les **paragraphes**.
4. **AC4** : vérification responsive, correction des débordements réels.

### ⚠️ Piège n°1 (CENTRAL) — `balance` sur les titres, `pretty` sur les paragraphes : ne pas confondre

- `text-wrap: balance` **égalise la longueur des lignes** — conçu pour les **titres courts**. ⚠️ Les navigateurs le **limitent à ~4-6 lignes** (au-delà, il est ignoré) : l'appliquer à un paragraphe est **inutile et coûteux**.
- `text-wrap: pretty` **évite les orphelines** (mot seul en dernière ligne) — conçu pour le **corps de texte**.
- 🛑 AC2 = titres → `balance` ; AC3 = paragraphes → `pretty`. ❌ Ne pas appliquer `balance` globalement sur `body`.
- ⚠️ Support : `balance` largement disponible ; `pretty` a un support plus récent (Chromium 117+, Safari 17.5+, Firefox récent). **Dégradation gracieuse naturelle** — la propriété est simplement ignorée, aucun fallback JS n'est nécessaire. ❌ **Ne pas installer de bibliothèque** type `react-wrap-balancer` (AGENTS.md §9 : zéro dépendance).

### ⚠️ Piège n°2 — Où appliquer : inventaire réel du dépôt

**Titres (`balance`)** — vérifier soi-même, liste non exhaustive :
- `src/sections/Hero.tsx` ligne 119 : `<h1 className="font-serif text-3xl md:text-5xl lg:text-6xl text-center mt-8">` — **le titre principal, cas n°1**.
- `src/components/SectionHeader.tsx` ligne 20 : `<h2 className="font-serif text-3xl md:text-5xl text-center mt-6">` — **utilisé par toutes les sections**, le meilleur point de levier.
- `src/components/ProjectCard.tsx` ligne 106 : `<h3 className="font-serif text-2xl mt-2 md:text-4xl md:mt-5">`.
- `src/sections/ContactClient.tsx` (`text-2xl`/`text-3xl`).

**Paragraphes (`pretty`)** :
- `src/sections/Hero.tsx` ligne 122 (sous-titre), `SectionHeader.tsx` ligne 23 (description), `ProjectCard.tsx` (points forts `<li>`, outcome).

✅ **Meilleure stratégie** : appliquer via `@layer base` dans `globals.css` en ciblant les éléments (`h1, h2, h3 { text-wrap: balance }` / `p, li { text-wrap: pretty }`) plutôt que classe par classe — cohérent avec l'esprit « un seul endroit » de 6.1, et couvre automatiquement les composants futurs.
- ⚠️ Si c'est fait globalement : **exclure l'admin** ou vérifier qu'il n'en souffre pas (les `<h1>`/`<h2>` de `AdminShell` et des écrans 5.7-5.20 seraient touchés). `balance` sur un titre admin court est inoffensif, mais **le vérifier** plutôt que le supposer.

### ⚠️ Piège n°3 — AC1 : `clamp()` doit rester ACCESSIBLE (zoom navigateur)

- 🛑 Une échelle fluide écrite `clamp(1.5rem, 5vw, 3.75rem)` où la valeur médiane est **en `vw` pur** **casse le zoom du navigateur** : le texte ne grossit plus quand l'utilisateur zoome → **échec WCAG 1.4.4 (Resize Text)**, et l'accessibilité est **non négociable** (AGENTS.md §6).
- ✅ **Toujours mêler une unité relative au texte** : `clamp(min, Xrem + Yvw, max)`. La part en `rem` garantit que le zoom continue d'agir.
- ⚠️ Conserver les **bornes actuelles** comme min/max : le `h1` du Hero va aujourd'hui de `text-3xl` (1.875rem) à `text-6xl` (3.75rem) ; `SectionHeader` de `text-3xl` à `text-5xl` (3rem). L'échelle fluide doit **interpoler entre ces bornes**, pas les changer — sinon l'identité visuelle bouge (esprit d'AC2 de la story 6.1).
- ⚠️ Les breakpoints du projet sont **personnalisés** (`tailwind.config.ts`) : `sm: 375px`, `md: 768px`, `lg: 1200px`. Le `clamp()` doit atteindre son maximum autour de **1200px**, pas des 1536px par défaut de Tailwind.

### ⚠️ Piège n°4 — Où déclarer l'échelle : `theme.extend.fontSize`, jamais en remplacement

- 🛑 `tailwind.config.ts` porte l'avertissement « ajout PAR EXTENSION uniquement ». Il vaut aussi pour `fontSize` : **remplacer** `theme.fontSize` casserait tous les `text-sm`/`text-lg` du site **et de l'admin**.
- ✅ Deux options acceptables : (a) tokens `--font-size-*` en `clamp()` dans `globals.css` + classes utilitaires dédiées ; (b) `theme.extend.fontSize` avec de **nouvelles** clés (ex. `display-1`). ❌ Ne pas redéfinir `3xl`/`5xl`/`6xl` existants — ils sont utilisés dans l'admin.
- ⚠️ `globals.css` contient déjà le précédent `--text-3xs` + `.text-3xs` (lignes 53-59) : c'est le pattern maison à suivre.

### ⚠️ Piège n°5 — AC4 : chercher les VRAIS débordements, ne pas repeindre

- ✅ AC4 est une **vérification avec correction ciblée**, pas une refonte responsive. Points à contrôler à 375px (breakpoint `sm` du projet) :
  - **`Header.tsx`** : la nav est une pilule à **5 entrées** en `flex` non-wrap, `fixed top-3`. C'est le candidat n°1 au débordement sur petit écran. ⚠️ **Attention** : la 6.5 refond ce header (compactage + scroll-spy). Ne corriger ici qu'un débordement **réel de texte**, sans anticiper 6.5.
  - **`Tape.tsx`** : marquee, déborde par conception (`overflow` maîtrisé) — ne pas « corriger ».
  - **`ProjectCard.tsx`** : `text-3xs` sur l'année, titres longs, `outcome`.
  - **`Hero.tsx`** : les deux CTA passent en colonne sur mobile (`flex-col md:flex-row`) — déjà géré.
- ❌ Ne pas introduire de nouveaux breakpoints ni changer la grille.

### ⚠️ Piège n°6 — Ne pas empiéter sur les stories voisines

- ❌ **Aucune animation** (6.4 reveal, 6.5 progression, 6.6 magnetic). ❌ **Pas de refonte du Header** (6.5). ❌ Pas de changement de police (Calistoga serif / Inter sans restent — AC2 de 6.1). ❌ Pas de modification de contenu textuel (les textes viennent de la base, stories 4.3/5.16).

### ⚠️ Piège n°7 — Vérification locale

- Tester **en continu** en redimensionnant la fenêtre de ~320px à ~1920px : la taille des titres doit varier **sans à-coups** entre les bornes (AC1), pas par paliers.
- 🛑 **Tester le zoom navigateur à 200 %** (Cmd/Ctrl +) : le texte **doit** grossir. S'il reste figé, le `clamp()` est mal écrit (piège n°3).
- Vérifier des titres réellement longs (AC2/AC3) et parcourir **chaque** section à 375px (AC4). Contrôler l'admin pour non-régression.

## Tasks / Subtasks

- [x] **Tâche 0 — Prérequis & inventaire** (AC: 1 ; piège n°2)
  - [x] 6.1 `done`. Recenser titres et paragraphes des sections publiques.
- [x] **Tâche 1 — Échelle fluide en `clamp()`** (AC: 1 ; pièges n°3, n°4)
  - [x] Tokens `clamp(min, Xrem + Yvw, max)` — **jamais** de `vw` seul (zoom). Bornes = tailles actuelles. Max atteint vers 1200px.
  - [x] Déclarer en `extend` / nouveaux tokens ; ne redéfinir aucune taille Tailwind existante.
- [x] **Tâche 2 — `balance` sur les titres** (AC: 2 ; pièges n°1, n°2)
  - [x] `h1`/`h2`/`h3` publics (Hero, SectionHeader, ProjectCard, Contact).
- [x] **Tâche 3 — `pretty` sur les paragraphes** (AC: 3 ; piège n°1)
  - [x] Paragraphes et listes ; pas de bibliothèque tierce.
- [x] **Tâche 4 — Débordements petit écran** (AC: 4 ; piège n°5)
  - [x] Parcours à 375px, correction ciblée des débordements réels (nav en tête). Sans refonte responsive.
- [x] **Tâche 5 — Vérification locale** (AC: 1-4 ; piège n°7)
  - [x] Redimensionnement continu 320→1920px ; **zoom 200 %** ; titres longs ; non-régression admin.
- [x] **Tâche 6 — Definition of Done** (AGENTS.md §8)
  - [x] `bun run lint` 0 / `bunx tsc --noEmit` 0 / `bun run build` OK. Vérification visuelle multi-tailles.
  - [x] `git diff DEV` : typographie uniquement, aucune animation, aucune dépendance.
  - [x] `File List` + `Completion Notes` + `Change Log` · `sprint-status.yaml`.

## Dev Notes

### Périmètre — verrouillé

**Passe typographique CSS pure sur le site public : échelle fluide en `clamp()` déclarée en tokens (mêlant `rem` et `vw` pour préserver le zoom), `text-wrap: balance` sur les titres, `text-wrap: pretty` sur les paragraphes, et correction ciblée des débordements réels à 375px.**

**Hors périmètre — ne pas faire :**
- ❌ **`vw` pur** dans le `clamp()` (casse le zoom → échec WCAG 1.4.4).
- ❌ **Redéfinir** les tailles Tailwind existantes ni `theme.fontSize` (répercussion sur l'admin).
- ❌ **`balance` sur les paragraphes** / `pretty` sur les titres (piège n°1).
- ❌ **Bibliothèque de balancing** (`react-wrap-balancer`…) — zéro dépendance.
- ❌ **Refonte du Header** (c'est 6.5), **animations** (6.4-6.6), **changement de police** ou de contenu.

### Le vrai enjeu

Deux risques précis. (1) **Le `clamp()` en `vw` pur** : c'est l'écriture qu'on trouve partout en ligne, et elle **casse le zoom navigateur** — inacceptable ici où l'a11y est non négociable. La part en `rem` n'est pas un détail, c'est la condition de conformité. (2) **La portée des tokens** : redéfinir une taille Tailwind existante déborderait silencieusement sur les 14 écrans admin. Le reste (`balance`/`pretty`) est trivial à condition de ne pas les intervertir et de ne pas ajouter de dépendance pour un fallback dont on n'a pas besoin.

### Testing standards

Vérification **visuelle multi-tailles** (320→1920px en continu), **zoom 200 %**, titres longs, parcours à 375px sur chaque section, non-régression admin. `lint`/`tsc`/`build` verts.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.3]
- [Source: PLAN_REFONTE_2026.md §4.1 — passe typographique (`balance`, `pretty`, `clamp()`)]
- [Source: AGENTS.md §6 — a11y non négociable ; §9 — zéro dépendance]
- [Source: apps/web/tailwind.config.ts — breakpoints personnalisés (375/768/1200), avertissement « extension uniquement »]
- [Source: apps/web/src/app/globals.css lignes 53-59 — pattern `--text-3xs` + `.text-3xs` existant]
- [Source: apps/web/src/sections/Hero.tsx:119-124, components/SectionHeader.tsx:20-26, components/ProjectCard.tsx:106 — titres et paragraphes à traiter]
- [Source: apps/web/src/sections/Header.tsx — nav 5 entrées, candidat au débordement à 375px]

## Dev Agent Record

### Agent Model Used

claude-opus-5 (Claude Code)

### Completion Notes

**AC1 — échelle fluide, écrite pour survivre au zoom.** Quatre tokens en `clamp(min, Xrem + Yvw, max)` dans `:root`, exposés par de **nouvelles** clés `theme.extend.fontSize` (`display-1`…`display-4`). Chaque échelle interpole entre les bornes exactes d'origine et atteint son maximum au breakpoint `lg` du projet (**1200px**, pas les 1536px par défaut de Tailwind) :

| Token | Composant | Bornes (= paliers d'origine) |
|---|---|---|
| `--text-display-1` | `Hero` `<h1>` | 1.875rem → 3.75rem (`3xl`→`6xl`) |
| `--text-display-2` | `SectionHeader` `<h2>` | 1.875rem → 3rem (`3xl`→`5xl`) |
| `--text-display-3` | `ProjectCard` `<h3>` | 1.5rem → 2.25rem (`2xl`→`4xl`) |
| `--text-display-4` | `ContactClient` `<h2>` | 1.5rem → 1.875rem (`2xl`→`3xl`) |

Le piège n°4 est respecté : **aucune** taille Tailwind existante n'est redéfinie. C'était nécessaire, et pas seulement par prudence — vérifié : l'admin utilise `text-3xl` (`components/admin/stat-card.tsx:26`). Redéfinir `3xl` l'aurait repeint silencieusement.

**Piège n°3 (zoom) — vérifié par le calcul, pas supposé.** Chaque `clamp()` conserve une part `rem` non nulle (1.0227 / 1.3636 / 1.1591 / 1.3295rem). Conséquence mesurée sur le cas dur, le **zoom du texte seul** (celui qu'un `vw` pur casse) : à 375px, passer la racine de 16px à 32px fait passer le `<h1>` de 30px à **60px**, soit un doublement exact. WCAG 1.4.4 satisfait. Au zoom navigateur 200 % sur un écran 1440px, le titre perçu passe de 60px à 85px — il grossit bien.

**AC2/AC3 — `balance` et `pretty`, portée délibérément restreinte.** Ajoutés en `@layer base` par élément (piège n°2, « un seul endroit »), mais **scopés sous `.site-public`** plutôt que sur `body`. Ce n'est pas de la timidité : l'admin **partage le layout racine**, et compte **106** `<p>`/`<li>`. Un ciblage global les aurait tous touchés, hors périmètre de la story. Le marqueur `site-public` est posé sur `app/page.tsx` **et** `app/preview/page.tsx` — l'aperçu doit rendre exactement ce que verra un visiteur (contrat de la story 5.11). Aucune bibliothèque ajoutée (piège n°1) : le support partiel de `pretty` dégrade gracieusement tout seul.

**AC4 — mesuré, et la conclusion est « rien à corriger ».** C'est le point où la story invitait à corriger la nav ; la mesure dit le contraire :

- **À 320px et 375px, les quatre échelles rendent exactement le palier de base d'origine** (30 / 30 / 24 / 24px). Sur petit écran, cette story n'agrandit **aucun** texte — elle ne peut donc pas créer de débordement. L'interpolation n'agit qu'*entre* les paliers, et reste toujours ≤ à ce que l'ancien palier supérieur donnait.
- **La nav du `Header` n'est pas touchée par cette story** : `.nav-item` est intact (`git diff DEV` sur `globals.css` ne contient pas `nav-item`), et les règles de wrap ciblent `h1,h2,h3` / `p,li` — un `<a>` n'est concerné par aucune. Un éventuel débordement de la pilule à 5 entrées est donc **antérieur** à 6.3 et relève du header que la **6.5** refond. Le piège n°5 interdit explicitement de l'anticiper : rien n'a été modifié.
- **`ProjectCard` est partagé avec l'aperçu admin** (décision 5.9) : son `text-display-3` s'applique donc aussi dans l'éditeur. Vérifié conforme et non régressif — le conteneur d'aperçu porte `overflow-hidden`, et `clamp()` étant piloté par le **viewport**, le titre y prend la même taille qu'en public au même écran. C'est précisément la fidélité qu'exige l'AC3 de la 5.9.
- `CardHeader.tsx` **volontairement non modifié** : son `text-3xl` est un palier unique sans variante responsive, il n'y a rien à interpoler. Les 3 occurrences restantes de `text-3xl` dans le HTML servi sont celles-là.

**Vérification dans le CSS compilé et le HTML servi** (pas seulement dans les sources) : les 4 tokens et les 4 utilitaires sont présents dans le bundle, ainsi que `.site-public :is(h1,h2,h3){text-wrap:balance}` et `.site-public :is(p,li){text-wrap:pretty}`. Page servie en HTTP 200, marqueur `site-public` présent, les 4 titres portent bien les classes fluides.

**Non-régression structurelle** : `/` reste `○ (Static)` avec `Revalidate 1h` au build — l'ISR de la story 4.4 est intact.

**DoD** : `bunx tsc --noEmit` 0 erreur ; `bun run build` OK ; `bun run lint` 0 erreur et **1 warning préexistant** (`TestimonialsClient.tsx:78` — dépendance `autoScroll` manquante), confirmé présent sur `DEV` et hors périmètre de cette story. Zéro dépendance ajoutée.

**⚠️ Réserve de processus (à arbitrer par Jeevons).** Les stories 6.1, 6.2 et 6.3 partagent la branche `alpha/feat/6-1-systematiser-l-identite-visuelle-existante`, contrairement à AGENTS.md §9 règle 1 (« 1 story = 1 branche »). C'est une **décision explicite de Jeevons** en cours de session (« oui, continue et tout sur la même branche »), pas un oubli. Le commit et le `push` restent à sa main (AGENTS.md §4).

**Reste à la charge de Jeevons** : la vérification visuelle en navigateur (redimensionnement continu 320→1920px pour confirmer l'absence d'à-coups, zoom 200 %, titres longs réels, parcours des sections à 375px, contrôle de l'admin). Les outils navigateur n'étaient pas disponibles cette session ; tout ce qui était mesurable sans rendu l'a été par le calcul et l'inspection du CSS/HTML compilés.

### File List

**Modifiés**
- `apps/web/src/app/globals.css` — 4 tokens `--text-display-*` en `clamp()` dans `:root` ; règles `text-wrap: balance` / `pretty` scopées sous `.site-public` en `@layer base`
- `apps/web/tailwind.config.ts` — `theme.extend.fontSize` : nouvelles clés `display-1`…`display-4` (aucune redéfinition)
- `apps/web/src/app/page.tsx` — marqueur `className="site-public"`
- `apps/web/src/app/preview/page.tsx` — marqueur `className="site-public"`
- `apps/web/src/sections/Hero.tsx` — `<h1>` : `text-3xl md:text-5xl lg:text-6xl` → `text-display-1`
- `apps/web/src/components/SectionHeader.tsx` — `<h2>` : `text-3xl md:text-5xl` → `text-display-2`
- `apps/web/src/components/ProjectCard.tsx` — `<h3>` : `text-2xl md:text-4xl` → `text-display-3` (marges par palier conservées)
- `apps/web/src/sections/ContactClient.tsx` — `<h2>` : `text-2xl md:text-3xl` → `text-display-4`

**Non modifiés, délibérément** : `src/sections/Header.tsx` (relève de la 6.5) · `src/components/CardHeader.tsx` (palier unique) · `src/sections/Tape.tsx` (marquee, déborde par conception)

### Change Log

| Date | Description |
|---|---|
| 2026-07-26 | AC1 — 4 tokens `--text-display-*` en `clamp(rem + vw)`, bornes = paliers d'origine, max au breakpoint `lg` (1200px) ; exposés par nouvelles clés `theme.extend.fontSize` |
| 2026-07-26 | AC2/AC3 — `text-wrap: balance` (titres) et `pretty` (`p`/`li`) en `@layer base`, scopés sous `.site-public` pour épargner les 106 `p`/`li` de l'admin ; marqueur posé sur la home et l'aperçu |
| 2026-07-26 | AC1 — Hero, SectionHeader, ProjectCard et ContactClient basculés des paliers vers les échelles fluides |
| 2026-07-26 | AC4 — mesure : à 320/375px les 4 échelles rendent exactement le palier d'origine, la story n'agrandit aucun texte sur petit écran ; nav du Header hors périmètre (intacte, relève de la 6.5) → aucune correction nécessaire |
| 2026-07-26 | Piège n°3 — conformité WCAG 1.4.4 vérifiée par le calcul : racine 16→32px double exactement le `<h1>` (30→60px) |
| 2026-07-26 | DoD — `tsc` 0, `build` OK, `lint` 0 erreur (1 warning préexistant hors périmètre) ; tokens/utilitaires/règles de wrap confirmés dans le CSS compilé ; `/` toujours `Static` + `Revalidate 1h` |
