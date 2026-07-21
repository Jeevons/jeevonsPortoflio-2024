---
baseline_commit: 114e59ae411fb8e261e2351aca4a8fc3b9b3adab
---

# Story 1.10: Apparaître correctement au partage et à l'indexation

Status: review

## Story

As a **Jeevons**,
I want **que mon portfolio s'affiche avec un aperçu soigné quand on le partage et qu'il soit correctement indexé**,
so that **un lien envoyé à un recruteur donne une bonne première impression et que le site soit trouvable**.

## 🛑 Décision requise avant implémentation

**URL publique du site.** `metadataBase`, `sitemap.xml` et `robots.txt` en dépendent tous.

- AGENTS.md §1 annonce le domaine de production **`portfolio.doshwork.com`** (VPS Hetzner, Coolify) — mais ce domaine n'est **opérationnel qu'à la story 2.6**. Le site tourne aujourd'hui sur **Vercel**, coupé seulement en story 2.7.
- 👉 **Demander à Jeevons** quelle URL inscrire : `https://portfolio.doshwork.com` (cible, correcte à terme mais fausse aujourd'hui) ou l'URL Vercel actuelle (juste maintenant, à changer en Epic 2).
- **Recommandation** : `https://portfolio.doshwork.com`, via une variable d'environnement `NEXT_PUBLIC_SITE_URL` avec ce domaine en valeur par défaut — la story 2.6 n'aura alors qu'à définir la variable, sans retoucher le code.

**Image de partage.** L'AC exige « une image de partage lisible ». Deux options — **demander à Jeevons** :
- **(a) `opengraph-image.tsx`** — image générée par Next.js à partir de JSX (aucun asset ajouté au dépôt, cohérente avec le design, et **c'est ce que prévoit `PLAN_REFONTE_2026.md` §2**). ✅ **Recommandé.**
- **(b) Un fichier statique** `opengraph-image.png` (1200×630) fourni par Jeevons. ⚠️ Contradictoire avec la story 1.9 qui vient d'alléger le dépôt.

## Acceptance Criteria

**AC1 — Métadonnées complètes**
**Given** `src/app/layout.tsx` ne déclare aujourd'hui qu'un titre et une description
**When** j'inspecte les métadonnées de la page
**Then** `metadataBase` est défini sur l'URL publique du site
**And** les balises **OpenGraph** sont présentes : titre, description, image, type et locale
**And** les balises **Twitter card** sont présentes avec un format `summary_large_image`

**AC2 — L'aperçu s'affiche au partage**
**Given** je partage l'URL du site sur un réseau social ou une messagerie
**When** l'aperçu se génère
**Then** une **image de partage lisible** s'affiche avec le titre et la description

**AC3 — Sitemap et robots**
**Given** un moteur de recherche explore le site
**When** il demande `/sitemap.xml` et `/robots.txt`
**Then** les deux répondent avec un **contenu valide**
**And** le sitemap liste les **pages publiques** du site

**AC4 — Favicon propre**
**Given** j'ouvre le site dans un navigateur
**When** je regarde l'onglet
**Then** une **icône de favori propre au portfolio** s'affiche, **distincte de l'icône par défaut de Next.js**

## Contexte d'implémentation

### État actuel

`src/app/layout.tsx:13-16` — métadonnées minimales :
```tsx
export const metadata: Metadata = {
  title: "Jeevons Eya | Portfolio 2024",
  description: "Portfolio React et Next js avec Tailwindcss et Framer-motion",
};
```

⚠️ **Deux problèmes de contenu, pas seulement d'absence de balises :**
1. Le titre dit **« Portfolio 2024 »** — nous sommes en 2026. Incohérent avec l'esprit de la story 1.5.
2. La description décrit la **stack technique**, pas la personne. C'est ce texte qui s'affichera dans Google et dans les aperçus de partage : un recruteur veut lire qui est Jeevons, pas « Tailwindcss et Framer-motion ».
👉 **Proposer un titre et une description orientés recruteur à Jeevons, et les faire valider.**

**Fichiers absents à créer :** `src/app/sitemap.ts`, `src/app/robots.ts`, et (option a) `src/app/opengraph-image.tsx`.

**Favicon (AC4)** : `src/app/favicon.ico` existe (25,9 Ko, 16×16 + 32×32). 🛑 **Vérifie visuellement s'il s'agit du logo Next.js par défaut ou d'une icône propre à Jeevons.** S'il est déjà personnalisé, l'AC4 est **déjà satisfaite** — le documenter et ne rien changer. Sinon, demander une icône à Jeevons.

### API Next.js 14.2.5 — à utiliser telle quelle

Le projet est en **Next.js 14.2.5 App Router** (`package.json`). Les conventions de fichiers ci-dessous sont natives — **aucune dépendance à ajouter** (pas de `next-sitemap`, pas de `next-seo` : ils sont inutiles ici).

**Métadonnées** (`src/app/layout.tsx`) :
```tsx
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://portfolio.doshwork.com"),
  title: "…",
  description: "…",
  openGraph: {
    title: "…",
    description: "…",
    type: "website",
    locale: "fr_FR",
    siteName: "…",
    // `images` est renseigné automatiquement par opengraph-image.tsx (option a)
  },
  twitter: {
    card: "summary_large_image",
    title: "…",
    description: "…",
  },
};
```

⚠️ `metadataBase` doit être un objet `URL`, pas une chaîne — sinon erreur TypeScript.

**Sitemap** — `src/app/sitemap.ts` :
```tsx
import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://portfolio.doshwork.com";
  return [{ url: base, lastModified: new Date(), changeFrequency: "monthly", priority: 1 }];
}
```
⚠️ **Le site n'a qu'UNE page publique** (`src/app/page.tsx`, page unique à sections ancrées). Le sitemap contient donc **une seule entrée** — c'est correct et conforme à l'AC3. **N'invente pas d'URL** : `/projects/[slug]` et `/cv` n'existeront qu'à l'Epic 6, `/admin` ne doit **jamais** figurer dans un sitemap.

**Robots** — `src/app/robots.ts` :
```tsx
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://portfolio.doshwork.com";
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${base}/sitemap.xml`,
  };
}
```
💡 Prévoir `disallow: "/admin"` dès maintenant est judicieux (l'admin arrive à l'Epic 5) — mais **valide-le avec Jeevons**, ce n'est pas dans l'AC.

**Image OG** (option a) — `src/app/opengraph-image.tsx` :
```tsx
import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "…";

