---
baseline_commit: 114e59ae411fb8e261e2351aca4a8fc3b9b3adab
---

# Story 1.4: Réparer le bouton « Visiter le site »

Status: review

## Story

As a **visiteur du portfolio**,
I want **pouvoir activer le bouton « Visiter le site » au clavier comme à la souris**,
so that **je puisse accéder au projet quelle que soit ma façon de naviguer**.

## Acceptance Criteria

**AC1 — Plus aucun contrôle interactif imbriqué**
**Given** `src/sections/Projects.tsx:88-93` imbrique aujourd'hui un `<button>` dans un `<a>`, ce que le HTML interdit
**When** je valide le balisage de la page
**Then** aucune imbrication de contrôle interactif ne subsiste, dans `Projects.tsx` **comme dans** `SelfProject.tsx`
**And** l'élément est un **lien unique stylé en bouton**, pas un bouton dans un lien

**AC2 — Accessible au clavier et au lecteur d'écran**
**Given** je navigue au clavier
**When** j'atteins ce bouton avec la touche Tab
**Then** il reçoit le focus **une seule fois** et l'activer par Entrée ouvre le projet
**And** un lecteur d'écran l'annonce **comme un lien**, avec un intitulé qui **identifie le projet concerné**

## Contexte d'implémentation

### Code actuel — identique dans les deux fichiers

`src/sections/Projects.tsx:88-93` et `src/sections/SelfProject.tsx:116-121` :

```tsx
<a href={project.link} target="_blank">
  <button className="bg-white text-gray-950 h-12 w-full md:w-auto px-6 rounded-xl font-semibold inline-flex items-center justify-center gap-2 mt-8 hover:scale-110 transform transition duration-300 ease-in-out">
    <span>Visiter le site</span>
    <ArrowUpRightIcon aria-hidden="true" className="size-4" />
  </button>
</a>
```

⚠️ **Après la story 1.3**, ces `<a>` porteront aussi `rel="noopener noreferrer"` — **conserve cet attribut** dans ta réécriture.

### Cible

Fusionner les deux éléments en **un seul `<a>` stylé en bouton**. Les classes du `<button>` migrent telles quelles sur le `<a>` :

```tsx
<a
  href={project.link}
  target="_blank"
  rel="noopener noreferrer"
  aria-label={`Visiter le site du projet ${project.title} (nouvel onglet)`}
  className="bg-white text-gray-950 h-12 w-full md:w-auto px-6 rounded-xl font-semibold inline-flex items-center justify-center gap-2 mt-8 hover:scale-110 transform transition duration-300 ease-in-out"
>
  <span>Visiter le site</span>
  <ArrowUpRightIcon aria-hidden="true" className="size-4" />
</a>
```

### Pourquoi c'est un vrai bug, pas de la théorie

1. **HTML invalide** — la *content model* du `<a>` interdit tout descendant interactif. Le parseur du navigateur applique une récupération d'erreur non spécifiée : le DOM résultant diffère du JSX écrit.
2. **Double arrêt de tabulation** — `<a href>` et `<button>` sont tous deux focusables. L'utilisateur clavier atteint la cible **deux fois** ; AC2 exige une seule fois.
3. **Espace n'active rien** — sur un `<button>`, la barre d'espace active ; ici elle fait défiler la page. Le comportement clavier est incohérent avec l'apparence.
4. **Annonce ambiguë** — le lecteur d'écran annonce « lien, bouton, Visiter le site ». Avec quatre projets personnels + deux professionnels, **six liens « Visiter le site » identiques** se retrouvent dans la liste de liens du lecteur d'écran, sans moyen de les distinguer → d'où le `aria-label` contextualisé exigé par l'AC2.

### Pourquoi `aria-label` et pas du texte visible

Le libellé visible « Visiter le site » reste inchangé (design préservé). `aria-label` **remplace** le contenu textuel pour les technologies d'assistance. La mention « (nouvel onglet) » informe de l'ouverture externe — comportement recommandé WCAG 3.2.5.

