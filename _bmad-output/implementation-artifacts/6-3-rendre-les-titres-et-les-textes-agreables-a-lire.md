---
baseline_commit: c408eae7818fb33ef915a70085775688fbf80640
---

# Story 6.3: Rendre les titres et les textes agréables à lire

Status: ready-for-dev

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

- [ ] **Tâche 0 — Prérequis & inventaire** (AC: 1 ; piège n°2)
  - [ ] 6.1 `done`. Recenser titres et paragraphes des sections publiques.
- [ ] **Tâche 1 — Échelle fluide en `clamp()`** (AC: 1 ; pièges n°3, n°4)
  - [ ] Tokens `clamp(min, Xrem + Yvw, max)` — **jamais** de `vw` seul (zoom). Bornes = tailles actuelles. Max atteint vers 1200px.
  - [ ] Déclarer en `extend` / nouveaux tokens ; ne redéfinir aucune taille Tailwind existante.
- [ ] **Tâche 2 — `balance` sur les titres** (AC: 2 ; pièges n°1, n°2)
  - [ ] `h1`/`h2`/`h3` publics (Hero, SectionHeader, ProjectCard, Contact).
- [ ] **Tâche 3 — `pretty` sur les paragraphes** (AC: 3 ; piège n°1)
  - [ ] Paragraphes et listes ; pas de bibliothèque tierce.
- [ ] **Tâche 4 — Débordements petit écran** (AC: 4 ; piège n°5)
  - [ ] Parcours à 375px, correction ciblée des débordements réels (nav en tête). Sans refonte responsive.
- [ ] **Tâche 5 — Vérification locale** (AC: 1-4 ; piège n°7)
  - [ ] Redimensionnement continu 320→1920px ; **zoom 200 %** ; titres longs ; non-régression admin.
- [ ] **Tâche 6 — Definition of Done** (AGENTS.md §8)
  - [ ] `bun run lint` 0 / `bunx tsc --noEmit` 0 / `bun run build` OK. Vérification visuelle multi-tailles.
  - [ ] `git diff DEV` : typographie uniquement, aucune animation, aucune dépendance.
  - [ ] `File List` + `Completion Notes` + `Change Log` · `sprint-status.yaml`.

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

### Completion Notes

### File List

### Change Log
