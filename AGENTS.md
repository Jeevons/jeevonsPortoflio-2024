# AGENTS.md — Instructions obligatoires pour les agents IA sur jeevonsPortoflio-2024

> Lu automatiquement par Claude Code, Cursor, Gemini CLI et tout agent compatible [AGENTS.md](https://agents.md).
>
> 🛑 **Tout agent opérant sur ce dépôt DOIT respecter les règles ci-dessous sans exception.**
> 🚨 **Les agents ont une tendance documentée à ignorer les règles de process (git, sprint-status, périmètre). ZÉRO TOLÉRANCE : si tu te rends compte que tu as sauté une étape, arrête-toi et répare immédiatement.**
>
> 📐 Architecture & décisions : **`PLAN_REFONTE_2026.md`** (source de vérité — tient lieu de PRD, d'architecture et de contrat UX).
> 📋 Découpage : `_bmad-output/planning-artifacts/epics.md` · Suivi : `_bmad-output/implementation-artifacts/sprint-status.yaml`.

---

## 1. Le projet en une page

Portfolio personnel de **Jeevons**, refonte 2026. Un site vitrine Next.js aujourd'hui statique et codé en dur, qui devient un **portfolio piloté par la donnée** : contenu en Postgres, back-office `/admin` sécurisé en 2FA, auto-hébergé sur VPS Hetzner via Coolify — sortie de Vercel assumée.

- **Cible** : site public performant (Lighthouse ≥ 95, LCP < 2 s) + back-office administrateur unique.
- **Domaine de production** : `portfolio.doshwork.com` (VPS Hetzner `89.167.90.7`, Coolify).
- **Garde-fous durs** : coût VPS additionnel nul (Postgres mutualisé) · **anti-scope-creep (UNE story à la fois)** · **accessibilité non négociable** (`prefers-reduced-motion`, AA, clavier) · aucun secret versionné · **ne jamais toucher aux ressources Coolify `doshwork-api` / `doshwork-web`**.

### 🛑 Stack en vigueur

**La migration de l'Epic 3 est faite.** L'état ci-dessous est celui du dépôt aujourd'hui.

| | État actuel |
|---|---|
| Emplacement du code | `apps/web/` |
| Package manager | **Bun** (`apps/web/bun.lock`) |
| Next / React | 16.2 / 19.2 |
| Animations | `motion` 12 |
| Branches | `PROD` / `DEV` |

> ⚠️ Un `bun.lock` traîne aussi à la racine alors que celle-ci ne déclare pas de `workspaces`. Le lockfile qui fait foi est `apps/web/bun.lock`.

> Les epics 4 à 7 ajoutent Prisma 7 + Postgres, Auth.js v5 + TOTP, shadcn/ui, Playwright et Umami. Ils n'existent pas encore : ne les invoque pas tant que leur epic n'est pas atteint.

---

## 2. Commandes

Le gestionnaire de paquets est **Bun**. Les commandes se lancent depuis `apps/web/`.

| Tâche | Commande |
|---|---|
| Installer | `bun install` |
| Dev | `bun run dev` |
| Build | `bun run build` |
| Lint | `bun run lint` |
| Types | `bunx tsc --noEmit` |

À partir de l'Epic 2, la stack de développement se lance aussi par `docker compose up` (service `db` Postgres + service `web`).

### ❌ Strictement interdit

- **Mélanger les gestionnaires de paquets.** C'est Bun et rien d'autre — pas de `npm install` « par habitude », il produirait un `package-lock.json` concurrent de `apps/web/bun.lock`.
- **Committer un secret.** Seul `.env.production.example` est versionné, **sans aucune valeur réelle**. Vérifie `git status` avant chaque commit : un `.env` réel ne doit jamais y apparaître.
- **Ajouter une dépendance** non prévue par la story ou le plan, sans validation explicite de Jeevons.
- **Toucher aux ressources Coolify de Doshwork** (`doshwork-api`, `doshwork-web`, bases existantes). Le portfolio est une **application Coolify distincte**.
- **Poser un FQDN dans Coolify avant d'avoir vérifié la propagation DNS** (`dig +short`) : Let's Encrypt limite à 5 échecs/heure.

---

## 3. Structure du dépôt

```
jeevonsPortoflio-2024/
├── AGENTS.md                    # ce fichier
├── PLAN_REFONTE_2026.md         # SOURCE DE VÉRITÉ (archi, UX, décisions)
├── README.md · next.config.mjs · tailwind.config.ts · tsconfig.json
├── src/                         # → migre vers apps/web/src en Epic 3.1
│   ├── app/                     # App Router Next.js
│   ├── components/              # composants réutilisables (Card, SectionHeader…)
│   ├── sections/                # sections de la page (Hero, Projects, Contact…)
│   └── assets/                  # images & icônes  ⚠️ ~16 Mo, purgés en story 1.9
├── public/                      # assets servis tels quels
├── design-artifacts/            # livrables design (A-Product-Brief → E-Development)
├── docs/                        # runbooks d'exploitation (remplis en Epic 7)
└── _bmad-output/
    ├── planning-artifacts/        → epics.md (entrée)
    └── implementation-artifacts/  → sprint-status.yaml + stories <id>-*.md (à plat)
```

> ✦ **Règle d'architecture (Epics 4–5)** : les pages publiques sont **statiques avec ISR** (`revalidate: 3600`) et **ne doivent jamais tomber en erreur** — si la base est injoignable, le fallback statique `src/content/*.ts` prend le relais (NFR17). Une mutation admin ne redéploie rien : elle déclenche `revalidateTag` sur l'étiquette concernée.

---

## 4. 🛑 Git Workflow — non négociable

- **Branche de base** : `DEV`. On ne code **jamais** directement sur `DEV` ni sur `PROD` (branche par défaut, protégée).
- **Flux** : `alpha/feat/<epic>-<num>-<slug>` → PR → `DEV` → PR → `PROD`.
- **Une story = une branche** : `alpha/feat/<epic>-<num>-<slug-kebab>` (ex. `alpha/feat/1-3-ouvrir-les-liens-externes-sans-risque`).
- **Toujours** repartir d'une base à jour : `git checkout DEV && git pull` avant de créer la branche.
- **Commits conventionnels** : `feat(hero): ...`, `fix(footer): ...`, `chore(docs): ...`, `test(e2e): ...`, `perf(images): ...`.
- **Merge uniquement par Pull Request**, **CI verte obligatoire** dès que `.github/workflows/ci.yml` existe (story 3.6). Jamais de push direct.
- **Le commit final et le `git push` sont déclenchés par l'humain** (Jeevons), pas par l'agent en autonomie.

---

## 5. 🛑 Cycle de vie d'une story (BMAD)

Statuts valides dans `_bmad-output/implementation-artifacts/sprint-status.yaml` : `backlog | ready-for-dev | in-progress | review | done`.

1. **`/bmad-create-story`** → crée `_bmad-output/implementation-artifacts/<id>-*.md` depuis `epics.md` + `PLAN_REFONTE_2026.md`, passe la story en `ready-for-dev`.
2. **`/bmad-dev-story`** → prend LA story `ready-for-dev`, `git pull`, crée la branche, **propose un plan (validation humaine)**, implémente, teste, passe en `review`, fait le compte-rendu.
3. **`/bmad-code-review`** → prend la story en `review`, relit le diff, signale corrections et décisions à prendre.

> 🚨 **Mise à jour de `sprint-status.yaml` OBLIGATOIRE à chaque transition de statut.** C'est la vérité opérationnelle.
> 🚨 **Une seule story `in-progress` à la fois.** Si tu es tenté d'en toucher une autre → STOP.

### Ordre des epics — à respecter

`Epic 1 → 2 → 3 → 4 → 5 → 6 → 7`. Deux dépendances sont **dures** :

- **Epic 5 dépend de l'Epic 4** : l'admin écrit dans les tables Prisma. C'est la seule dépendance bloquante de toute la chaîne.
- **Au sein de l'Epic 5**, l'accès sécurisé complet (auth, 2FA, middleware) est livré **avant** tout écran de gestion. On ne construit pas d'écrans sur une sécurité inachevée.

> Les epics 1 et 6 modifient tous deux `Projects.tsx`, `SelfProject.tsx`, `Card.tsx`, `Header.tsx`. Ce chevauchement est **assumé** : l'Epic 1 doit partir en production sans attendre la refonte visuelle. Ne fusionne pas ces travaux.

---

## 6. 🛑 Standards de qualité du code

- **TypeScript strict.** `bunx tsc --noEmit` doit passer sans erreur. Pas de `any` implicite, pas de `@ts-ignore` sans justification écrite.
- **Composants** : logique de données côté Server Components ; `"use client"` uniquement quand l'interactivité l'impose. Vues « bêtes », données passées en props.
- **Pas de duplication.** `Projects.tsx` / `SelfProject.tsx` partagent ~90 % de code : la factorisation est traitée en story 3.7 — n'aggrave pas la dette d'ici là.
- **Accessibilité — non négociable** :
  - Chaque animation introduite est **neutralisée sous `prefers-reduced-motion: reduce`** (UX-DR20, contrainte transverse à toutes les stories d'animation).
  - Contrastes AA, focus visibles, navigation clavier complète, landmarks ARIA corrects.
  - HTML valide : jamais de contrôle interactif imbriqué dans un autre (`<button>` dans `<a>`).
- **Liens sortants** : `target="_blank"` **toujours** accompagné de `rel="noopener noreferrer"`.
- **Identifiants de section uniques** dans toute la page — l'ancre `#projects` doit être déterministe.
- **Images** : `next/image` avec dimensions explicites, formats AVIF/WebP, `blurDataUrl` quand disponible. Aucun asset lourd ajouté au dépôt sans nécessité.
- **Sécurité** : aucune coordonnée personnelle en clair dans le HTML servi ; secrets exclusivement par variable d'environnement ; conteneur de production en utilisateur non-root `nextjs:nodejs` (uid 1001).

---

## 7. Workflow BMAD

BMAD est installé (modules `core` + `bmm`), configuré par `_bmad/bmm/config.yaml`. Artefacts sous `_bmad-output/` : `planning-artifacts/epics.md` (entrée), `implementation-artifacts/sprint-status.yaml` + les stories `<id>-*.md` à plat.

**Langue** : `communication_language` et `document_output_language` sont réglés sur **le français**. Réponds et rédige les documents en français.

> ℹ️ La phase « architecture » de BMAD est **déjà faite** : elle est figée dans `PLAN_REFONTE_2026.md`. On démarre directement à la création des stories puis à l'implémentation.

---

## 8. 🛑 Definition of Done technique (avant `review` → `done`)

- [ ] Tous les **critères d'acceptation** de la story cochés (ils sont rédigés en Given/When/Then — vérifie-les un par un).
- [ ] `bun run lint` → **0 warning**.
- [ ] `bunx tsc --noEmit` → **0 erreur**.
- [ ] `bun run build` → **succès**, sans avertissement de dépréciation non traité.
- [ ] **Vérification visuelle** dans le navigateur si la story touche l'UI, **y compris avec « réduire les animations » activé** lorsqu'elle introduit du mouvement.
- [ ] `git diff DEV` relu : **rien hors périmètre de la story**.
- [ ] `File List` + `Completion Notes` + `Change Log` de la story remplis.
- [ ] `sprint-status.yaml` mis à jour.

À partir de l'Epic 7 s'ajoutent : tests Playwright verts, audit `@axe-core/playwright` sans régression, budgets Lighthouse respectés.

---

## 9. 🛑 Garde-fous anti-débordement (les 7 règles)

1. **1 story = 1 session = 1 branche.** Jamais deux stories mélangées.
2. **Périmètre verrouillé.** Tu ne modifies QUE ce qu'impose la story. Hors périmètre → tu t'arrêtes et tu demandes.
3. **Plan avant code.** Toujours un plan validé par l'humain avant d'implémenter.
4. **`sprint-status.yaml` = vérité unique**, mis à jour à chaque transition.
5. **Definition of Done** (§8) non négociable.
6. **Zéro dépendance ajoutée** sans validation.
7. **Si tu as sauté une étape, arrête-toi et répare immédiatement.**

> Mantra : **« Une story, rien qu'une story, toute la story. »**

---

## 10. Checklist finale avant de rendre la main

- [ ] Build vert · lint vert · types verts · vérification visuelle si UI
- [ ] Accessibilité vérifiée : mouvement réduit, clavier, contrastes
- [ ] Diff relu, périmètre respecté
- [ ] Story documentée (File List / Completion Notes / Change Log)
- [ ] `sprint-status.yaml` à jour
- [ ] Compte-rendu clair à Jeevons, en français (ce qui marche, points d'attention, dette éventuelle)
- [ ] **Stop** : le push/commit final est validé par l'humain
