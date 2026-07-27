---
baseline_commit: 5c22f3a6c48914801d0a226ab5a0b15c005d8765
---

# Story 5.13: Gérer ma bibliothèque d'images

Status: review

## Story

As **Jeevons**,
I want **voir et nettoyer les images que j'ai téléversées**,
so that **mon stockage ne se remplisse pas de fichiers oubliés**.

## Acceptance Criteria

**AC1 — Grille avec dimensions et date**
**Given** j'ai téléversé des images
**When** j'ouvre la bibliothèque
**Then** je les vois présentées en grille, avec leurs dimensions et leur date

**AC2 — Remplacement propagé partout**
**Given** je veux corriger une image
**When** je la remplace par une autre
**Then** tous les contenus qui l'utilisaient affichent la nouvelle
**And** je n'ai pas à modifier chaque projet un par un

**AC3 — Suppression bloquée si utilisée, avec liste des usages**
**Given** une image est utilisée par un projet
**When** je tente de la supprimer
**Then** la suppression est refusée
**And** on me dit précisément quels contenus l'utilisent

**AC4 — Suppression effective (base + fichier) si inutilisée**
**Given** une image n'est utilisée nulle part
**When** je la supprime après confirmation
**Then** son enregistrement et son fichier sont tous deux supprimés

## Contexte d'implémentation

### 🛑 Prérequis : story 5.12 `done` (modèle `Media`, upload, volume)

5.12 a posé `Media`, l'upload et le service `/api/media`. 5.13 ajoute l'**écran bibliothèque** (`/admin/media`) : voir, **remplacer** (propagation), **supprimer avec garde d'intégrité**. PLAN §3.2 (`/admin/media` : grille, remplacement, suppression avec garde d'intégrité).

### 🎯 Ce que fait vraiment cette story

`/admin/media` : **grille** des `Media` (dimensions + date), **remplacement** d'une image (tous les usages pointent vers la nouvelle **sans éditer chaque projet**), **suppression** refusée si l'image est **utilisée** (avec la liste précise des usages) et effective (base **+ fichier**) si inutilisée.

### ⚠️ Piège n°1 (CENTRAL) — Détecter les usages = garde d'intégrité (AC3, AC4)

- ⚠️ À ce stade, `Media` est référencé par `Project.coverId` (5.12). D'autres références viendront : avatars du parcours (`TimelineEntry.avatarId`, 5.14), CV/vignette (5.17). La garde doit **interroger toutes les relations** pointant vers un `Media` avant de supprimer.
- ⚠️ **`avatarId`/`coverId` ne sont pas tous des relations FK Prisma** : `TimelineEntry.avatarId` est un `String?` **sans relation déclarée** (schéma 4.2 : « pas de relation ici, joint par slug »). Donc une simple contrainte FK **ne suffit pas** à détecter tous les usages → il faut une **vérification applicative explicite** (compter les `Project` où `coverId = media.id`, les `TimelineEntry` où `avatarId = media.id`, etc.). 🛑 Recenser **toutes** les colonnes référençant un média au moment de l'implémentation (au minimum `Project.coverId` ; `TimelineEntry.avatarId` si 5.14 est déjà fait). Concevoir la détection **extensible** (une fonction `findMediaUsages(mediaId)` que 5.14/5.17 complètent).
- AC3 : refus + **liste précise** des contenus utilisateurs (« utilisée par le projet X »).

### ⚠️ Piège n°2 — Remplacement sans éditer chaque contenu (AC2)

- Deux stratégies :
  - **(a)** Remplacer le **fichier** derrière le même `Media` (même `id`/`path`, nouveau contenu binaire + nouvelles dimensions/blurDataUrl) → tous les usages, qui référencent l'`id`, affichent la nouvelle image **automatiquement** (AC2). ⚠️ `Cache-Control: immutable` (5.12) : si l'URL est identique, les navigateurs peuvent servir l'ancienne. Gérer le **cache-busting** (ex. changer le `path`/nom au remplacement, ou un suffixe de version) tout en gardant les références à jour. 🛑 Trancher.
  - **(b)** Créer un nouveau `Media` et **repointer** toutes les références → plus explicite mais touche chaque relation.
  - 👉 (a) répond le mieux à « sans modifier chaque projet », à condition de gérer le cache d'URL (n°3). Réutiliser sharp (5.12) pour re-traiter la nouvelle image.

