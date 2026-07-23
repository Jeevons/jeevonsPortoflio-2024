---
baseline_commit: a270747a2c1a628c60ee36e4697aede4f6558474
---

# Story 3.5: Aligner les branches sur la convention Doshwork

Status: ready-for-dev

## Story

As **Jeevons**,
I want **les mêmes noms de branches et le même flux que sur Doshwork**,
so that **je ne me trompe pas de cible en passant d'un projet à l'autre**.

## Acceptance Criteria

**AC1 — Branches renommées, `PROD` par défaut**
**Given** les branches se nomment aujourd'hui `Production` et `develop`
**When** le renommage est fait
**Then** elles se nomment **`PROD`** et **`DEV`**
**And** la **branche par défaut du dépôt distant est `PROD`**

**AC2 — Branche morte `fix` supprimée**
**Given** la branche `fix` est morte, déjà fusionnée et sans commit d'avance
**When** je nettoie le dépôt
**Then** elle est **supprimée en local comme sur le distant**

**AC3 — Protection de branche `PROD`**
**Given** la production ne doit pas recevoir de code non vérifié
**When** j'inspecte la protection de branche
**Then** **`PROD` n'accepte que des pull requests, avec intégration continue au vert obligatoire**
**And** le flux attendu **`alpha/feat/*` → `DEV` → `PROD`** est documenté dans le README

**AC4 — Coolify pointe vers `PROD`**
**Given** Coolify déploie depuis une branche nommée
**When** le renommage est effectif
**Then** la **configuration Coolify pointe vers `PROD`** et un **déploiement de vérification aboutit**

## Contexte d'implémentation

### 🚨 Story à fort impact externe — actions humaines requises

Cette story touche le **dépôt distant GitHub** et **Coolify en production**. Plusieurs actions **ne peuvent pas** être faites par l'agent en autonomie et **doivent** être exécutées par Jeevons (ou validées explicitement). L'agent **prépare, documente et guide** ; Jeevons **exécute** les opérations distantes sensibles.

⚠️ **Ordre critique** pour ne pas casser la production : renommer les branches **avant** de basculer Coolify, et vérifier un déploiement **après**. Une erreur de séquencement peut rendre le site indéployable.

### État actuel (vérifié sur le dépôt)

```
* develop                        (branche de travail courante)
  Production                     (branche de prod, déployée)
  remotes/origin/HEAD -> origin/Production   (défaut distant)
  remotes/origin/Production
  remotes/origin/develop
  remotes/origin/fix             (branche morte, AC2)
```
Remote : `https://github.com/Jeevons/jeevonsPortoflio-2024.git`.

- `fix` : 0 commit d'avance, déjà fusionnée (plan §1.3) → suppression pure (AC2).
- Coolify déploie aujourd'hui depuis `Production` (stories 2.5/2.6) → devra pointer sur `PROD` (AC4).
- La branche par défaut GitHub est `Production` → devra devenir `PROD` (AC1).

### ⚠️ Piège n°1 — Renommer une branche distante : la séquence sûre

Git ne « renomme » pas une branche distante d'un coup. La séquence :

```bash
# --- develop → DEV ---
git checkout develop && git pull
git branch -m develop DEV            # renomme en local
git push origin -u DEV               # pousse la nouvelle
# NE PAS encore supprimer develop distante (voir piège n°2)

# --- Production → PROD ---
git branch -m Production PROD         # (après checkout local si besoin)
git push origin -u PROD
```

Puis, **côté GitHub (action humaine Jeevons)** :
1. **Changer la branche par défaut** du dépôt de `Production` → **`PROD`** (Settings → Branches). AC1. ⚠️ Doit être fait **avant** de supprimer `Production` distante, sinon GitHub refuse (on ne supprime pas la branche par défaut).
2. Supprimer les anciennes distantes `develop` et `Production` :
   ```bash
   git push origin --delete develop
   git push origin --delete Production
   ```

### ⚠️ Piège n°2 — Ne pas supprimer la branche par défaut avant de l'avoir changée

GitHub **interdit** de supprimer la branche par défaut. Il faut d'abord basculer le défaut sur `PROD` (étape humaine), **ensuite** supprimer `Production`. Inverser l'ordre bloque l'opération.

### ⚠️ Piège n°3 — Supprimer `fix` (AC2)

