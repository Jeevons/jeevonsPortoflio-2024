---
baseline_commit: a270747a2c1a628c60ee36e4697aede4f6558474
---

# Story 3.7: Éliminer la duplication entre les deux sections de projets

Status: ready-for-dev

## Story

As **Jeevons**,
I want **que les projets professionnels et personnels partagent le même code d'affichage**,
so that **toute évolution ne soit à faire qu'une fois, et que le branchement à la base soit simple**.

## Acceptance Criteria

**AC1 — Un composant unique, paramétré par données et intitulé**
**Given** `Projects.tsx` et `SelfProject.tsx` partagent environ 90 % de leur code
**When** la factorisation est faite
**Then** un **composant unique rend une liste de projets, paramétré par ses données et son intitulé**
**And** les **deux sections l'utilisent, sans logique de rendu dupliquée**

**AC2 — Rendu identique, ancres et accessibilité préservées**
**Given** les deux sections doivent rester distinctes visuellement
**When** je compare le site avant et après
**Then** le **rendu est identique**, y compris les identifiants **`#projects`** et **`#side-projects`** posés en Epic 1
**And** les **corrections d'accessibilité de l'Epic 1 sont préservées**, sans réintroduction du bouton imbriqué dans un lien

**AC3 — Composant agnostique de la source des données**
**Given** l'Epic 4 branchera bientôt la base de données
**When** j'examine le composant factorisé
**Then** il **reçoit ses projets en entrée, sans dépendre de la façon dont ils ont été obtenus**

## Contexte d'implémentation

### 🛑 Prérequis : stories 3.1, 3.2, 3.3 `done`

Code sous `apps/web/`, Bun, Next 16 / React 19. Chemins ci-dessous en `apps/web/src/…`.

### État actuel — comparaison ligne à ligne des deux fichiers

`apps/web/src/sections/Projects.tsx` (**section pro**, `id="projects"`) et `apps/web/src/sections/SelfProject.tsx` (**section perso**, `id="side-projects"`) ont un **corps de rendu quasi identique**. Différences réelles observées :

| | `Projects.tsx` | `SelfProject.tsx` |
|---|---|---|
| Export | `ProjectsSection` | `SelfProjectsSection` |
| `id` de section | `projects` | `side-projects` |
| `SectionHeader` eyebrow | `Résultats concrets` | `eat() explore() sleep() repeat()` |
| `SectionHeader` title | `Projets phares` | `Mes petites réalisations personnelles` |
| `SectionHeader` description | « Créer des expériences… » | « Quoi de mieux pour apprendre… » |
| Données | `portfolioProjects` (2 projets pro) | `portfolioProjects` (4 projets perso) |
| Micro-écart | `gap-1` sur le bandeau company | `gap-2` sur le bandeau company |

**Le bloc `<Card>…</Card>` (map, image, titre, `results`, lien) est identique à ce détail `gap-1`/`gap-2` près.** C'est le cœur à factoriser.

### Forme de donnée d'un projet (à figer comme type)

Chaque projet a : `company: string`, `year: string`, `title: string`, `results: { title: string }[]`, `link: string`, `image` (import statique `StaticImageData`). Définir un **type** partagé — il servira de contrat quand l'Epic 4 branchera Prisma (AC3).

### Conception cible

Créer **un composant de présentation** (recommandation : `apps/web/src/components/ProjectList.tsx` ou `sections/ProjectList.tsx`) qui reçoit en props :
```tsx
type Project = {
  company: string;
  year: string;
  title: string;
  results: { title: string }[];
  link: string;
  image: StaticImageData;
};

type ProjectListProps = {
  id: string;                       // "projects" | "side-projects" (AC2)
  eyebrow: string;
  title: string;
  description: string;
  projects: Project[];              // AC3 — données injectées, source-agnostique
};
```
`Projects.tsx` et `SelfProject.tsx` deviennent des **conteneurs minces** : ils conservent leurs constantes `portfolioProjects` et leurs textes, et délèguent tout le rendu à `<ProjectList … />`.

```tsx
// Projects.tsx (après)
export const ProjectsSection = () => (
  <ProjectList
    id="projects"
    eyebrow="Résultats concrets"
    title="Projets phares"
    description="Créer des expériences accessibles, fluides et intuitives…"
    projects={portfolioProjects}
  />
);
```

> 💡 **Pourquoi garder deux fichiers conteneurs** plutôt qu'un seul appel dans `page.tsx` : conserver `ProjectsSection`/`SelfProjectsSection` évite de toucher `page.tsx` et son ordre de sections, et garde un point d'ancrage stable pour l'Epic 4 (qui remplacera la constante par un fetch DB). **Aucune logique de rendu** ne reste dans ces conteneurs (AC1).

### ⚠️ Piège n°1 — Les ancres `#projects` / `#side-projects` (AC2, critique)

Ces `id` ont été posés en **Epic 1** (stories de navigation) et le Header y renvoie. **Un seul écart casse la navigation.** Le composant reçoit `id` en prop et le pose sur `<section id={id}>`. Vérifier après coup que les deux ancres existent **exactement** et que les liens du Header fonctionnent.

