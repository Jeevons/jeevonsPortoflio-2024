# Story 1.1: Cibler la bonne section depuis la navigation

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **visiteur du portfolio**,
I want **que le lien « Projets » du menu m'amène à la section des projets**,
so that **je puisse consulter le travail de Jeevons sans avoir à faire défiler la page à la main**.

## Acceptance Criteria

**AC1 — Unicité des identifiants de section**
**Given** les sections `Projects` et `SelfProject` portent aujourd'hui toutes deux `id="projects"` (`src/sections/Projects.tsx:44` et `src/sections/SelfProject.tsx:73`)
**When** j'inspecte le document
**Then** chaque `id` de section est unique dans toute la page
**And** la section des projets professionnels conserve `id="projects"` tandis que la section des projets personnels reçoit `id="side-projects"`

**AC2 — L'ancre `#projects` cible la bonne section**
**Given** je suis en bas de la page
**When** je clique sur « Projets » dans le menu
**Then** la page défile jusqu'à la section des projets professionnels
**And** l'URL affiche l'ancre `#projects`

**AC3 — La navigation reste à quatre entrées**
**Given** la navigation compte aujourd'hui quatre entrées
**When** je consulte le menu après la correction
**Then** il compte toujours quatre entrées, sans lien dédié aux projets personnels
**And** la section `#side-projects` reste atteignable en poursuivant le défilement, puisqu'elle suit immédiatement la section des projets professionnels

## Tasks / Subtasks

- [ ] **Tâche 1 — Renommer l'identifiant de la section des projets personnels** (AC: 1)
  - [ ] Dans `src/sections/SelfProject.tsx:73`, remplacer `id="projects"` par `id="side-projects"`. **Ne changer aucune classe** de ce `<section>`.
  - [ ] Laisser `src/sections/Projects.tsx:44` **inchangé** — il conserve `id="projects"`.
- [ ] **Tâche 2 — Vérifier qu'aucun `id` n'est dupliqué dans la page** (AC: 1)
  - [ ] `grep -rn 'id="' src/sections/ src/app/` : attendu exactement `hero`, `projects`, `side-projects`, `contact`, `about` — cinq valeurs distinctes.
  - [ ] Confirmer qu'aucune autre occurrence de `#projects` ne pointe vers la mauvaise cible : `grep -rn 'href="#' src/`.
- [ ] **Tâche 3 — Confirmer la navigation inchangée** (AC: 3)
  - [ ] `src/sections/Header.tsx` **n'est pas modifié** dans cette story : il doit conserver ses quatre liens `#hero` / `#projects` / `#about` / `#contact`. **N'ajoute pas** de lien « Projets perso ».
  - [ ] `src/sections/Hero.tsx:136` (`href="#projects"`) reste inchangé et cible désormais sans ambiguïté les projets professionnels.
- [ ] **Tâche 4 — Vérification manuelle dans le navigateur** (AC: 2, 3)
  - [ ] `npm run dev`, aller en bas de page, cliquer « Projets » → le défilement s'arrête sur « Projets phares » (et **pas** sur « Mes petites réalisations personnelles »).
  - [ ] Vérifier que l'URL affiche `#projects`.
  - [ ] Poursuivre le défilement : la section des projets personnels arrive juste après.
  - [ ] Tester aussi le bouton « Explorez mon travail » du Hero.
- [ ] **Tâche 5 — Definition of Done technique** (AGENTS.md §8)
  - [ ] `npm run lint` → 0 warning
  - [ ] `npx tsc --noEmit` → 0 erreur
  - [ ] `npm run build` → succès
  - [ ] `git diff develop` relu : **un seul fichier modifié**, une seule ligne.

## Dev Notes

### Périmètre — verrouillé

**Un seul fichier à modifier : `src/sections/SelfProject.tsx`, ligne 73, une seule chaîne.**

C'est la story la plus petite du projet. Le risque n'est pas de rater l'implémentation, c'est d'en faire trop. Tout ce qui suit est **hors périmètre** :