```bash
git branch -d fix                    # local ; -d refuse si non mergée (sécurité)
git push origin --delete fix         # distant
```
⚠️ Utiliser `-d` (pas `-D`) : si Git refuse au motif que `fix` n'est pas fusionnée, **s'arrêter et vérifier** — le plan §1.3 affirme qu'elle l'est (0 commit d'avance), mais on ne force pas sans preuve.

### ⚠️ Piège n°4 — Protection de branche `PROD` (AC3) — action humaine GitHub

La protection de branche se configure **dans les Settings GitHub** (ou via `gh api`), pas dans le code. Jeevons doit activer sur `PROD` :
- **Require a pull request before merging** (interdit le push direct).
- **Require status checks to pass before merging** → cocher le job CI (`lint`, `build-web`) **une fois la story 3.6 en place**.

⚠️ **Dépendance de séquencement** : la CI (`ci.yml`) est la **story 3.6**. Deux cas :
- Si 3.6 n'est **pas encore** faite : configurer la protection « PR obligatoire » maintenant, et **noter** que le statut « CI verte obligatoire » sera coché quand le job existera (le documenter en Completion Notes). L'agent peut préparer une commande `gh api` prête à l'emploi.
- Si 3.6 est déjà faite : cocher directement le check CI.

L'agent peut proposer les commandes `gh api` de protection, mais **Jeevons les exécute** (droits admin sur le dépôt).

### ⚠️ Piège n°5 — Coolify pointe vers `PROD` (AC4) — action humaine Coolify

Dans l'application Compose du portfolio sur Coolify (Projects → portfolio → production) : changer la branche source de `Production` → **`PROD`**, puis déclencher un **déploiement de vérification** et confirmer qu'il aboutit (site joignable, `/api/health` 200).

⚠️ **Ne jamais toucher aux ressources Coolify de Doshwork** (`doshwork-api`, `doshwork-web`) — AGENTS.md §2. Seule l'application **portfolio** change de branche.

⚠️ Faire cette bascule **après** que `PROD` distante existe et contient le bon code, **sinon** Coolify déploiera une branche vide ou inexistante.

### ⚠️ Piège n°6 — Documenter le flux dans le README + mettre à jour AGENTS.md ? (AC3)

L'AC3 exige le flux `alpha/feat/*` → `DEV` → `PROD` **documenté dans le README**. C'est un livrable **de code** que l'agent fait :
```markdown
## 🌿 Flux Git
`alpha/feat/<epic>-<num>-<slug>` → PR → `DEV` → PR → `PROD` (protégée, CI verte obligatoire).
```
⚠️ **AGENTS.md §4/§1 mentionne encore « develop »** avec la note « deviendra `DEV` en story 3.5 ». Mettre à jour ces mentions dans AGENTS.md fait partie d'un renommage cohérent — **mais** c'est un fichier de gouvernance : proposer la modification et **la faire valider** par Jeevons avant de committer. Au minimum, le README (livrable AC3) est mis à jour par l'agent.

## Tasks / Subtasks

- [ ] **Tâche 1 — Préparer et exécuter le renommage local** (AC: 1, piège n°1)
  - [ ] `git branch -m develop DEV`, `git branch -m Production PROD`.
  - [ ] Pousser `DEV` et `PROD` avec `-u` sur origin.
- [ ] **Tâche 2 — [HUMAIN] Basculer le défaut GitHub puis nettoyer** (AC: 1, pièges n°2)
  - [ ] Jeevons : branche par défaut du dépôt → **`PROD`** (Settings GitHub).
  - [ ] Supprimer les distantes `develop` et `Production` (après bascule du défaut).
- [ ] **Tâche 3 — Supprimer la branche morte `fix`** (AC: 2, piège n°3)
  - [ ] `git branch -d fix` (vérifier qu'elle est bien fusionnée) puis `git push origin --delete fix`.
- [ ] **Tâche 4 — [HUMAIN] Protection de branche `PROD`** (AC: 3, piège n°4)
  - [ ] Jeevons : « PR obligatoire » sur `PROD` ; « CI verte obligatoire » (checks 3.6 si dispo, sinon noté pour plus tard).
  - [ ] L'agent fournit les commandes `gh api` prêtes à l'emploi.
- [ ] **Tâche 5 — Documenter le flux Git** (AC: 3, piège n°6)
  - [ ] README : section « Flux Git » `alpha/feat/*` → `DEV` → `PROD`.
  - [ ] Proposer la mise à jour des mentions `develop`/`Production` dans AGENTS.md → **valider avec Jeevons**.
- [ ] **Tâche 6 — [HUMAIN] Basculer Coolify + déploiement de vérification** (AC: 4, piège n°5) — 🛑 **cœur de la story**
  - [ ] Jeevons : branche source de l'app portfolio Coolify → **`PROD`**.
  - [ ] Déclencher un déploiement de vérification → site joignable, `/api/health` 200.
  - [ ] ❌ Ne pas toucher aux ressources Doshwork.
- [ ] **Tâche 7 — Definition of Done** (AGENTS.md §8)
  - [ ] `git branch -a` : `DEV`, `PROD` présentes ; `develop`, `Production`, `fix` **absentes** (local + distant).
  - [ ] Branche par défaut distante = `PROD` ; protection active ; Coolify sur `PROD` ; déploiement vert.
  - [ ] `File List` + `Completion Notes` + `Change Log` remplis · `sprint-status.yaml` mis à jour.

## Dev Notes

### Périmètre — verrouillé

**Renommage et hygiène des branches** (`Production`→`PROD`, `develop`→`DEV`, suppression `fix`), **protection de `PROD`**, **bascule Coolify**, **documentation du flux dans le README**.

**Hors périmètre — ne pas faire :**
- ❌ **Ne pas créer la CI** → story 3.6. Ici on **prépare** la case « CI verte obligatoire » ; on ne l'écrit pas.
- ❌ **Ne pas ajouter de `deploy.yml`** ni de secret SSH (convention D8 Doshwork, story 3.6) — le déploiement reste piloté par le webhook Coolify.
- ❌ **Ne pas modifier le code applicatif** — aucune ligne de `src/`.
- ❌ **Ne pas toucher aux ressources Coolify de Doshwork.**
- ❌ **Ne pas exécuter en autonomie** les actions distantes sensibles (bascule du défaut, suppression de branches distantes, protection, Coolify) : elles sont **[HUMAIN]** — l'agent guide et fournit les commandes, Jeevons exécute.

### Pourquoi l'ordre compte tant

La production tourne. Si Coolify est basculé sur `PROD` **avant** que `PROD` distante existe avec le bon code, le prochain déploiement échoue ou sert du vide. Si on supprime `Production` distante **avant** d'avoir changé le défaut GitHub, l'opération est refusée. La séquence — local → défaut GitHub → nettoyage distant → protection → Coolify → vérification — est **la** partie critique de la story.

### Dépendance douce avec 3.6

L'AC3 « CI verte obligatoire » suppose l'existence des jobs CI (story 3.6). Si 3.6 n'est pas encore faite, on pose la protection « PR obligatoire » et on **note** que le check CI sera coché ensuite. Ne pas bloquer la story sur 3.6 : le renommage et la suppression de `fix` sont indépendants.

### Testing standards

Pas de test automatisé. Vérification par **inspection Git** (`git branch -a`, défaut distant), **inspection de la protection** GitHub, et **déploiement de vérification** réel sur Coolify (site joignable + `/api/health` 200).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.5]
- [Source: PLAN_REFONTE_2026.md §5.6 — « `alpha/feat/*` → PR → `DEV` → PR → `PROD` (protégée, CI verte obligatoire) ; Renommage `Production`→`PROD`, `develop`→`DEV`, suppression de `fix` »]
- [Source: PLAN_REFONTE_2026.md §1.3 — état des branches, `fix` morte (0 commit d'avance, déjà mergée)]
- [Source: AGENTS.md §1 — « Branches `Production`/`develop` → `PROD`/`DEV` » ; §4 — « `develop` deviendra `DEV` en story 3.5 » ; §2 — « ne jamais toucher aux ressources Coolify de Doshwork »]
- [Source: git — remote origin, `origin/HEAD -> origin/Production`, branches `develop`/`Production`/`fix`]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

### Change Log

| Date | Description |
|------|-------------|
| 2026-07-23 | Story 3.5 créée — renommage branches `PROD`/`DEV`, suppression `fix`, protection + Coolify. |
