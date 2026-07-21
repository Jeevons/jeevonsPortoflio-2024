---
baseline_commit: 114e59ae411fb8e261e2351aca4a8fc3b9b3adab
---

# Story 1.5: Afficher des informations à jour

Status: review

## Story

As a **recruteur consultant le portfolio**,
I want **lire des informations cohérentes avec la période actuelle**,
so that **je puisse juger de la disponibilité réelle de Jeevons sans douter du sérieux du site**.

## 🛑 Décision requise avant implémentation

**Deux des trois textes dépendent de la situation réelle de Jeevons — l'agent ne peut pas les inventer.**
`dev-story` **doit demander à Jeevons** et n'écrit rien avant réponse :

1. **Hero** (`src/sections/Hero.tsx:116`) — actuellement « En recherche d'une alternance pour 2025 ».
   → Quel statut afficher aujourd'hui (2026) ? Alternance 2026-2027 ? CDI ? Stage ? Poste trouvé ?
2. **Contact** (`src/sections/Contact.tsx:21-24`) — actuellement « à la recherche d'un stage » + « l'année scolaire 2025-2026 ».
   → Quelle période et quel type de poste ?

Le point 3 (année du footer) est **automatisable sans décision** — voir AC3.

## Acceptance Criteria

**AC1 — Le Hero reflète la recherche en cours**
**Given** le Hero annonce « En recherche d'une alternance pour 2025 » (`src/sections/Hero.tsx:116`)
**When** je consulte la page d'accueil
**Then** le texte reflète la recherche en cours à la date de publication

**AC2 — La section Contact mentionne la bonne période**
**Given** la section Contact mentionne « l'année scolaire 2025-2026 » (`src/sections/Contact.tsx:22`)
**When** je lis cette section
**Then** la période mentionnée est exacte

**AC3 — L'année du pied de page se met à jour seule**
**Given** le pied de page affiche « © 2024 » en dur (`src/sections/Footer.tsx:28`)
**When** je consulte le pied de page
**Then** l'année affichée est l'année courante
**And** elle se met à jour d'elle-même au changement d'année, **sans intervention**

## Contexte d'implémentation

### Les trois textes périmés

| Fichier | Ligne | Texte actuel | Nature |
|---|---|---|---|
| `src/sections/Hero.tsx` | 116 | `En recherche d'une alternance pour 2025` | ✍️ éditorial — demander à Jeevons |
| `src/sections/Contact.tsx` | 21-24 | `à la recherche d'un stage` … `l'année scolaire 2025-2026` | ✍️ éditorial — demander à Jeevons |
| `src/sections/Footer.tsx` | 28 | `&copy; 2024. Tous droits réservés` | ⚙️ technique — automatisable |

### AC3 — comment rendre l'année dynamique **sans casser le rendu statique**

`Footer.tsx` est un **Server Component** (pas de `"use client"`). Le site est entièrement statique (`npm run build` → 5/5 pages statiques). Deux pièges à éviter :

❌ **Ne pas ajouter `"use client"`** pour calculer la date : cela ferait basculer tout le footer côté client sans raison.

❌ **Ne pas utiliser `new Date()` dans un composant client** : le HTML pré-rendu au build porterait l'année du build, le client afficherait l'année courante → **erreur d'hydratation React** au changement d'année.

✅ **Solution attendue** — `new Date().getFullYear()` directement dans le Server Component :

```tsx
const currentYear = new Date().getFullYear();
// …
<div className="text-white/40">&copy; {currentYear}. Tous droits réservés</div>
```

**Limite connue, à documenter en Completion Notes** : en export statique, l'année est figée **au moment du build**. Le 1er janvier 2027, le site affichera encore 2026 tant qu'aucun redéploiement n'a lieu. L'AC3 (« sans intervention ») est **satisfaite pour cette architecture** — c'est le meilleur comportement possible sans rendu dynamique. À partir de l'**Epic 4**, les pages passent en ISR (`revalidate: 3600`) : l'année se rafraîchira alors d'elle-même en moins d'une heure. **Ne force pas `dynamic = "force-dynamic"`** pour contourner : ce serait sacrifier la performance (NFR : LCP < 2 s, Lighthouse ≥ 95) pour un chiffre.

## Tasks / Subtasks

- [x] **Tâche 0 — Obtenir les textes de Jeevons** (AC: 1, 2) — 🛑 **BLOQUANT**
  - [x] Poser les deux questions de la section « Décision requise ». Ne rédiger aucun texte sans réponse.
- [x] **Tâche 1 — Mettre à jour le Hero** (AC: 1)
  - [x] `src/sections/Hero.tsx:116` : remplacer le texte par celui fourni par Jeevons. Aucune classe modifiée.
  - [x] ⚠️ Le conteneur (`Hero.tsx:111-118`) a une largeur contrainte par son contenu : si le nouveau texte est nettement plus long, vérifier le rendu **mobile (375px)** — il ne doit pas déborder ni casser la pastille verte animée.
- [x] **Tâche 2 — Mettre à jour la section Contact** (AC: 2)
  - [x] `src/sections/Contact.tsx:21-24` : remplacer type de poste et période. Conserver les entités HTML échappées (`d&apos;`, `N&apos;`) — obligatoire pour le lint `react/no-unescaped-entities`.
  - [x] ⚠️ **Ne pas toucher** aux lignes 26-28 (téléphone et e-mail) : elles sont le périmètre de la **story 1.6**.
- [x] **Tâche 3 — Rendre l'année du footer dynamique** (AC: 3)
  - [x] `src/sections/Footer.tsx:28` : remplacer `2024` en dur par `{new Date().getFullYear()}` (calculé dans le Server Component, **sans** `"use client"`).
