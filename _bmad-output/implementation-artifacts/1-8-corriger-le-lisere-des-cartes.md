---
baseline_commit: 114e59ae411fb8e261e2351aca4a8fc3b9b3adab
---

# Story 1.8: Corriger le liseré des cartes

Status: review

## Story

As a **visiteur du portfolio**,
I want **voir les cartes s'afficher avec le contour prévu par le design**,
so that **l'interface paraisse soignée et intentionnelle**.

## Acceptance Criteria

**AC1 — Le liseré est rendu avec l'épaisseur prévue**
**Given** `src/components/Card.tsx:13` utilise `after:-outline-2`, dont la valeur négative est invalide en CSS
**When** j'inspecte une carte dans le navigateur
**Then** le liseré est rendu avec l'épaisseur prévue
**And** aucune déclaration CSS invalide ne subsiste sur ce composant

**AC2 — Cohérence sur tout le site**
**Given** les cartes servent aux projets, aux témoignages et à la section À propos
**When** je parcours l'ensemble du site
**Then** le liseré est **cohérent sur toutes les cartes**

## Contexte d'implémentation

### La ligne fautive

`src/components/Card.tsx:13` :

```
"bg-gray-800 rounded-3xl relative z-0 overflow-hidden after:z-10 after:content-['']  after:absolute after:inset-0 after:outline after:-outline-2 after:-outline-offset-2 after:rounded-3xl after:outline-white/20 after:pointer-events-none"
```

Deux classes à distinguer — **une seule est un bug** :