### ⚠️ Piège n°3 — Cohérence cache / revalidation

- Après remplacement/suppression → invalider les tags concernés (`revalidateTag('projects')`, et `'timeline'` si avatars) pour que le public voie la nouvelle image. ⚠️ Combiné à l'`immutable` du fichier (5.12), soigner le cache-busting d'URL (n°2).

### ⚠️ Piège n°4 — Suppression : base + fichier, atomicité (AC4)

- Supprimer un `Media` inutilisé = supprimer l'**enregistrement** ET le **fichier** du volume (AC4). ⚠️ Ordonner pour éviter les orphelins : idéalement supprimer le fichier après la ligne, en tolérant un fichier déjà absent (idempotent). Confirmation avant suppression (irréversible).
- ⚠️ Ne **jamais** supprimer un fichier encore référencé (la garde n°1 protège). Un `Media` sans fichier physique (orphelin) doit rester gérable (ne pas planter la grille).

### ⚠️ Piège n°5 — Réutiliser l'infra 5.12, pattern mutation 5.8

- Service `/api/media`, sharp, volume = 5.12 (ne pas dupliquer). Mutations = `requireAdmin` + Server Action. AuditLog = 5.19.

### ⚠️ Piège n°6 — Vérification locale

- Uploader 2-3 images (5.12) → grille avec dimensions+date (AC1). Associer une image à un projet, tenter de la supprimer → **refus** + « utilisée par <projet> » (AC3). Remplacer cette image → le projet affiche la **nouvelle** sans édition, cache rafraîchi (AC2). Supprimer une image **non** utilisée (confirmation) → ligne **et** fichier disparus (AC4).

## Tasks / Subtasks

- [x] **Tâche 0 — Prérequis** (AC: 1)
  - [x] 5.12 `done` (Media, upload, volume, /api/media).
- [x] **Tâche 1 — Grille** (AC: 1)
  - [x] `/admin/media` : liste `Media` (miniature, dimensions, date).
- [x] **Tâche 2 — Détection des usages** (AC: 3 ; piège n°1)
  - [x] `findMediaUsages(mediaId)` extensible (Project.coverId ; TimelineEntry.avatarId si présent). Refus + liste précise.
- [x] **Tâche 3 — Remplacement propagé** (AC: 2 ; pièges n°2, 3)
  - [x] Re-traitement sharp ; usages à jour sans édition ; cache-busting + `revalidateTag`.
- [x] **Tâche 4 — Suppression gardée** (AC: 3, 4 ; piège n°4)
  - [x] Refus si utilisée ; sinon confirmation → suppression base + fichier (idempotent).
- [x] **Tâche 5 — Vérification locale** (AC: 1-4 ; piège n°6)
  - [x] Grille ; refus si utilisée + liste ; remplacement propagé ; suppression base+fichier.
- [x] **Tâche 6 — Definition of Done** (AGENTS.md §8)
  - [x] lint 0 / tsc 0 / build OK. ⏳ Vérification VISUELLE par Jeevons. `git diff DEV` : écran média, usages, remplacement, suppression — rien d'autre.
  - [x] `File List` + `Completion Notes` + `Change Log` · `sprint-status.yaml`.

## Dev Notes

### Périmètre — verrouillé

**Bibliothèque `/admin/media` : grille (dimensions/date), remplacement propagé à tous les usages, suppression bloquée si l'image est utilisée (liste des usages) et effective (base + fichier) si inutilisée.**

**Hors périmètre — ne pas faire :**
- ❌ **Upload / traitement image / route de service** → 5.12 (réutiliser).
- ❌ **Avatars parcours / CV** → 5.14 / 5.17 (compléteront `findMediaUsages`).
- ❌ **AuditLog** → 5.19.
- ❌ **Nouvelle dépendance**.

### Le vrai enjeu

