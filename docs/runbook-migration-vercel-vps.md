# Runbook — Migration du portfolio de Vercel vers le VPS

> Livrable de la story **2.7** (« Couper Vercel sans risque »).
> Objectif : consigner la procédure **réelle** suivie, pour pouvoir la **rejouer**
> lors du futur passage au domaine définitif (PLAN §8.6).
>
> ⚠️ **Aucun secret ici** (pas de mot de passe, pas de `DATABASE_URL`) — AGENTS.md §2.

## 1. Contexte

- **Ancien hébergement** : Vercel, servi sur une URL `*.vercel.app` (aucun domaine
  personnalisé configuré côté Vercel — confirmé avec Jeevons le 2026-07-24).
- **Nouvel hébergement** : VPS Doshwork, déploiement via **Coolify** (Docker Compose),
  domaine **`portfolio.doshwork.com`**, IP `89.167.90.7`, TLS Let's Encrypt.
- **Domaine définitif** : pas encore acheté → hors périmètre (PLAN §8.6).

Ce que l'on perd volontairement en quittant Vercel : déploiements auto par push
(rétabli par le webhook Coolify natif), previews de PR, CDN mondial, rollback 1-clic.
Ce que l'on gagne : maîtrise complète, coût nul supplémentaire, cohérence avec
Doshwork déjà auto-hébergé (AGENTS.md §1 — « sortie de Vercel assumée »).

## 2. Chronologie réelle observée

