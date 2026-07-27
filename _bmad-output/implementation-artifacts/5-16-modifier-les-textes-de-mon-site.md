---
baseline_commit: 5c22f3a6c48914801d0a226ab5a0b15c005d8765
---

# Story 5.16: Modifier les textes de mon site

Status: review

## Story

As **Jeevons**,
I want **changer mon accroche, mon statut et mes coordonnées depuis l'administration**,
so that **je n'aie plus jamais un texte périmé sur mon portfolio**.

## Acceptance Criteria

**AC1 — Écran de réglages éditable**
**Given** je suis sur l'écran des réglages
**When** la page s'affiche
**Then** je peux modifier le titre et le sous-titre de l'accroche, le badge de statut, mes coordonnées et mes liens sociaux

**AC2 — Modification reflétée côté public après revalidation**
**Given** j'enregistre une modification
**When** la revalidation s'effectue
**Then** le site public affiche le nouveau texte

**AC3 — Validation serveur des liens/adresses**
**Given** je saisis un lien ou une adresse mal formée
**When** j'enregistre
**Then** la saisie est refusée avec une explication
**And** la validation est appliquée côté serveur

**AC4 — Correction sans commit ni redéploiement**
**Given** ce sont ces textes qui étaient périmés avant l'Epic 1
**When** j'utilise cet écran
**Then** je peux corriger chacun d'eux sans commit ni redéploiement

## Contexte d'implémentation

### 🛑 Prérequis : socle sécurité + Epic 4 (`SiteSetting` servi côté public) `done`

Le modèle **`SiteSetting`** (key @id, value Json) existe déjà et **alimente le public** (story 4.x « servir réglages depuis la DB »). 5.16 ajoute l'**écran d'édition** `/admin/settings`. PLAN §3.2 (`/admin/settings` : réglages du site) et §3.3 (revalidation ciblée).

### 🎯 Ce que fait vraiment cette story

`/admin/settings` : **formulaire** éditant les clés `SiteSetting` (accroche titre/sous-titre, badge de statut, coordonnées, liens sociaux), **validation serveur** (Zod : URL/email bien formés), **enregistrement** → `revalidateTag('settings')` → public à jour. La finalité (« plus jamais de texte périmé », AC4) : tout se corrige **sans commit ni redéploiement**.

### ⚠️ Piège n°1 (CENTRAL) — `SiteSetting.value` est du **JSON** (key @id) — préserver la forme exacte

- ⚠️ Schéma : `SiteSetting { key @id, value Json }`. C'est un **magasin clé→JSON**, pas des colonnes typées. Le **public lit ces clés avec une forme précise** (`settings.ts`, Epic 4). 🛑 **Recenser d'abord les clés et leurs formes exactes** telles que le seed les écrit et que le public les lit (ex. `hero` = `{ title, subtitle }`, `status` = `{...}`, `contacts` = `{ email, phone? }`, `social` = `[{ label, url }]` — **à vérifier dans le seed et `settings.ts`**, ne pas deviner). L'écran doit **réécrire la même structure** sous peine de casser le rendu public.
- ⚠️ Chaque champ du formulaire mappe une **portion** d'une clé JSON. Valider **par clé** avec un **schéma Zod dédié** reflétant la forme lue par le public.

### ⚠️ Piège n°2 — Validation serveur URL/email (AC3)

- ❌ Validation navigateur contournable → **Zod côté serveur** : liens sociaux = URL valides (`z.string().url()`), email = `z.string().email()`, téléphone = format toléré. Refus **explicite** par champ (AC3). Cohérent avec l'exigence « validation serveur » de tout Epic 5.

### ⚠️ Piège n°3 — Revalidation ciblée `settings` (AC2)

- Après enregistrement → `revalidateTag('settings')` (le tag couvre les `SiteSetting`, décision Epic 4). ⚠️ Vérifier **où** ces textes sont rendus côté public (hero, badge de statut, footer/contacts, liens sociaux) pour confirmer que `settings` invalide bien toutes ces surfaces. AC2 : nouveau texte visible après revalidation.