### ⚠️ Piège n°2 — Ne pas réintroduire le bouton imbriqué dans un lien (AC2)

Une correction d'accessibilité de l'Epic 1 a supprimé un `<button>` imbriqué dans un `<a>` (HTML invalide). Le code actuel utilise un `<a>` **stylé en bouton** (pas de `<button>` dedans) avec `target="_blank"` + `rel="noopener noreferrer"` + `aria-label`. **Reproduire ce `<a>` à l'identique** dans le composant factorisé — ne pas « améliorer » en réintroduisant un `<button>`. AGENTS.md §6 : jamais de contrôle interactif imbriqué.

### ⚠️ Piège n°3 — Préserver `target="_blank" rel="noopener noreferrer"` et les `aria-label` (AGENTS.md §6)

Le lien « Visiter le site » et l'`alt` des images portent des `aria-label`/`alt` dynamiques (`Visiter le site du projet ${title}`, `Capture d'écran du projet ${title}`). Les **conserver tels quels**. Les liens sortants gardent `rel="noopener noreferrer"`.

### ⚠️ Piège n°4 — Le micro-écart `gap-1` vs `gap-2`

Le bandeau `company • year` utilise `gap-1` dans Projects, `gap-2` dans SelfProject. Deux choix :
- (a) Uniformiser (choisir l'un) — **changement visuel**, viole « rendu identique » (AC2) même s'il est infime.
- (b) Le rendre paramétrable — sur-ingénierie pour 4px.

**Recommandation** : vérifier lequel est intentionnel. Si c'est une coquille, **uniformiser et le signaler** en Completion Notes comme micro-correction assumée. Sinon, exposer une prop. Ne pas décider en silence — c'est un écart visible sous AC2. **Trancher avec Jeevons si doute.**

### ⚠️ Piège n°5 — `key` de liste et warnings React 19

Le code actuel utilise `key={project.title}` (map projets) et `key={resultIndex}` (map results, avec un commentaire « Ajout de la clé ici »). Les **reprendre à l'identique** dans le composant. React 19 est plus strict sur les clés : vérifier `bunx tsc --noEmit` et la console pour l'absence de warning de clé.

### ⚠️ Piège n°6 — AC3, le contrat pour l'Epic 4

Le composant **ne doit connaître que ses props** : pas d'import de constante `portfolioProjects` **dans** le composant, pas de fetch, pas de `import … from "@/assets/images/…"` **dans** le composant. Les images et données restent **dans les conteneurs** (aujourd'hui des imports statiques ; demain un fetch DB). Le composant reçoit un `Project[]` opaque. C'est ce qui rend le branchement Epic 4 trivial (plan §2 : « le composant factorisé reçoit ces projets sans savoir d'où ils viennent »).

⚠️ Le type `image: StaticImageData` est adapté aux imports statiques actuels. En Epic 4, les images viendront de la DB (URLs). **Ne pas anticiper** ce changement ici (hors périmètre) — mais le **type** doit être défini proprement pour qu'il soit facile à faire évoluer. Rester sur `StaticImageData` aujourd'hui.

## Tasks / Subtasks

- [ ] **Tâche 1 — Vérifier prérequis** (3.1, 3.2, 3.3 `done`)
  - [ ] Code sous `apps/web/`, Next 16 / React 19, Bun.
- [ ] **Tâche 2 — Créer le composant factorisé** (AC: 1, 3 ; pièges n°1, 2, 3, 5, 6)
  - [ ] `ProjectList.tsx` avec type `Project` + props `{ id, eyebrow, title, description, projects }`.
  - [ ] Déplacer le `<section>` + `<SectionHeader>` + map `<Card>` **à l'identique** (rendu, classes, `aria-label`, `alt`, `target`/`rel`).
  - [ ] `id` posé depuis la prop (piège n°1). Lien sortant en `<a>` stylé, **jamais** de `<button>` imbriqué (piège n°2).
  - [ ] ❌ Aucune donnée ni import d'image **dans** le composant (AC3, piège n°6).
- [ ] **Tâche 3 — Convertir les deux sections en conteneurs minces** (AC: 1)
  - [ ] `Projects.tsx` : garder `portfolioProjects` + textes, déléguer à `<ProjectList id="projects" …/>`.
  - [ ] `SelfProject.tsx` : idem avec `id="side-projects"` et ses 4 projets.
  - [ ] Aucune logique de rendu résiduelle dans les conteneurs (AC1).
- [ ] **Tâche 4 — Trancher le micro-écart gap-1/gap-2** (AC: 2, piège n°4)
  - [ ] Décider (uniformiser ou paramétrer) et **documenter** le choix. Valider avec Jeevons si intentionnel.
- [ ] **Tâche 5 — Vérification visuelle et accessibilité** (AC: 2) — 🛑 **cœur de la story**
  - [ ] Comparer avant/après : les deux sections rendues **à l'identique** (hors décision tâche 4).
  - [ ] Ancres : cliquer les liens du Header vers `#projects` et `#side-projects` → défilement correct (piège n°1).
  - [ ] Inspecter le HTML : aucun `<button>` dans un `<a>` (piège n°2) ; `rel="noopener noreferrer"` présent ; `aria-label`/`alt` intacts.
  - [ ] Console navigateur : aucun warning de clé React (piège n°5).