La **garde d'intégrité** est le cœur : supprimer une image utilisée casserait des projets. Le piège subtil est que tous les usages ne sont **pas** des FK Prisma (`TimelineEntry.avatarId` est un `String?` sans relation, décision 4.2) → il faut une détection **applicative explicite** et **extensible** (5.14/5.17 s'y greffent). Le remplacement doit propager **sans éditer chaque contenu**, ce qui bute sur le cache `immutable` de 5.12 (cache-busting à gérer).

### Testing standards

Vérification **manuelle en local** + visuelle. Les 4 AC dont refus avec liste d'usages (AC3) et suppression base+fichier (AC4). tsc/lint/build verts.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.13]
- [Source: PLAN_REFONTE_2026.md §3.2 — `/admin/media` : grille, remplacement, suppression avec garde d'intégrité]
- [Source: _bmad-output/implementation-artifacts/5-12-illustrer-mes-projets.md — modèle Media, upload sharp, volume, route `/api/media` (`immutable`)]
- [Source: apps/web/prisma/schema.prisma — Project.coverId (relation) ; TimelineEntry.avatarId (String? SANS relation, décision 4.2 → détection applicative)]
- [Source: _bmad-output/implementation-artifacts/5-8-gerer-mes-projets.md — pattern mutation `requireAdmin` + revalidateTag]
- [Source: AGENTS.md §6 — sécurité, a11y ; §9 — anti-scope-creep]

## Dev Agent Record

### Context Reference

- Story 5.12 (`review`) : modèle `Media`, `processUploadedImage` (sharp), volume `/app/uploads`, route de service `/api/media/[...path]` (`Cache-Control: immutable`).
- Story 5.8 : pattern de mutation `requireAdmin` → validation → écriture → `revalidateTag`.

### Completion Notes

**Garde d'intégrité (AC3, AC4) — le cœur de la story.**
`src/lib/media/usages.ts` centralise la détection : `findMediaUsages(id)` (unitaire, appelée au moment de supprimer) et `findAllMediaUsages()` (une passe pour toute la grille, évite le N+1). Détection **applicative** et non par clés étrangères, pour une raison décisive : `Project.coverId` est déclaré `onDelete: SetNull` — la base **accepterait** la suppression et **viderait silencieusement** la couverture des projets publiés ; et `TimelineEntry.avatarId` est un `String?` **sans relation** (décision 4.2), donc protégé par rien du tout. S'en remettre au schéma laissait passer les deux cas.

La vérification est **refaite côté serveur au moment de la suppression**, jamais reprise de ce que l'écran a affiché : une Server Action est un endpoint POST atteignable directement, et l'association a pu changer entre l'affichage et le clic. Le bouton désactivé côté client n'est qu'un confort.

Point d'extension **unique** documenté pour 5.14 (avatars) et 5.17 (CV). `TimelineEntry.avatarId` est déjà testé alors même que 5.14 n'existe pas : la colonne est renseignable par le seed, attendre aurait laissé un angle mort.

**Remplacement propagé (AC2) — même `id`, nouveau `path`.**
`replaceMedia()` conserve le `Media.id`, donc **tous les usages suivent automatiquement** — « je n'ai pas à modifier chaque projet un par un ». Mais le `path` change, et c'est indispensable : la route de service pose `Cache-Control: immutable` sur un an (5.12), donc réécrire sous le même chemin laisserait les navigateurs sur l'ancienne image jusqu'à un an malgré une base à jour. Un chemin neuf contourne le cache **par construction** plutôt que par un paramètre de version qu'un intermédiaire pourrait ignorer. `alt` est **volontairement préservé** (remplacer le fichier ne change pas ce que l'image représente). Dimensions et `blurDataUrl` sont recalculés, sinon la mauvaise place serait réservée et la page sauterait.

**Ordres d'opérations (AC4).** Remplacement : fichier écrit → base → **ancien fichier supprimé en dernier** (un échec laisse un résidu, jamais une image cassée). Suppression : **base d'abord**, fichier ensuite, même raisonnement. `deleteMediaFile` est idempotent (ENOENT ignoré) : une ligne dont le fichier a déjà disparu reste supprimable.