| Horodatage (UTC) | Événement |
|------------------|-----------|
| 2026-07-22 18:38 | Émission du certificat Let's Encrypt (valide → 2026-10-20) |
| 2026-07-22 19:22 | **Mise en ligne** sur `portfolio.doshwork.com` → **ouverture de la fenêtre d'observation 48 h** |
| 2026-07-22 20:39 | Migration Coolify Deploy Key → GitHub App (webhooks fonctionnels) |
| 2026-07-22 20:50 | Validation du déclenchement auto (merge PR #2 `develop`→`Production`) |
| 2026-07-24 ~08:0X | Déploiement volontaire du monorepo Epic 3 (merge PR #4 `DEV`→`PROD`) — succès, conteneur `Running (healthy)` |
| **2026-07-24 19:22** | **Échéance des 48 h** — suppression Vercel possible à partir d'ici |

> Note : le déploiement Epic 3 du 24/07 est un redéploiement **volontaire et sain**
> (healthcheck OK), pas un crash. La fenêtre d'observation ouverte le 22/07 est
> considérée comme continue.

## 3. Vérifications de mise en service (AC1)

Relevés automatisés depuis `https://portfolio.doshwork.com` le **2026-07-24 ~08:13 UTC** :

| Vérification | Résultat |
|--------------|----------|
| Page d'accueil | ✅ HTTP 200, ~0,42 s, `text/html` |
| Healthcheck `/api/health` | ✅ HTTP 200, `{"status":"ok"}`, conteneur stable |
| **Téléchargement du CV** `/assets/docs/jeevons-cv-2024-1.6.pdf` | ✅ HTTP 200, `application/pdf`, 454 269 octets — **pas de régression** malgré la purge d'assets de la story 1.9 |
| Ancres de navigation | ✅ `#projects`, `#side-projects`, `#about`, `#contact` présentes |
| Titre / SEO | ✅ `Jeevons Eya — Développeur web` |
| Certificat TLS | ✅ valide 2026-07-22 → **2026-10-20**, Let's Encrypt |

**À compléter par Jeevons (vérif visuelle navigateur, non automatisable) :**
- [ ] Clic sur chaque entrée du Header → bonne section (dont Témoignages, story 1.2)
- [ ] Bouton « Visiter le site » d'un projet → ouvre en nouvel onglet
- [ ] Mode « Réduire les animations » activé → site correct (story 1.7)
- [ ] Rendu sur téléphone réel (⚠️ défaut Header 375 px **connu et différé** en Epic 6 — pas une régression de migration)
- [ ] **Comparaison côte à côte avec Vercel** dans deux onglets → comportement identique

## 4. Surveillance sur 48 h (AC2)

Relevés à répartir (≥ 3, dont un le lendemain matin) — `curl` sur `/api/health`
attendu **200**, et dans Coolify le conteneur `portfolio_web` **ne doit pas avoir
redémarré** (un redémarrage auto = healthcheck en échec → la fenêtre repart de zéro).

| Horodatage (UTC) | `/api/health` | Conteneur non redémarré | Certificat OK | doshwork.com OK |
|------------------|---------------|--------------------------|---------------|-----------------|
| 2026-07-24 08:13 | ✅ 200        | ✅ (uptime ~11 min post-déploiement Epic 3) | ✅ | à confirmer |
| _(soir 24/07)_   |               |                          |               |                 |
| _(échéance 19:22)_ |             |                          |               |                 |

## 5. ▶️ CHECKLIST À EXÉCUTER CE SOIR (après 19:22 UTC / 21:22 Paris)

> 🛑 Ne rien exécuter avant l'échéance des 48 h. Actions opérées **par Jeevons**.

### Étape A — Dernière passe de vérification (tâche 4)
- [ ] Relancer les checks du §3 : `curl -sS -o /dev/null -w "%{http_code}\n" https://portfolio.doshwork.com/` → 200
- [ ] `curl -sS https://portfolio.doshwork.com/api/health` → `status:ok`
- [ ] Coolify : `portfolio_web` toujours `Running (healthy)`, **pas de redémarrage** depuis le déploiement Epic 3
- [ ] Confirmer : **48 h pleines écoulées sans incident**

### Étape B — Supprimer le projet Vercel (tâche 5) — ⚠️ IRRÉVERSIBLE
- [ ] Dashboard Vercel → projet du portfolio → **Settings** → tout en bas → **Delete Project**
- [ ] (Pas de domaine perso à retirer — confirmé, servi uniquement en `*.vercel.app`)
- [ ] Juste après : `curl -sS -o /dev/null -w "%{http_code}\n" https://portfolio.doshwork.com/` → **toujours 200** (prouve l'absence de dépendance)

### Étape C — Remonter le TTL DNS à 3600 s (tâche 6)
> 💡 À faire **APRÈS** la suppression Vercel : tant que le TTL est bas (300 s),
> un retour arrière reste rapide.
- [ ] Chez le registrar : enregistrement **A** `portfolio` → TTL **300 → 3600**
- [ ] ❌ Ne modifier **aucun autre** enregistrement
- [ ] Vérifier : `dig +noall +answer portfolio.doshwork.com A` (le nouveau TTL peut mettre jusqu'à l'ancien TTL — 300 s — à se refléter)

**État DNS avant modification (relevé 2026-07-24) :**
```
portfolio.doshwork.com.  300  IN  A  89.167.90.7
```

## 6. Rejouer pour le domaine définitif (PLAN §8.6)

Quand le domaine définitif sera acheté :
1. Créer l'enregistrement **A** du nouveau domaine → `89.167.90.7`, TTL bas (300 s) le temps de valider.
2. Ajouter le domaine dans Coolify (Domains) → Traefik émet un nouveau certificat Let's Encrypt.
3. ⚠️ **Rebuild obligatoire** : `NEXT_PUBLIC_SITE_URL` est **inlinée par Next au moment du build**
   (cf. Dockerfile, `ARG NEXT_PUBLIC_SITE_URL`). Changer de domaine **impose un rebuild** —
   la passer au runtime n'a aucun effet.
4. Après validation, remonter le TTL à 3600 s.

## 7. Suite après clôture

- [ ] **Aperçus sociaux** (story 1.10, reportée faute d'URL publique) : désormais validables
  via LinkedIn Post Inspector et Twitter/X Card Validator sur `https://portfolio.doshwork.com`.
- [ ] Proposer le passage d'`epic-2` à `done` si toutes ses stories sont terminées.