- [ ] **Tâche 6 — Definition of Done technique** (AGENTS.md §8)
  - [ ] `bun run lint` → 0 warning · `bunx tsc --noEmit` → 0 erreur · `bun run build` → succès.
  - [ ] `git diff` : `ProjectList.tsx` créé, `Projects.tsx` et `SelfProject.tsx` allégés. Rien d'autre.
  - [ ] `File List` + `Completion Notes` + `Change Log` remplis · `sprint-status.yaml` mis à jour.

## Dev Notes

### Périmètre — verrouillé

**Extraction d'un composant de liste de projets** consommé par les deux sections. **Un fichier créé** (`ProjectList.tsx`), **deux allégés** (`Projects.tsx`, `SelfProject.tsx`).

**Hors périmètre — ne pas faire :**
- ❌ **Ne pas brancher la base de données** → **Epic 4**. On rend le composant *prêt* à la recevoir (AC3), on ne la branche pas. Les données restent des constantes en dur dans les conteneurs.
- ❌ **Ne pas changer le rendu visuel** (AC2) — hors la micro-décision `gap` de la tâche 4, tranchée et documentée.
- ❌ **Ne pas modifier `Card.tsx`, `SectionHeader.tsx`, `Header.tsx`** ni `page.tsx` : la factorisation est **interne** aux deux sections projets. AGENTS.md §5 rappelle que ces fichiers sont aussi touchés par l'Epic 6 — ne pas empiéter.
- ❌ **Ne pas toucher aux `id` `#projects`/`#side-projects`** autrement qu'en les passant en prop (Epic 1).
- ❌ **Ne pas réintroduire de `<button>` dans un `<a>`** (régression accessibilité Epic 1).
- ❌ **Ne pas ajouter de dépendance.**

### Pourquoi cette factorisation en dernier dans l'Epic 3

Séquencement plan §6.1 et epics.md : « la factorisation des sections dupliquées vient en dernier — juste avant que l'Epic 4 n'y branche la base ». Une fois le socle moderne (monorepo, Bun, Next 16) posé, on nettoie la dette de duplication pour que l'Epic 4 n'ait qu'**un seul** point de branchement au lieu de deux. AGENTS.md §6 signalait déjà cette dette : « `Projects.tsx`/`SelfProject.tsx` partagent ~90 % de code : la factorisation est traitée en story 3.7 — n'aggrave pas la dette d'ici là. »

### Le vrai enjeu : AC3, le contrat pour l'Epic 4

Ce qui compte le plus n'est pas la réduction de lignes, c'est que le composant devienne **agnostique de la source**. Aujourd'hui les deux conteneurs importent des constantes ; demain (Epic 4) l'un fera un `await prisma.project.findMany()` et passera le résultat au **même** composant, sans aucune modification de rendu. Si le composant importe lui-même les données ou les images, ce contrat est cassé — d'où l'interdiction stricte du piège n°6.

### Chevauchement Epic 1 / Epic 6 assumé

AGENTS.md §5 : Epics 1 et 6 modifient tous deux ces fichiers, chevauchement **assumé**. Cette story 3.7 se limite à la **factorisation structurelle** ; elle ne doit pas préempter la refonte visuelle de l'Epic 6 ni défaire les corrections de l'Epic 1. Rendu **strictement iso** (AC2).

### Testing standards

Pas de test automatisé (Playwright en Epic 7). Vérification par **comparaison visuelle avant/après**, **test des ancres** depuis le Header, **inspection du HTML rendu** (pas de bouton imbriqué, `rel` correct, `aria`/`alt` intacts) et **console sans warning de clé**.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.7]
- [Source: PLAN_REFONTE_2026.md §2 — architecture cible ; §6.1 — « factorisation des sections dupliquées en dernier, juste avant le branchement DB de l'Epic 4 »]
- [Source: AGENTS.md §6 — « `Projects.tsx`/`SelfProject.tsx` partagent ~90 % de code : factorisation en story 3.7 » ; jamais de contrôle imbriqué, liens sortants `rel="noopener noreferrer"`, `id` de section uniques]
- [Source: AGENTS.md §5 — chevauchement Epics 1/6 sur `Projects.tsx`/`SelfProject.tsx`/`Card.tsx`/`Header.tsx`, à ne pas mélanger]
- [Source: apps/web/src/sections/Projects.tsx — `id="projects"`, 2 projets, `gap-1` ; apps/web/src/sections/SelfProject.tsx — `id="side-projects"`, 4 projets, `gap-2`]
- [Source: apps/web/src/components/Card.tsx · SectionHeader.tsx — consommés à l'identique, non modifiés]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

### Change Log

| Date | Description |
|------|-------------|
| 2026-07-23 | Story 3.7 créée — factorisation `Projects`/`SelfProject` en composant unique source-agnostique. |