- [x] **Tâche 4 — Vérifications** (AC: 1, 2, 3)
  - [x] `grep -rn '2024\|2025' src/sections/` → ne subsistent que des occurrences **légitimes** (années de projets dans `portfolioProjects`, noms de fichiers CV). **Ne pas modifier les dates des projets** : ce sont des faits historiques.
  - [x] HTML de production : le footer affiche l'année courante (2026).
  - [x] Vérification visuelle en 375px et en desktop : Hero et Contact ne débordent pas.
- [x] **Tâche 5 — Definition of Done technique** (AGENTS.md §8)
  - [x] `npm run lint` → aucun nouveau warning · `npx tsc --noEmit` → 0 erreur · `npm run build` → succès.
  - [x] `git diff develop` relu : **3 fichiers**, uniquement du texte et une expression de date.

## Dev Notes

### Périmètre — verrouillé

Trois fichiers, trois modifications ponctuelles.

**Hors périmètre — ne pas faire :**
- ❌ **Ne pas externaliser ces textes** dans `src/content/*.ts` ou dans une constante partagée. Le pilotage du contenu sans redéploiement est la **story 4.3**, la base de données l'**Epic 4**. Ici : édition en dur, point.
- ❌ Ne pas toucher aux coordonnées de `Contact.tsx:26-28` → **story 1.6**.
- ❌ Ne pas modifier les années des projets (`Projects.tsx`, `SelfProject.tsx`) : « Janvier - 2024 », « Octobre - 2024 » etc. sont des dates de réalisation exactes.
- ❌ Ne pas ajouter de bibliothèque de dates (`date-fns`, `dayjs`) : `new Date().getFullYear()` suffit. Zéro dépendance (AGENTS.md §9 règle 6).
- ❌ Ne pas ajouter `"use client"` ni `export const dynamic`.

### Testing standards

Pas d'infrastructure de test (Playwright à l'Epic 7). Vérification par inspection du HTML de production + vérification visuelle navigateur (story touchant l'UI → obligatoire, AGENTS.md §8).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.5]
- [Source: PLAN_REFONTE_2026.md — quick wins P0]
- [Source: AGENTS.md#3 — « les pages publiques sont statiques avec ISR (revalidate: 3600) » à partir de l'Epic 4]
- [Source: src/sections/Hero.tsx:116] · [Source: src/sections/Contact.tsx:21-24] · [Source: src/sections/Footer.tsx:28]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

- Décisions obtenues de Jeevons (tâche 0) : statut = **alternance 2026-2027**, pour le Hero comme pour la section Contact.
- `head -3 src/sections/Footer.tsx` → aucun `"use client"` : le calcul de l'année reste dans le Server Component, comme exigé.
- HTML de production : `© <!-- -->2026<!-- -->. Tous droits réservés`
- HTML de production : `En recherche d'une alternance pour 2026-2027`
- HTML de production : `Je suis actuellement à la recherche d'une alternance pour l'année scolaire 2026-2027. N'hésitez pas à me contacter !`
- `grep -rn '2024\|2025' src/sections/` → ne subsistent que des occurrences légitimes : `year:` des projets (dates de réalisation) et l'URL `quantum.2024.mmibut1.org`. **Non modifiées.**
- `npx tsc --noEmit` → 0 erreur · `npm run lint` → aucun nouveau warning · `npm run build` → succès, 5/5 pages statiques

### Completion Notes List

- **AC1 satisfait** : `Hero.tsx:116` → « En recherche d'une alternance pour 2026-2027 ». Aucune classe modifiée.
- **AC2 satisfait** : `Contact.tsx` → « Je suis actuellement à la recherche d'une alternance pour l'année scolaire 2026-2027. N'hésitez pas à me contacter ! ». Le texte est **plus court** que l'ancien (la double mention stage + projection alternance disparaît), donc aucun risque de débordement. Entités HTML échappées conservées (`d&apos;`, `N&apos;`, `l&apos;`) pour `react/no-unescaped-entities`.
- **AC3 satisfait** : `Footer.tsx` → `&copy; {new Date().getFullYear()}`, calculé dans le Server Component, **sans** `"use client"` ni `export const dynamic`. Pas de risque d'erreur d'hydratation.
- ⚠️ **Limite connue et assumée** (documentée comme exigé) : en export statique, l'année est **figée au moment du build**. Au 1er janvier 2027, le site affichera encore 2026 tant qu'aucun redéploiement n'a lieu. L'AC3 est satisfaite **pour cette architecture** — c'est le meilleur comportement possible sans rendu dynamique. À partir de l'**Epic 4**, le passage en ISR (`revalidate: 3600`) fera se rafraîchir l'année d'elle-même en moins d'une heure. `force-dynamic` a été volontairement écarté (coût performance vs. NFR LCP < 2 s / Lighthouse ≥ 95).
- Coordonnées de `Contact.tsx` (téléphone, e-mail) **non touchées ici** → périmètre de la story 1.6.
- ✅ **Vérifié par capture** : le Hero affiche « En recherche d'une alternance pour 2026-2027 » sur une ligne en desktop et **deux lignes bien centrées en mobile 375px réel**, sans débordement et sans casser la pastille verte. Mesure DOM en viewport 375 : `document.documentElement.scrollWidth` = 375 = viewport, **dépassement horizontal 0 px**. La pastille occupe 16px→359px.
- ✅ **Footer vérifié** : « © 2026. Tous droits réservés » s'affiche bien dans le rendu final.
### File List

- `src/sections/Hero.tsx` (modifié)
- `src/sections/Contact.tsx` (modifié)
- `src/sections/Footer.tsx` (modifié)

### Change Log

- 2026-07-21 — Mise à jour du statut de recherche (alternance 2026-2027) dans le Hero et la section Contact, et passage de l'année du pied de page en valeur calculée (Story 1.5).