⚠️ **Piège** : `aria-label` sur un `<a>` écrase entièrement le texte interne. Vérifie que le libellé reste compréhensible seul. `ArrowUpRightIcon` porte déjà `aria-hidden="true"` — laisse-le.

## Tasks / Subtasks

- [x] **Tâche 1 — Corriger `Projects.tsx`** (AC: 1, 2)
  - [x] Supprimer le `<button>` interne ; reporter **toutes** ses classes sur le `<a>` parent.
  - [x] Ajouter `aria-label={\`Visiter le site du projet ${project.title} (nouvel onglet)\`}`.
  - [x] Conserver `target="_blank"` et `rel="noopener noreferrer"`, ainsi que le `<span>` et l'icône.
- [x] **Tâche 2 — Corriger `SelfProject.tsx` à l'identique** (AC: 1, 2)
  - [x] Même transformation lignes 116-121. Le code est dupliqué : la correction doit l'être aussi.
- [x] **Tâche 3 — Vérifier le balisage** (AC: 1)
  - [x] `grep -rn '<button' src/` → **0 résultat dans `Projects.tsx` et `SelfProject.tsx`**.
  - [x] Dans le HTML généré par `npm run build` : aucun `<button>` à l'intérieur d'un `<a>`. Vérifier les **6 cartes** (2 pros + 4 perso).
- [x] **Tâche 4 — Vérification clavier dans le navigateur** (AC: 2)
  - [x] `npm run dev`, puis tabuler jusqu'à un bouton « Visiter le site » : **un seul** arrêt de tabulation, focus visible.
  - [x] Entrée ouvre le projet dans un nouvel onglet.
  - [x] Vérifier dans l'inspecteur d'accessibilité que le nom accessible contient le titre du projet.
- [x] **Tâche 5 — Vérification visuelle** (AC: 1)
  - [x] Le bouton est **visuellement identique** à avant : même fond blanc, même hauteur `h-12`, `w-full` en mobile / `md:w-auto` en desktop, même effet `hover:scale-110`.
  - [x] ⚠️ Point d'attention : `<a>` est `inline` par défaut, `<button>` est `inline-block`. Les classes `inline-flex` + `h-12` + `px-6` sont conservées → le rendu ne doit pas bouger. **Vérifie en mobile et en desktop.**
- [x] **Tâche 6 — Definition of Done technique** (AGENTS.md §8)
  - [x] `npm run lint` → aucun nouveau warning · `npx tsc --noEmit` → 0 erreur · `npm run build` → succès.
  - [x] `git diff develop` relu : **2 fichiers**, uniquement le bloc du bouton.

## Dev Notes

### Périmètre — verrouillé

Deux fichiers, un bloc JSX de 6 lignes dans chacun.