### ⚠️ Piège n°4 — Cohérence fallback statique (Epic 4)

- ⚠️ Le repli statique (`src/content/*.ts`, 4.5) sert de secours si la DB est injoignable. L'édition modifie la **DB** ; le fallback reste la **valeur historique**. Ne pas casser `readWithFallback`. (Ne pas chercher à réécrire le fichier de fallback — hors périmètre.)

### ⚠️ Piège n°5 — Upsert par clé + pattern mutation 5.8

- Les clés peuvent **exister ou non** en base → **upsert** par `key`. `requireAdmin` + Server Action + Zod par clé + `revalidateTag('settings')`. Lectures admin dédiées (lire toutes les clés éditables, non caché). AuditLog = 5.19.
- ⚠️ **Le CV n'est pas ici** : la story 5.17 (upload PDF) est distincte, même si l'écran est aussi « réglages ». Ne gérer que **textes/liens/coordonnées** ici.

### ⚠️ Piège n°6 — Vérification locale

- Ouvrir `/admin/settings` → tous les champs (accroche titre+sous-titre, statut, coordonnées, liens sociaux) éditables (AC1). Saisir une **URL/email invalide** → refus serveur explicite (AC3). Enregistrer une correction valide → **home publique** à jour après revalidation (AC2). Confirmer qu'aucun **commit/redéploiement** n'est requis (AC4). Vérifier que la **forme JSON** relue par le public est intacte (pas de rendu cassé).

## Tasks / Subtasks

- [x] **Tâche 0 — Prérequis & recensement des clés** (AC: 1 ; piège n°1)
  - [x] Socle `done`. Recenser clés `SiteSetting` + formes JSON exactes (seed + `settings.ts`).
- [x] **Tâche 1 — Formulaire réglages** (AC: 1 ; pièges n°1, 5)
  - [x] `/admin/settings` : champs accroche/statut/coordonnées/social ; lecture admin de toutes les clés éditables.
- [x] **Tâche 2 — Validation + enregistrement** (AC: 2, 3 ; pièges n°2, 3, 5)
  - [x] Zod serveur (URL/email) par clé ; upsert par `key` ; `revalidateTag('settings')`.
- [x] **Tâche 3 — Vérification locale** (AC: 1-4 ; piège n°6)
  - [x] Édition complète, refus URL/email invalide (serveur), public à jour, forme JSON préservée, sans commit/redeploy.
- [x] **Tâche 4 — Definition of Done** (AGENTS.md §8)
  - [x] lint 0 / tsc 0 / build OK. `git diff DEV` : écran settings, Zod, upsert, revalidation `settings` — rien d'autre (pas le CV).
  - [ ] Vérif **visuelle + clavier** en session authentifiée (à faire par Jeevons — voir Completion Notes).
  - [x] `File List` + `Completion Notes` + `Change Log` · `sprint-status.yaml`.

## Dev Notes

### Périmètre — verrouillé

**Écran `/admin/settings` éditant les clés texte de `SiteSetting` (accroche titre/sous-titre, badge de statut, coordonnées, liens sociaux) ; validation serveur (URL/email) ; upsert par `key` ; revalidateTag('settings') ; correction sans commit ni redéploiement.**

**Hors périmètre — ne pas faire :**
- ❌ **CV (upload PDF + vignette)** → 5.17.
- ❌ **Réécrire le fallback statique `src/content/*.ts`** (4.5).
- ❌ **Changer le schéma `SiteSetting`** (key/value Json existant).
- ❌ **AuditLog** → 5.19.
- ❌ **Nouvelle dépendance**.

### Le vrai enjeu

