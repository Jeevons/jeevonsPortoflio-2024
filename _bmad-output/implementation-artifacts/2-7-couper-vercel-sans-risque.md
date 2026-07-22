---
baseline_commit: 43e1e458b22cdbaaab761e933ce4021bd15301ad
---

# Story 2.7: Couper Vercel sans risque

Status: ready-for-dev

## Story

As **Jeevons**,
I want **retirer le portfolio de Vercel une fois le VPS éprouvé**,
so that **je maîtrise entièrement mon hébergement sans laisser traîner un déploiement fantôme**.

## 🛑 Story d'exploitation — comporte une action IRRÉVERSIBLE

Aucun code produit. Cette story **supprime le projet Vercel** : c'est le seul geste destructif de tout l'Epic 2.

- 🛑 **La suppression n'est pas annulable.** Elle n'intervient qu'après **48 h** de production stable et une validation explicite de Jeevons.
- 🛑 **L'agent n'exécute rien.** Registrar, Vercel et VPS sont opérés **par Jeevons**. L'agent prépare, vérifie, interprète et consigne.
- ⏱️ **Cette story s'étale sur au moins deux jours.** Elle démarre à la fin de la story 2.6 et se termine 48 h plus tard. C'est **voulu** : ne pas chercher à la boucler en une session.

## Acceptance Criteria

**AC1 — Vérifications de mise en service**
**Given** le site tourne sur le VPS
**When** j'effectue les vérifications de mise en service
**Then** la **page d'accueil**, la **navigation**, les **liens externes** et le **téléchargement du CV** fonctionnent depuis l'adresse publique
**And** le comportement est **identique à celui du site servi par Vercel**

**AC2 — Période d'observation de 48 heures**
**Given** une bascule mérite une période d'observation
**When** je décide de supprimer le projet Vercel
**Then** au moins **48 heures de production stable** se sont écoulées
**And** la **configuration DNS de secours vers Vercel a été conservée** pendant toute cette fenêtre

**AC3 — Clôture de la migration**
**Given** la période d'observation est concluante
**When** je clôture la migration
**Then** le **projet Vercel est supprimé**
**And** le **TTL du DNS est remonté à 3600 secondes**
**And** la **procédure suivie est consignée** pour pouvoir être rejouée lors du passage au domaine définitif

## Contexte d'implémentation

### 🛑 Prérequis : story 2.6 `done`, et son horodatage

La fenêtre de 48 h court **depuis la mise en ligne effective** notée en Completion Notes de la story 2.6. Récupérer cette date et heure : elle détermine le moment où l'AC2 est satisfaite.

### ⚠️ Précision importante sur « le DNS de secours vers Vercel » (AC2)