- ❌ Ne pas factoriser `Projects.tsx` / `SelfProject.tsx` — ils partagent ~90 % de code, c'est **connu et assumé**, traité en **story 3.7**. Ne pas aggraver la dette, mais ne pas la résoudre ici non plus.
- ❌ Ne pas ajouter d'entrée de navigation pour les projets personnels — **AC3 l'interdit explicitement**.
- ❌ Ne pas toucher au `<section>` des témoignages : son `id` manquant est la **story 1.2**.
- ❌ Ne pas corriger `target="_blanck"` dans `Footer.tsx` ni ajouter `rel="noopener noreferrer"` : c'est la **story 1.3**, même si tu croises ces lignes.
- ❌ Ne pas retoucher le style, les animations ou les cartes : l'Epic 6 y reviendra (stories 6.1, 6.8). Le chevauchement Epic 1 / Epic 6 sur ces fichiers est **assumé** — l'Epic 1 part en production sans attendre la refonte visuelle. Ne fusionne pas ces travaux.
- ❌ Aucune dépendance ajoutée.

### État actuel du code lu et vérifié

`src/app/page.tsx` — ordre de rendu confirmé, `SelfProjectsSection` suit immédiatement `ProjectsSection` (AC3 tient sans autre changement) :

```
Header → HeroSection → ProjectsSection → SelfProjectsSection → TapeSection
→ TestimonialsSection → AboutSection → ContactSection → Footer
```

`src/sections/Projects.tsx:44` (**NE PAS MODIFIER**) :
```tsx
<section className="pb-16 lg:py-24" id="projects">
```

`src/sections/SelfProject.tsx:73` (**SEULE LIGNE À MODIFIER**) :
```tsx
<section className="pb-16 lg:py-24" id="projects">      // avant
<section className="pb-16 lg:py-24" id="side-projects"> // après
```

Les deux sections ont des `className` **identiques** : attention à ne pas éditer le mauvais fichier. Le repère fiable est le `SectionHeader` juste en dessous :
- `Projects.tsx` → eyebrow « Résultats concrets », titre « Projets phares »
- `SelfProject.tsx` → eyebrow « eat() explore() sleep() repeat() », titre « Mes petites réalisations personnelles »

**Consommateurs de l'ancre `#projects`** (tous restent inchangés, ils bénéficient de la correction) :
- `src/sections/Header.tsx:8` — lien « Projets » du menu
- `src/sections/Hero.tsx:136` — bouton « Explorez mon travail »

**Inventaire complet des `id=` de la page** — après la story, cinq valeurs distinctes :

| Fichier | `id` | Statut |
|---|---|---|
| `Hero.tsx:13` | `hero` | inchangé |
| `Projects.tsx:44` | `projects` | inchangé |
| `SelfProject.tsx:73` | ~~`projects`~~ → `side-projects` | **modifié** |
| `Testimonials.tsx` | *(aucun)* | hors périmètre → story 1.2 |
| `About.tsx:97` | `about` | inchangé |
| `Contact.tsx:6` | `contact` | inchangé |

### Comportement de défilement — pourquoi rien d'autre n'est nécessaire

`src/app/globals.css:23-25` définit `html { scroll-behavior: smooth; }`. Le défilement fluide fonctionne déjà nativement, aucun JavaScript n'est requis : les `<a href="#...">` natifs suffisent. **Ne pas ajouter de gestionnaire `onClick` ni de `scrollIntoView`.**

⚠️ **Observation, pas une exigence de cette story** : le `<header>` est `fixed top-3` (`Header.tsx:3`) et aucune section ne porte de `scroll-margin-top`. La cible d'ancre peut donc arriver légèrement sous la barre de navigation. **AC2 exige seulement que la bonne section soit atteinte**, ce que la correction d'`id` garantit. Si tu observes un recouvrement, **ne le corrige pas ici** — signale-le dans les Completion Notes comme dette identifiée pour l'Epic 6 (stories 6.3 / 6.5, mise en page et repérage dans la page).

### Contraintes techniques (AGENTS.md)