**Fichier manquant (AC1).** `mediaFileExists()` compare base et volume. Une image dont le fichier a disparu reste **affichée et signalée**, jamais masquée : cet écran est le seul endroit d'où Jeevons peut la réparer (remplacer) ou la nettoyer (supprimer). La faire disparaître rendrait l'incohérence invisible **et** irréparable.

**Texte alternatif — l'AC3 de la story 5.12 est fermé ici.** 5.12 demandait le texte au téléversement et signalait son absence, mais aucun écran ne permettait de le **corriger** après coup ; le sélecteur de couverture renvoyait explicitement vers « la bibliothèque d'images ». C'est fait.

**Découpage Server Action / route API.** Le remplacement transporte un fichier → route `POST /api/admin/media/[id]` (même raison qu'en 5.12). Suppression et texte alternatif → Server Actions. `revalidateTag('projects'|'timeline')` après remplacement (les projets publiés changent d'image) et après édition du `alt` (rendu sur les cartes publiques). Pas d'invalidation au téléversement en 5.12 : une image neuve n'illustre encore rien.

**Un correctif de qualité en cours de route.** Le premier jet fermait le formulaire de description depuis un `useEffect`, ce que `react-hooks/set-state-in-effect` a signalé à juste titre : `useActionState` conserve son résultat tant que le composant est monté, donc un `status: "success"` figé empêchait toute réouverture. Le formulaire est devenu un sous-composant (`AltForm`) que la fermeture **démonte** — l'état d'action repart à zéro par construction, sans état de synchronisation.

**Vérifications exécutées** (conteneur de dev, base et volume réels) :
- chaîne complète : création → association à un projet → **refus de suppression avec le projet nommé** → remplacement (même `id`, `path` changé, `alt` préservé, ancien fichier effacé, le projet pointe toujours dessus) → détachement → suppression effective base **et** fichier ;
- les **vraies fonctions du code** (`findMediaUsages`, `findAllMediaUsages`, `usagesRefusalMessage`, `mediaFileExists`) exécutées directement : les deux recensements concordent, le message nomme précisément le projet ;
- gardes HTTP : `POST /api/admin/media/[id]` sans session → **401**, `/admin/media` → **307** vers la connexion ;
- fichiers de sonde et médias de test retirés du volume.

`bunx tsc --noEmit` 0 erreur · `bun run lint` 0 erreur (seul subsiste l'avertissement préexistant `TestimonialsClient.tsx:78`, identique sur `DEV`) · `bun run build` OK, `/` conserve `○ 1h` (ISR de 4.4 intacte).

**⏳ Reste la vérification VISUELLE par Jeevons**, ainsi que le commit et le `git push` (AGENTS.md : déclenchés par l'humain).

### File List

**Créés**
- `apps/web/src/app/(admin)/admin/media/page.tsx` — grille (AC1)
- `apps/web/src/app/(admin)/admin/media/media-card.tsx` — carte : remplacer / décrire / supprimer
- `apps/web/src/app/(admin)/admin/media/actions.ts` — Server Actions suppression + texte alternatif
- `apps/web/src/app/api/admin/media/[id]/route.ts` — remplacement de fichier (AC2)
- `apps/web/src/lib/admin/media.ts` — lecture d'écran (médias + usages + présence fichier)
- `apps/web/src/lib/media/usages.ts` — garde d'intégrité (AC3, AC4)

**Modifiés**
- `apps/web/src/lib/media/index.ts` — `replaceMedia()`, `deleteMedia()`
- `apps/web/src/lib/media/storage.ts` — `mediaFileExists()`
- `apps/web/src/components/admin/admin-nav.tsx` — entrée « Médias » activée

### Change Log

- Bibliothèque `/admin/media` : grille avec miniature, dimensions et date (AC1).
- Détection applicative et extensible des usages ; suppression refusée avec la liste précise des contenus concernés (AC3).
- Remplacement conservant l'identifiant et propagé à tous les usages, avec contournement du cache `immutable` par changement de chemin (AC2).
- Suppression gardée, confirmée, effective en base et sur le volume (AC4).
- Édition du texte alternatif : ferme l'AC3 de la story 5.12.
- Signalement des images dont le fichier a disparu du volume.