export default function Image() {
  return new ImageResponse(( /* JSX */ ), { ...size });
}
```
⚠️ **Pièges d'`ImageResponse`** : il utilise Satori, qui ne comprend **qu'un sous-ensemble du CSS** — **pas de Tailwind par défaut** (les classes ne sont pas compilées ici), pas de `gap` sur tous les affichages, tout conteneur à plusieurs enfants doit porter `display: flex` explicitement. Écris des **styles inline simples**. `next/og` est inclus dans Next 14 — aucune installation.

## Tasks / Subtasks

- [x] **Tâche 0 — Obtenir les décisions de Jeevons** — 🛑 **BLOQUANT**
  - [x] URL publique à utiliser.
  - [x] Option (a) image générée ou (b) image statique.
  - [x] Titre et description validés (orientés recruteur, sans « 2024 »).
  - [x] Statut du favicon existant (personnalisé ou Next.js par défaut).
- [x] **Tâche 1 — Enrichir les métadonnées** (AC: 1)
  - [x] `src/app/layout.tsx` : ajouter `metadataBase`, `openGraph` (title, description, type, locale, siteName) et `twitter` (`summary_large_image`).
  - [x] Mettre à jour titre et description avec les textes validés.
- [x] **Tâche 2 — Créer l'image de partage** (AC: 2)
  - [x] Selon l'option retenue : créer `src/app/opengraph-image.tsx` (styles inline uniquement) **ou** déposer l'image statique fournie.
  - [x] Vérifier le format **1200×630** et la **lisibilité du texte en petit** (l'aperçu est souvent affiché en ~300px de large).
- [x] **Tâche 3 — Créer le sitemap** (AC: 3)
  - [x] `src/app/sitemap.ts`, **une seule entrée** : la page d'accueil.
- [x] **Tâche 4 — Créer robots.txt** (AC: 3)
  - [x] `src/app/robots.ts` avec `allow: "/"` et l'URL du sitemap.
- [x] **Tâche 5 — Favicon** (AC: 4)
  - [x] Ouvrir `src/app/favicon.ico` et déterminer s'il est déjà personnalisé.
  - [x] S'il s'agit de l'icône Next.js par défaut, la remplacer par celle fournie par Jeevons (⚠️ **ne pas générer d'icône soi-même** : c'est une décision d'identité visuelle).
  - [x] Si elle est déjà personnalisée : **ne rien changer**, documenter l'AC4 comme déjà satisfaite avec la preuve.
- [x] **Tâche 6 — Vérification du build et des routes** (AC: 1, 3)
  - [x] `npm run build` → succès. ⚠️ Le nombre de routes générées **augmente** (`/sitemap.xml`, `/robots.txt`, `/opengraph-image`) : c'est **attendu**, ce n'est pas une régression du « 5/5 pages statiques » des stories précédentes.
  - [x] `npm run dev` puis :
    - [x] `curl -s localhost:3000/sitemap.xml` → XML valide contenant l'URL d'accueil.
    - [x] `curl -s localhost:3000/robots.txt` → texte valide avec la ligne `Sitemap:`.
    - [x] `curl -sI localhost:3000/opengraph-image` → `content-type: image/png` (option a).
  - [x] `curl -s localhost:3000 | grep -o '<meta property="og:[^>]*>'` → titre, description, image, type, locale présents.
  - [x] `curl -s localhost:3000 | grep -o '<meta name="twitter:[^>]*>'` → `summary_large_image` présent.
- [x] **Tâche 7 — Vérification de l'aperçu** (AC: 2)
  - [x] Ouvrir `/opengraph-image` dans le navigateur : image lisible, texte non tronqué.
  - [x] ⚠️ Les validateurs en ligne (LinkedIn Post Inspector, Twitter Card Validator) **exigent une URL publique** : impossible à tester depuis `localhost`. Validation complète **reportée après le déploiement** (Epic 2) → à noter en Completion Notes.
- [x] **Tâche 8 — Vérification du favicon** (AC: 4)
  - [x] Ouvrir le site : l'onglet affiche une icône propre au portfolio, distincte du logo Next.js. Vider le cache si nécessaire (les favicons sont agressivement mis en cache).
- [x] **Tâche 9 — Definition of Done technique** (AGENTS.md §8)
  - [x] `npm run lint` → aucun nouveau warning · `npx tsc --noEmit` → 0 erreur · `npm run build` → succès.
  - [x] `git diff develop` relu : `layout.tsx` modifié + 2 à 3 fichiers créés. Rien d'autre.
  - [x] ⚠️ **Aucun `.env` réel committé** si `NEXT_PUBLIC_SITE_URL` est introduite — `git status` doit être propre (AGENTS.md §2).

## Dev Notes

### Périmètre — verrouillé

Un fichier modifié (`layout.tsx`), deux à trois créés (`sitemap.ts`, `robots.ts`, éventuellement `opengraph-image.tsx`), éventuellement le favicon remplacé.

**Hors périmètre — ne pas faire :**
- ❌ **Ne pas ajouter de dépendance SEO** (`next-sitemap`, `next-seo`, `schema-dts`…). Next 14 fait tout nativement. AGENTS.md §9 règle 6.
- ❌ **Ne pas ajouter de données structurées JSON-LD** ni de `manifest.json` (PWA) : hors AC.
- ❌ **Ne pas créer de pages** (`/cv`, `/projects/[slug]`) pour « remplir » le sitemap → Epic 6.
- ❌ **Ne pas ajouter de balises `alternates` / hreflang** : le site est monolingue.
- ❌ Ne pas toucher aux sections (`src/sections/`) : cette story reste dans `src/app/`.
- ❌ Ne pas déployer ni configurer de DNS → **Epic 2** (story 2.6). ⚠️ AGENTS.md §2 : ne jamais poser un FQDN dans Coolify avant vérification DNS.

### Une seule page publique

`src/app/page.tsx` assemble toutes les sections (Hero, Projects, SelfProject, Testimonials, About, Contact, Footer) en **une page unique** à ancres. C'est pour cela que le sitemap ne contient qu'une entrée. Les ancres (`#projects`, `#parcours`, `#about`, `#contact` — posées en stories 1.1/1.2) **ne s'inscrivent pas dans un sitemap** : ce ne sont pas des URL distinctes.