Le portfolio Vercel est servi sur une URL `*.vercel.app` (aucun domaine personnalisé n'apparaît dans le dépôt). Le nouveau domaine `portfolio.doshwork.com` est **entièrement nouveau** : il n'a jamais pointé vers Vercel.

👉 **Il n'y a donc probablement aucun enregistrement DNS à « conserver »** — le secours consiste simplement à ce que **le projet Vercel reste en ligne et déployable** pendant la fenêtre. C'est le sens réel de l'AC2 dans ce contexte.

🛑 **À vérifier avec Jeevons en tâche 0** : un domaine personnalisé a-t-il été configuré côté Vercel ? Si oui, son enregistrement DNS doit être conservé intact pendant les 48 h et sa suppression traitée en tâche 5.

### ⚠️ Le CV — vérification à ne pas prendre à la légère (AC1)

L'AC1 cite explicitement « le téléchargement du CV ». Attention : la story **1.9** a purgé 15 Mo d'assets, dont **7 fichiers WebP de CV**. La page `/cv` avec viewer PDF (FR25) relève de l'**Epic 6** — elle n'existe pas encore.

👉 **Vérifier ce qui existe réellement aujourd'hui** : chercher le lien ou bouton de CV dans `src/sections/` (probablement dans `Hero.tsx` ou `Contact.tsx`) et **suivre le lien depuis l'adresse publique**. S'il pointe vers un asset supprimé en story 1.9, c'est une **régression de l'Epic 1** à signaler immédiatement — pas un problème de migration. 🛑 **Ne pas la corriger dans cette story** (hors périmètre) : la remonter à Jeevons.

### Comparaison Vercel ↔ VPS (AC1)

Tant que Vercel tourne, la comparaison **côte à côte** est possible — c'est précisément ce que la fenêtre de 48 h permet, et cela disparaît définitivement après la tâche 5.

```bash
# Codes HTTP
curl -sS -o /dev/null -w "%{http_code}\n" https://portfolio.doshwork.com
curl -sS -o /dev/null -w "%{http_code}\n" https://<projet>.vercel.app

# Comparaison du HTML servi (hors identifiants de build, volatils)
curl -s https://portfolio.doshwork.com > /tmp/vps.html
curl -s https://<projet>.vercel.app     > /tmp/vercel.html
diff <(grep -o '<h1[^>]*>[^<]*' /tmp/vps.html) <(grep -o '<h1[^>]*>[^<]*' /tmp/vercel.html)
```
💡 Un `diff` intégral produira du bruit (hachages de build Next, ordre des classes). Comparer les **éléments signifiants** : titres, liens, textes — et surtout **comparer visuellement dans deux onglets**.

### Surveillance pendant les 48 h (AC2)

Ce qu'il faut observer, sans y consacrer d'effort continu :
- **Disponibilité** : quelques `curl` sur `/api/health` répartis dans la fenêtre (matin, soir, lendemain matin).
- **Stabilité du conteneur** : dans Coolify, `portfolio_web` ne doit **pas avoir redémarré**. 🛑 Un redémarrage automatique signale un healthcheck en échec → **la fenêtre repart de zéro**.
- **Certificat** : toujours valide (émis en story 2.6, ~90 jours).
- **Doshwork** : `doshwork.com` et `api.doshwork.com` répondent toujours normalement.

### TTL à 3600 s (AC3)

Le TTL avait été posé à **300 s** en story 2.6 pour permettre une correction rapide. Une fois stable, le remonter à **3600 s** : moins de requêtes DNS, résolution plus rapide côté visiteurs.

💡 **Le remonter APRÈS la suppression Vercel**, pas avant : tant que le TTL est bas, un retour arrière reste rapide.

### Consignation (AC3) — livrable réel de la story

L'AC3 exige une procédure « rejouable lors du passage au domaine définitif ». Le plan §8.6 décrit déjà cette future bascule ; ce qui manque, c'est **le retour d'expérience réel** : durées observées, écarts avec le plan, erreurs rencontrées.

👉 **Où consigner ?** `docs/` existe et AGENTS.md §3 l'annonce comme le dossier des « runbooks d'exploitation (remplis en Epic 7) ». Y déposer un runbook de migration est cohérent et anticipe cet usage.
- 👉 **Recommandé : `docs/runbook-migration-vercel-vps.md`.**
- **Variante** : tout consigner dans les Completion Notes de cette story. Plus léger, mais moins retrouvable dans six mois — or FR/NFR « pouvoir reprendre mon projet dans six mois » est un objectif explicite (story 7.6).
🛑 **À trancher avec Jeevons en tâche 0.**

## Tasks / Subtasks

- [ ] **Tâche 0 — Préparation** — 🛑 **BLOQUANT**
  - [ ] Récupérer l'**horodatage de mise en ligne** en Completion Notes de la story 2.6 → calculer la fin de la fenêtre de 48 h.
  - [ ] Vérifier avec Jeevons si un **domaine personnalisé** est configuré côté Vercel (cf. précision AC2).
  - [ ] Trancher le lieu de consignation : `docs/runbook-migration-vercel-vps.md` (recommandé) ou Completion Notes.
  - [ ] Identifier **où se trouve le lien de CV** dans le code, et vers quel fichier il pointe.
- [ ] **Tâche 1 — Vérifications de mise en service** (AC: 1) — 🛑 **cœur de la story**
  - [ ] **Page d'accueil** : s'affiche sur `https://portfolio.doshwork.com`, **avec images, CSS et polices**.
  - [ ] **Navigation** : chaque entrée du Header mène à la bonne section — `#projects` (story 1.1), **Témoignages** (story 1.2), À propos, Contact.
  - [ ] **Liens externes** : ouverture en nouvel onglet, `rel="noopener noreferrer"` (story 1.3), bouton « Visiter le site » fonctionnel (story 1.4).
  - [ ] **Téléchargement du CV** : suivre le lien → **le fichier se télécharge réellement**. ⚠️ S'il est cassé, **signaler à Jeevons** sans corriger (cf. contexte).
  - [ ] **Comparaison Vercel ↔ VPS** : les deux sites côte à côte dans le navigateur → **comportement identique** (AC1).
  - [ ] **Mobile** : vérifier sur téléphone réel. ⚠️ Le défaut de Header en 375 px est **connu et différé** (`deferred-work.md`, Epic 6) — ne pas le compter comme régression de migration.
  - [ ] **Mouvement réduit** : activer « Réduire les animations » → le site reste correct (story 1.7).
- [ ] **Tâche 2 — Ouvrir la fenêtre d'observation** (AC: 2)
  - [ ] Consigner la date et l'heure de début (= mise en ligne, story 2.6).
  - [ ] Confirmer que le **projet Vercel reste en ligne** pendant toute la fenêtre (AC2).
  - [ ] ❌ **Ne rien supprimer** avant l'échéance.
- [ ] **Tâche 3 — Surveiller pendant 48 h** (AC: 2)
  - [ ] Contrôles répartis (≥ 3, dont un le lendemain matin) : `curl /api/health` → **200**.
  - [ ] Coolify : `portfolio_web` **n'a pas redémarré** — 🛑 sinon **la fenêtre repart de zéro**, et diagnostiquer la cause.
  - [ ] Certificat TLS toujours valide.
  - [ ] `doshwork.com` et `api.doshwork.com` répondent normalement.
  - [ ] Consigner chaque relevé (horodatage + résultat).
- [ ] **Tâche 4 — Valider avant l'irréversible** (AC: 2) — 🛑 **BLOQUANT**
  - [ ] Confirmer que **48 h pleines** se sont écoulées **sans incident**.
  - [ ] Refaire une **passe complète de la tâche 1**.
  - [ ] 🛑 **Obtenir de Jeevons un accord explicite** pour supprimer le projet Vercel. Sans accord : **s'arrêter là**.
- [ ] **Tâche 5 — Supprimer Vercel** (AC: 3) — ⚠️ **IRRÉVERSIBLE**
  - [ ] Supprimer le projet Vercel.
  - [ ] Si un domaine personnalisé y était configuré : retirer ses enregistrements DNS **après** la suppression.
  - [ ] Vérifier que `https://portfolio.doshwork.com` **répond toujours** juste après (aucun lien de dépendance, mais on le prouve).
- [ ] **Tâche 6 — Remonter le TTL** (AC: 3)
  - [ ] Chez le registrar : TTL de l'enregistrement `A` `portfolio` → **3600**.
  - [ ] `dig portfolio.doshwork.com A` → vérifier le TTL renvoyé (peut mettre jusqu'à l'ancien TTL à se refléter).
  - [ ] ❌ Ne modifier **aucun autre** enregistrement.
- [ ] **Tâche 7 — Consigner la procédure** (AC: 3)
  - [ ] Rédiger le runbook à l'emplacement retenu en tâche 0 : chronologie réelle, commandes utilisées, durées observées (propagation DNS, build, émission du certificat), **problèmes rencontrés et leurs solutions**, écarts avec le plan §8.
  - [ ] Y inclure explicitement ce qu'il faudra rejouer pour le **domaine définitif** (renvoyer au plan §8.6, et signaler le **rebuild obligatoire** pour `NEXT_PUBLIC_SITE_URL`).
  - [ ] ❌ **Aucun secret**, aucun mot de passe, aucune `DATABASE_URL` (AGENTS.md §2).
- [ ] **Tâche 8 — Clôture de l'Epic 2**
  - [ ] Completion Notes : résultats des AC1 à AC3, horodatages, relevés de surveillance.
  - [ ] Signaler à Jeevons que la **validation des aperçus sociaux** (story 1.10, reportée faute d'URL publique) est désormais possible : LinkedIn Post Inspector, Twitter Card Validator.
  - [ ] Reporter dans `deferred-work.md` ce qui aurait été constaté et différé.
  - [ ] `sprint-status.yaml` mis à jour · proposer le passage d'`epic-2` à `done` si toutes ses stories sont terminées.

## Dev Notes

### Périmètre — verrouillé

**Aucun fichier de code créé ou modifié.** Au plus un fichier de documentation créé (`docs/runbook-migration-vercel-vps.md`, selon la tâche 0).

**Hors périmètre — ne pas faire :**
- ❌ **Ne pas corriger de bug découvert pendant les vérifications** — pas même un « petit ». Le **consigner** dans `deferred-work.md` et le remonter. AGENTS.md §9 règle 2 : hors périmètre → on s'arrête et on demande.
- ❌ **Ne pas modifier le code, le Dockerfile ni les composes.**
- ❌ **Ne pas supprimer Vercel avant 48 h pleines** (AC2), ni sans accord explicite de Jeevons.
- ❌ **Ne pas configurer le domaine définitif** → **§8.6**, quand Jeevons l'aura acheté.
- ❌ **Ne pas renommer les branches** → story **3.5**. ❌ **Ne pas créer de `ci.yml`** → story **3.6**.
- ❌ **Ne pas installer Umami** → **Epic 7**.
- ❌ **Ne pas supprimer le fichier `.vercel`** ni toucher au `.gitignore` : hors AC, sans effet.

### Pourquoi 48 h et pas une heure (AC2)

Une bascule d'hébergement révèle ses défauts **dans la durée**, pas à la mise en ligne : fuite mémoire, redémarrage nocturne, saturation disque, renouvellement de certificat, pic de trafic. Vercel constitue le filet de sécurité pendant cette fenêtre. La supprimer trop tôt, c'est retirer le filet avant la fin du numéro.

### Ce que Vercel apportait et qu'on perd volontairement

Déploiements automatiques par push, previews de PR, CDN mondial, TLS géré, rollback en un clic. En contrepartie : **maîtrise complète, coût nul supplémentaire, et cohérence avec Doshwork déjà auto-hébergé** (AGENTS.md §1 : « sortie de Vercel assumée »). Le webhook Coolify natif (PLAN §5.5) rétablit le déploiement automatique.

### Testing standards

Aucun test automatisé. Vérification par **parcours manuel complet** depuis l'adresse publique (AC1), **relevés `curl` répartis sur 48 h** (AC2), et **comparaison côte à côte avec Vercel** tant qu'il existe encore. Playwright arrive en Epic 7 — ces vérifications manuelles y deviendront automatiques (story 7.1).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.7]
- [Source: PLAN_REFONTE_2026.md §5.4 étape 7 — « Ne supprimer le projet Vercel qu'après 48 h de production stable ; garder le DNS Vercel en secours »]
- [Source: PLAN_REFONTE_2026.md §8.2 — TTL 300 s le temps de valider, puis 3600 s]
- [Source: PLAN_REFONTE_2026.md §8.6 — procédure de migration vers le domaine définitif, rebuild obligatoire pour `NEXT_PUBLIC_SITE_URL`]
- [Source: AGENTS.md §1 — « sortie de Vercel assumée »] · [Source: AGENTS.md §3 — `docs/` : runbooks d'exploitation]
- [Source: AGENTS.md §9 règle 2 — périmètre verrouillé, hors périmètre → s'arrêter et demander]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md — Header mobile 375 px, différé en Epic 6]
- [Source: _bmad-output/implementation-artifacts/1-10-*.md — validation des aperçus sociaux reportée faute d'URL publique]
- [Source: story 2.6 — horodatage de mise en ligne, ouverture de la fenêtre de 48 h]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8

### Debug Log References

- `grep -rniE "cv|resume" src/` → lien CV localisé en **`src/sections/About.tsx:113`** : `<a href="/assets/docs/jeevons-cv-2024-1.6.pdf" target="_blank" rel="noopener noreferrer">`
- `find public -iname "*cv*"` → **`public/assets/docs/jeevons-cv-2024-1.6.pdf`** présent
- Servi depuis l'image de production (story 2.2) : `curl localhost:3002/assets/docs/jeevons-cv-2024-1.6.pdf` → **200, `application/pdf`, 454 269 octets** ✅

### Completion Notes List

⏸️ **Story NON terminée — bloquée par construction.** Elle démarre à la clôture de la story 2.6 (mise en ligne) et exige **48 h pleines** d'observation avant l'action irréversible. Elle ne peut pas être bouclée en une session, et la 2.6 n'est pas encore exécutée.

**Travail préparatoire réalisé (partie de la tâche 0 réalisable sans VPS) :**

- **Lien de CV identifié et vérifié — aucune régression à craindre (AC1).** Le point de vigilance soulevé par la story était que la story 1.9 avait purgé 15 Mo d'assets dont **7 fichiers WebP de CV**. Vérification faite : le lien de `About.tsx:113` pointe vers le **PDF** `/assets/docs/jeevons-cv-2024-1.6.pdf`, qui **n'a pas été purgé** et est bien présent dans `public/`. Mieux : il est **effectivement servi par l'image de production** (200, `application/pdf`, 454 ko). Le téléchargement du CV exigé par l'AC1 fonctionnera donc depuis l'adresse publique. ⚠️ Seule l'image d'aperçu `jeevons-cv-2024-1.6_resultat.webp` (importée depuis `src/assets/`) est distincte du PDF — elle est présente elle aussi, le build passe.

**Reste à faire, dans l'ordre, par Jeevons :**
1. Exécuter la story **2.6** et **noter l'horodatage exact de mise en ligne** — c'est lui qui ouvre la fenêtre de 48 h (tâche 0).
2. Vérifier si un **domaine personnalisé** est configuré côté Vercel (détermine s'il y a des enregistrements DNS à conserver puis retirer, cf. précision AC2).
3. Trancher le lieu de consignation : `docs/runbook-migration-vercel-vps.md` (recommandé, cohérent avec AGENTS.md §3 et l'objectif « reprendre mon projet dans six mois » de la story 7.6) ou Completion Notes.
4. Tâches 1 à 8 : vérifications de mise en service, surveillance répartie sur 48 h, accord explicite avant suppression, remontée du TTL à 3600 s **après** la suppression, rédaction du runbook.

### File List

### Change Log
