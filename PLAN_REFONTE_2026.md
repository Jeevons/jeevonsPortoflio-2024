# Portfolio Jeevons — Plan de refonte 2026

> Analyse de l'existant + plan d'implémentation : back-office admin, refonte visuelle/animations, conteneurisation & migration Vercel → VPS Coolify (process Doshwork).

---

## 1. Analyse de l'existant

### 1.1 Stack actuelle

| Couche | Actuel | Cible |
|---|---|---|
| Framework | Next.js **14.2.5** (App Router) | Next.js 16.2 |
| React | 18 | 19.2 |
| Package manager | **npm** (`package-lock.json`) | **Bun 1.3+** (parité Doshwork) |
| Styling | TailwindCSS 3.4 | Tailwind 3.4 + shadcn/ui |
| Animation | framer-motion 11 (usage marginal) | motion 12 + CSS scroll-driven |
| Données | **Hardcodées dans les `.tsx`** | Postgres 16 + Prisma 7 |
| Déploiement | **Vercel** | VPS Hetzner + Coolify + Docker |
| Tests | **Aucun** | Playwright E2E + a11y |
| CI | **Aucune** | GitHub Actions (calqué Doshwork) |

### 1.2 Cartographie du code

```
src/
├── app/          layout.tsx (metadata minimale), page.tsx (monolithe 9 sections), globals.css
├── sections/     Header · Hero · Projects · SelfProject · Tape · Testimonials · About · Contact · Footer
├── components/   Card · CardHeader · HeroOrbit · SectionHeader · TechIcon · ToolboxItems
└── assets/       ~40 images (dont 7 WebP de CV à ~1,8 Mo pièce) + 11 icônes SVG
```

### 1.3 État des branches

| Branche | Écart / Production | Contenu |
|---|---|---|
| `Production` | — | branche par défaut, déployée sur Vercel |
| `develop` | +1 commit (`1b7ef01`) | « auto scroll animation part 1 » sur Testimonials (+71 l.) **et supprime tous les CV/PDF/WebP** — travail inachevé |
| `fix` | 0 commit devant | déjà mergé (textes FR Header + README), **branche morte** |

**Action** : cherry-pick l'animation utile de `develop` (`Testimonials.tsx`, `SectionHeader.tsx`) sans les suppressions d'assets, puis supprimer `fix` et repartir sur un modèle `DEV` → `PROD` identique à Doshwork.

### 1.4 Dettes et bugs identifiés