### Dépendance temporelle avec l'Epic 2

`metadataBase`, le sitemap et robots référencent une URL qui **n'est pas encore joignable**. C'est normal et sans danger : ces valeurs ne sont lues que par les crawlers et les générateurs d'aperçu, pas par le rendu. Passer par `NEXT_PUBLIC_SITE_URL` avec valeur par défaut rend la bascule de l'Epic 2 gratuite.

### Testing standards

Pas d'infrastructure de test (Playwright à l'Epic 7). Vérification par **`curl` sur les routes générées** + inspection des balises `<meta>` du HTML servi. La validation réelle des aperçus sociaux requiert une URL publique → reportée à l'Epic 2, à documenter en Completion Notes.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.10]
- [Source: PLAN_REFONTE_2026.md — règle D7 (metadata minimale, 🔴 SEO), §2 arborescence : « sitemap.ts · robots.ts · opengraph-image.tsx »]
- [Source: AGENTS.md#1 — domaine de production `portfolio.doshwork.com`]
- [Source: src/app/layout.tsx:13-16] · [Source: src/app/page.tsx] · [Source: src/app/favicon.ico]
- [Source: Next.js 14 App Router — conventions `sitemap.ts`, `robots.ts`, `opengraph-image.tsx`, API `Metadata`]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

**Décisions obtenues de Jeevons (tâche 0)** :
- URL publique : `https://portfolio.doshwork.com`, via `NEXT_PUBLIC_SITE_URL` avec ce domaine en valeur par défaut.
- Image de partage : **option (a)**, générée par `opengraph-image.tsx`.
- Titre : « Jeevons Eya — Développeur web » · Description : « Portfolio de Jeevons Eya, développeur web. Découvrez mes projets, mon parcours et mes compétences. » (variante **sans mention de recherche**, retenue pour limiter la maintenance dans le temps).
- `disallow: "/admin"` : **oui**, posé par anticipation.

**Vérifications** :
- `npm run build` → succès. Routes générées : `/`, `/_not-found`, `/opengraph-image`, `/robots.txt`, `/sitemap.xml` — toutes **statiques**. L'augmentation du nombre de routes est attendue, ce n'est pas une régression du « 5/5 » précédent.
- `curl -s localhost:3000/sitemap.xml` → XML valide, **une seule entrée** `<loc>https://portfolio.doshwork.com</loc>` avec `lastmod`, `changefreq: monthly`, `priority: 1`.
- `curl -s localhost:3000/robots.txt` → `User-Agent: *` / `Allow: /` / `Disallow: /admin` / `Sitemap: https://portfolio.doshwork.com/sitemap.xml`.
- `curl -sI localhost:3000/opengraph-image` → `HTTP/1.1 200 OK`, `content-type: image/png`.
- `file og.png` → `PNG image data, **1200 x 630**, 8-bit/color RGBA`.
- Balises OG présentes : `og:title`, `og:description`, `og:url`, `og:site_name`, `og:locale` (`fr_FR`), `og:type` (`website`), `og:image` + `og:image:width` (1200) + `og:image:height` (630) + `og:image:alt` + `og:image:type`.
- Balises Twitter présentes : `twitter:card` = **`summary_large_image`**, `twitter:title`, `twitter:description`, `twitter:image` (+ width/height/alt/type).
- Image OG **inspectée visuellement** : dégradé emerald→sky correctement appliqué au texte, accents français rendus, hiérarchie lisible même réduite à ~300 px.
- `git status | grep -i env` → **aucun `.env`** créé ni committé.
- `npx tsc --noEmit` → 0 erreur · `npm run lint` → aucun nouveau warning

### Completion Notes List

- **AC1 satisfait** : `metadataBase` défini via `new URL(siteUrl)` (objet `URL`, pas une chaîne). Bloc `openGraph` complet (titre, description, type, locale, siteName, url) et bloc `twitter` en `summary_large_image`. Le titre et la description ont été réécrits pour un lectorat recruteur : la mention « Portfolio 2024 » (périmée) et l'énumération de la stack technique ont disparu.
- **AC2 satisfait** : `src/app/opengraph-image.tsx` génère l'image via `ImageResponse` (`next/og`, inclus dans Next 14 — **aucune dépendance ajoutée**). Styles **inline uniquement** (Satori ne compile pas Tailwind), `display: flex` explicite sur chaque conteneur. Next renseigne automatiquement `og:image` et `twitter:image` à partir de ce fichier.
- **AC3 satisfait** : `sitemap.ts` et `robots.ts` répondent tous deux avec un contenu valide. Le sitemap ne contient **qu'une entrée** — le site est une page unique à sections ancrées ; les ancres (`#projects`, `#parcours`, `#about`, `#contact`) ne sont pas des URL distinctes et n'ont pas leur place dans un sitemap. Aucune URL inventée.
- **AC4 satisfaite — déjà, sans modification** : `src/app/favicon.ico` a été converti et **inspecté visuellement**. Il s'agit d'un **triangle blanc dans un disque noir**, donc bien une icône propre au portfolio et **non** le logo Next.js par défaut (un « N » stylisé). Conformément à la consigne, le fichier n'a **pas** été touché et aucune icône n'a été générée.
- **Bascule Epic 2 gratuite** : les trois fichiers lisent `process.env.NEXT_PUBLIC_SITE_URL` avec `https://portfolio.doshwork.com` en repli. La story 2.6 n'aura qu'à définir la variable d'environnement, sans retoucher une ligne de code. Aucun `.env` n'a été créé (la valeur par défaut suffit).
- ⚠️ **Validation reportée** : LinkedIn Post Inspector et Twitter Card Validator **exigent une URL publique** et sont donc intestables depuis `localhost`. La validation réelle des aperçus sociaux devra être refaite **après le déploiement (Epic 2)**. Tout ce qui est vérifiable en local l'a été (routes, en-têtes, balises, dimensions et rendu de l'image).
- ✅ **Favicon inspecté visuellement** (converti en PNG et affiché) : il s'agit d'un **triangle blanc dans un disque noir**, une icône propre au portfolio, distincte du logo Next.js par défaut (un « N » stylisé). **AC4 satisfaite sans modification** — le fichier n'a pas été touché.

### File List

- `src/app/layout.tsx` (modifié)
- `src/app/sitemap.ts` (créé)
- `src/app/robots.ts` (créé)
- `src/app/opengraph-image.tsx` (créé)

### Change Log

- 2026-07-21 — Enrichissement des métadonnées (metadataBase, OpenGraph, Twitter card), création du sitemap, du robots.txt et de l'image de partage générée ; favicon existant constaté déjà personnalisé (Story 1.10).