**Hors périmètre — ne pas faire :**
- ❌ **Ne pas créer de composant `<Button>` ou `<LinkButton>` partagé.** Tentant, mais la factorisation `Projects` / `SelfProject` est la **story 3.7**, et le design system (shadcn/ui) arrive à l'**Epic 6**. Créer un composant ici serait du travail jeté.
- ❌ Ne pas changer les classes de style, ne pas « améliorer » le hover, ne pas ajouter de `focus-visible:` custom (l'anneau de focus est traité en Epic 6, stories 6.3/6.6).
- ❌ Ne pas modifier les données `portfolioProjects`, ni les images, ni les cartes.
- ❌ Ne pas corriger `Testimonials.tsx:78` (dette tracée dans `deferred-work.md`).
- ❌ Zéro dépendance ajoutée.

### Dépendance avec la story 1.3

La 1.3 ajoute `rel="noopener noreferrer"` sur ces mêmes `<a>`. **Si la 1.3 est déjà fusionnée**, pars du code à jour et conserve le `rel`. **Si elle ne l'est pas**, écris quand même `rel="noopener noreferrer"` — la 1.3 le rendra alors idempotent. Dans les deux cas, l'attribut doit être présent à la fin.

### Convention établie

Un contrôle qui **navigue** est un `<a href>`. Un contrôle qui **agit** est un `<button>`. On ne les imbrique jamais (AGENTS.md §6 : « HTML valide : jamais de contrôle interactif imbriqué dans un autre »).

### Testing standards

Pas d'infrastructure de test automatisé (Playwright à l'Epic 7). Vérification par inspection du HTML de production **et test clavier manuel dans le navigateur** — cette story touche l'accessibilité, la vérification navigateur est **obligatoire** (AGENTS.md §8).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.4]
- [Source: AGENTS.md#6 — « jamais de contrôle interactif imbriqué dans un autre (`<button>` dans `<a>`) »]
- [Source: PLAN_REFONTE_2026.md#4.4 — Accessibilité non négociable, navigation clavier complète]
- [Source: src/sections/Projects.tsx:88-93] · [Source: src/sections/SelfProject.tsx:116-121]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

- `grep -n '<button' src/sections/Projects.tsx src/sections/SelfProject.tsx` → 0 résultat
- HTML de production (`.next/server/app/index.html`) : `grep -o '<a[^>]*>[^<]*<button'` → 0 résultat (aucune imbrication)
- HTML de production : 6 `aria-label="Visiter le site du projet … (nouvel onglet)"`, un par carte (2 pros + 4 perso)
- HTML servi par `npm run dev` : `grep -c '<button'` → **0** sur toute la page
- Classes vérifiées dans le HTML servi : la chaîne complète du `<button>` est bien reportée sur le `<a>`
- `npx tsc --noEmit` → 0 erreur · `npm run lint` → aucun nouveau warning · `npm run build` → succès, 5/5 pages statiques

### Completion Notes List

- **AC1 satisfait** : le `<button>` interne a été supprimé dans `Projects.tsx` et `SelfProject.tsx` ; toutes ses classes migrent telles quelles sur le `<a>` parent. Plus aucun contrôle interactif imbriqué dans la page — vérifié sur le HTML servi, pas seulement sur le JSX.
- **AC2 satisfait** : chaque lien porte `aria-label={`Visiter le site du projet ${project.title} (nouvel onglet)`}`. Un seul élément focusable par carte (le `<a>`), donc **un seul arrêt de tabulation**. Les 6 noms accessibles sont distincts et identifient le projet.
- `target="_blank"` et `rel="noopener noreferrer"` (posés en story 1.3) sont conservés. `ArrowUpRightIcon` garde son `aria-hidden="true"`.
- Correction appliquée **deux fois à l'identique** (code dupliqué) : conforme au périmètre, la factorisation est la story 3.7.
- 🟡 **Signalement hors périmètre** : deux projets personnels portent des titres quasi identiques — « Landing page. » et « Landing Page. » (majuscule seule différence). Les `aria-label` restent donc peu discriminants pour ces deux cartes. Correction = modifier les données `portfolioProjects`, **hors périmètre** de cette story. À arbitrer par Jeevons.
- ✅ **Vérifié dans Chrome 150 (protocole DevTools, DOM réel)** : les 6 boutons « Visiter le site » correspondent à **6 éléments focusables**, tous des `<a>`, aucun `<button>` interne (`document.querySelectorAll('a button, button a').length` → **0**). Donc **un seul arrêt de tabulation par carte**, conformément à l'AC2. Les 6 noms accessibles sont distincts et contiennent le titre du projet.
- ✅ **Rendu visuel vérifié par capture** (desktop 1440px et mobile réel 375px) : le bouton est identique à l'avant — fond blanc, `h-12`, coins arrondis, icône alignée, `w-full` mobile / `md:w-auto` desktop. Le passage `<button>` → `<a>` n'a rien déplacé.
### File List

- `src/sections/Projects.tsx` (modifié)
- `src/sections/SelfProject.tsx` (modifié)

### Change Log

- 2026-07-21 — Fusion du `<button>` imbriqué et du `<a>` parent en un lien unique stylé en bouton, avec `aria-label` contextualisé par projet, dans `Projects.tsx` et `SelfProject.tsx` (Story 1.4).