| # | Fichier | Problème | Gravité |
|---|---|---|---|
| D1 | `SelfProject.tsx:426` | `id="projects"` **dupliqué** avec `Projects.tsx:287` → l'ancre `#projects` du Header ne cible jamais la bonne section | 🔴 |
| D2 | `Footer.tsx:33` | `target="_blanck"` (faute) → chaque lien social ouvre un nouvel onglet nommé, pas `_blank` | 🔴 |
| D3 | `Projects.tsx:331`, `SelfProject.tsx:469` | `target="_blank"` sans `rel="noopener noreferrer"` | 🟠 |
| D4 | `Projects.tsx:332` | `<button>` imbriqué dans `<a>` → HTML invalide, a11y cassée | 🟠 |
| D5 | `Testimonials.tsx:773` | `<section>` sans `id`, absente de la nav | 🟡 |
| D6 | assets | 7 WebP de CV × ~1,8 Mo + PDF versionnés = **~15 Mo** de repo pour un seul CV affiché | 🟠 |
| D7 | `layout.tsx:14` | Metadata minimale : pas d'OpenGraph, pas de Twitter card, pas de `metadataBase`, pas de favicon custom, pas de sitemap/robots | 🔴 SEO |
| D8 | tout `sections/` | Contenu 100 % hardcodé : chaque ajout de projet = commit + redéploiement | 🔴 (motive l'admin) |
| D9 | `Hero.tsx:203`, `Contact.tsx` | Textes périmés : « alternance pour **2025** », « année scolaire **2025-2026** », Footer « © **2024** » | 🔴 |
| D10 | `Contact.tsx:699` | Téléphone + email **en clair dans le HTML** → moisson par bots | 🟠 |
| D11 | global | Aucun `prefers-reduced-motion` alors que le Hero anime 10 orbites en continu | 🟠 a11y |
| D12 | `Card.tsx:14` | `after:-outline-2` (valeur négative invalide) → le liseré ne s'affiche pas comme prévu | 🟡 |
| D13 | `package.json` | Pas de `prettier`, pas de husky/lint-staged/commitlint (Doshwork les a) | 🟡 |
| D14 | `Projects/SelfProject` | ~90 % de code dupliqué entre les deux sections | 🟡 |

---

## 2. Architecture cible

Monorepo Bun calqué sur Doshwork, mais **plus léger** : pas de NestJS séparé — les Route Handlers Next.js suffisent pour un portfolio (une seule image à builder, un seul conteneur).

```
jeevonsPortfolio/
├── .github/workflows/ci.yml
├── apps/
│   └── web/
│       ├── prisma/{schema.prisma,seed.ts,migrations/}
│       ├── src/
│       │   ├── app/
│       │   │   ├── (site)/          # portfolio public
│       │   │   ├── (admin)/admin/   # back-office protégé
│       │   │   ├── api/
│       │   │   │   ├── health/      # healthcheck Coolify
│       │   │   │   ├── admin/       # CRUD (auth requise)
│       │   │   │   └── contact/     # formulaire + rate limit
│       │   │   ├── sitemap.ts · robots.ts · opengraph-image.tsx
│       │   ├── components/{ui,site,admin}/
│       │   ├── lib/{db.ts,auth.ts,storage.ts,validation.ts}
│       │   └── content/             # fallback statique si DB vide
│       ├── Dockerfile               # 4 stages : deps/builder/development/production
│       └── .dockerignore
├── docker-compose.yml               # dev : db + web
├── docker-compose.prod.yml          # prod : web sur réseau `coolify` externe
├── .env.production.example
└── README.md
```

**Décision architecturale** : un seul service `web`. La DB Postgres est mutualisée via Coolify (même service que Doshwork, base séparée `portfolio_prod`) — zéro coût VPS supplémentaire.

### 2.1 Modèle de données (Prisma 7)

```prisma
model Project {
  id          String   @id @default(cuid())
  slug        String   @unique
  category    ProjectCategory      // FLAGSHIP | PERSONAL | LAB
  company     String
  title       String
  description String?  @db.Text
  period      String                // "Janvier - 2024"
  sortOrder   Int      @default(0)
  published   Boolean  @default(false)
  link        String?
  repoUrl     String?
  coverId     String?
  cover       Media?   @relation(fields: [coverId], references: [id])
  highlights  Highlight[]
  stacks      Stack[]  @relation("ProjectStacks")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@index([category, sortOrder])
}

model Highlight  { id String @id @default(cuid()) label String sortOrder Int @default(0) projectId String project Project @relation(fields:[projectId], references:[id], onDelete: Cascade) }
model Stack      { id String @id @default(cuid()) name String @unique iconKey String? level SkillLevel? projects Project[] @relation("ProjectStacks") }
model TimelineEntry { id String @id @default(cuid()) title String place String body String @db.Text avatarId String? startYear Int endYear Int? sortOrder Int @default(0) published Boolean @default(true) }
model Hobby      { id String @id @default(cuid()) title String emoji String posLeft String posTop String }
model Media      { id String @id @default(cuid()) path String width Int height Int blurDataUrl String? alt String createdAt DateTime @default(now()) }
model SiteSetting{ key String @id value Json updatedAt DateTime @updatedAt }   // hero, contact, statut, CV courant
model ContactMessage { id String @id @default(cuid()) name String email String body String @db.Text ip String? read Boolean @default(false) createdAt DateTime @default(now()) }
model User      { id String @id @default(cuid()) email String @unique passwordHash String role Role @default(ADMIN) createdAt DateTime @default(now()) }
model AuditLog  { id String @id @default(cuid()) userId String action String entity String entityId String? diff Json? createdAt DateTime @default(now()) }

enum ProjectCategory { FLAGSHIP PERSONAL LAB }
enum SkillLevel { LEARNING COMFORTABLE STRONG }
enum Role { ADMIN }
```

---

## 3. Back-office admin

### 3.1 Authentification

Mono-utilisateur → pas besoin d'un provider lourd.
- **Auth.js v5** (`next-auth@beta`) en Credentials provider, hash **argon2id**, session JWT en cookie `httpOnly` + `Secure` + `SameSite=Lax`.
- Compte unique seedé via `ADMIN_EMAIL` / `ADMIN_PASSWORD` (idempotent par `upsert`, comme Doshwork).
- **TOTP (2FA)** optionnel via `otplib` — recommandé, le back-office est exposé publiquement.
- Middleware Next protégeant `/admin/*` + rate-limit sur `/api/auth/*` (5 tentatives / 15 min / IP).
- `REGISTRATION_OPEN=false` en dur : aucune route d'inscription.

### 3.2 Écrans

| Route | Contenu |
|---|---|
| `/admin` | Dashboard : compteurs (projets publiés/brouillons), 5 derniers messages, vues 7 j, bouton « Revalider le site » |
| `/admin/projects` | Table filtrable + tri **drag & drop** (dnd-kit) → persiste `sortOrder` |
| `/admin/projects/[id]` | Éditeur : champs + highlights répétables + sélecteur de stacks + upload cover (drag & drop, conversion WebP `sharp`, `blurDataUrl` généré) + **aperçu live** de la carte à droite |
| `/admin/timeline` | CRUD parcours (même pattern) |
| `/admin/stacks` | CRUD stacks + icône + niveau |
| `/admin/settings` | Hero (titre, sous-titre, badge statut), coordonnées, liens sociaux, **upload du CV** (PDF + génération auto de la vignette) |
| `/admin/messages` | Boîte de réception du formulaire de contact, marquer lu / supprimer |
| `/admin/media` | Bibliothèque : grille, remplacement, suppression avec garde d'intégrité |

### 3.3 Points techniques

- **Server Actions** + validation **Zod** partagée client/serveur ; `useOptimistic` pour le réordonnancement.
- **Brouillon / publié** : `published=false` visible uniquement en session admin via `?preview=1`.
- **ISR + revalidation à la demande** : les pages publiques sont statiques (`revalidate: 3600`) ; chaque mutation admin appelle `revalidateTag('projects' | 'timeline' | 'settings')` → site instantanément à jour sans rebuild Docker. **C'est le cœur de la souplesse recherchée.**
- **Uploads** : volume Docker `portfolio_uploads:/app/uploads`, servi par une route `/api/media/[...path]` avec `Cache-Control: immutable`. Pas de S3 (surcoût inutile).
- **AuditLog** sur chaque mutation.
- **Fallback statique** : si la DB est injoignable, `src/content/*.ts` alimente le site → le portfolio ne tombe jamais en erreur pendant un entretien.

---

## 4. Refonte visuelle & animations

### 4.1 Direction artistique

L'identité actuelle (fond `gray-900`, dégradé `emerald-300 → sky-400`, grain, orbites, serif Calistoga) est **bonne et reconnaissable** — on la conserve et on la systématise plutôt que de repartir de zéro.

- **Design tokens** en variables CSS (`--surface-*`, `--accent-from/to`, `--radius-*`, échelle d'espacement) → cohérence + thème alternatif possible.
- **Passe typographique** : `text-wrap: balance` sur les titres, `pretty` sur les paragraphes, échelle fluide en `clamp()`.
- Aujourd'hui le site est **dark-only**. Ajouter un **thème clair** avec `next-themes` (bascule dans le Header, respect de `prefers-color-scheme`).

### 4.2 Animations — par priorité d'impact

**P1 — impact fort, coût faible**
1. **Reveal au scroll** généralisé : `IntersectionObserver` + stagger sur les cartes (remplace l'apparition brutale actuelle).
2. **Scroll progress bar** en dégradé accent, fixée en haut.
3. **Header adaptatif** : la pill se contracte et se floute au scroll, item actif surligné via scroll-spy (règle aussi D1/D5).
4. **Magnetic buttons** : les CTA suivent légèrement le curseur (~8 px) — signature « dev front soigné ».
5. **Curseur custom** desktop : point + halo qui grossit sur les éléments interactifs.

**P2 — signature visuelle**
6. **Hero refondu** : garder les orbites mais y ajouter un **parallaxe à la souris** (les anneaux réagissent au pointeur) + **typing effect** sur le rôle (« Développeur Full-Stack » / « UI Engineer » / « Créatif »).
7. **Cartes projet en 3D tilt** (`rotateX/rotateY` sur mousemove) + **spotlight** radial suivant le curseur — remplace le `hover:scale-110` actuel.
8. **Timeline verticale animée** pour le parcours : ligne qui se remplit au scroll, jalons qui s'illuminent. Bien plus lisible que le carrousel horizontal actuel.
9. **Transitions de page** via `ViewTransition` API (Next 16) pour les pages projet détaillées.
10. **Compteurs animés** dans une nouvelle section stats (projets livrés, technos, années de code).

**P3 — polish**
11. **Bento grid** pour la section À propos (la carte hobbies draggable est un bon point de départ, la généraliser).
12. **Marquee Tape** piloté par la vitesse de scroll (accélère/inverse selon la direction).
13. **Noise + aurora background** animé en CSS pur (déjà 80 % là avec `grain.jpg`).
14. **Skeletons** shimmer pendant les chargements admin.
15. **Konami code / easter egg** — mémorable en entretien.

### 4.3 Nouvelles sections proposées

- **`/projects/[slug]`** : page détaillée par projet (contexte, rôle, stack, captures, résultats chiffrés, lien repo). Aujourd'hui tout tient dans une carte — c'est le principal manque pour convaincre un recruteur.
- **Section « Stack & outils »** enrichie : niveau de maîtrise par techno, groupée par domaine.
- **Section « Chiffres »** : compteurs animés.
- **`/cv`** : viewer PDF inline + bouton téléchargement (au lieu du lien brut actuel).
- **Formulaire de contact** réel (honeypot + rate-limit + envoi SMTP Infomaniak, même config que Doshwork) → remplace l'email en clair (règle D10).

### 4.4 Accessibilité & perf (non négociable)

- `prefers-reduced-motion: reduce` → **toutes** les animations désactivées (règle D11).
- Focus visibles, navigation clavier complète dans l'admin, landmarks ARIA, contrastes AA.
- Cibles Lighthouse : **95+** partout ; LCP < 2 s, CLS < 0,05.
- `next/font` déjà OK ; images converties en AVIF/WebP responsive avec `blurDataUrl` ; purge des 15 Mo d'assets morts (règle D6).
- Audit `@axe-core/playwright` en CI, comme Doshwork.

---

## 5. Conteneurisation & déploiement VPS

Reproduction **stricte** du process Doshwork.

### 5.1 Dockerfile `apps/web` — 4 stages

Identique à `Doshwork/apps/web/Dockerfile` :
- Base `node:22-alpine`, Bun 1.3.3 installé dans `deps`/`builder`/`development`.
- `production` **sans Bun** : `node server.js` sur le standalone (`output: 'standalone'` requis dans `next.config.js`).
- User non-root `nextjs:nodejs` (1001), `HOSTNAME=0.0.0.0`, `EXPOSE 3000`.
- Pas de `HEALTHCHECK` dans l'image : délégué au compose (convention Doshwork).
- Les `NEXT_PUBLIC_*` passées en `ARG` → `ENV` dans `builder` (inlinées au build).
- Ajout spécifique portfolio : `RUN apk add --no-cache vips-dev` dans builder pour `sharp` (traitement d'images admin).

### 5.2 `docker-compose.yml` (dev)

Services `db` (postgres:16-alpine, port bindé sur `127.0.0.1:5432`, healthcheck `pg_isready`) + `web` (target `development`, volumes source + `/app/node_modules` + `/app/.next`, `depends_on: db healthy`).

### 5.3 `docker-compose.prod.yml`

```yaml
services:
  web:
    container_name: portfolio_web
    build:
      context: ./apps/web
      target: production
      args:
        NEXT_PUBLIC_SITE_URL: ${NEXT_PUBLIC_SITE_URL}
    restart: unless-stopped
    environment:
      NODE_ENV: production
      DATABASE_URL: ${DATABASE_URL}
      AUTH_SECRET: ${AUTH_SECRET}
      ADMIN_EMAIL: ${ADMIN_EMAIL}
      ADMIN_PASSWORD: ${ADMIN_PASSWORD}
      MAIL_HOST: ${MAIL_HOST}
      MAIL_PORT: ${MAIL_PORT}
      MAIL_USER: ${MAIL_USER}
      MAIL_PASSWORD: ${MAIL_PASSWORD}
      MAIL_FROM: ${MAIL_FROM}
    volumes:
      - portfolio_uploads:/app/uploads
    networks: [coolify]
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:3000/api/health || exit 1"]
      interval: 15s
      timeout: 5s
      retries: 5
      start_period: 30s

volumes:
  portfolio_uploads:
networks:
  coolify:
    external: true
```

Aucun service `db` : Postgres mutualisé via Coolify, base `portfolio_prod`, `DATABASE_URL` injectée en Secret Coolify (avec `?schema=public` pour Prisma 7).

### 5.4 Migration Vercel → Coolify

1. Créer la base `portfolio_prod` + user dédié sur le Postgres Coolify existant.
2. Nouvelle application **Docker Compose** dans le projet Coolify, source = GitHub App déjà installée, branche **`PROD`**, fichier `docker-compose.prod.yml`.
3. Renseigner les Secrets (`.env.production.example` sert de checklist versionnée, jamais de valeur réelle).
4. DNS : enregistrement `A` du domaine → IP du VPS (TTL 300 s le temps de valider, puis 3600 s).
5. Coolify → **Domains** sur le service `web` : `https://<domaine>` + **Force HTTPS** (Traefik + Let's Encrypt).
6. Smoke tests : `curl https://<domaine>/api/health` puis `/admin` (login).
7. **Ne supprimer le projet Vercel qu'après 48 h** de prod stable ; garder le DNS Vercel en secours pendant la fenêtre.
8. Migrations Prisma au démarrage du conteneur (`prisma migrate deploy` + seed idempotent), comme l'API Doshwork.

### 5.5 CI GitHub Actions

`ci.yml` calqué sur Doshwork : jobs `lint`, `build-web`, `test-e2e` (Playwright + axe), `setup-bun@v2` (1.3), cache `node_modules` sur `hashFiles('apps/web/bun.lock')`, déclenché sur `push`/`PR` vers `DEV` et `PROD`.
**Pas de `deploy.yml`** — déploiement par webhook Coolify natif (décision D8 Doshwork : aucun secret SSH côté GitHub).

### 5.6 Convention Git

Aligner sur Doshwork : `alpha/feat/*` → PR → **`DEV`** → PR → **`PROD`** (protégée, CI verte obligatoire).
Renommage : `Production` → `PROD`, `develop` → `DEV`, suppression de `fix`.
Ajouter husky + lint-staged + commitlint (conventional commits), déjà présents chez Doshwork.

---

## 6. Roadmap

| Phase | Contenu | Effort |
|---|---|---|
| **P0 — Quick wins** | D1, D2, D3, D4, D9, D12 · metadata OpenGraph + sitemap/robots · `prefers-reduced-motion` · purge des 15 Mo d'assets · cherry-pick de `develop` | ~1 j |
| **P1 — Socle** | Migration monorepo `apps/web` · npm → Bun · Next 16 / React 19 · Prettier + husky + commitlint · renommage branches | 2-3 j |
| **P2 — Docker & VPS** | Dockerfile 4 stages · compose dev + prod · `/api/health` · `.env.production.example` · CI · Coolify + DNS + TLS · bascule Vercel | 2-3 j |
| **P3 — Données** | Prisma + schéma + migrations · seed depuis le contenu hardcodé actuel · refonte des sections en lecture DB · ISR + `revalidateTag` · fallback statique | 3-4 j |
| **P4 — Admin** | Auth.js + argon2 + 2FA · middleware · CRUD projets/timeline/stacks/settings · upload + sharp · drag & drop · messages · audit log | 5-7 j |
| **P5 — Refonte visuelle** | Tokens + thème clair · animations P1 puis P2 · pages `/projects/[slug]` · timeline verticale · formulaire de contact · nouvelles sections | 5-7 j |
| **P6 — Qualité** | Playwright E2E + axe · budgets Lighthouse en CI · analytics self-hosted (Umami sur le VPS) · README + runbooks `docs/` | 2-3 j |

**Total : ~4 à 5 semaines** à temps partiel.

### Ordre recommandé

P0 → P2 → P1 → P3 → P4 → P5 → P6.

**Pourquoi Docker avant la migration Bun/Next 16** : dockeriser l'app *telle quelle* d'abord permet de valider la chaîne Coolify sur un périmètre stable et de sortir de Vercel rapidement. Chaque montée de version se vérifie ensuite dans un environnement de prod déjà éprouvé, au lieu de cumuler deux inconnues.

---

## 7. Décisions arrêtées

| # | Sujet | Décision |
|---|---|---|
| 1 | Domaine | **`portfolio.doshwork.com`** en attendant l'achat d'un domaine propre (prévu courant juillet-août 2026). Guide : [§8](#8-guide--sous-domaine-portfoliodoshworkcom). Migration vers le domaine définitif : [§8.6](#86-migrer-vers-le-domaine-définitif-plus-tard) |
| 2 | Postgres | **Mutualisé** sur le service Coolify existant, base dédiée `portfolio_prod` + user `portfolio_user`. Coût VPS nul |
| 3 | Thème | **Dark only.** Pas de `next-themes`, pas de `@media (prefers-color-scheme)`. Les tokens CSS restent structurés pour qu'un thème clair reste possible plus tard sans refonte |
| 4 | 2FA admin | **TOTP obligatoire dès la P4**, pas optionnel. Détail : [§9](#9-2fa-totp-sur-ladmin) |
| 5 | Analytics | **Umami self-hosted** sur le VPS, en ressource Coolify séparée. Guide complet : [§10](#10-guide--umami-self-hosted) |

**Impacts sur le plan ci-dessus** :
- §4.1 — la ligne « thème clair avec `next-themes` » est **annulée** (décision 3). Les design tokens restent, mono-thème.
- §3.1 — « TOTP optionnel » devient **obligatoire** (décision 4).
- §2 — `NEXT_PUBLIC_SITE_URL=https://portfolio.doshwork.com` dans un premier temps.
- P6 — « analytics self-hosted (Umami) » est confirmé et détaillé en §10.

---

## 8. Guide — sous-domaine `portfolio.doshwork.com`

Tu possèdes déjà `doshwork.com` et le VPS tourne déjà. Ajouter un sous-domaine ne coûte **rien** et ne touche **pas** à Doshwork en production.

### 8.1 Comprendre ce qui se passe

Trois briques, dans cet ordre :

1. **DNS** — tu dis à Internet que `portfolio.doshwork.com` pointe vers l'IP de ton VPS. Ça se fait chez ton **registrar** (là où tu as acheté `doshwork.com`), pas dans Coolify.
2. **Traefik** — le reverse proxy déjà installé par Coolify reçoit la requête, lit le `Host:` demandé, et route vers le bon conteneur. C'est lui qui permet à `doshwork.com`, `api.doshwork.com` et `portfolio.doshwork.com` de cohabiter sur **une seule IP**.
3. **Let's Encrypt** — Traefik demande automatiquement un certificat TLS pour le nouveau sous-domaine. Aucun `certbot` à lancer à la main.

Tu as déjà fait exactement ça pour `api.doshwork.com` — c'est le même geste.

### 8.2 Étape DNS (chez ton registrar)

Un seul enregistrement à créer :

| Type | Nom / Host | Valeur | TTL |
|------|-----------|--------|-----|
| `A` | `portfolio` | `89.167.90.7` (IP de ton VPS) | `300` |

> Le champ « Nom » attend en général **`portfolio`** seul, pas `portfolio.doshwork.com` — le registrar complète avec le domaine. Si ton interface exige le nom complet, mets-le en entier. En cas de doute : regarde comment est écrite ta ligne `api` existante et copie exactement le même format.

TTL à `300` (5 min) pour pouvoir corriger vite ; tu le repasseras à `3600` une fois stable.

**Vérifier la propagation** (5 à 30 min) depuis ton Mac :

```bash
dig +short portfolio.doshwork.com A
```

Tant que ça ne renvoie pas l'IP du VPS, **ne passe pas à l'étape suivante** : Let's Encrypt échouera et Traefik se mettra en back-off (attente forcée avant nouvelle tentative).

Comparer avec ce qui marche déjà :

```bash
dig +short api.doshwork.com A          # doit renvoyer la même IP
```

### 8.3 Étape Coolify

Dans **Projects → (ton projet) → production →** l'application Compose du portfolio :

1. Ouvrir le service **`web`** (port interne 3000).
2. Section **Domains** / **FQDN**.
3. Saisir `https://portfolio.doshwork.com` — avec le `https://`, Coolify s'en sert pour configurer Traefik.
4. Activer **Force HTTPS** si l'option est proposée.
5. **Save**, puis **Redeploy** — c'est le redéploiement qui déclenche l'émission du certificat.

### 8.4 Vérifier

```bash
# Le healthcheck doit renvoyer 200
curl -sS -o /dev/null -w "%{http_code}
" https://portfolio.doshwork.com/api/health

# Le certificat doit être émis pour le bon nom
echo | openssl s_client -connect portfolio.doshwork.com:443 -servername portfolio.doshwork.com 2>/dev/null \
  | openssl x509 -noout -dates -subject
```

Attendu : `200`, et un `subject=CN=portfolio.doshwork.com` avec une date d'expiration à ~90 jours (Traefik renouvelle tout seul vers J-30).

### 8.5 Si ça ne marche pas

| Symptôme | Cause probable | Action |
|---|---|---|
| `dig` ne renvoie rien | DNS pas encore propagé, ou nom mal saisi chez le registrar | Attendre ; vérifier le format du champ « Nom » |
| Erreur de certificat dans le navigateur | Le domaine a été ajouté dans Coolify **avant** que le DNS ne pointe | Corriger le DNS, attendre, **Redeploy**. Let's Encrypt limite à 5 échecs/heure — si tu es en back-off, patiente une heure |
| `404` de Traefik | Domaine posé sur le mauvais service, ou pas de redeploy après Save | Vérifier que le FQDN est bien sur le service `web`, redéployer |
| `502 Bad Gateway` | Conteneur démarré mais pas healthy | `docker ps` sur le VPS, vérifier `/api/health` en interne |
| **Doshwork tombe** | Tu as édité le FQDN d'un service Doshwork au lieu d'en créer un nouveau | Rollback Coolify sur l'app Doshwork |

> ⚠️ Le portfolio doit être une **application Coolify distincte** de Doshwork, dans le même projet ou un projet séparé. Ne touche jamais aux ressources `doshwork-api` / `doshwork-web` existantes.

### 8.6 Migrer vers le domaine définitif (plus tard)

Quand tu achètes ton domaine, la bascule prend ~15 min :

1. Créer l'enregistrement `A` (`@` et éventuellement `www`) vers l'IP du VPS.
2. Dans Coolify, **ajouter** le nouveau FQDN sur le service `web` **sans retirer l'ancien** — Coolify accepte plusieurs domaines.
3. Redeploy → certificat émis pour le nouveau domaine.
4. Mettre à jour `NEXT_PUBLIC_SITE_URL` (build-time, voir §5.1) puis **rebuild**.
5. Vérifier, laisser tourner 48 h en double.
6. Retirer `portfolio.doshwork.com`, ou le garder en redirection 301 vers le nouveau domaine (meilleur pour le SEO si le sous-domaine a été indexé).

**Conséquence à anticiper** : `NEXT_PUBLIC_SITE_URL` est inlinée au `next build`. Un changement de domaine impose un **rebuild**, pas un simple restart — c'est le piège n°1 déjà documenté dans le runbook Doshwork.

---

## 9. 2FA TOTP sur l'admin

Obligatoire dès la P4 (décision 4). Le back-office est exposé publiquement : mot de passe seul insuffisant.

### 9.1 Implémentation

- Lib : **`otplib`** (`@otplib/preset-default`), algorithme TOTP standard (RFC 6238) — compatible Google Authenticator, Authy, 1Password, Bitwarden.
- Schéma Prisma, à ajouter au modèle `User` de §2.1 :

```prisma
model User {
  // … champs existants
  totpSecret     String?    // secret base32, chiffré au repos
  totpEnabledAt  DateTime?  // null = 2FA pas encore activée
  recoveryCodes  Json?      // 8 codes à usage unique, hashés argon2id
}
```

- **Chiffrement du secret** : `totpSecret` est chiffré en AES-256-GCM avec une clé dérivée de `AUTH_SECRET`. Un dump SQL volé ne suffit alors pas à générer des codes.
- **Flux de connexion en 2 temps** : email+mot de passe → session partielle (`mfaPending`) → saisie du code à 6 chiffres → session complète. La session partielle expire en 5 min et ne donne accès à **aucune** route `/admin/*`.
- **Fenêtre de tolérance** : ±1 pas (30 s) pour absorber la dérive d'horloge. Pas plus.
- **Anti-rejeu** : mémoriser le dernier `counter` validé, refuser sa réutilisation.
- **Rate-limit** : 5 tentatives de code / 15 min / IP, puis verrouillage temporaire.

### 9.2 Enrôlement

Écran `/admin/settings/security` : QR code (`otpauth://totp/Portfolio:<email>?secret=…&issuer=Portfolio`) + secret en clair pour saisie manuelle, puis **confirmation par un premier code valide** avant activation. Sans cette confirmation, on peut se verrouiller dehors.

### 9.3 Codes de récupération — ne pas sauter cette étape

8 codes générés à l'enrôlement, affichés **une seule fois**, stockés hashés. Chacun à usage unique.

Sans eux, un téléphone perdu = admin définitivement inaccessible, seule issue : `docker exec` + requête SQL manuelle sur la prod. Prévoir aussi un script de secours `bun run admin:reset-2fa` exécutable sur le VPS, documenté dans `docs/ops/`.

### 9.4 Seed

Le compte seedé depuis `ADMIN_EMAIL` / `ADMIN_PASSWORD` démarre avec `totpEnabledAt = null`. Au premier login, redirection **forcée** vers l'enrôlement 2FA — impossible d'accéder au reste de l'admin avant.

---

## 10. Guide — Umami self-hosted

### 10.1 Pourquoi Umami

- **Sans cookie, sans données personnelles** → pas de bandeau de consentement à afficher (contrairement à Google Analytics). Argument RGPD réel, pas cosmétique.
- Script de **~2 ko**, aucun impact mesurable sur le LCP.
- Tes données restent sur ton VPS.
- Bonus entretien : « analytics auto-hébergé sur mon propre VPS » est une ligne qui se raconte bien.

### 10.2 Ce que ça implique concrètement

Umami = une app Next.js + une base Postgres. Comme pour le portfolio, on **mutualise** le Postgres Coolify : une base `umami` de plus, pas un conteneur de plus.

Architecture finale sur ton VPS :

```
VPS Hetzner (une seule IP)
└── Traefik (Coolify)
    ├── doshwork.com              → doshwork_web
    ├── api.doshwork.com          → doshwork_api
    ├── portfolio.doshwork.com    → portfolio_web      ← §8
    └── analytics.doshwork.com    → umami              ← §10
        └── Postgres 16 mutualisé (doshwork_prod · portfolio_prod · umami)
```

### 10.3 Installation

Coolify propose Umami dans son catalogue de services — c'est le chemin le plus court.

1. **Projects → (projet) → production → + New Resource → Service**.
2. Chercher **Umami** dans le catalogue.
3. Base de données : pointer vers le Postgres existant via **Reference Resource**, base `umami` (à créer au préalable, cf. §10.4).
4. Variable obligatoire : `APP_SECRET` — générer avec `openssl rand -base64 32`, stocker dans ton password manager, **jamais** dans le repo.
5. **Domains** : `https://analytics.doshwork.com` (créer d'abord l'enregistrement DNS `A` `analytics` → IP du VPS, même geste qu'en §8.2).
6. Deploy.
7. Première connexion : `admin` / `umami` — **changer le mot de passe immédiatement**, c'est un compte par défaut public.

### 10.4 Créer la base `umami`

Depuis le VPS, sur le conteneur Postgres (méthode identique à celle de ton `coolify-setup.md`) :

```bash
CID="$(docker ps -q --filter ancestor=postgres:16-alpine | head -n1)"
docker exec -it "$CID" psql -U doshwork_user -d postgres
```

```sql
CREATE DATABASE umami;
CREATE USER umami_user WITH ENCRYPTED PASSWORD '<mot-de-passe-généré>';
GRANT ALL PRIVILEGES ON DATABASE umami TO umami_user;
\c umami
GRANT ALL ON SCHEMA public TO umami_user;
```

> La dernière ligne (`GRANT ALL ON SCHEMA public`) est nécessaire depuis **Postgres 15** : sans elle, Umami échoue à créer ses tables avec `permission denied for schema public`. Piège classique.

Faire de même pour `portfolio_prod` / `portfolio_user` (décision 2).

### 10.5 Ajouter le tracking au portfolio

Dans Umami : **Settings → Websites → Add website** → nom + domaine `portfolio.doshwork.com`. Tu obtiens un `websiteId`.

Dans `apps/web/src/app/layout.tsx`, avec `next/script` :

```tsx
import Script from "next/script";

// … dans <body>, après {children}
{process.env.NEXT_PUBLIC_UMAMI_ID && (
  <Script
    src="https://analytics.doshwork.com/script.js"
    data-website-id={process.env.NEXT_PUBLIC_UMAMI_ID}
    strategy="afterInteractive"
    defer
  />
)}
```

Variables à ajouter (build-time dans Coolify, comme toute `NEXT_PUBLIC_*`) :

```bash
NEXT_PUBLIC_UMAMI_ID=<websiteId fourni par Umami>
```

Le garde `process.env.NEXT_PUBLIC_UMAMI_ID &&` évite de charger le script en dev local et de polluer tes stats avec ton propre trafic.

### 10.6 Événements personnalisés

Au-delà des pages vues, quelques événements valent la peine sur un portfolio :

```tsx
// Sur un clic de téléchargement CV, lien projet, envoi de contact
onClick={() => window.umami?.track("cv-download")}
```

À instrumenter : `cv-download`, `project-visit` (avec le slug), `contact-submit`, `social-click`. Ça te dit **ce que les recruteurs regardent vraiment**, pas seulement combien sont venus.

Typage à ajouter dans `src/types/umami.d.ts` :

```ts
declare global {
  interface Window {
    umami?: { track: (event: string, data?: Record<string, unknown>) => void };
  }
}
export {};
```

### 10.7 Points de vigilance

- **Bloqueurs de pub** : uBlock Origin bloque `/script.js` sur un domaine tiers. Tu perdras ~20-30 % du trafic dev/tech. Contournement : servir le script depuis un chemin proxifié sur ton propre domaine (`/stats/script.js` via un rewrite Next). À faire seulement si l'écart te gêne.
- **Rétention** : Umami garde tout indéfiniment. Sur un portfolio le volume est négligeable, mais prévoir la purge dans la revue trimestrielle.
- **Backups** : la base `umami` est incluse dans les backups Coolify du service Postgres (déjà configurés pour Doshwork, cf. `coolify-setup.md` §7). Vérifier qu'elle est bien dans le périmètre.
- **Ne pas exposer** `analytics.doshwork.com` sans mot de passe fort — le dashboard révèle ton trafic.

---

## 11. Impact sur la roadmap

Les décisions ajoutent ~1,5 j répartis, et retirent ~1 j (thème clair annulé) :

| Phase | Ajustement |
|---|---|
| **P2 — Docker & VPS** | **+0,5 j** : sous-domaine `portfolio.doshwork.com` (§8) + création des bases `portfolio_prod` / `portfolio_user` (§10.4) |
| **P4 — Admin** | **+1 j** : 2FA TOTP complète — enrôlement, codes de récupération, chiffrement du secret, script de secours (§9) |
| **P5 — Refonte visuelle** | **−1 j** : thème clair annulé, mono-thème dark |
| **P6 — Qualité** | **+0,5 j** : Umami — service Coolify, DNS `analytics`, tracking + événements personnalisés (§10) |

**Total révisé : ~4 à 5 semaines** — inchangé, les écarts se compensent.