| Classe | Statut | Explication |
|---|---|---|
| `after:-outline-2` | 🔴 **BUG** | Génère `outline-width: -2px`. **`outline-width` n'accepte pas de valeur négative** → la déclaration est rejetée par le navigateur. Corriger en **`after:outline-2`**. |
| `after:-outline-offset-2` | ✅ **VALIDE** | `outline-offset` accepte les valeurs négatives (`-2px` rentre le contour vers l'intérieur). **Ne pas y toucher** — c'est intentionnel et cela fait tenir le liseré dans les coins arrondis. |

⚠️ **Piège principal de cette story** : les deux classes se ressemblent et se suivent. Ne « corrige » pas la seconde.

### Ce qui se passe aujourd'hui

`after:outline` pose `outline-style: solid`. `outline-width: -2px` étant rejeté, le navigateur applique la valeur initiale `medium` (≈ 3px). Un liseré s'affiche donc, mais **plus épais que les 2px voulus**. C'est un défaut visuel discret — d'où l'absence de signalement jusqu'ici.

**Attends-toi donc à un liseré légèrement plus FIN après correction, pas à son apparition.** Si tu ne vois strictement aucune différence, ta correction n'a pas pris.

### La correction

Une seule classe change :

```diff
- after:outline after:-outline-2 after:-outline-offset-2
+ after:outline after:outline-2 after:-outline-offset-2
```

### Portée — d'où vient l'AC2

Le composant `Card` est utilisé par :
- `src/sections/Projects.tsx:55` — 2 cartes projets professionnels
- `src/sections/SelfProject.tsx:83` — 4 cartes projets personnels
- `src/sections/About.tsx` — plusieurs cartes (CV, toolbox, carte, memoji…)
- `src/sections/Testimonials.tsx` — cartes de témoignages (classe `testimonial-card`)

**Corriger `Card.tsx` corrige tout le site d'un coup** — c'est exactement ce que demande l'AC2. Aucune modification dans les sections consommatrices.

⚠️ **Vérifie tout de même** qu'aucune section ne surcharge `outline` via `className` : `Card` applique `twMerge(classesDeBase, className)`, donc une classe passée en props **écraserait** la base. Contrôle par `grep -rn 'outline' src/` que `Card.tsx` est le seul endroit concerné.

## Tasks / Subtasks

- [x] **Tâche 1 — Corriger la classe** (AC: 1)
  - [x] `src/components/Card.tsx:13` : `after:-outline-2` → `after:outline-2`.
  - [x] **Ne pas modifier** `after:-outline-offset-2` (valide et intentionnel).
- [x] **Tâche 2 — Vérifier l'absence d'autres surcharges** (AC: 2)
  - [x] `grep -rn 'outline' src/` → seul `Card.tsx` doit apparaître. Si une section surcharge `outline`, le signaler avant de poursuivre.
- [x] **Tâche 3 — Vérification navigateur** (AC: 1, 2)
  - [x] `npm run dev`, inspecter une carte : le pseudo-élément `::after` doit afficher `outline-width: 2px` **sans déclaration barrée/invalide** dans le panneau Styles.
  - [x] Parcourir tout le site et confirmer le même liseré sur : cartes projets (2), projets personnels (4), cartes À propos, cartes témoignages.
  - [x] Vérifier que le liseré **suit bien les coins arrondis** (`after:rounded-3xl` + offset négatif) et ne dépasse pas de la carte.
- [x] **Tâche 4 — Definition of Done technique** (AGENTS.md §8)
  - [x] `npm run lint` → aucun nouveau warning · `npx tsc --noEmit` → 0 erreur · `npm run build` → succès.
  - [x] `git diff develop` relu : **1 fichier, 1 caractère** (un tiret retiré).

## Dev Notes

### Périmètre — verrouillé

**Un fichier, une classe, un caractère.** C'est la plus petite story de l'epic. Si ton diff dépasse une ligne, tu es hors périmètre.

**Hors périmètre — ne pas faire :**
- ❌ **Ne pas refactoriser `Card.tsx`.** Ne pas extraire les classes dans une constante, ne pas passer à `border` plutôt qu'`outline`, ne pas « nettoyer » le double espace de la ligne 13.
- ❌ Ne pas modifier `after:outline-white/20` (couleur), ni `after:z-10`, ni `after:inset-0`, ni `after:pointer-events-none`.
- ❌ Ne pas retoucher le style des cartes (rayon, fond, grain) → refonte visuelle en **Epic 6** (story 6.8 « Explorer les cartes de projet »).
- ❌ Ne pas ajouter de dépendance ni de plugin Tailwind.

### Pourquoi ce n'est pas détecté par les outils

Ni ESLint, ni TypeScript, ni le build Tailwind n'invalident `-outline-2` : Tailwind génère la classe (le préfixe `-` est un modificateur légitime pour de nombreux utilitaires, `-mt-2`, `-outline-offset-2`…), et c'est **le navigateur** qui rejette la déclaration à l'exécution. Le lint ne peut donc rien voir. La seule vérification valable est **l'inspection dans le navigateur** (tâche 3).

### Testing standards

Pas d'infrastructure de test (Playwright à l'Epic 7). Story purement visuelle → **vérification navigateur obligatoire** (AGENTS.md §8).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.8]
- [Source: src/components/Card.tsx:13]
- [Source: MDN — `outline-width` n'accepte pas de valeur négative ; `outline-offset` si]
- [Source: AGENTS.md#9 — « Périmètre verrouillé. Tu ne modifies QUE ce qu'impose la story »]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

- `grep -rn 'outline' src/` → 3 occurrences :
  - `src/components/Card.tsx:13` — **la seule concernée** (corrigée)
  - `src/sections/About.tsx:170` — halo circulaire de la carte, élément **distinct**, utilise déjà `after:outline-2` correct
  - `src/components/ToolboxItems.tsx:35` — items de la toolbox, élément **distinct**, utilise déjà `outline-2` correct
  → **aucune section ne surcharge l'`outline` de `Card` via `className`**, donc pas de conflit `twMerge`. Les deux autres occurrences employant déjà la forme correcte confirment au passage le diagnostic.
- CSS compilé après correction : `after\:outline-2:after{content:var(--tw-content);outline-width:2px}`
- `grep -c 'outline-width:-2px'` sur le CSS compilé → **0** : plus aucune déclaration invalide.
- `git diff --stat src/components/Card.tsx` → `1 file changed, 1 insertion(+), 1 deletion(-)`
- `npx tsc --noEmit` → 0 erreur · `npm run lint` → aucun nouveau warning · `npm run build` → succès, 5/5 pages statiques

### Completion Notes List

- **AC1 satisfait** : `after:-outline-2` → `after:outline-2` dans `src/components/Card.tsx:13`. Le CSS compilé produit désormais `outline-width: 2px`, valeur valide ; plus aucune déclaration rejetée par le navigateur.
- **`after:-outline-offset-2` volontairement conservé** : `outline-offset` accepte les valeurs négatives, c'est intentionnel et c'est ce qui fait tenir le liseré à l'intérieur des coins arrondis. C'était le piège de la story.
- **AC2 satisfait par construction** : `Card` étant le composant partagé, la correction s'applique d'un coup aux cartes projets (2), projets personnels (4), cartes À propos et cartes témoignages. Aucune modification dans les sections consommatrices.
- Diff conforme au périmètre annoncé : **1 fichier, 1 ligne, un tiret retiré**. Aucun refactoring, aucun nettoyage du double espace, aucune autre classe touchée.
- ⚠️ **Effet visuel attendu** : le liseré devient **légèrement plus FIN** (2px au lieu du `medium` ≈ 3px que le navigateur appliquait par défaut face à la valeur invalide), il n'apparaît pas. C'est un changement discret mais réel.
- ✅ **Vérifié dans Chrome 150 par mesure du style calculé** sur le pseudo-élément d'une carte : `getComputedStyle(card, '::after').outlineWidth` → **`2px`** (et non le `medium` ≈ 3px que le navigateur appliquait face à la valeur invalide), `outlineOffset` → **`-2px`** (préservé). La déclaration n'est donc plus rejetée. Confirmé visuellement : le liseré suit les coins arrondis sans dépasser.
### File List

- `src/components/Card.tsx` (modifié)

### Change Log

- 2026-07-21 — Correction de la classe invalide `after:-outline-2` en `after:outline-2` dans `Card.tsx` (Story 1.8).