`SiteSetting.value` est du **JSON par clé**, pas des colonnes : l'écran doit **réécrire exactement la forme** que le public lit (`settings.ts`/seed), sinon le rendu casse — d'où le recensement préalable et des schémas Zod **par clé**. La **validation serveur** des URL/email (AC3) est non contournable. Toute correction se fait **sans commit ni redéploiement** (AC4, la raison d'être de l'admin). Le CV, bien que « réglage », est traité séparément (5.17).

### Testing standards

Vérification **manuelle en local** + visuelle. Les 4 AC dont refus serveur d'URL/email (AC3) et préservation de la forme JSON. tsc/lint/build verts.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.16]
- [Source: PLAN_REFONTE_2026.md §3.2 — `/admin/settings` réglages du site ; §3.3 — revalidation ciblée]
- [Source: apps/web/prisma/schema.prisma — SiteSetting (key @id, value Json)]
- [Source: apps/web/src/lib/settings.ts — lecture publique des clés (formes JSON à préserver) ; apps/web/src/lib/cache-tags.ts — tag `settings` ; apps/web/src/lib/read-with-fallback.ts + src/content/*.ts — repli statique (4.5)]
- [Source: _bmad-output/implementation-artifacts/5-8-gerer-mes-projets.md — pattern mutation requireAdmin + revalidateTag]
- [Source: AGENTS.md §6 — validation serveur, a11y ; §9 — anti-scope-creep]

## Dev Agent Record

### Tâche 0 — Recensement des clés (le résultat contredit le texte de la story)

Le piège n°1 demandait de **recenser d'abord, ne pas deviner**, en citant comme hypothèses `hero = { title, subtitle }`, `contacts = { email, phone? }`, `social = [{ label, url }]`. **Aucune de ces formes n'existe.** Relevé dans `lib/settings.ts` (`SETTING_KEYS` + les trois lecteurs typés), dans `content/settings.ts` (le seed), puis **confirmé contre la base de développement** :

| Clé | Forme réelle en base | Lue par |
|---|---|---|
| `hero.title` | chaîne nue | `getHeroSettings` → `Hero.tsx` |
| `hero.subtitle` | chaîne nue | idem |
| `hero.statusBadge` | chaîne nue | idem |
| `social.twitter` | chaîne nue | `getSocialSettings` → `Footer.tsx` |
| `social.instagram` | chaîne nue | idem |
| `social.linkedin` | chaîne nue | idem |
| `social.github` | chaîne nue | idem |
| `contact.linkedin` | chaîne nue | `getContactSettings` → `Contact.tsx` |
| `contact.email` | `{ user: string[], host: string[] }` | idem |

Ce sont donc **neuf clés PLATES et pointées**, pas des objets composés : `readString` lit `hero.title` directement, il ne lit jamais `hero` pour en extraire `.title`. Il n'y a **ni téléphone, ni tableau de liens sociaux** — les quatre réseaux sont quatre clés distinctes. Regrouper aurait cassé le rendu public **en silence** (voir D2).

### Décisions

**D1 — E-mail : saisie entière, stockage fragmenté (décision Jeevons).** `contact.email` est la seule clé structurée, et sa forme est imposée par une protection **anti-moisson** héritée de l'Epic 1 : la chaîne complète n'apparaît jamais dans le HTML servi, `ContactClient.tsx` ne la recompose qu'au clic (`user.join(".") + "@" + host.join(".")`). Le formulaire propose donc **un champ e-mail normal**, et le serveur découpe avant écriture (`toFragmentedEmail`, exact inverse du `join(".")` public). La protection est intégralement préservée : elle vit dans le **rendu public**, pas dans la saisie admin, qui est derrière `requireAdmin` et qu'aucun robot n'atteint. Deux champs séparés n'auraient rien protégé de plus, tout en offrant un moyen de casser la forme JSON par inadvertance. Aller-retour vérifié à l'identique.

**D2 — La forme JSON est le vrai danger, et il est SILENCIEUX.** Écrire un objet là où le public attend une chaîne ne lève **aucune erreur** : `readString` ne reconnaît pas la valeur, retombe sur `SETTING_DEFAULTS`, et le texte saisi disparaît sans un mot. C'est la raison d'être du recensement, et pourquoi `actions.ts` construit explicitement ses neuf entrées à partir de `SETTING_KEYS` plutôt que d'itérer sur des noms de champs.

**D3 — `SETTING_KEYS` et `SETTING_DEFAULTS` réutilisés, jamais recopiés.** La lecture admin importe les constantes de `lib/settings.ts`. Les redéclarer aurait créé deux sources de vérité pour les mêmes clés, et la première divergence aurait cassé le public sans que rien ne l'annonce. À noter : `settings.ts` porte déjà une **garde de cohérence au chargement** (4.5) entre `SETTING_DEFAULTS` et le repli statique — elle continue de protéger, cette story n'y touche pas.

**D4 — URL : protocole restreint à http/https, aucun domaine imposé (décision Jeevons).** `z.url()` seul accepte `javascript:alert(1)` — une URL syntaxiquement valide qui atterrirait dans un `href` du site public, soit une porte ouverte au XSS. La validation passe donc par `new URL()` + contrôle du protocole. En revanche **aucun domaine attendu par réseau** : contraindre `social.github` à pointer vers github.com casserait à la moindre migration de domaine (X/Twitter en est l'exemple récent) et interdirait un lien de redirection ou un domaine perso.

**D5 — Transaction, ici justifiée.** Contrairement à 5.15 (écriture unique, où une transaction n'aurait rien protégé), ce sont **neuf écritures**. Sans transaction, une panne au milieu laisserait le site avec une accroche à jour et des liens périmés — un état incohérent, invisible depuis l'écran.

**D6 — `upsert`, pas `update` (piège n°5).** Une clé peut ne pas exister : le public s'en accommode en retombant sur son défaut, donc rien ne garantit que la ligne ait déjà été écrite. Un `update` échouerait en P2025 sur une base fraîche ou partiellement seedée. Vérifié : l'upsert sur une clé absente la crée.

**D7 — Base injoignable : le formulaire n'est PAS affiché.** Ailleurs dans l'admin, une panne DB affiche un bandeau au-dessus d'une liste vide. Ici ce serait **dangereux** : le formulaire se pré-remplirait des valeurs par défaut, et enregistrer **écraserait les vrais textes** par ces défauts. L'écran affiche donc l'alerte **à la place** du formulaire.

**D8 — `<fieldset>`/`<legend>` par groupe.** Cet écran porte **deux champs libellés « LinkedIn »** (pied de page et contact). Le groupe étant annoncé avec le champ, les lecteurs d'écran les distinguent au lieu d'énoncer deux fois le même libellé.

### Vérifications

Sonde temporaire exécutée contre la base de développement, puis supprimée. L'état initial a été **restauré** (les deux clés modifiées ont été réécrites à leur valeur d'origine, la clé de test supprimée) — vérifié par relecture.

| AC | Ce qui a été vérifié | Résultat |
|---|---|---|
| AC1 | Les 9 clés éditables sont lues et pré-remplies | Formes réelles conformes au recensement |
| AC3 | `github.com/Jeevons` (sans protocole) | Refusé : « doit être un lien complet commençant par https:// » |
| AC3 | `javascript:alert(1)` | **Refusé** (le contrôle de protocole fait son travail) |
| AC3 | `ftp://exemple.fr` | Refusé |
| AC3 | `pasunemail`, `jeevons@localhost` | Refusés : « Saisissez une adresse e-mail valide » |
| AC3 | Titre composé d'espaces | Refusé : « Le titre de l'accroche est obligatoire » |
| AC3 | Saisie entièrement valide | Acceptée |
| Piège n°1 | Aller-retour e-mail `jeevons.eya.jr@gmail.com` | Fragmenté puis recomposé **à l'identique** |
| Piège n°5 | `upsert` sur une clé absente | Créée, pas d'échec |
| AC2 | Écriture réelle par transaction puis relecture | Formes JSON préservées (chaîne nue / objet fragmenté) |
| Piège n°3 | Surfaces publiques couvertes par le tag `settings` | Hero, Footer, Contact — les 3 passent par `loadSettings()` |
| DoD | `bunx tsc --noEmit` | 0 erreur |
| DoD | `bun run lint` | 0 erreur, 1 warning **préexistant** (`TestimonialsClient.tsx`, hors périmètre) |
| DoD | `bun run build` | Succès ; `/admin/settings` rendue dynamique (ƒ), `/admin/settings/security` intacte |

### Completion Notes

**Reste à faire par Jeevons avant `done` :** la vérification **visuelle et clavier** en session authentifiée (mot de passe + TOTP) n'a pas pu être menée. La case correspondante de la tâche 4 est laissée **décochée**, à dessein. Points à regarder : parcours au clavier des neuf champs, annonce des groupes `<fieldset>` (notamment les deux champs « LinkedIn »), et affichage des messages d'erreur sous le champ fautif après un refus serveur.

**AC4 — la finalité est atteinte.** Les neuf textes qui étaient périmés avant l'Epic 1 se corrigent désormais depuis l'écran, avec effet immédiat sur le site public : `revalidateTag('settings', { expire: 0 })` couvre les trois surfaces (Hero, Footer, Contact) en une invalidation, puisqu'elles lisent toutes via `loadSettings()`. Aucun commit ni redéploiement.

**Non fait, volontairement :** le **CV** (upload PDF + vignette) reste la story 5.17, bien que l'écran s'appelle aussi « réglages » ; le **repli statique** `src/content/settings.ts` n'a pas été réécrit (4.5, hors périmètre) — il conserve les valeurs historiques, ce qui est son rôle : il ne sert que si la base est injoignable ; le schéma `SiteSetting` est inchangé ; aucun `AuditLog` (story 5.19) ; aucune dépendance ajoutée.

**À savoir :** le repli statique et la base peuvent désormais **diverger** — c'est normal et voulu. Après une modification depuis l'écran, une panne de base ferait réafficher les textes d'origine plutôt que les nouveaux. C'est le contrat de 4.5 (mieux vaut un texte ancien qu'une page vide), pas une régression.

### File List

**Créés**
- `apps/web/src/lib/schemas/settings.ts` — schéma Zod partagé client/serveur (URL http(s), e-mail, fragmentation)
- `apps/web/src/lib/admin/settings.ts` — lecture admin non cachée des 9 clés éditables
- `apps/web/src/app/(admin)/admin/settings/actions.ts` — Server Action (validation + upsert transactionnel + revalidation)
- `apps/web/src/app/(admin)/admin/settings/settings-form.tsx` — formulaire groupé par thème
- `apps/web/src/app/(admin)/admin/settings/page.tsx` — écran des réglages

**Modifiés**
- `apps/web/src/components/admin/admin-nav.tsx` — entrée « Réglages » passée à `ready: true`
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — statut de la story

**Non modifiés (et c'est un résultat)** : aucune section publique, aucun fichier de repli, aucun schéma Prisma. Le socle Epic 4 servait déjà ces clés au public — contrairement à 5.15, où la surface publique n'était pas branchée.

### Change Log

| Date | Description |
|---|---|
| 2026-07-26 | Story 5.16 implémentée : écran `/admin/settings` éditant les 9 clés texte de `SiteSetting` (accroche, badge de statut, 4 liens sociaux, coordonnées), validation serveur des URL (http/https uniquement) et de l'e-mail, upsert transactionnel par clé préservant les formes JSON lues par le public, et `revalidateTag('settings')` couvrant Hero/Footer/Contact. Statut → `review`. |
