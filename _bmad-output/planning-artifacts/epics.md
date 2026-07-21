---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - PLAN_REFONTE_2026.md
  - src/ (code source actuel — vérification des dettes D1 à D14)
  - README.md
---

# jeevonsPortoflio-2024 - Epic Breakdown

## Overview

Ce document fournit le découpage complet en epics et stories de la refonte 2026 du portfolio, en décomposant les exigences de `PLAN_REFONTE_2026.md` (qui tient lieu de PRD, d'Architecture et de contrat UX) en stories implémentables.

**Note de provenance** : ce projet n'a ni PRD ni document d'architecture séparés. `PLAN_REFONTE_2026.md` est la source unique : ses §1 et §3-4 fournissent les exigences fonctionnelles, ses §2, §5 et §9-10 l'architecture technique, ses §4.1-4.4 le contrat UX. Le code source `src/` a été scanné pour ancrer les exigences de dette technique sur des fichiers et lignes vérifiés.

## Requirements Inventory

### Functional Requirements

**Contenu piloté par la donnée (§2.1, §3)**

FR1: Le site doit servir le contenu des projets, du parcours, des stacks et des réglages depuis une base Postgres via Prisma, et non depuis des constantes codées en dur dans les composants.
FR2: Le système doit exposer un back-office `/admin` protégé par authentification, accessible uniquement à l'administrateur unique.
FR3: L'administrateur doit pouvoir créer, lire, modifier et supprimer des projets (slug, catégorie FLAGSHIP/PERSONAL/LAB, entreprise, titre, description, période, lien, dépôt).
FR4: L'administrateur doit pouvoir réordonner les projets par glisser-déposer, l'ordre étant persisté dans `sortOrder`.
FR5: L'administrateur doit pouvoir gérer des highlights répétables rattachés à un projet, eux-mêmes ordonnables.
FR6: L'administrateur doit pouvoir associer des stacks à un projet via un sélecteur multiple.
FR7: L'administrateur doit pouvoir marquer un projet comme brouillon ou publié ; les brouillons ne sont visibles que dans une session admin via `?preview=1`.
FR8: L'administrateur doit pouvoir téléverser une image de couverture en glisser-déposer, convertie automatiquement en WebP avec génération d'un `blurDataUrl`.
FR9: L'éditeur de projet doit afficher un aperçu live de la carte projet à droite du formulaire, reflétant les saisies en temps réel.
FR10: L'administrateur doit pouvoir gérer le CRUD des entrées de parcours (TimelineEntry) selon le même patron que les projets.
FR11: L'administrateur doit pouvoir gérer le CRUD des stacks, avec clé d'icône et niveau de maîtrise (LEARNING/COMFORTABLE/STRONG).
FR12: L'administrateur doit pouvoir modifier les réglages du site (titre et sous-titre du Hero, badge de statut, coordonnées, liens sociaux) stockés dans `SiteSetting`.
FR13: L'administrateur doit pouvoir téléverser un nouveau CV au format PDF, avec génération automatique de sa vignette.
FR14: Le tableau de bord `/admin` doit afficher les compteurs de projets publiés et brouillons, les 5 derniers messages reçus, les vues sur 7 jours, et un bouton de revalidation du site.
FR15: L'administrateur doit disposer d'une bibliothèque média `/admin/media` (grille, remplacement, suppression avec garde d'intégrité empêchant de supprimer un média référencé).
FR16: Chaque mutation admin doit être enregistrée dans `AuditLog` avec l'utilisateur, l'action, l'entité, l'identifiant et le diff.

**Authentification et sécurité admin (§3.1, §9)**

FR17: L'authentification doit se faire par Auth.js v5 en Credentials provider, avec hash de mot de passe argon2id et session JWT en cookie `httpOnly` + `Secure` + `SameSite=Lax`.
FR18: Le compte administrateur unique doit être créé par un seed idempotent (`upsert`) depuis les variables `ADMIN_EMAIL` et `ADMIN_PASSWORD` ; aucune route d'inscription ne doit exister.
FR19: La double authentification TOTP doit être obligatoire : la connexion se fait en deux temps (identifiants → session partielle `mfaPending` de 5 min sans accès à `/admin/*` → code à 6 chiffres → session complète).
FR20: L'enrôlement 2FA doit présenter un QR code `otpauth://` et le secret en clair, et exiger un premier code valide avant activation.
FR21: L'enrôlement doit générer 8 codes de récupération à usage unique, affichés une seule fois et stockés hashés en argon2id.
FR22: Au premier login d'un compte seedé (`totpEnabledAt = null`), l'utilisateur doit être redirigé de force vers l'enrôlement 2FA, sans accès possible au reste de l'admin.
FR23: Un script de secours `bun run admin:reset-2fa` exécutable sur le VPS doit permettre de réinitialiser la 2FA en cas de perte du téléphone.

**Site public (§4.3)**

FR24: Le site doit exposer une page détaillée par projet à `/projects/[slug]` (contexte, rôle, stack, captures, résultats chiffrés, lien dépôt).
FR25: Le site doit exposer une page `/cv` avec viewer PDF inline et bouton de téléchargement.
FR26: Le site doit exposer un formulaire de contact fonctionnel avec honeypot, rate-limit et envoi SMTP Infomaniak, remplaçant l'affichage de l'email en clair.
FR27: Les messages du formulaire de contact doivent être persistés en `ContactMessage` et consultables dans `/admin/messages`, avec marquage lu et suppression.
FR28: Le site doit présenter une section « Stack & outils » enrichie affichant le niveau de maîtrise par techno, groupée par domaine.
FR29: Le site doit présenter une section « Chiffres » avec compteurs animés (projets livrés, technos, années de code).

**Corrections fonctionnelles (§1.4)**

FR30: L'ancre `#projects` du Header doit cibler une section unique et déterministe (aujourd'hui `id="projects"` est dupliqué entre `Projects.tsx:44` et `SelfProject.tsx:73`).
FR31: Tous les liens sortants doivent s'ouvrir dans un nouvel onglet correctement (`target="_blank"`, faute `_blanck` en `Footer.tsx:34`) et porter `rel="noopener noreferrer"`.
FR32: Les textes datés doivent être à jour : « alternance pour 2025 » (`Hero.tsx:116`), « année scolaire 2025-2026 » (`Contact.tsx:22`), « © 2024 » (`Footer.tsx:28`).
FR33: La section Testimonials doit porter un `id` et figurer dans la navigation (`Testimonials.tsx:104`, aujourd'hui sans `id`).

**Observabilité (§10)**

FR34: Le site doit intégrer le tracking Umami self-hosted, chargé conditionnellement sur présence de `NEXT_PUBLIC_UMAMI_ID` afin de ne pas polluer les stats en développement local.
FR35: Le site doit émettre des événements Umami personnalisés : `cv-download`, `project-visit` (avec slug), `contact-submit`, `social-click`.
FR36: Le système doit exposer un endpoint `/api/health` renvoyant 200 lorsque l'application est opérationnelle, consommé par le healthcheck Coolify.

### NonFunctional Requirements

**Performance (§4.4)**

NFR1: Le site doit atteindre un score Lighthouse de 95 ou plus sur les quatre catégories.
NFR2: Le LCP doit rester sous 2 secondes et le CLS sous 0,05.
NFR3: Les pages publiques doivent être statiques avec ISR (`revalidate: 3600`) ; chaque mutation admin doit déclencher `revalidateTag` sur l'étiquette concernée pour une mise à jour instantanée sans rebuild Docker.
NFR4: Les images doivent être servies en AVIF/WebP responsive avec `blurDataUrl`, et les 15 Mo d'assets morts purgés du dépôt (16 Mo mesurés dans `src/assets`, dont 7 WebP de CV à ~1,8 Mo pièce).
NFR5: Les médias téléversés doivent être servis avec `Cache-Control: immutable`.

**Accessibilité (§4.4)**

NFR6: `prefers-reduced-motion: reduce` doit désactiver la totalité des animations, y compris les 10 orbites du Hero animées en continu (aucune occurrence dans le code aujourd'hui).
NFR7: Les contrastes doivent respecter le niveau AA sur l'ensemble du site et de l'admin.
NFR8: Les indicateurs de focus doivent être visibles et la navigation clavier complète dans le back-office.
NFR9: Les landmarks ARIA doivent être correctement posés, et le HTML valide (aujourd'hui `<button>` imbriqué dans `<a>` en `Projects.tsx:88-93` et `SelfProject.tsx`).
NFR10: Un audit `@axe-core/playwright` doit s'exécuter en intégration continue et bloquer la fusion en cas de régression.

**Sécurité (§3.1, §9)**

NFR11: Le secret TOTP doit être chiffré au repos en AES-256-GCM avec une clé dérivée de `AUTH_SECRET`, de sorte qu'un dump SQL volé ne permette pas de générer des codes.
NFR12: Les tentatives d'authentification doivent être limitées à 5 par tranche de 15 minutes et par IP, sur `/api/auth/*` comme sur la vérification du code TOTP, avec verrouillage temporaire au-delà.
NFR13: La validation TOTP doit tolérer ±1 pas de 30 secondes, pas davantage, et refuser la réutilisation du dernier `counter` validé (anti-rejeu).
NFR14: Les coordonnées personnelles ne doivent plus apparaître en clair dans le HTML servi (aujourd'hui `jeevons.eya.jr@gmail.com` en `Contact.tsx:28` et `:35`).
NFR15: Le conteneur de production doit s'exécuter sous l'utilisateur non-root `nextjs:nodejs` (uid 1001).
NFR16: Aucun secret réel ne doit être versionné ; `.env.production.example` sert de checklist sans valeur.

**Résilience (§3.3)**

NFR17: Si la base est injoignable, `src/content/*.ts` doit alimenter le site en fallback statique, de sorte que le portfolio ne tombe jamais en erreur.
NFR18: Le conteneur de production doit répondre au healthcheck dans les 30 secondes suivant son démarrage (`start_period: 30s`, `interval: 15s`, `retries: 5`).

**Qualité de code (§1.4, §5.6)**

NFR19: Le dépôt doit disposer de Prettier, husky, lint-staged et commitlint en conventional commits.
NFR20: La duplication entre `Projects.tsx` et `SelfProject.tsx` (~90 % de code commun sur 109 et 137 lignes) doit être éliminée par factorisation.
NFR21: La CI doit exécuter les jobs `lint`, `build-web` et `test-e2e` sur push et PR vers `DEV` et `PROD`.

### Additional Requirements

**Socle technique (§1.1, §2)**

- Migrer vers un monorepo Bun avec `apps/web`, calqué sur Doshwork mais sans NestJS séparé : les Route Handlers Next suffisent, une seule image et un seul conteneur.
- Remplacer npm par Bun 1.3+ (parité Doshwork) ; le lockfile de référence devient `apps/web/bun.lock`.
- Monter Next.js de 14.2.5 à 16.2 et React de 18 à 19.2.
- Remplacer `framer-motion` 11 par `motion` 12, complété par les animations CSS scroll-driven.
- Ajouter shadcn/ui par-dessus TailwindCSS 3.4.
- Activer `output: 'standalone'` dans `next.config.js`, prérequis du stage `production` du Dockerfile.

**Modèle de données (§2.1, §9.1)**

- Implémenter les modèles Prisma 7 : `Project`, `Highlight`, `Stack`, `TimelineEntry`, `Hobby`, `Media`, `SiteSetting`, `ContactMessage`, `User`, `AuditLog`.
- Implémenter les enums `ProjectCategory` (FLAGSHIP/PERSONAL/LAB), `SkillLevel` (LEARNING/COMFORTABLE/STRONG), `Role` (ADMIN).
- Étendre `User` des champs 2FA : `totpSecret`, `totpEnabledAt`, `recoveryCodes`.
- Poser l'index `@@index([category, sortOrder])` sur `Project`.
- Écrire un seed idempotent alimenté depuis le contenu aujourd'hui codé en dur dans les sections.

**Conteneurisation (§5.1, §5.2, §5.3)**

- Dockerfile `apps/web` à 4 stages (`deps`, `builder`, `development`, `production`) sur base `node:22-alpine`, Bun 1.3.3 installé dans les trois premiers.
- Le stage `production` tourne sans Bun : `node server.js` sur le standalone, `HOSTNAME=0.0.0.0`, `EXPOSE 3000`.
- Ajouter `RUN apk add --no-cache vips-dev` dans `builder` pour `sharp` (spécifique au portfolio, absent de Doshwork).
- Les variables `NEXT_PUBLIC_*` passent en `ARG` puis `ENV` dans `builder`, inlinées au build.
- Pas de `HEALTHCHECK` dans l'image : délégué au compose, convention Doshwork.
- `docker-compose.yml` de développement : service `db` (postgres:16-alpine, port bindé sur `127.0.0.1:5432`, healthcheck `pg_isready`) + service `web` (target `development`, volumes source, `/app/node_modules`, `/app/.next`, `depends_on: db healthy`).
- `docker-compose.prod.yml` : service `web` seul, réseau `coolify` externe, volume nommé `portfolio_uploads:/app/uploads`, `restart: unless-stopped`.
- Les migrations Prisma (`prisma migrate deploy` + seed idempotent) s'exécutent au démarrage du conteneur.

**Infrastructure et déploiement (§5.4, §7, §8, §10)**

- Postgres mutualisé sur le service Coolify existant : bases dédiées `portfolio_prod` (user `portfolio_user`) et `umami` (user `umami_user`), coût VPS nul.
- `GRANT ALL ON SCHEMA public` obligatoire depuis Postgres 15, sans quoi la création de tables échoue.
- `DATABASE_URL` injectée en Secret Coolify avec `?schema=public` pour Prisma 7.
- Domaine `portfolio.doshwork.com` : enregistrement DNS `A` vers `89.167.90.7`, TTL 300 puis 3600 une fois stable.
- Le portfolio doit être une application Coolify distincte ; ne jamais toucher aux ressources `doshwork-api` / `doshwork-web`.
- Vérifier la propagation DNS (`dig +short`) **avant** de poser le FQDN dans Coolify, sous peine de back-off Let's Encrypt (5 échecs/heure).
- Ne supprimer le projet Vercel qu'après 48 h de production stable, en gardant le DNS Vercel en secours.
- Umami installé depuis le catalogue Coolify, base pointée par Reference Resource, `APP_SECRET` généré par `openssl rand -base64 32`, domaine `analytics.doshwork.com`, mot de passe par défaut `admin/umami` à changer immédiatement.
- `NEXT_PUBLIC_SITE_URL` est inlinée au build : tout changement de domaine impose un rebuild, pas un restart.

**Git et CI (§1.3, §5.5, §5.6)**

- Cherry-picker l'animation utile de `develop` (`Testimonials.tsx`, `SectionHeader.tsx`) sans les suppressions d'assets qui l'accompagnent.
- Renommer `Production` en `PROD` et `develop` en `DEV`, supprimer la branche morte `fix`.
- Adopter le flux `alpha/feat/*` → PR → `DEV` → PR → `PROD` (protégée, CI verte obligatoire).
- `ci.yml` avec `setup-bun@v2` (1.3) et cache `node_modules` sur `hashFiles('apps/web/bun.lock')`.
- Pas de `deploy.yml` : déploiement par webhook Coolify natif, aucun secret SSH côté GitHub.

### UX Design Requirements

**Fondations visuelles (§4.1)**

UX-DR1: Systématiser l'identité existante (fond `gray-900`, dégradé `emerald-300 → sky-400`, grain, orbites, serif Calistoga) en design tokens CSS : `--surface-*`, `--accent-from` / `--accent-to`, `--radius-*`, échelle d'espacement. L'identité actuelle est conservée, pas refondue.
UX-DR2: Structurer les tokens pour qu'un thème clair reste possible plus tard sans refonte, tout en restant **mono-thème dark** : pas de `next-themes`, pas de `@media (prefers-color-scheme)` (décision 3, annule la ligne « thème clair » de §4.1).
UX-DR3: Passe typographique : `text-wrap: balance` sur les titres, `text-wrap: pretty` sur les paragraphes, échelle de tailles fluide en `clamp()`.

**Animations P1 — impact fort, coût faible (§4.2)**

UX-DR4: Reveal au scroll généralisé via `IntersectionObserver`, avec stagger sur les cartes, remplaçant l'apparition brutale actuelle.
UX-DR5: Barre de progression de scroll en dégradé accent, fixée en haut de la fenêtre.
UX-DR6: Header adaptatif : la pill se contracte et se floute au scroll, l'item actif est surligné par scroll-spy — ce qui règle aussi D1 (ancre dupliquée) et D5 (section sans id).
UX-DR7: Magnetic buttons : les CTA suivent légèrement le curseur (~8 px de déplacement).
UX-DR8: Curseur custom sur desktop : point plus halo qui grossit au survol des éléments interactifs.

**Animations P2 — signature visuelle (§4.2)**

UX-DR9: Hero refondu : conserver les orbites en y ajoutant un parallaxe à la souris (les anneaux réagissent au pointeur).
UX-DR10: Typing effect sur le rôle dans le Hero, alternant « Développeur Full-Stack », « UI Engineer », « Créatif ».
UX-DR11: Cartes projet en tilt 3D (`rotateX`/`rotateY` au mousemove) avec spotlight radial suivant le curseur, remplaçant le `hover:scale-110` actuel.
UX-DR12: Timeline verticale animée pour le parcours : ligne qui se remplit au scroll, jalons qui s'illuminent — remplace le carrousel horizontal actuel, jugé moins lisible.
UX-DR13: Transitions de page via l'API `ViewTransition` de Next 16, pour les pages projet détaillées.
UX-DR14: Compteurs animés dans la nouvelle section « Chiffres ».

**Animations P3 — polish (§4.2)**

UX-DR15: Bento grid pour la section À propos, en généralisant le patron de la carte hobbies draggable existante.
UX-DR16: Marquee de la section Tape piloté par la vitesse de scroll : accélère et s'inverse selon la direction.
UX-DR17: Fond noise + aurora animé en CSS pur, en prolongement du `grain.jpg` déjà en place.
UX-DR18: Skeletons shimmer pendant les chargements du back-office.
UX-DR19: Easter egg type Konami code.

**Accessibilité et interaction (§4.4)**

UX-DR20: Toute animation introduite doit être neutralisée sous `prefers-reduced-motion: reduce` — contrainte transverse à UX-DR4 à UX-DR19, non négociable.
UX-DR21: Corriger `after:-outline-2` dans `Card.tsx:13` : la valeur négative est invalide, le liseré ne s'affiche pas comme prévu.

### FR Coverage Map

| FR | Epic | Objet |
|---|---|---|
| FR1 | Epic 4 | Contenu servi depuis Postgres via Prisma |
| FR2 | Epic 5 | Back-office `/admin` protégé |
| FR3 | Epic 5 | CRUD projets |
| FR4 | Epic 5 | Réordonnancement drag & drop |
| FR5 | Epic 5 | Highlights répétables |
| FR6 | Epic 5 | Association des stacks à un projet |
| FR7 | Epic 5 | Brouillon / publié + `?preview=1` |
| FR8 | Epic 5 | Upload de couverture, WebP + blurDataUrl |
| FR9 | Epic 5 | Aperçu live de la carte projet |
| FR10 | Epic 5 | CRUD parcours |
| FR11 | Epic 5 | CRUD stacks |
| FR12 | Epic 5 | Réglages du site |
| FR13 | Epic 5 | Upload du CV + vignette |
| FR14 | Epic 5 | Dashboard admin |
| FR15 | Epic 5 | Bibliothèque média |
| FR16 | Epic 5 | AuditLog sur chaque mutation |
| FR17 | Epic 5 | Auth.js v5, argon2id, session JWT |
| FR18 | Epic 5 | Seed idempotent, aucune inscription |
| FR19 | Epic 5 | Login 2FA en deux temps |
| FR20 | Epic 5 | Enrôlement TOTP avec QR code |
| FR21 | Epic 5 | 8 codes de récupération |
| FR22 | Epic 5 | Redirection forcée vers l'enrôlement |
| FR23 | Epic 5 | Script de secours `admin:reset-2fa` |
| FR24 | Epic 6 | Pages `/projects/[slug]` |
| FR25 | Epic 6 | Page `/cv` avec viewer PDF |
| FR26 | Epic 6 | Formulaire de contact fonctionnel |
| FR27 | Epic 5 | Boîte de réception `/admin/messages` |
| FR28 | Epic 6 | Section « Stack & outils » enrichie |
| FR29 | Epic 6 | Section « Chiffres » |
| FR30 | Epic 1 | Ancre `#projects` déterministe |
| FR31 | Epic 1 | Liens sortants corrigés |
| FR32 | Epic 1 | Textes datés mis à jour |
| FR33 | Epic 1 | Section Testimonials dans la nav |
| FR34 | Epic 7 | Tracking Umami conditionnel |
| FR35 | Epic 7 | Événements Umami personnalisés |
| FR36 | Epic 2 | Endpoint `/api/health` |

**Couverture NFR**

| Epic | NFR couverts |
|---|---|
| Epic 1 | NFR4 (purge des CV morts), NFR6, NFR9, NFR14 |
| Epic 2 | NFR15, NFR16, NFR18 |
| Epic 3 | NFR19, NFR20, NFR21 |
| Epic 4 | NFR3, NFR17 |
| Epic 5 | NFR8, NFR11, NFR12, NFR13 |
| Epic 6 | NFR4 (pipeline AVIF/WebP), NFR5 |
| Epic 7 | NFR1, NFR2, NFR7, NFR10 |

**Couverture UX-DR**

| Epic | UX-DR couverts |
|---|---|
| Epic 1 | UX-DR21 |
| Epic 5 | UX-DR18 |
| Epic 6 | UX-DR1 à UX-DR17, UX-DR19, UX-DR20 |

Aucune exigence orpheline : les 36 FR, 21 NFR et 21 UX-DR sont rattachés à un epic.

## Epic List

**Ordre d'exécution : Epic 1 → 2 → 3 → 4 → 5 → 6 → 7**, conformément à l'ordre recommandé §6 du plan (P0 → P2 → P1 → P3 → P4 → P5 → P6).

**Note sur le principe « valeur utilisateur »** : les epics 2 et 3 correspondent à des phases d'infrastructure. Ils sont conservés comme epics distincts parce que la sortie de Vercel et la maîtrise de l'hébergement sont un objectif explicite du projet (§5, décisions §7), pas un simple moyen. Chaque epic est néanmoins formulé par son résultat observable, et ses critères d'acceptation porteront sur ce résultat — jamais sur une liste de tâches techniques.

**Chevauchement de fichiers assumé** : les epics 1 et 6 modifient tous deux `Projects.tsx`, `SelfProject.tsx`, `Card.tsx` et `Header.tsx`. La fusion a été écartée volontairement — l'epic 1 doit rester livrable en une journée et partir en production immédiatement, sans attendre la refonte visuelle.

### Epic 1: Portfolio propre et indexable

Un visiteur navigue sur le site sans rencontrer de lien cassé ni d'information périmée, et le site apparaît correctement quand on le partage ou qu'un moteur l'indexe. Livrable en production immédiatement, indépendamment de tout le reste.

**FRs covered:** FR30, FR31, FR32, FR33
**NFRs covered:** NFR4 (purge des assets de CV morts), NFR6, NFR9, NFR14
**UX-DRs covered:** UX-DR21

**Implementation notes:** Correspond à la phase P0. Inclut le cherry-pick de l'animation de `develop` (`Testimonials.tsx`, `SectionHeader.tsx`) sans les suppressions d'assets qui l'accompagnent, l'ajout des metadata OpenGraph et Twitter card, `metadataBase`, favicon, `sitemap.ts` et `robots.ts`. Dettes visées : D1 (`Projects.tsx:44` / `SelfProject.tsx:73`), D2 (`Footer.tsx:34`), D3, D4 (`Projects.tsx:88-93`), D5 (`Testimonials.tsx:104`), D6, D7, D9, D10, D11, D12 (`Card.tsx:13`).

### Epic 2: Le portfolio tourne sur mon VPS

Le site est servi depuis le VPS Hetzner sur `portfolio.doshwork.com` en HTTPS, conteneurisé et supervisé par Coolify, et le projet Vercel peut être coupé sans conséquence.

**FRs covered:** FR36
**NFRs covered:** NFR15, NFR16, NFR18

**Implementation notes:** Correspond à la phase P2, placée avant la modernisation du socle. L'application est dockerisée *telle quelle* (Next 14 / npm) afin de valider la chaîne Coolify sur un périmètre stable et de ne pas cumuler deux inconnues. Couvre le Dockerfile 4 stages, les deux fichiers compose, la création des bases `portfolio_prod` et `umami` sur le Postgres mutualisé, le DNS, le TLS Let's Encrypt et la fenêtre de bascule de 48 h. Le stage `production` ne contient pas Bun à ce stade.

### Epic 3: Socle moderne et discipline de code

Le projet tourne sur un socle à jour (monorepo Bun, Next 16, React 19.2) sans régression visible sur le site, et toute contribution passe par un formatage, un lint et une CI automatiques.

**NFRs covered:** NFR19, NFR20, NFR21

**Implementation notes:** Correspond à la phase P1, exécutée après la mise en production VPS. Chaque montée de version se vérifie dans un environnement de production déjà éprouvé. Couvre la migration vers `apps/web`, npm → Bun 1.3+, Next 14.2.5 → 16.2, React 18 → 19.2, `framer-motion` 11 → `motion` 12, l'ajout de shadcn/ui, Prettier + husky + lint-staged + commitlint, le renommage `Production` → `PROD` et `develop` → `DEV`, la suppression de `fix`, et `ci.yml`. La factorisation de `Projects.tsx` / `SelfProject.tsx` (NFR20, dette D14) est traitée ici, avant que les données ne s'y branchent.

### Epic 4: Mon contenu vit en base

Les sections du site affichent le contenu servi depuis la base de données au lieu de constantes codées en dur, et le site continue de fonctionner même si la base devient injoignable.

**FRs covered:** FR1
**NFRs covered:** NFR3, NFR17

**Implementation notes:** Correspond à la phase P3. Couvre le schéma Prisma 7 complet (§2.1 plus les champs 2FA de §9.1), les migrations, le seed alimenté depuis le contenu aujourd'hui codé en dur, la réécriture des sections en lecture base, l'ISR à 3600 s avec `revalidateTag`, et le fallback statique `src/content/*.ts`. L'epic se tient seul : à sa fin, le site fonctionne mieux qu'avant, même sans back-office. Les métriques chiffrées de projet sont modélisées en champs **optionnels** (décision de cadrage), la page les masquant lorsqu'elles sont absentes.

### Epic 5: Je gère mon portfolio sans commit

L'administrateur se connecte à un back-office sécurisé par double authentification et met à jour l'intégralité du contenu du site — projets, parcours, stacks, réglages, médias, CV — sans écrire une ligne de code ni redéployer.

**FRs covered:** FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR10, FR11, FR12, FR13, FR14, FR15, FR16, FR17, FR18, FR19, FR20, FR21, FR22, FR23, FR27
**NFRs covered:** NFR8, NFR11, NFR12, NFR13
**UX-DRs covered:** UX-DR18

**Implementation notes:** Correspond à la phase P4, la plus lourde (~7 j, 23 FR). Conservé comme epic unique par choix explicite, pour rester fidèle au découpage du plan. **Dépendance dure sur l'epic 4** : l'admin écrit dans les tables Prisma — c'est la seule dépendance bloquante de toute la chaîne. Les stories seront ordonnées pour livrer l'accès sécurisé complet (auth, 2FA, middleware) avant tout écran de gestion, afin que la sécurité soit finie et vérifiée avant qu'on empile les écrans dessus. Server Actions, validation Zod partagée, `useOptimistic` pour le réordonnancement, `sharp` pour les images, volume `portfolio_uploads`.

### Epic 6: Un portfolio qui marque

Un recruteur qui arrive sur le site rencontre une expérience soignée et animée, peut explorer chaque projet en détail, consulter le CV et prendre contact directement — sans qu'aucune animation ne gêne une personne sensible au mouvement.

**FRs covered:** FR24, FR25, FR26, FR28, FR29
**NFRs covered:** NFR4 (pipeline AVIF/WebP responsive), NFR5
**UX-DRs covered:** UX-DR1 à UX-DR17, UX-DR19, UX-DR20

**Implementation notes:** Correspond à la phase P5, allégée d'un jour (thème clair annulé, décision 3 — mono-thème dark, tokens structurés pour un thème clair ultérieur). L'identité visuelle actuelle est systématisée, pas refondue. Les animations sont livrées par vagues de priorité P1 → P2 → P3. UX-DR20 (`prefers-reduced-motion`) est une contrainte transverse : chaque story d'animation porte sa propre vérification. Les métriques de projet restent optionnelles côté affichage.

### Epic 7: Je sais que ça marche et ce qui est regardé

Toute régression fonctionnelle, d'accessibilité ou de performance est détectée automatiquement avant fusion, et l'administrateur sait quels projets les visiteurs consultent réellement.

**FRs covered:** FR34, FR35
**NFRs covered:** NFR1, NFR2, NFR7, NFR10

**Implementation notes:** Correspond à la phase P6. Couvre Playwright E2E, l'audit `@axe-core/playwright` en CI, les budgets Lighthouse bloquants, Umami self-hosted sur `analytics.doshwork.com` (base créée dès l'epic 2), les événements personnalisés `cv-download`, `project-visit`, `contact-submit`, `social-click`, ainsi que le README et les runbooks `docs/ops/` — dont la procédure de secours 2FA.

---

## Epic 1: Portfolio propre et indexable

Un visiteur navigue sur le site sans rencontrer de lien cassé ni d'information périmée, et le site apparaît correctement quand on le partage ou qu'un moteur l'indexe.

> **Correction au plan §1.3** — vérification faite sur le dépôt : la branche `develop` ne modifie que `Testimonials.tsx` (+62 / −7) et **ne supprime aucun asset**. Le « cherry-pick sans les suppressions » décrit dans le plan est sans objet : le travail est déjà sur `develop`, qui est la branche courante. Seule la branche morte `fix` reste à supprimer (traité en Epic 3).

### Story 1.1: Cibler la bonne section depuis la navigation

As a visiteur du portfolio,
I want que le lien « Projets » du menu m'amène à la section des projets,
So that je puisse consulter le travail de Jeevons sans avoir à faire défiler la page à la main.

**Acceptance Criteria:**

**Given** le site est ouvert et les sections `Projects` et `SelfProject` portent aujourd'hui toutes deux `id="projects"` (`Projects.tsx:44` et `SelfProject.tsx:73`)
**When** j'inspecte le document
**Then** chaque `id` de section est unique dans toute la page
**And** la section des projets professionnels conserve `id="projects"` tandis que la section des projets personnels reçoit `id="side-projects"`

**Given** je suis en bas de la page
**When** je clique sur « Projets » dans le menu
**Then** la page défile jusqu'à la section des projets professionnels
**And** l'URL affiche l'ancre `#projects`

**Given** la navigation compte aujourd'hui quatre entrées
**When** je consulte le menu après la correction
**Then** il compte toujours quatre entrées, sans lien dédié aux projets personnels
**And** la section `#side-projects` reste atteignable en poursuivant le défilement, puisqu'elle suit immédiatement la section des projets professionnels

### Story 1.2: Rendre la section Témoignages atteignable

As a visiteur du portfolio,
I want pouvoir accéder à la section des témoignages depuis la navigation,
So that je puisse lire les retours sur le travail de Jeevons sans la découvrir par hasard.

**Acceptance Criteria:**

**Given** la section des témoignages n'a aujourd'hui aucun identifiant (`Testimonials.tsx:104`)
**When** j'inspecte le document
**Then** la section porte un `id` unique et descriptif

**Given** la section porte un identifiant
**When** je consulte la navigation du Header
**Then** un lien y mène et le défilement fonctionne

### Story 1.3: Ouvrir les liens externes sans risque

As a visiteur du portfolio,
I want que les liens vers les projets et les réseaux sociaux s'ouvrent correctement dans un nouvel onglet,
So that je puisse les explorer sans perdre le portfolio et sans exposer ma session à la page ouverte.

**Acceptance Criteria:**

**Given** `Footer.tsx:34` porte aujourd'hui la faute de frappe `target="_blanck"`
**When** je clique sur un lien de réseau social
**Then** le lien s'ouvre dans un nouvel onglet
**And** aucune occurrence de `_blanck` ne subsiste dans le code

**Given** les liens de `Projects.tsx:88` et `SelfProject.tsx:116` portent `target="_blank"` sans attribut `rel`
**When** j'inspecte ces liens
**Then** chacun porte `rel="noopener noreferrer"`
**And** tout lien du site ouvrant un nouvel onglet porte cet attribut, sans exception

### Story 1.4: Réparer le bouton « Visiter le site »

As a visiteur du portfolio,
I want pouvoir activer le bouton « Visiter le site » au clavier comme à la souris,
So that je puisse accéder au projet quelle que soit ma façon de naviguer.

**Acceptance Criteria:**

**Given** `Projects.tsx:88-93` imbrique aujourd'hui un `<button>` dans un `<a>`, ce que le HTML interdit
**When** je valide le balisage de la page
**Then** aucune imbrication de contrôle interactif ne subsiste, dans `Projects.tsx` comme dans `SelfProject.tsx`
**And** l'élément est un lien unique stylé en bouton, pas un bouton dans un lien

**Given** je navigue au clavier
**When** j'atteins ce bouton avec la touche Tab
**Then** il reçoit le focus une seule fois et l'activer par Entrée ouvre le projet
**And** un lecteur d'écran l'annonce comme un lien, avec un intitulé qui identifie le projet concerné

### Story 1.5: Afficher des informations à jour

As a recruteur consultant le portfolio,
I want lire des informations cohérentes avec la période actuelle,
So that je puisse juger de la disponibilité réelle de Jeevons sans douter du sérieux du site.

**Acceptance Criteria:**

**Given** le Hero annonce « En recherche d'une alternance pour 2025 » (`Hero.tsx:116`)
**When** je consulte la page d'accueil
**Then** le texte reflète la recherche en cours à la date de publication

**Given** la section Contact mentionne « l'année scolaire 2025-2026 » (`Contact.tsx:22`)
**When** je lis cette section
**Then** la période mentionnée est exacte

**Given** le pied de page affiche « © 2024 » en dur (`Footer.tsx:28`)
**When** je consulte le pied de page
**Then** l'année affichée est l'année courante
**And** elle se met à jour d'elle-même au changement d'année, sans intervention

### Story 1.6: Protéger les coordonnées personnelles de la moisson

As a Jeevons,
I want que mon adresse e-mail ne soit pas lisible en clair dans le code source de la page,
So that je ne reçoive pas de spam issu des robots qui parcourent le web.

**Acceptance Criteria:**

**Given** l'adresse `jeevons.eya.jr@gmail.com` figure en clair dans le HTML servi (`Contact.tsx:28` et `Contact.tsx:35`)
**When** j'affiche le code source de la page rendue
**Then** aucune adresse e-mail ni numéro de téléphone n'y apparaît en clair
**And** l'adresse n'est reconstituable qu'à l'exécution de JavaScript, jamais présente d'un seul tenant dans le balisage servi

**Given** je suis un visiteur légitime avec JavaScript actif
**When** je clique sur le bouton de contact
**Then** l'adresse est assemblée à ce moment-là et mon client de messagerie s'ouvre, prérempli
**And** l'opération ne demande aucune étape supplémentaire par rapport à aujourd'hui

**Given** je navigue sans JavaScript
**When** j'atteins la section Contact
**Then** un moyen de contact alternatif reste proposé, par exemple un lien vers un profil professionnel
**And** le bouton ne reste jamais inerte sans explication

**Given** je navigue au clavier ou au lecteur d'écran
**When** j'atteins le bouton de contact
**Then** il est annonçable, focusable et activable comme n'importe quel contrôle

> Note : cette story est une mesure d'atténuation provisoire. Le formulaire de contact complet (FR26) remplace définitivement l'affichage de l'adresse en Epic 6.

### Story 1.7: Respecter le choix de mouvement réduit

As a visiteur sensible au mouvement,
I want que les animations du site s'arrêtent quand mon système demande un mouvement réduit,
So that je puisse consulter le portfolio sans gêne ni malaise.

**Acceptance Criteria:**

**Given** aucune prise en charge de `prefers-reduced-motion` n'existe aujourd'hui dans le code
**When** j'active « réduire les animations » dans mon système et que je charge le site
**Then** les dix orbites animées en continu du Hero cessent leur mouvement
**And** toute autre animation ou transition décorative est neutralisée
**And** l'intégralité du contenu reste lisible et accessible dans son état final

**Given** je n'ai pas activé ce réglage
**When** je charge le site
**Then** les animations se comportent comme avant, sans régression

### Story 1.8: Corriger le liseré des cartes

As a visiteur du portfolio,
I want voir les cartes s'afficher avec le contour prévu par le design,
So that l'interface paraisse soignée et intentionnelle.

**Acceptance Criteria:**

**Given** `Card.tsx:13` utilise `after:-outline-2`, dont la valeur négative est invalide en CSS
**When** j'inspecte une carte dans le navigateur
**Then** le liseré est rendu avec l'épaisseur prévue
**And** aucune déclaration CSS invalide ne subsiste sur ce composant

**Given** les cartes servent aux projets, aux témoignages et à la section À propos
**When** je parcours l'ensemble du site
**Then** le liseré est cohérent sur toutes les cartes

### Story 1.9: Alléger le dépôt de ses assets morts

As a Jeevons,
I want que mon dépôt ne transporte plus les fichiers de CV inutilisés,
So that les clones et les builds soient rapides et que le dépôt reste sain.

**Acceptance Criteria:**

**Given** seule la version `1.6` du CV est référencée (`About.tsx:3` pour l'image, `About.tsx:112` pour le PDF)
**When** j'inventorie les fichiers de CV du dépôt
**Then** les six WebP inutilisés (`jeevons-cv-2024_resultat.webp`, `-1.1` à `-1.5`, soit environ 10,7 Mo) sont supprimés
**And** les six PDF inutilisés (`jeevons-cv-2024.pdf`, `-1.1` à `-1.5`, soit environ 2,7 Mo) sont supprimés
**And** le doublon `public/assets/docs/jeevons-cv-2024_resultat.webp.webp` (environ 1,8 Mo) est supprimé

**Given** la suppression est faite
**When** je construis le projet et que je parcours le site
**Then** le build réussit sans référence manquante
**And** l'image et le lien de téléchargement du CV fonctionnent toujours dans la section À propos
**And** le dépôt a perdu environ 15 Mo

### Story 1.10: Apparaître correctement au partage et à l'indexation

As a Jeevons,
I want que mon portfolio s'affiche avec un aperçu soigné quand on le partage et qu'il soit correctement indexé,
So that un lien envoyé à un recruteur donne une bonne première impression et que le site soit trouvable.

**Acceptance Criteria:**

**Given** `layout.tsx` ne déclare aujourd'hui qu'un titre et une description
**When** j'inspecte les métadonnées de la page
**Then** `metadataBase` est défini sur l'URL publique du site
**And** les balises OpenGraph sont présentes : titre, description, image, type et locale
**And** les balises Twitter card sont présentes avec un format `summary_large_image`

**Given** je partage l'URL du site sur un réseau social ou une messagerie
**When** l'aperçu se génère
**Then** une image de partage lisible s'affiche avec le titre et la description

**Given** un moteur de recherche explore le site
**When** il demande `/sitemap.xml` et `/robots.txt`
**Then** les deux répondent avec un contenu valide
**And** le sitemap liste les pages publiques du site

**Given** j'ouvre le site dans un navigateur
**When** je regarde l'onglet
**Then** une icône de favori propre au portfolio s'affiche, distincte de l'icône par défaut de Next.js

---

## Epic 2: Le portfolio tourne sur mon VPS

Le site est servi depuis le VPS Hetzner sur `portfolio.doshwork.com` en HTTPS, conteneurisé et supervisé par Coolify, et le projet Vercel peut être coupé sans conséquence.

> **Rappel de séquencement** : l'application est dockerisée *telle quelle* (Next 14.2.5, npm) — la modernisation du socle vient après, en Epic 3. Dockeriser d'abord permet de valider la chaîne Coolify sur un périmètre stable, et de ne pas cumuler deux inconnues en cas de problème.

### Story 2.1: Savoir si l'application est en bonne santé

As a exploitant du VPS,
I want interroger un point d'entrée qui me dit si l'application répond,
So that l'orchestrateur puisse redémarrer le conteneur tout seul quand elle ne répond plus.

**Acceptance Criteria:**

**Given** l'application est démarrée
**When** j'appelle `GET /api/health`
**Then** je reçois un statut 200
**And** le corps de la réponse est un JSON indiquant l'état, exploitable par un humain comme par une machine

**Given** l'endpoint est destiné à un healthcheck appelé toutes les 15 secondes
**When** je l'appelle
**Then** il répond sans effet de bord, sans écriture, et sans dépendre d'un service externe indisponible
**And** il n'expose aucune information sensible : ni version de dépendance, ni chaîne de connexion, ni variable d'environnement

**Given** l'endpoint doit rester joignable depuis l'intérieur du conteneur
**When** j'appelle `http://127.0.0.1:3000/api/health` depuis le conteneur lui-même
**Then** la réponse est identique à celle obtenue de l'extérieur

### Story 2.2: Construire une image de production minimale

As a Jeevons,
I want une image Docker qui contienne le strict nécessaire pour faire tourner le site,
So that les déploiements soient rapides et la surface d'attaque réduite.

**Acceptance Criteria:**

**Given** le Dockerfile suit la convention Doshwork à quatre étages
**When** j'inspecte `apps/web/Dockerfile`
**Then** les étages `deps`, `builder`, `development` et `production` sont présents et distincts
**And** la base est `node:22-alpine`
**And** l'étage `builder` installe `vips-dev` via `apk`, prérequis de `sharp` pour le traitement d'images à venir

**Given** l'étage `production` ne sert qu'à exécuter l'application
**When** j'inspecte cet étage
**Then** il ne contient pas Bun
**And** il démarre par `node server.js` sur la sortie standalone
**And** `next.config.js` déclare `output: 'standalone'`

**Given** une image ne doit pas tourner en root
**When** j'inspecte l'utilisateur d'exécution
**Then** le processus tourne sous `nextjs:nodejs` en uid et gid 1001
**And** `HOSTNAME` vaut `0.0.0.0` et le port 3000 est exposé

**Given** les variables publiques sont figées à la construction
**When** j'inspecte l'étage `builder`
**Then** les variables `NEXT_PUBLIC_*` sont reçues en `ARG` puis promues en `ENV` avant le build

**Given** la convention Doshwork délègue la supervision au compose
**When** j'inspecte le Dockerfile
**Then** il ne contient aucune instruction `HEALTHCHECK`

**Given** je construis l'image
**When** le build se termine
**Then** il réussit sans erreur et l'image démarre en servant le site à l'identique du site actuel

### Story 2.3: Développer en local dans les mêmes conditions qu'en production

As a Jeevons,
I want lancer le site et sa base d'une seule commande sur ma machine,
So that je travaille dans un environnement proche de la production sans installer Postgres localement.

**Acceptance Criteria:**

**Given** `docker-compose.yml` décrit l'environnement de développement
**When** je lance la stack
**Then** un service `db` en `postgres:16-alpine` démarre, avec son port publié uniquement sur `127.0.0.1:5432`
**And** ce service déclare un healthcheck fondé sur `pg_isready`
**And** un service `web` démarre sur l'étage `development` et n'accepte les connexions qu'une fois la base saine

**Given** je modifie un fichier source
**When** je regarde le navigateur
**Then** le rechargement à chaud fonctionne, grâce au montage du code source
**And** les volumes `node_modules` et `.next` du conteneur sont préservés du montage, afin de ne pas être écrasés par l'hôte

**Given** je découvre le projet
**When** je suis les instructions du README
**Then** une seule commande suffit à obtenir un site fonctionnel en local

### Story 2.4: Héberger les données du portfolio sur le Postgres mutualisé

As a Jeevons,
I want une base dédiée au portfolio sur le Postgres que Coolify héberge déjà,
So that je n'ajoute aucun coût ni conteneur supplémentaire à mon VPS.

**Acceptance Criteria:**

**Given** le service Postgres de Coolify héberge déjà la base de Doshwork
**When** je crée les nouvelles bases
**Then** une base `portfolio_prod` existe avec un utilisateur dédié `portfolio_user`
**And** une base `umami` existe avec un utilisateur dédié `umami_user`, en prévision de l'Epic 7
**And** chaque utilisateur n'a de droits que sur sa propre base

**Given** Postgres 15 et suivants restreignent le schéma public par défaut
**When** je vérifie les droits de chaque nouvel utilisateur
**Then** `GRANT ALL ON SCHEMA public` a été appliqué sur sa base
**And** l'utilisateur peut effectivement y créer une table, ce qui est vérifié explicitement

**Given** les bases de Doshwork sont en production
**When** j'ai terminé l'opération
**Then** les bases et utilisateurs existants de Doshwork sont intacts
**And** le service Doshwork continue de répondre normalement

### Story 2.5: Décrire le déploiement de production

As a Jeevons,
I want un fichier de composition dédié à la production,
So that Coolify sache exactement quoi construire et démarrer, sans ambiguïté avec l'environnement de développement.

**Acceptance Criteria:**

**Given** `docker-compose.prod.yml` décrit la production
**When** j'inspecte ce fichier
**Then** il ne déclare que le service `web`, sans service de base de données
**And** ce service se construit sur l'étage `production` et se nomme `portfolio_web`
**And** il déclare `restart: unless-stopped`

**Given** la production est joignable via le proxy de Coolify
**When** j'inspecte la configuration réseau
**Then** le service rejoint le réseau externe `coolify`

**Given** les fichiers téléversés doivent survivre à un redéploiement
**When** j'inspecte les volumes
**Then** un volume nommé `portfolio_uploads` est monté sur `/app/uploads`

**Given** l'orchestrateur doit détecter une panne
**When** j'inspecte le healthcheck du service
**Then** il interroge `/api/health` en interne, toutes les 15 secondes, avec 5 tentatives et une période de grâce de 30 secondes au démarrage

**Given** aucun secret ne doit être versionné
**When** j'inspecte le dépôt
**Then** toutes les valeurs sensibles sont référencées par variable, jamais écrites en clair
**And** un fichier `.env.production.example` liste chaque variable attendue, sans aucune valeur réelle

### Story 2.6: Rendre le portfolio joignable sur son sous-domaine

As a recruteur,
I want atteindre le portfolio via une adresse web publique et sécurisée,
So that je puisse le consulter en confiance depuis n'importe quel navigateur.

**Acceptance Criteria:**

**Given** le domaine `doshwork.com` est déjà géré chez le registrar
**When** je crée l'enregistrement DNS
**Then** un enregistrement `A` fait pointer `portfolio` vers l'IP du VPS, avec un TTL de 300 secondes
**And** `dig +short portfolio.doshwork.com A` renvoie cette IP avant toute étape suivante

**Given** Let's Encrypt limite les tentatives infructueuses à cinq par heure
**When** je configure le domaine dans Coolify
**Then** je ne le fais qu'après confirmation de la propagation DNS, afin d'éviter une mise en attente forcée

**Given** le domaine est configuré sur le service `web`
**When** je visite `https://portfolio.doshwork.com`
**Then** le portfolio s'affiche
**And** `curl` sur `/api/health` renvoie 200
**And** le certificat TLS est émis pour ce nom exact et valide environ 90 jours

**Given** une requête arrive en HTTP simple
**When** elle atteint le proxy
**Then** elle est redirigée vers HTTPS

**Given** Doshwork tourne en production sur la même IP
**When** j'ai terminé la configuration
**Then** `doshwork.com` et `api.doshwork.com` répondent toujours normalement
**And** le portfolio a été créé comme application Coolify distincte, sans modification d'aucune ressource Doshwork existante

**Given** l'adresse publique est désormais connue
**When** je vérifie la configuration de l'application
**Then** `NEXT_PUBLIC_SITE_URL` vaut `https://portfolio.doshwork.com` et a été fournie au moment de la construction de l'image

### Story 2.7: Couper Vercel sans risque

As a Jeevons,
I want retirer le portfolio de Vercel une fois le VPS éprouvé,
So that je maîtrise entièrement mon hébergement sans laisser traîner un déploiement fantôme.

**Acceptance Criteria:**

**Given** le site tourne sur le VPS
**When** j'effectue les vérifications de mise en service
**Then** la page d'accueil, la navigation, les liens externes et le téléchargement du CV fonctionnent depuis l'adresse publique
**And** le comportement est identique à celui du site servi par Vercel

**Given** une bascule mérite une période d'observation
**When** je décide de supprimer le projet Vercel
**Then** au moins 48 heures de production stable se sont écoulées
**And** la configuration DNS de secours vers Vercel a été conservée pendant toute cette fenêtre

**Given** la période d'observation est concluante
**When** je clôture la migration
**Then** le projet Vercel est supprimé
**And** le TTL du DNS est remonté à 3600 secondes
**And** la procédure suivie est consignée pour pouvoir être rejouée lors du passage au domaine définitif

---

## Epic 3: Socle moderne et discipline de code

Le projet tourne sur un socle à jour sans régression visible sur le site, et toute contribution passe par un formatage, un lint et une intégration continue automatiques.

> **Séquencement interne** : la réorganisation en monorepo précède les montées de version, et la factorisation des sections dupliquées vient en dernier — juste avant que l'Epic 4 n'y branche la base de données.

### Story 3.1: Réorganiser le projet en monorepo

As a Jeevons,
I want que le code du site vive dans `apps/web` selon la même structure que Doshwork,
So that je raisonne de la même façon sur mes deux projets et que la place reste libre pour d'autres applications.

**Acceptance Criteria:**

**Given** le code est aujourd'hui à la racine du dépôt
**When** la réorganisation est faite
**Then** le code applicatif vit sous `apps/web`
**And** l'historique Git des fichiers déplacés est préservé

**Given** le projet a été déplacé
**When** je lance la construction et le serveur de développement
**Then** les deux fonctionnent et le site est identique à avant
**And** les chemins de configuration du Dockerfile et des fichiers de composition ont été mis à jour en conséquence

### Story 3.2: Passer à Bun comme gestionnaire de paquets

As a Jeevons,
I want gérer les dépendances avec Bun comme sur Doshwork,
So that j'aie un seul outil à connaître et des installations nettement plus rapides.

**Acceptance Criteria:**

**Given** le projet utilise aujourd'hui npm et `package-lock.json`
**When** la migration est faite
**Then** `apps/web/bun.lock` est versionné et `package-lock.json` supprimé
**And** l'installation, la construction, le lint et le démarrage passent tous par Bun

**Given** le conteneur doit construire le projet
**When** j'inspecte le Dockerfile
**Then** Bun 1.3.3 est installé dans les étages `deps`, `builder` et `development`
**And** l'étage `production` reste dépourvu de Bun

**Given** l'image de production a changé de chaîne de construction
**When** je construis et démarre le conteneur
**Then** le site est servi à l'identique et le healthcheck répond

### Story 3.3: Monter le socle à Next 16 et React 19

As a Jeevons,
I want que le portfolio tourne sur les versions actuelles de Next et de React,
So that je bénéficie des nouvelles capacités et que je puisse en parler en entretien.

**Acceptance Criteria:**

**Given** le projet est en Next 14.2.5 et React 18
**When** la montée de version est faite
**Then** le projet tourne en Next 16.2 et React 19.2
**And** `framer-motion` 11 est remplacé par `motion` 12, les animations existantes étant portées

**Given** une montée de version majeure peut casser silencieusement
**When** je parcours l'ensemble du site après migration
**Then** chaque section s'affiche et se comporte comme avant
**And** la construction ne produit ni erreur ni avertissement de dépréciation non traité
**And** le contrôle de types passe sans erreur

**Given** la production tourne déjà sur le VPS
**When** je déploie cette montée de version
**Then** elle est vérifiée en conteneur avant d'atteindre la production
**And** un retour arrière reste possible en redéployant l'image précédente

### Story 3.4: Empêcher qu'un code mal formé entre dans le dépôt

As a Jeevons,
I want que le formatage et le lint s'appliquent automatiquement à chaque commit,
So that je ne relise jamais de diff pollué par des questions de style.

**Acceptance Criteria:**

**Given** le projet n'a aujourd'hui ni Prettier ni crochets Git
**When** la configuration est en place
**Then** Prettier, husky et lint-staged sont installés et configurés
**And** un commit déclenche le formatage et le lint des seuls fichiers modifiés

**Given** les messages de commit doivent rester lisibles dans l'historique
**When** je rédige un message qui ne respecte pas la convention
**Then** commitlint rejette le commit avec un message explicite
**And** un message conforme aux conventional commits est accepté

**Given** la base de code n'a jamais été formatée
**When** j'applique le formatage initial
**Then** il fait l'objet d'un commit isolé, distinct de tout changement fonctionnel

### Story 3.5: Aligner les branches sur la convention Doshwork

As a Jeevons,
I want les mêmes noms de branches et le même flux que sur Doshwork,
So that je ne me trompe pas de cible en passant d'un projet à l'autre.

**Acceptance Criteria:**

**Given** les branches se nomment aujourd'hui `Production` et `develop`
**When** le renommage est fait
**Then** elles se nomment `PROD` et `DEV`
**And** la branche par défaut du dépôt distant est `PROD`

**Given** la branche `fix` est morte, déjà fusionnée et sans commit d'avance
**When** je nettoie le dépôt
**Then** elle est supprimée en local comme sur le distant

**Given** la production ne doit pas recevoir de code non vérifié
**When** j'inspecte la protection de branche
**Then** `PROD` n'accepte que des pull requests, avec intégration continue au vert obligatoire
**And** le flux attendu `alpha/feat/*` puis `DEV` puis `PROD` est documenté dans le README

**Given** Coolify déploie depuis une branche nommée
**When** le renommage est effectif
**Then** la configuration Coolify pointe vers `PROD` et un déploiement de vérification aboutit

### Story 3.6: Vérifier automatiquement chaque contribution

As a Jeevons,
I want qu'une intégration continue valide mon code à chaque poussée,
So that je détecte une régression avant qu'elle n'atteigne la production.

**Acceptance Criteria:**

**Given** aucune intégration continue n'existe aujourd'hui
**When** `.github/workflows/ci.yml` est en place
**Then** les jobs `lint` et `build-web` s'exécutent sur chaque poussée et chaque pull request visant `DEV` et `PROD`
**And** Bun 1.3 est installé via `setup-bun@v2`
**And** les dépendances sont mises en cache sur l'empreinte de `apps/web/bun.lock`

**Given** un job échoue
**When** je consulte la pull request
**Then** la fusion est bloquée et la cause de l'échec est lisible dans le rapport

**Given** la convention Doshwork exclut tout secret de déploiement côté GitHub
**When** j'inspecte les workflows
**Then** aucun `deploy.yml` n'existe et aucun secret SSH n'est déclaré
**And** le déploiement reste déclenché par le webhook natif de Coolify

> Le job `test-e2e` avec Playwright et l'audit d'accessibilité rejoignent ce workflow en Epic 7, une fois les tests écrits.

### Story 3.7: Éliminer la duplication entre les deux sections de projets

As a Jeevons,
I want que les projets professionnels et personnels partagent le même code d'affichage,
So that toute évolution ne soit à faire qu'une fois, et que le branchement à la base soit simple.

**Acceptance Criteria:**

**Given** `Projects.tsx` et `SelfProject.tsx` partagent environ 90 % de leur code
**When** la factorisation est faite
**Then** un composant unique rend une liste de projets, paramétré par ses données et son intitulé
**And** les deux sections l'utilisent, sans logique de rendu dupliquée

**Given** les deux sections doivent rester distinctes visuellement
**When** je compare le site avant et après
**Then** le rendu est identique, y compris les identifiants `#projects` et `#side-projects` posés en Epic 1
**And** les corrections d'accessibilité de l'Epic 1 sont préservées, sans réintroduction du bouton imbriqué dans un lien

**Given** l'Epic 4 branchera bientôt la base de données
**When** j'examine le composant factorisé
**Then** il reçoit ses projets en entrée, sans dépendre de la façon dont ils ont été obtenus

---

## Epic 4: Mon contenu vit en base

Les sections du site affichent le contenu servi depuis la base de données au lieu de constantes codées en dur, et le site continue de fonctionner même si la base devient injoignable.

> **Principe de découpage** : conformément à la règle « créer les tables au moment où une story en a besoin », le schéma n'est pas posé d'un bloc. Chaque story crée les seuls modèles qu'elle utilise. Les modèles propres au back-office (`User`, `AuditLog`, `ContactMessage`) sont créés en Epic 5, et `Media` en Epic 5 également, au moment du premier téléversement.

### Story 4.1: Servir les projets depuis la base

As a visiteur du portfolio,
I want voir la liste des projets de Jeevons,
So that je puisse juger de son travail — que ces projets viennent du code ou d'une base m'est indifférent, mais Jeevons doit pouvoir les mettre à jour sans redéployer.

**Acceptance Criteria:**

**Given** Prisma n'est pas encore installé sur le projet
**When** cette story est terminée
**Then** Prisma 7 est configuré et connecté à la base `portfolio_prod` créée en Epic 2
**And** les modèles `Project`, `Highlight` et `Stack` existent, avec les énumérations `ProjectCategory` et `SkillLevel`
**And** `Project` porte l'index composé sur la catégorie et l'ordre de tri
**And** une migration versionnée décrit ces créations

**Given** les projets sont aujourd'hui codés en dur dans `Projects.tsx` et `SelfProject.tsx`
**When** j'exécute le seed
**Then** chaque projet existant est présent en base avec ses points forts, ses technologies, sa période et son lien
**And** relancer le seed ne crée aucun doublon

**Given** le contenu est désormais en base
**When** je consulte le site
**Then** les sections de projets affichent exactement les mêmes projets qu'avant, dans le même ordre
**And** le composant factorisé en Epic 3 reçoit ces projets sans savoir d'où ils viennent

**Given** les projets ont un statut de publication
**When** un projet est marqué comme non publié
**Then** il n'apparaît pas sur le site public

### Story 4.2: Servir le parcours et les centres d'intérêt depuis la base

As a visiteur du portfolio,
I want consulter le parcours et la personnalité de Jeevons,
So that je comprenne d'où il vient — et Jeevons doit pouvoir enrichir ce parcours sans toucher au code.

**Acceptance Criteria:**

**Given** le parcours et les centres d'intérêt sont codés en dur dans les sections
**When** cette story est terminée
**Then** les modèles `TimelineEntry` et `Hobby` existent et sont migrés
**And** le seed y reporte le contenu existant, de façon idempotente

**Given** le contenu est en base
**When** je consulte les sections concernées
**Then** l'affichage est identique à avant, dans le même ordre
**And** une entrée de parcours non publiée n'apparaît pas

### Story 4.3: Piloter les textes du site sans redéployer

As a Jeevons,
I want que les textes d'accroche et mes coordonnées viennent de la base,
So that je puisse corriger une phrase datée sans faire un commit — la cause même du problème corrigé en Epic 1.

**Acceptance Criteria:**

**Given** le titre du Hero, le badge de statut et les coordonnées sont codés en dur
**When** cette story est terminée
**Then** le modèle `SiteSetting` existe, indexé par clé et portant une valeur structurée
**And** le seed y reporte les valeurs actuellement affichées

**Given** les réglages sont en base
**When** je consulte le site
**Then** le Hero, le badge de statut, les coordonnées et les liens sociaux affichent les valeurs issues de la base

**Given** une clé de réglage attendue est absente de la base
**When** la page se rend
**Then** une valeur par défaut raisonnable est utilisée
**And** la page ne tombe jamais en erreur pour cette raison

### Story 4.4: Garder le site rapide malgré la base

As a visiteur du portfolio,
I want que les pages s'affichent instantanément,
So that la consultation reste agréable, sans attendre une requête à chaque visite.

**Acceptance Criteria:**

**Given** les pages publiques interrogent désormais la base
**When** j'inspecte leur mode de rendu
**Then** elles sont rendues statiquement avec une revalidation périodique d'une heure
**And** un visiteur ne déclenche pas de requête à la base à chaque chargement

**Given** les données sont mises en cache par famille
**When** j'inspecte le code de récupération
**Then** les lectures sont étiquetées par domaine — projets, parcours, réglages — afin qu'une revalidation ciblée soit possible

**Given** le contenu change en base
**When** la revalidation ciblée de l'étiquette correspondante est déclenchée
**Then** le site public reflète le changement immédiatement
**And** aucune reconstruction d'image ni redéploiement n'est nécessaire

> Le déclenchement de cette revalidation depuis les écrans d'administration est traité en Epic 5. Ici, la capacité est en place et vérifiable manuellement.

### Story 4.5: Ne jamais tomber en panne si la base est injoignable

As a Jeevons,
I want que mon portfolio reste consultable même si la base ne répond plus,
So that je ne me retrouve jamais avec un site en erreur pendant qu'un recruteur le consulte.

**Acceptance Criteria:**

**Given** le contenu vient désormais de la base
**When** j'inspecte le projet
**Then** un contenu de repli statique existe sous `src/content`, reflétant le contenu de référence

**Given** la base est injoignable
**When** je charge la page d'accueil
**Then** le site s'affiche avec le contenu de repli
**And** aucune page d'erreur n'est présentée au visiteur
**And** l'incident est tracé côté serveur, avec assez de détail pour être diagnostiqué

**Given** la base redevient joignable
**When** je recharge la page
**Then** le contenu réel est de nouveau servi, sans intervention manuelle

**Given** ce comportement est difficile à vérifier par hasard
**When** je veux le tester
**Then** une procédure de vérification est documentée, permettant de simuler l'indisponibilité de la base

### Story 4.6: Appliquer les migrations automatiquement au déploiement

As a Jeevons,
I want que la base soit mise à jour toute seule quand je déploie,
So that je n'aie jamais à me connecter au VPS pour lancer une migration à la main.

**Acceptance Criteria:**

**Given** le conteneur démarre en production
**When** l'application se lance
**Then** les migrations en attente sont appliquées avant que l'application ne serve du trafic
**And** le seed idempotent s'exécute ensuite, sans jamais écraser de contenu existant

**Given** une migration échoue
**When** le conteneur démarre
**Then** le démarrage est interrompu avec un message explicite
**And** le healthcheck ne passe pas au vert, empêchant l'orchestrateur de router du trafic vers une application dont la base est incohérente

**Given** le conteneur redémarre plusieurs fois
**When** les migrations et le seed se rejouent
**Then** le résultat est identique à chaque fois, sans duplication ni effet de bord

---

## Epic 5: Je gère mon portfolio sans commit

L'administrateur se connecte à un back-office sécurisé par double authentification et met à jour l'intégralité du contenu du site — projets, parcours, stacks, réglages, médias, CV — sans écrire une ligne de code ni redéployer.

> **Ordre imposé** : les stories 5.1 à 5.6 livrent l'accès sécurisé complet — authentification, double facteur, cloisonnement, secours. Aucun écran de gestion n'est construit avant que cette base ne soit finie et vérifiée. C'est le jalon de sécurité interne à l'epic, décidé en remplacement d'un découpage en deux epics distincts.
>
> **Dépendance** : cet epic suppose l'Epic 4 terminé — les écrans d'administration écrivent dans les modèles Prisma qui y ont été créés. C'est la seule dépendance bloquante de toute la chaîne.

### Story 5.1: Me connecter au back-office

As a Jeevons,
I want me connecter avec mon e-mail et mon mot de passe,
So that je puisse accéder à l'administration de mon portfolio, et personne d'autre.

**Acceptance Criteria:**

**Given** aucun système d'authentification n'existe
**When** cette story est terminée
**Then** le modèle `User` existe avec e-mail unique, empreinte de mot de passe et rôle, et une migration le décrit
**And** l'authentification repose sur Auth.js v5 en fournisseur par identifiants
**And** les mots de passe sont hachés en argon2id, jamais stockés en clair ni réversibles

**Given** le compte administrateur doit exister sans inscription
**When** le seed s'exécute avec les variables d'environnement d'e-mail et de mot de passe administrateur
**Then** le compte est créé s'il n'existe pas, mis à jour sinon, sans jamais être dupliqué
**And** aucune route ni écran d'inscription n'existe dans l'application

**Given** je saisis des identifiants valides
**When** je soumets le formulaire de connexion
**Then** une session est ouverte
**And** le cookie de session est `httpOnly`, `Secure` et `SameSite=Lax`

**Given** je saisis des identifiants invalides
**When** je soumets le formulaire
**Then** la connexion échoue avec un message qui ne révèle pas si l'e-mail existe
**And** le temps de réponse ne permet pas de deviner l'existence du compte

### Story 5.2: Verrouiller l'accès à l'administration

As a Jeevons,
I want qu'aucune page d'administration ne soit atteignable sans session valide,
So that mon back-office exposé publiquement ne soit pas une porte ouverte.

**Acceptance Criteria:**

**Given** des pages d'administration existent
**When** j'appelle une URL sous `/admin` sans session
**Then** je suis redirigé vers la page de connexion
**And** aucun contenu de la page demandée n'est rendu, même partiellement

**Given** une route d'API d'administration existe
**When** je l'appelle sans session valide
**Then** je reçois un refus explicite et aucune donnée
**And** la protection est appliquée côté serveur, sans dépendre d'une vérification côté navigateur

**Given** je me connecte après avoir été redirigé
**When** l'authentification réussit
**Then** je suis renvoyé vers la page que je demandais initialement

**Given** le back-office est public sur Internet
**When** un attaquant enchaîne les tentatives de connexion
**Then** au-delà de cinq tentatives en quinze minutes depuis une même adresse, les suivantes sont refusées
**And** le refus est temporaire et se lève de lui-même

### Story 5.3: Activer la double authentification à ma première connexion

As a Jeevons,
I want être obligé de configurer un second facteur dès ma première connexion,
So that mon back-office ne reste jamais protégé par un simple mot de passe.

**Acceptance Criteria:**

**Given** le modèle `User` doit porter l'état du second facteur
**When** cette story est terminée
**Then** il porte un secret, une date d'activation et un jeu de codes de récupération, décrits par une migration
**And** le compte issu du seed démarre sans second facteur activé

**Given** mon compte n'a pas encore de second facteur
**When** je me connecte avec mes identifiants
**Then** je suis redirigé de force vers l'écran d'enrôlement
**And** aucune autre page d'administration ne m'est accessible tant que l'enrôlement n'est pas terminé

**Given** je suis sur l'écran d'enrôlement
**When** la page s'affiche
**Then** un QR code lisible par une application d'authentification standard m'est présenté
**And** le secret est aussi affiché en clair, pour une saisie manuelle

**Given** j'ai scanné le QR code
**When** je saisis un premier code valide
**Then** le second facteur est activé et la date d'activation enregistrée
**And** tant que je n'ai pas fourni ce code valide, le second facteur reste inactif — ce qui m'évite de me verrouiller dehors

**Given** le secret est stocké en base
**When** j'inspecte son enregistrement
**Then** il est chiffré au repos avec une clé dérivée du secret d'application
**And** un extrait de base volé ne permet pas de générer des codes valides

### Story 5.4: Conserver un moyen d'entrer si je perds mon téléphone

As a Jeevons,
I want disposer de codes de secours,
So that la perte de mon téléphone ne me coupe pas définitivement l'accès à mon propre site.

**Acceptance Criteria:**

**Given** je viens d'activer mon second facteur
**When** l'activation se termine
**Then** huit codes de récupération me sont présentés
**And** ils ne sont affichés qu'une seule fois, avec un avertissement clair invitant à les conserver

**Given** ces codes sont stockés
**When** j'inspecte leur enregistrement
**Then** ils sont hachés en argon2id, jamais lisibles en base

**Given** je n'ai pas accès à mon application d'authentification
**When** je saisis un code de récupération valide à l'étape du second facteur
**Then** ma session s'ouvre normalement
**And** ce code est immédiatement invalidé et ne peut plus resservir
**And** le nombre de codes restants m'est indiqué

**Given** tous mes codes sont épuisés
**When** je consulte l'administration
**Then** je suis averti et je peux en régénérer un nouveau jeu

### Story 5.5: Me connecter en deux temps

As a Jeevons,
I want fournir mon code à usage unique après mon mot de passe,
So that un mot de passe volé ne suffise jamais à entrer chez moi.

**Acceptance Criteria:**

**Given** mon second facteur est activé
**When** je fournis des identifiants valides
**Then** j'obtiens une session partielle en attente de second facteur
**And** cette session ne donne accès à aucune page d'administration
**And** elle expire au bout de cinq minutes si je ne vais pas au bout

**Given** je suis dans cette session partielle
**When** je saisis un code à six chiffres valide
**Then** ma session devient complète et l'administration m'est ouverte

**Given** l'horloge de mon téléphone peut légèrement dériver
**When** je saisis un code correspondant au pas précédent ou suivant
**Then** il est accepté
**And** un code plus ancien ou plus lointain est refusé

**Given** un code vient d'être utilisé
**When** je tente de le réutiliser
**Then** il est refusé, même s'il est encore dans sa fenêtre de validité

**Given** un attaquant tente de deviner un code
**When** il dépasse cinq tentatives en quinze minutes depuis une même adresse
**Then** les tentatives suivantes sont refusées et le compte est temporairement verrouillé

### Story 5.6: Débloquer mon accès depuis le serveur

As a Jeevons,
I want une commande de secours exécutable sur le VPS,
So that je ne sois jamais réduit à modifier ma base de production à la main.

**Acceptance Criteria:**

**Given** j'ai perdu à la fois mon téléphone et mes codes de récupération
**When** j'exécute la commande de réinitialisation du second facteur dans le conteneur
**Then** le second facteur de mon compte est désactivé et son secret effacé
**And** ma connexion suivante me redirige de force vers un nouvel enrôlement

**Given** cette commande contourne une protection de sécurité
**When** elle s'exécute
**Then** elle exige une confirmation explicite et ne peut pas se déclencher par accident
**And** son exécution est tracée

**Given** cette procédure ne servira que dans un moment de panique
**When** je consulte la documentation d'exploitation
**Then** la marche à suivre est écrite pas à pas, avec la commande exacte à lancer sur le VPS

### Story 5.7: Voir l'état de mon portfolio d'un coup d'œil

As a Jeevons,
I want une page d'accueil d'administration qui me résume l'essentiel,
So that je sache quoi faire en arrivant, sans fouiller dans les écrans.

**Acceptance Criteria:**

**Given** je suis connecté avec une session complète
**When** j'arrive sur la page d'accueil de l'administration
**Then** je vois le nombre de projets publiés et le nombre de brouillons
**And** je vois les cinq derniers messages reçus, s'il en existe
**And** je vois la fréquentation des sept derniers jours, ou une mention explicite si la mesure n'est pas encore disponible

**Given** le site public est mis en cache
**When** je déclenche la revalidation depuis cette page
**Then** le contenu public est rafraîchi et un retour visuel me le confirme

**Given** je viens d'installer le site et n'ai encore rien saisi
**When** j'arrive sur cette page
**Then** les compteurs à zéro sont présentés comme un état normal, avec une invitation à créer un premier contenu
**And** aucune zone vide ni erreur ne s'affiche

### Story 5.8: Gérer mes projets

As a Jeevons,
I want créer, modifier et supprimer mes projets depuis l'administration,
So that je puisse enrichir mon portfolio sans commit ni redéploiement.

**Acceptance Criteria:**

**Given** je suis sur la liste des projets
**When** la page s'affiche
**Then** je vois tous mes projets avec leur titre, leur catégorie et leur statut de publication
**And** je peux filtrer et trier cette liste

**Given** je crée un projet
**When** je renseigne le formulaire et que j'enregistre
**Then** le projet est créé avec son identifiant d'URL, sa catégorie, son entreprise, son titre, sa description, sa période, son lien et son dépôt
**And** les mêmes règles de validation s'appliquent côté navigateur et côté serveur, une saisie invalide étant refusée dans les deux cas

**Given** l'identifiant d'URL doit rester unique
**When** je saisis un identifiant déjà utilisé
**Then** l'enregistrement est refusé avec un message qui m'explique le conflit
**And** un identifiant m'est proposé automatiquement à partir du titre lors d'une création

**Given** je modifie un projet existant
**When** j'enregistre
**Then** les changements sont persistés et visibles sur le site public après revalidation

**Given** je supprime un projet
**When** je confirme la suppression
**Then** le projet disparaît, ainsi que ses points forts associés
**And** une confirmation m'a été demandée avant l'action, qui est irréversible

### Story 5.9: Décrire finement un projet

As a Jeevons,
I want détailler les points forts et les technologies de chaque projet,
So that un recruteur comprenne ce que j'ai réellement fait et avec quoi.

**Acceptance Criteria:**

**Given** j'édite un projet
**When** je gère ses points forts
**Then** je peux en ajouter, en modifier, en supprimer, sans limite arbitraire
**And** je peux les réordonner, l'ordre étant conservé après enregistrement et reflété sur le site public

**Given** j'édite un projet
**When** je gère ses technologies
**Then** je peux en associer plusieurs depuis la liste des technologies existantes
**And** l'association est bidirectionnelle : la technologie connaît ses projets

**Given** je saisis un projet
**When** je remplis le formulaire
**Then** un aperçu de la carte du projet s'affiche à côté et se met à jour à mesure que je tape
**And** cet aperçu ressemble à ce que verra réellement un visiteur

**Given** un projet peut ne pas avoir de résultat chiffré
**When** je laisse ces champs vides
**Then** l'enregistrement est accepté
**And** la page publique du projet masque simplement la section correspondante

### Story 5.10: Choisir l'ordre d'affichage de mes projets

As a Jeevons,
I want réordonner mes projets en les faisant glisser,
So that je mette en avant ce qui compte le plus, selon le poste que je vise.

**Acceptance Criteria:**

**Given** je suis sur la liste des projets
**When** je fais glisser un projet à une autre position
**Then** l'interface reflète le nouvel ordre immédiatement, sans attendre le serveur
**And** l'ordre est persisté

**Given** l'enregistrement de l'ordre échoue
**When** le serveur renvoie une erreur
**Then** l'interface revient à l'ordre précédent et m'informe de l'échec

**Given** j'ai réordonné mes projets
**When** je consulte le site public après revalidation
**Then** les projets y apparaissent dans l'ordre que j'ai défini

**Given** je navigue au clavier
**When** je veux réordonner un projet
**Then** un moyen accessible me le permet, sans obligation d'utiliser la souris

### Story 5.11: Préparer un projet avant de le publier

As a Jeevons,
I want rédiger un projet tranquillement avant qu'il ne soit visible,
So that je ne publie jamais un contenu inachevé sur mon portfolio.

**Acceptance Criteria:**

**Given** je crée un projet
**When** je l'enregistre sans le publier
**Then** il est conservé en brouillon
**And** il n'apparaît nulle part sur le site public

**Given** un projet est en brouillon
**When** je consulte le site avec le paramètre d'aperçu, en étant connecté
**Then** le brouillon m'est affiché comme il le serait une fois publié
**And** un repère visuel m'indique clairement que je suis en mode aperçu

**Given** je ne suis pas connecté
**When** j'utilise ce même paramètre d'aperçu
**Then** aucun brouillon ne m'est montré
**And** le site se comporte comme pour un visiteur ordinaire

**Given** je publie un brouillon
**When** j'enregistre
**Then** il devient visible publiquement après revalidation

### Story 5.12: Illustrer mes projets

As a Jeevons,
I want déposer une image de couverture par simple glisser-déposer,
So that mes projets soient illustrés sans que j'aie à préparer mes fichiers à la main.

**Acceptance Criteria:**

**Given** aucun stockage de média n'existe encore
**When** cette story est terminée
**Then** le modèle `Media` existe avec chemin, dimensions, texte alternatif et miniature de flou, décrit par une migration
**And** les fichiers sont écrits dans le volume persistant prévu, hors de l'image du conteneur

**Given** j'édite un projet
**When** je dépose une image sur la zone prévue
**Then** elle est téléversée, convertie en WebP et redimensionnée
**And** une miniature de flou est générée pour éviter que la page ne saute au chargement
**And** ses dimensions réelles sont enregistrées

**Given** une image doit être décrite pour être accessible
**When** je téléverse
**Then** un texte alternatif m'est demandé
**And** l'absence de description est signalée comme un défaut d'accessibilité

**Given** je dépose un fichier trop lourd ou d'un type non pris en charge
**When** le téléversement démarre
**Then** il est refusé avec un message qui m'explique la limite
**And** la vérification est faite côté serveur, pas seulement côté navigateur

**Given** les images téléversées ne changent jamais
**When** un visiteur les charge
**Then** elles sont servies avec des en-têtes de cache de longue durée

### Story 5.13: Gérer ma bibliothèque d'images

As a Jeevons,
I want voir et nettoyer les images que j'ai téléversées,
So that mon stockage ne se remplisse pas de fichiers oubliés.

**Acceptance Criteria:**

**Given** j'ai téléversé des images
**When** j'ouvre la bibliothèque
**Then** je les vois présentées en grille, avec leurs dimensions et leur date

**Given** je veux corriger une image
**When** je la remplace par une autre
**Then** tous les contenus qui l'utilisaient affichent la nouvelle
**And** je n'ai pas à modifier chaque projet un par un

**Given** une image est utilisée par un projet
**When** je tente de la supprimer
**Then** la suppression est refusée
**And** on me dit précisément quels contenus l'utilisent

**Given** une image n'est utilisée nulle part
**When** je la supprime après confirmation
**Then** son enregistrement et son fichier sont tous deux supprimés

### Story 5.14: Gérer mon parcours

As a Jeevons,
I want tenir à jour mon parcours depuis l'administration,
So that mon expérience reste exacte au fil du temps.

**Acceptance Criteria:**

**Given** je suis sur l'écran du parcours
**When** je crée ou modifie une entrée
**Then** je renseigne son intitulé, son lieu, son texte, ses années de début et de fin, et son illustration
**And** une entrée toujours en cours peut être enregistrée sans année de fin

**Given** j'ai plusieurs entrées
**When** je les réordonne
**Then** l'ordre est persisté et reflété sur le site public

**Given** une entrée n'est pas prête
**When** je la laisse non publiée
**Then** elle n'apparaît pas sur le site public

**Given** je supprime une entrée
**When** je confirme
**Then** elle disparaît du site après revalidation

### Story 5.15: Gérer mes technologies

As a Jeevons,
I want tenir à jour la liste des technologies que je maîtrise et mon niveau sur chacune,
So that la section « Stack & outils » reflète honnêtement où j'en suis.

**Acceptance Criteria:**

**Given** je suis sur l'écran des technologies
**When** je crée ou modifie une technologie
**Then** je renseigne son nom, sa clé d'icône et mon niveau de maîtrise
**And** le nom doit rester unique, un doublon étant refusé avec un message clair

**Given** une technologie est associée à des projets
**When** je tente de la supprimer
**Then** je suis averti du nombre de projets concernés avant de confirmer
**And** confirmer retire l'association sans supprimer les projets

**Given** j'ai modifié mes niveaux de maîtrise
**When** je consulte le site public après revalidation
**Then** la section des technologies reflète ces niveaux

### Story 5.16: Modifier les textes de mon site

As a Jeevons,
I want changer mon accroche, mon statut et mes coordonnées depuis l'administration,
So that je n'aie plus jamais un texte périmé sur mon portfolio.

**Acceptance Criteria:**

**Given** je suis sur l'écran des réglages
**When** la page s'affiche
**Then** je peux modifier le titre et le sous-titre de l'accroche, le badge de statut, mes coordonnées et mes liens sociaux

**Given** j'enregistre une modification
**When** la revalidation s'effectue
**Then** le site public affiche le nouveau texte

**Given** je saisis un lien ou une adresse mal formée
**When** j'enregistre
**Then** la saisie est refusée avec une explication
**And** la validation est appliquée côté serveur

**Given** ce sont ces textes qui étaient périmés avant l'Epic 1
**When** j'utilise cet écran
**Then** je peux corriger chacun d'eux sans commit ni redéploiement

### Story 5.17: Mettre à jour mon CV

As a Jeevons,
I want téléverser une nouvelle version de mon CV,
So that les recruteurs téléchargent toujours la version à jour, sans que j'aie à versionner un fichier de plus.

**Acceptance Criteria:**

**Given** je suis sur l'écran des réglages
**When** je téléverse un nouveau CV au format PDF
**Then** il est enregistré et devient la version courante
**And** une vignette de sa première page est générée automatiquement

**Given** un CV courant existe déjà
**When** j'en téléverse un nouveau
**Then** le site public sert immédiatement le nouveau après revalidation
**And** le lien de téléchargement reste stable, sans référence à un numéro de version

**Given** je téléverse un fichier qui n'est pas un PDF
**When** le téléversement démarre
**Then** il est refusé avec un message explicite

**Given** l'ancienne manière imposait de versionner sept fichiers dans le dépôt
**When** j'utilise cet écran
**Then** aucun fichier de CV n'a besoin d'entrer dans le dépôt Git

### Story 5.18: Lire les messages qu'on m'envoie

As a Jeevons,
I want consulter les messages reçus via mon site,
So that je ne rate aucune sollicitation.

**Acceptance Criteria:**

**Given** aucun stockage de message n'existe encore
**When** cette story est terminée
**Then** le modèle `ContactMessage` existe avec nom, e-mail, corps, adresse d'origine, état de lecture et date, décrit par une migration

**Given** des messages ont été reçus
**When** j'ouvre la boîte de réception
**Then** je les vois du plus récent au plus ancien, les non lus étant distingués visuellement

**Given** j'ouvre un message
**When** je le lis
**Then** il est marqué comme lu
**And** je peux le repasser en non lu

**Given** un message est indésirable
**When** je le supprime après confirmation
**Then** il disparaît définitivement

**Given** aucun message n'a encore été reçu
**When** j'ouvre la boîte de réception
**Then** un état vide explicite s'affiche, sans erreur

> Le formulaire public qui alimente cette boîte est livré en Epic 6. Cette story permet déjà de consulter et de gérer les messages, vérifiable par insertion directe.

### Story 5.19: Retrouver ce que j'ai modifié

As a Jeevons,
I want savoir quelles modifications ont été faites et quand,
So that je puisse comprendre un changement inattendu et prouver que rien d'anormal ne s'est produit.

**Acceptance Criteria:**

**Given** aucune traçabilité n'existe
**When** cette story est terminée
**Then** le modèle `AuditLog` existe avec utilisateur, action, entité, identifiant d'entité, différence et date

**Given** j'effectue une modification depuis l'administration
**When** l'opération réussit
**Then** une entrée de journal est écrite, quel que soit le type de contenu concerné
**And** elle indique ce qui a changé, avec assez de précision pour être compris plus tard

**Given** une modification échoue
**When** je consulte le journal
**Then** aucune entrée trompeuse n'a été écrite pour une opération qui n'a pas abouti

**Given** le journal peut contenir des données sensibles
**When** j'inspecte son contenu
**Then** aucune empreinte de mot de passe, aucun secret de second facteur ni code de récupération n'y figure

### Story 5.20: Utiliser l'administration au clavier, sans à-coups

As a Jeevons,
I want une administration utilisable entièrement au clavier et sans clignotement au chargement,
So that mon back-office soit agréable à utiliser au quotidien.

**Acceptance Criteria:**

**Given** je navigue au clavier dans l'administration
**When** je parcours une page avec la touche de tabulation
**Then** chaque élément interactif est atteignable, dans un ordre logique
**And** l'élément qui a le focus est toujours visible, avec un contraste suffisant

**Given** une boîte de dialogue de confirmation s'ouvre
**When** je navigue au clavier
**Then** le focus est piégé à l'intérieur et la touche d'échappement la ferme
**And** le focus revient à l'élément qui l'avait déclenchée

**Given** une liste ou un tableau charge ses données
**When** l'attente dure
**Then** une silhouette de chargement occupe la place du contenu final
**And** la page ne saute pas quand les données arrivent

**Given** l'application respecte le réglage de mouvement réduit
**When** ce réglage est actif
**Then** l'animation de ces silhouettes est neutralisée

---

## Epic 6: Un portfolio qui marque

Un recruteur qui arrive sur le site rencontre une expérience soignée et animée, peut explorer chaque projet en détail, consulter le CV et prendre contact directement — sans qu'aucune animation ne gêne une personne sensible au mouvement.

> **Contrainte transverse** : chaque story introduisant du mouvement porte son propre critère de neutralisation sous mouvement réduit. Ce n'est pas une story de fin d'epic, c'est une condition d'acceptation de chacune. Le socle est posé en story 6.2.
>
> **Décision de cadrage** : le site reste en thème sombre unique. Les variables de style sont néanmoins structurées pour qu'un thème clair reste possible plus tard sans refonte.

### Story 6.1: Systématiser l'identité visuelle existante

As a Jeevons,
I want que les couleurs, rayons et espacements du site soient définis en un seul endroit,
So that toute évolution visuelle se fasse d'un geste, sans chasse aux valeurs éparpillées.

**Acceptance Criteria:**

**Given** les valeurs de style sont aujourd'hui dispersées dans les classes utilitaires
**When** cette story est terminée
**Then** les surfaces, les couleurs d'accent, les rayons et l'échelle d'espacement sont déclarés en variables de style centralisées
**And** les composants s'y réfèrent, sans réintroduire de valeur en dur

**Given** l'identité actuelle est reconnaissable et doit être conservée
**When** je compare le site avant et après
**Then** le rendu est visuellement identique : même fond sombre, même dégradé d'accent, même grain, même police à empattements pour les titres

**Given** un thème clair pourrait être ajouté plus tard
**When** j'examine la structure des variables
**Then** elle permettrait de basculer de thème sans réécrire les composants
**And** aucune bibliothèque de gestion de thème n'est installée, et aucune détection de préférence de couleur système n'est en place

### Story 6.2: Neutraliser le mouvement d'un seul geste

As a développeur du portfolio,
I want un mécanisme unique qui coupe toutes les animations,
So that chaque animation ajoutée par la suite respecte le choix du visiteur sans effort supplémentaire.

**Acceptance Criteria:**

**Given** l'Epic 1 a neutralisé les animations existantes au cas par cas
**When** cette story est terminée
**Then** un mécanisme partagé permet à tout composant de savoir si le mouvement doit être réduit
**And** une neutralisation globale s'applique par défaut aux transitions et animations décoratives

**Given** une nouvelle animation est ajoutée au site
**When** le réglage de mouvement réduit est actif
**Then** elle est neutralisée sans que le développeur ait à y penser
**And** le contenu reste présenté dans son état final, jamais masqué

**Given** ce comportement doit rester vérifiable
**When** je veux le tester
**Then** la façon de simuler ce réglage est documentée

### Story 6.3: Rendre les titres et les textes agréables à lire

As a visiteur du portfolio,
I want des textes bien équilibrés quelle que soit la taille de mon écran,
So that la lecture soit confortable du téléphone au grand écran.

**Acceptance Criteria:**

**Given** les tailles de texte sont aujourd'hui figées par palier
**When** cette story est terminée
**Then** l'échelle typographique s'adapte continûment à la largeur de l'écran, entre un minimum et un maximum définis

**Given** un titre tient sur plusieurs lignes
**When** il se rend
**Then** ses lignes sont équilibrées, sans mot isolé en dernière ligne

**Given** un paragraphe se rend
**When** je le lis
**Then** il évite les lignes orphelines en fin de bloc

**Given** je consulte le site sur un petit écran
**When** je parcours chaque section
**Then** aucun texte ne déborde ni ne devient illisible

### Story 6.4: Découvrir le contenu à mesure que je défile

As a visiteur du portfolio,
I want que le contenu apparaisse avec fluidité quand il entre à l'écran,
So that la navigation soit agréable plutôt que brutale.

**Acceptance Criteria:**

**Given** les sections apparaissent aujourd'hui sans transition
**When** je fais défiler la page
**Then** chaque bloc se révèle à son entrée dans la zone visible
**And** les éléments d'une même liste se révèlent en cascade, légèrement décalés

**Given** une révélation ne doit pas priver de contenu
**When** j'arrive directement sur une ancre en milieu de page
**Then** le contenu visible est déjà révélé, sans attendre un défilement

**Given** le réglage de mouvement réduit est actif
**When** je fais défiler
**Then** le contenu est présenté directement dans son état final, sans animation

**Given** l'animation ne doit pas coûter en fluidité
**When** je fais défiler sur un appareil modeste
**Then** le défilement reste fluide

### Story 6.5: Situer ma progression dans la page

As a visiteur du portfolio,
I want voir où j'en suis dans la page et dans quelle section je me trouve,
So that je garde mes repères sur une page longue.

**Acceptance Criteria:**

**Given** je fais défiler la page
**When** je regarde le haut de l'écran
**Then** une barre de progression aux couleurs d'accent reflète ma position dans la page

**Given** la navigation est fixée en haut
**When** je m'éloigne du haut de la page
**Then** elle se compacte et se floute pour se faire discrète sans disparaître

**Given** je traverse les sections
**When** une section occupe l'essentiel de l'écran
**Then** l'entrée de menu correspondante est mise en évidence
**And** ce repérage s'appuie sur les identifiants de section uniques posés en Epic 1

**Given** je navigue au clavier
**When** je parcours le menu
**Then** chaque entrée reste atteignable et son état actif est perceptible autrement que par la seule couleur

**Given** le réglage de mouvement réduit est actif
**When** je fais défiler
**Then** la barre et la navigation s'actualisent sans transition animée

### Story 6.6: Rendre les éléments interactifs vivants

As a visiteur du portfolio,
I want que les boutons et le curseur réagissent à mes gestes,
So that je perçoive immédiatement le soin apporté au détail.

**Acceptance Criteria:**

**Given** je survole un bouton d'action à la souris
**When** je m'en approche
**Then** il se déplace légèrement vers mon curseur, de quelques pixels seulement
**And** il retrouve sa position dès que je m'en éloigne

**Given** je navigue sur un ordinateur avec une souris
**When** je déplace le curseur
**Then** un curseur personnalisé le suit, et son halo grossit au survol des éléments interactifs

**Given** je navigue sur un écran tactile
**When** j'utilise le site
**Then** ces effets sont désactivés et le comportement tactile reste standard

**Given** le réglage de mouvement réduit est actif
**When** je survole ces éléments
**Then** aucun de ces effets ne s'applique et le curseur système reste inchangé

**Given** ces effets sont purement décoratifs
**When** je navigue au clavier
**Then** ils n'entravent ni le parcours de focus ni l'activation des contrôles

### Story 6.7: Être accueilli par une page d'accueil marquante

As a recruteur,
I want une première impression forte en arrivant sur le site,
So that je retienne le portfolio parmi tous ceux que je consulte.

**Acceptance Criteria:**

**Given** les orbites animées de l'accueil sont l'élément reconnaissable du site
**When** je déplace ma souris sur la zone d'accueil
**Then** les anneaux réagissent au pointeur par un léger décalage de profondeur
**And** l'effet reste subtil, sans donner le tournis

**Given** le rôle est aujourd'hui un texte fixe
**When** la page d'accueil s'affiche
**Then** le rôle défile entre plusieurs intitulés avec un effet de frappe
**And** le texte alterné est annoncé de façon compréhensible aux technologies d'assistance, sans les inonder de mises à jour

**Given** la zone d'accueil détermine la performance perçue
**When** je mesure le chargement
**Then** l'élément principal s'affiche rapidement et la mise en page ne saute pas

**Given** le réglage de mouvement réduit est actif
**When** j'arrive sur la page
**Then** les orbites sont immobiles, le parallaxe est désactivé et le rôle s'affiche fixe, sans effet de frappe

### Story 6.8: Explorer les cartes de projet

As a visiteur du portfolio,
I want que les cartes de projet réagissent quand je les survole,
So that l'exploration soit engageante.

**Acceptance Criteria:**

**Given** les cartes grandissent aujourd'hui brutalement au survol
**When** je survole une carte à la souris
**Then** elle s'incline légèrement en suivant la position du pointeur
**And** un halo lumineux suit le curseur sur sa surface
**And** l'ancien effet d'agrandissement est retiré

**Given** je m'éloigne de la carte
**When** le pointeur en sort
**Then** elle revient à sa position d'origine sans à-coup

**Given** je navigue au clavier ou sur écran tactile
**When** j'atteins une carte
**Then** un état de mise en évidence lisible est présenté, sans dépendre du pointeur

**Given** le réglage de mouvement réduit est actif
**When** je survole une carte
**Then** ni inclinaison ni halo ne s'appliquent

### Story 6.9: Suivre le parcours de Jeevons

As a recruteur,
I want lire le parcours de Jeevons dans un déroulé clair,
So that je comprenne sa progression d'un coup d'œil.

**Acceptance Criteria:**

**Given** le parcours est aujourd'hui présenté en carrousel horizontal
**When** cette story est terminée
**Then** il est présenté en déroulé vertical, chronologique et lisible sans interaction

**Given** je fais défiler la page
**When** le déroulé entre à l'écran
**Then** la ligne se remplit progressivement et les jalons s'illuminent à mesure

**Given** les entrées viennent de la base
**When** je consulte le déroulé
**Then** il reflète les entrées publiées dans l'ordre défini en administration

**Given** je consulte sur téléphone
**When** je parcours le déroulé
**Then** il reste lisible, sans défilement horizontal

**Given** le réglage de mouvement réduit est actif
**When** le déroulé entre à l'écran
**Then** il s'affiche complet et rempli, sans animation de progression

### Story 6.10: Consulter un projet en détail

As a recruteur,
I want ouvrir la fiche complète d'un projet,
So that je comprenne le contexte, le rôle tenu et les technologies employées — ce qu'une simple carte ne peut pas dire.

**Acceptance Criteria:**

**Given** aucune page dédiée aux projets n'existe
**When** cette story est terminée
**Then** chaque projet publié dispose d'une page à son adresse propre, construite sur son identifiant d'URL
**And** cette page présente le contexte, le rôle, les technologies, les illustrations et le lien vers le dépôt

**Given** un projet n'a pas de résultat chiffré renseigné
**When** j'ouvre sa page
**Then** la section correspondante est simplement absente, sans espace vide ni mention d'information manquante

**Given** un projet est en brouillon
**When** j'ouvre son adresse sans être connecté
**Then** je reçois une page « non trouvée »

**Given** je demande une adresse qui ne correspond à aucun projet
**When** la page se rend
**Then** je reçois une page « non trouvée » soignée, avec un chemin de retour vers l'accueil

**Given** ces pages doivent être trouvables
**When** un moteur les explore
**Then** chacune porte ses propres métadonnées de titre, description et image de partage
**And** elles figurent dans le plan du site

**Given** je navigue depuis une carte vers la fiche
**When** la transition s'opère
**Then** elle est fluide plutôt qu'abrupte
**And** sous mouvement réduit, la navigation est immédiate et sans transition

### Story 6.11: Consulter et télécharger le CV

As a recruteur,
I want lire le CV directement dans mon navigateur,
So that je n'aie pas à télécharger un fichier pour y jeter un œil.

**Acceptance Criteria:**

**Given** le CV n'est aujourd'hui accessible que par un lien de téléchargement direct
**When** cette story est terminée
**Then** une page dédiée l'affiche dans le navigateur
**And** un bouton de téléchargement reste proposé

**Given** le CV courant est géré depuis l'administration
**When** Jeevons en téléverse une nouvelle version
**Then** cette page sert la nouvelle version sans changement de code

**Given** mon navigateur ne peut pas afficher le document intégré
**When** j'ouvre la page
**Then** un message clair et le lien de téléchargement me sont proposés

**Given** je consulte sur téléphone
**When** j'ouvre la page
**Then** le document reste lisible ou le téléchargement est proposé d'emblée

### Story 6.12: Prendre contact directement depuis le site

As a recruteur,
I want écrire à Jeevons depuis son site,
So that je puisse le solliciter sans quitter la page ni ouvrir mon client de messagerie.

**Acceptance Criteria:**

**Given** le contact passe aujourd'hui par un lien de messagerie
**When** cette story est terminée
**Then** un formulaire me permet de saisir mon nom, mon adresse et mon message
**And** l'envoi enregistre le message et le rend visible dans la boîte de réception de l'administration

**Given** un message est reçu
**When** l'enregistrement réussit
**Then** une notification est envoyée à Jeevons par courrier électronique
**And** l'échec de cet envoi ne fait pas perdre le message, qui reste enregistré

**Given** les robots remplissent les formulaires automatiquement
**When** un champ piège invisible est rempli
**Then** la soumission est silencieusement ignorée
**And** aucun message n'est enregistré ni notifié

**Given** un même visiteur soumet en boucle
**When** il dépasse un seuil raisonnable sur une courte période
**Then** les soumissions suivantes sont refusées avec un message compréhensible

**Given** ma saisie est incomplète ou mal formée
**When** je soumets
**Then** les erreurs me sont indiquées champ par champ
**And** la validation est appliquée côté serveur

**Given** l'envoi réussit
**When** l'opération se termine
**Then** une confirmation claire s'affiche
**And** aucune adresse personnelle de Jeevons n'apparaît en clair dans la page

### Story 6.13: Comprendre les compétences de Jeevons

As a recruteur,
I want voir les technologies maîtrisées et le niveau sur chacune,
So that je juge rapidement de l'adéquation à mon poste.

**Acceptance Criteria:**

**Given** les technologies sont aujourd'hui présentées sans hiérarchie
**When** cette story est terminée
**Then** elles sont regroupées par domaine et le niveau de maîtrise est indiqué pour chacune
**And** ces informations proviennent de la base, telles que saisies en administration

**Given** le niveau est représenté visuellement
**When** je consulte cette section
**Then** il reste compréhensible sans dépendre uniquement de la couleur
**And** il est accessible aux technologies d'assistance

**Given** aucune technologie n'est enregistrée
**When** la section se rend
**Then** elle est masquée plutôt que présentée vide

### Story 6.14: Saisir l'expérience de Jeevons en quelques chiffres

As a recruteur,
I want quelques chiffres marquants sur le parcours de Jeevons,
So that j'aie un repère immédiat avant d'entrer dans le détail.

**Acceptance Criteria:**

**Given** aucune section de ce type n'existe
**When** cette story est terminée
**Then** une section présente les chiffres clés du portfolio
**And** ils sont calculés à partir des données réelles plutôt que saisis à la main, quand c'est possible

**Given** la section entre à l'écran
**When** je la découvre
**Then** les nombres défilent jusqu'à leur valeur finale
**And** ils ne s'animent qu'une seule fois par visite

**Given** le réglage de mouvement réduit est actif
**When** la section entre à l'écran
**Then** les valeurs finales s'affichent directement

### Story 6.15: Découvrir la personnalité de Jeevons

As a visiteur du portfolio,
I want une section « à propos » vivante et bien organisée,
So that je perçoive la personne derrière les projets.

**Acceptance Criteria:**

**Given** la section rassemble des contenus de natures différentes
**When** cette story est terminée
**Then** elle est organisée en grille modulaire, chaque bloc ayant une taille adaptée à son contenu

**Given** le bloc des centres d'intérêt était déjà manipulable
**When** je le découvre
**Then** ce comportement est conservé et cohérent avec le reste de la grille

**Given** je consulte sur téléphone
**When** je parcours la section
**Then** la grille se réorganise en une lecture verticale, sans perte de contenu

**Given** le réglage de mouvement réduit est actif
**When** j'interagis avec la section
**Then** les animations sont neutralisées, le contenu restant entièrement accessible

### Story 6.16: Percevoir un site vivant jusque dans les détails

As a visiteur du portfolio,
I want des détails d'ambiance soignés,
So that le site donne une impression d'ensemble aboutie.

**Acceptance Criteria:**

**Given** le bandeau défilant a aujourd'hui une vitesse fixe
**When** je fais défiler la page
**Then** sa vitesse suit celle de mon défilement et sa direction s'inverse selon mon sens de lecture

**Given** le fond utilise aujourd'hui une texture fixe
**When** je consulte le site
**Then** un dégradé d'ambiance animé s'y ajoute discrètement
**And** il n'entrave ni la lisibilité du texte ni le contraste

**Given** ces effets sont décoratifs
**When** je mesure la performance
**Then** ils n'entament pas la fluidité du défilement ni les scores de performance visés

**Given** le réglage de mouvement réduit est actif
**When** je consulte le site
**Then** le bandeau est immobile et le fond statique

### Story 6.17: Récompenser les curieux

As a visiteur curieux,
I want découvrir une surprise cachée,
So that je garde un souvenir amusant du portfolio.

**Acceptance Criteria:**

**Given** une séquence de touches secrète est définie
**When** je la saisis sur la page
**Then** un effet visuel amusant se déclenche
**And** il se termine de lui-même ou peut être interrompu

**Given** cette surprise ne doit gêner personne
**When** je navigue normalement
**Then** je ne la déclenche jamais par accident
**And** elle n'interfère ni avec la navigation clavier ni avec les technologies d'assistance

**Given** le réglage de mouvement réduit est actif
**When** je saisis la séquence
**Then** l'effet est neutralisé ou remplacé par une version statique

### Story 6.18: Charger les images sans attente ni saut

As a visiteur du portfolio,
I want des images qui s'affichent vite et sans faire sauter la page,
So that la consultation reste fluide, y compris en connexion lente.

**Acceptance Criteria:**

**Given** les images sont aujourd'hui servies dans un format unique
**When** cette story est terminée
**Then** elles sont servies dans des formats modernes et à des tailles adaptées à l'écran

**Given** une image met du temps à charger
**When** la page se rend
**Then** un aperçu flouté occupe sa place
**And** la mise en page ne saute pas à l'arrivée de l'image

**Given** les illustrations viennent désormais de la bibliothèque de médias
**When** elles s'affichent sur le site public
**Then** elles bénéficient du même traitement que les images intégrées au projet

**Given** des images restent dans le dépôt après la purge de l'Epic 1
**When** j'inventorie ce qui subsiste
**Then** chaque fichier conservé est effectivement utilisé

---

## Epic 7: Je sais que ça marche et ce qui est regardé

Toute régression fonctionnelle, d'accessibilité ou de performance est détectée automatiquement avant fusion, et l'administrateur sait quels projets les visiteurs consultent réellement.

### Story 7.1: Vérifier automatiquement les parcours essentiels

As a Jeevons,
I want que les parcours clés de mon site soient testés à chaque modification,
So that je ne casse jamais sans le voir ce qu'un recruteur va utiliser.

**Acceptance Criteria:**

**Given** aucun test automatisé n'existe sur le projet
**When** cette story est terminée
**Then** un cadre de tests de bout en bout est installé et documenté
**And** une seule commande les exécute en local

**Given** les parcours publics sont ceux qui comptent le plus
**When** les tests s'exécutent
**Then** ils couvrent la consultation de l'accueil, la navigation entre sections, l'ouverture d'une fiche projet, la consultation du CV et l'envoi du formulaire de contact

**Given** l'administration protège du contenu
**When** les tests s'exécutent
**Then** ils vérifient qu'une page d'administration est inaccessible sans session
**And** ils vérifient qu'un projet en brouillon n'apparaît pas publiquement

**Given** un test échoue
**When** je consulte son rapport
**Then** la cause est identifiable, avec une capture ou une trace exploitable

### Story 7.2: Empêcher toute régression d'accessibilité

As a visiteur en situation de handicap,
I want que le site reste accessible au fil de ses évolutions,
So that je puisse continuer à le consulter sans obstacle.

**Acceptance Criteria:**

**Given** l'accessibilité a été corrigée manuellement lors des epics précédents
**When** cette story est terminée
**Then** un audit automatisé s'exécute sur les pages principales du site
**And** il est intégré à la suite de tests de bout en bout

**Given** une violation d'accessibilité est introduite
**When** l'audit s'exécute
**Then** il échoue en indiquant la règle enfreinte et l'élément concerné

**Given** le contraste doit respecter le niveau AA
**When** j'audite le site public et l'administration
**Then** aucun texte ni élément d'interface n'est en dessous de ce seuil
**And** les écarts constatés sont corrigés dans le cadre de cette story

### Story 7.3: Bloquer toute contribution qui dégrade le site

As a Jeevons,
I want que l'intégration continue refuse un code qui casse ou ralentit le site,
So that ma production reste saine sans que j'aie à y penser.

**Acceptance Criteria:**

**Given** l'intégration continue exécute aujourd'hui le lint et la construction
**When** cette story est terminée
**Then** elle exécute aussi les tests de bout en bout et l'audit d'accessibilité
**And** un échec bloque la fusion

**Given** des seuils de performance sont visés
**When** la mesure s'exécute en intégration continue
**Then** un score inférieur à 95 sur l'une des catégories fait échouer le contrôle
**And** un temps d'affichage du contenu principal supérieur à deux secondes, ou un décalage de mise en page supérieur au seuil fixé, le fait échouer également

**Given** ces contrôles allongent le temps de vérification
**When** j'ouvre une demande de fusion
**Then** la durée totale reste raisonnable, les travaux indépendants s'exécutant en parallèle

### Story 7.4: Savoir combien de personnes visitent mon portfolio

As a Jeevons,
I want mesurer la fréquentation de mon site sans dépendre d'un service tiers,
So that je garde mes données chez moi et que je n'aie pas à afficher de bandeau de consentement.

**Acceptance Criteria:**

**Given** la base de mesure a été créée en Epic 2
**When** cette story est terminée
**Then** un service de mesure d'audience auto-hébergé tourne sur le VPS, joignable sur son propre sous-domaine en HTTPS
**And** il utilise cette base existante, sans conteneur de base supplémentaire

**Given** ce service arrive avec un compte par défaut connu publiquement
**When** la mise en service se termine
**Then** ce mot de passe a été changé
**And** le secret d'application a été généré aléatoirement et conservé hors du dépôt

**Given** la mesure ne doit pas dépendre du site mesuré
**When** j'ajoute le script de suivi au portfolio
**Then** il n'est chargé que si l'identifiant de site est configuré
**And** aucune mesure n'est envoyée depuis un poste de développement

**Given** cette solution se veut respectueuse de la vie privée
**When** je vérifie son fonctionnement
**Then** aucun cookie n'est déposé et aucune donnée personnelle n'est collectée
**And** aucun bandeau de consentement n'est nécessaire

**Given** le script est chargé
**When** je mesure la performance de la page
**Then** les seuils fixés en story 7.3 restent respectés

### Story 7.5: Savoir ce que les recruteurs regardent vraiment

As a Jeevons,
I want savoir quels projets sont consultés et quelles actions sont effectuées,
So that je mette en avant ce qui intéresse réellement, plutôt que ce que je crois.

**Acceptance Criteria:**

**Given** la mesure de fréquentation est en place
**When** un visiteur télécharge le CV, ouvre une fiche projet, envoie le formulaire ou clique sur un lien social
**Then** un événement correspondant est enregistré
**And** l'ouverture d'une fiche projet précise de quel projet il s'agit

**Given** ces événements doivent rester fiables dans la durée
**When** j'inspecte leur mise en place
**Then** le nom des événements est centralisé plutôt que recopié à chaque appel
**And** l'appel de mesure est typé

**Given** un bloqueur empêche le chargement du script
**When** un visiteur effectue ces actions
**Then** elles fonctionnent normalement
**And** aucune erreur n'apparaît dans la console

**Given** les mesures alimentent le tableau de bord d'administration
**When** je consulte la page d'accueil de l'administration
**Then** la fréquentation des sept derniers jours y est renseignée, remplaçant la mention d'indisponibilité de la story 5.7

### Story 7.6: Pouvoir reprendre mon projet dans six mois

As a Jeevons,
I want une documentation qui me dise comment mon projet se lance, se déploie et se répare,
So that je ne perde pas une soirée à retrouver comment tout fonctionne.

**Acceptance Criteria:**

**Given** le fichier de présentation du dépôt ne décrit pas le fonctionnement du projet
**When** cette story est terminée
**Then** il explique comment lancer le projet en local, quelles variables d'environnement sont nécessaires et quel flux de branches suivre

**Given** l'exploitation du VPS comporte des gestes précis
**When** je consulte la documentation d'exploitation
**Then** j'y trouve la procédure de déploiement, celle de retour arrière, la conduite à tenir si l'application ne répond plus, et la procédure de déblocage du second facteur

**Given** le changement de domaine est prévu à terme
**When** je consulte cette documentation
**Then** la marche à suivre y figure, avec l'avertissement que l'adresse publique est figée à la construction de l'image et impose donc une reconstruction

**Given** les sauvegardes protègent des données réelles
**When** je vérifie leur périmètre
**Then** la base du portfolio et celle de la mesure d'audience y sont incluses
**And** une restauration a été testée au moins une fois, et le résultat consigné

---

## Rapport de validation

Contrôles effectués sur le document terminé, par vérification mécanique du contenu plutôt que de mémoire.

### Couverture des exigences

| Famille | Total | Couvertes | Non couvertes |
|---|---:|---:|---:|
| Exigences fonctionnelles | 36 | 36 | 0 |
| Exigences non fonctionnelles | 21 | 21 | 0 |
| Exigences de design | 21 | 21 | 0 |

Chaque exigence apparaît dans au moins une story, et ses critères d'acceptation en couvrent la substance — pas seulement une mention.

### Répartition des stories

| Epic | Stories | Portée |
|---|---:|---|
| 1 — Portfolio propre et indexable | 10 | Dettes bloquantes, accessibilité de base, référencement |
| 2 — Le portfolio tourne sur mon VPS | 7 | Conteneurisation, bases, domaine, sortie de Vercel |
| 3 — Socle moderne et discipline de code | 7 | Monorepo, Bun, Next 16, outillage, intégration continue |
| 4 — Mon contenu vit en base | 6 | Prisma, seed, cache, repli statique, migrations |
| 5 — Je gère mon portfolio sans commit | 20 | Authentification, double facteur, écrans de gestion |
| 6 — Un portfolio qui marque | 18 | Fondations visuelles, animations, nouvelles pages |
| 7 — Je sais que ça marche | 6 | Tests, accessibilité, seuils, audience, documentation |
| **Total** | **74** | **274 critères d'acceptation** |

### Création des modèles de données

Aucun schéma posé d'un bloc : chaque modèle est créé par la première story qui l'utilise.

| Story | Modèles créés |
|---|---|
| 4.1 | `Project`, `Highlight`, `Stack`, énumérations `ProjectCategory` et `SkillLevel` |
| 4.2 | `TimelineEntry`, `Hobby` |
| 4.3 | `SiteSetting` |
| 5.1 | `User` |
| 5.3 | Champs de second facteur sur `User` |
| 5.12 | `Media` |
| 5.18 | `ContactMessage` |
| 5.19 | `AuditLog` |

### Dépendances

**Entre epics** — une seule dépendance bloquante : l'Epic 5 suppose l'Epic 4 terminé, les écrans d'administration écrivant dans les modèles qui y sont créés. Toutes les autres références inter-epics pointent vers des epics antérieurs ou sont des notes de séquencement, jamais des conditions de réalisation.

**Dans chaque epic** — aucune story ne dépend d'une story ultérieure. Deux cas méritaient attention, tous deux résolus par un ordre correct :

- La story 5.18 rend la boîte de réception consultable avant que la story 6.12 ne livre le formulaire public qui l'alimente. La story est vérifiable seule, par insertion directe de messages.
- La story 5.7 affiche une mention d'indisponibilité pour la fréquentation ; la story 7.5 exige explicitement de la remplacer une fois la mesure en place. La boucle est fermée des deux côtés.

### Recouvrement de fichiers entre epics

Les epics 1 et 6 modifient tous deux les composants de cartes et de sections de projets. Le regroupement a été examiné puis écarté : l'Epic 1 doit rester livrable en une journée et partir en production sans attendre la refonte visuelle, qui intervient plusieurs semaines plus tard. Le recouvrement est donc assumé, et les stories 3.7, 6.1 et 6.8 rappellent explicitement de préserver les corrections apportées en Epic 1.

### Accessibilité du mouvement

Les onze stories de l'Epic 6 qui introduisent du mouvement portent chacune un critère de neutralisation sous mouvement réduit. La story 6.2 fournit le mécanisme partagé. L'accessibilité n'est donc pas reportée en fin de parcours.

### Écarts relevés par rapport au plan source

| Sujet | Plan | Constat |
|---|---|---|
| Cherry-pick de `develop` | À faire, en écartant des suppressions d'assets | Sans objet : `develop` ne modifie que `Testimonials.tsx` et ne supprime aucun asset |
| Numéros de ligne des dettes | D1 à D12 référencés | Tous décalés ; corrigés dans l'inventaire d'après le code réel |
| Poids des assets morts | Environ 15 Mo | 16 Mo dans `src/assets` et 4,9 Mo dans `public` ; environ 15,2 Mo réellement supprimables |
| Dette D3 | Trois liens sans attribut de sécurité | Deux seulement : le lien du CV le porte déjà |
| Déduplication des sections | Implicitement en phase visuelle | Remontée en Epic 3, avant le branchement à la base |
| Base de mesure d'audience | Phase de qualité | Créée dès l'Epic 2, en même temps que la base du portfolio |

### Point resté ouvert

La story 6.14 prévoit des chiffres calculés depuis les données réelles lorsque c'est possible. Le nombre de projets et de technologies se déduit de la base ; le nombre d'années de code ne s'en déduit pas et devra être saisi quelque part. Aucun réglage dédié n'a été prévu : à trancher à l'implémentation.