- **Stack actuelle** (Epic 1, avant migration Epic 3) : Next.js **14.2.5**, React **18**, TypeScript strict, Tailwind **3.4**, `framer-motion` 11. Code à la **racine** dans `src/` — `apps/web/` n'existe pas encore.
- **Gestionnaire de paquets : `npm` exclusivement.** `bun` est interdit tant que la story 3.2 n'est pas `done` : il produirait un lockfile concurrent.
- **Identifiants de section uniques** dans toute la page — l'ancre `#projects` doit être déterministe (AGENTS.md §6). C'est précisément l'objet de cette story.
- **TypeScript strict** : `npx tsc --noEmit` sans erreur. Pas de `any`, pas de `@ts-ignore`.
- **Accessibilité non négociable** : cette story n'introduit aucune animation, donc aucune contrainte `prefers-reduced-motion` supplémentaire. Elle **améliore** l'accessibilité : des `id` dupliqués sont une violation HTML qui casse la navigation par ancre pour les technologies d'assistance.

### Git workflow (AGENTS.md §4)

```bash
git checkout develop && git pull
git checkout -b alpha/feat/1-1-cibler-la-bonne-section-depuis-la-navigation
```

Commit conventionnel suggéré : `fix(sections): rendre unique l'identifiant de la section projets personnels`

🛑 **Le commit final et le `git push` sont déclenchés par Jeevons, pas par l'agent.**

### Testing standards

Aucune infrastructure de test n'existe à ce stade — Playwright et `@axe-core/playwright` n'arrivent qu'à l'**Epic 7** (stories 7.1, 7.2). **N'installe aucun framework de test dans cette story.**

La vérification est donc **manuelle et documentée** :
1. `npm run dev` puis parcours des quatre liens du menu.
2. Console du navigateur : `document.querySelectorAll('#projects').length` → doit valoir **1** (avant la correction : 2).
3. `document.querySelector('#side-projects')` → doit retourner l'élément.

### Project Structure Notes

- Aucun fichier créé, aucun fichier supprimé, aucun fichier déplacé.
- `src/sections/` est l'emplacement établi des sections de page — conforme à la structure documentée (AGENTS.md §3). La migration vers `apps/web/src/` est une affaire d'**Epic 3.1**.
- Convention de nommage des `id` : kebab-case, en anglais, descriptif. `side-projects` s'aligne sur `hero` / `about` / `contact` déjà en place.

### Previous Story Intelligence

Première story du projet — aucun apprentissage antérieur à reprendre. La branche `develop` est à jour avec `Production` (merge `faa313b`). Les commits récents (`b6bfcdb` plan, `a06a0bd` traduction du header en français) ne modifient pas les fichiers de cette story.

⚠️ **Note de cadrage reportée d'`epics.md`** : la vérification du dépôt a établi que `develop` ne modifie que `Testimonials.tsx` (+62/−7) et **ne supprime aucun asset**. La branche morte `fix` sera supprimée en **Epic 3** — ne t'en occupe pas ici.

**À laisser derrière toi pour la story 1.2** (section Témoignages) : documenter dans les Completion Notes la convention d'`id` retenue, pour que `Testimonials.tsx` reçoive un identifiant cohérent.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.1: Cibler la bonne section depuis la navigation]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1: Portfolio propre et indexable]
- [Source: PLAN_REFONTE_2026.md — défaut D1 (sévérité 🔴) : `id="projects"` dupliqué, l'ancre `#projects` du Header ne cible jamais la bonne section]
- [Source: AGENTS.md#6 Standards de qualité du code — « Identifiants de section uniques dans toute la page »]
- [Source: AGENTS.md#4 Git Workflow] · [Source: AGENTS.md#8 Definition of Done technique] · [Source: AGENTS.md#9 Garde-fous anti-débordement]
- [Source: src/sections/SelfProject.tsx:73] · [Source: src/sections/Projects.tsx:44] · [Source: src/sections/Header.tsx:8] · [Source: src/sections/Hero.tsx:136] · [Source: src/app/page.tsx:15-16] · [Source: src/app/globals.css:23-25]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

### Change Log
