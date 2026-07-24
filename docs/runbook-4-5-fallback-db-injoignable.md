# Runbook — Vérifier le repli statique quand la base est injoignable (Story 4.5)

Ce runbook décrit comment **simuler une base de données injoignable** et vérifier
que le portfolio reste consultable grâce au contenu de repli statique
(`apps/web/src/content/*.ts`), sans page d'erreur, puis qu'il revient
automatiquement au contenu réel une fois la base rétablie.

> Aucune donnée sensible ni secret n'apparaît dans ce runbook. Ne collez jamais
> la `DATABASE_URL` réelle ni un mot de passe dans un ticket ou un log.

## Contexte

Depuis l'Epic 4, les pages publiques lisent leur contenu (projets, parcours,
centres d'intérêt, réglages) en base. La story 4.5 rend ces lectures
**résilientes** : si une lecture échoue (base injoignable), un contenu de repli
statique prend le relais et l'incident est tracé côté serveur. Le visiteur ne
voit jamais de page d'erreur.

- Repli : `apps/web/src/content/{projects,timeline,settings}.ts` (source unique,
  partagée avec le seed → pas de dérive).
- Enveloppe résiliente : `apps/web/src/lib/read-with-fallback.ts`.
- Interaction avec le cache ISR (story 4.4) : le repli **n'est jamais mis en
  cache** sous le tag normal ; dès que la base revient, la lecture suivante
  réussit et repeuple le cache avec le contenu réel.

## Prérequis

- Docker + docker compose disponibles.
- La stack locale démarrée (`docker compose up -d`), base `db` saine et seedée.

## Procédure

### 1. État de référence (base joignable)

```bash
docker compose ps            # le service "db" est "healthy"
```

Chargez le site et notez le contenu réel affiché (titre du Hero, badge, projets).

### 2. Simuler la base injoignable

Deux options — la plus simple est d'arrêter le service `db` :

```bash
docker compose stop db       # la base ne répond plus
```

> Variante sans Docker : pointer temporairement `DATABASE_URL` vers un hôte/port
> injoignable (ex. un port fermé) et redémarrer l'application. Ne jamais committer
> cette valeur.

### 3. Déclencher une lecture pendant la panne

Avec l'ISR (story 4.4), une page déjà rendue peut continuer à servir sa version
cachée : la panne serait alors invisible. Pour **forcer une nouvelle lecture** et
observer le repli, on invalide le cache puis on recharge.

```bash
# Purge le cache pour forcer un nouveau rendu (secret local requis).
curl -X POST "http://localhost:3000/api/revalidate?tag=projects" \
     -H "x-revalidate-secret: $REVALIDATE_SECRET"

# Recharger la page d'accueil.
curl -s http://localhost:3000/ | grep -c "Projets phares"
```

**Attendu (AC2) :**
- La page d'accueil **s'affiche normalement**, avec le contenu de repli
  (identique au contenu de référence tant que le seed = `src/content`).
- **Aucune page d'erreur** n'est présentée (pas de 500, pas d'« error boundary »).
- Un log serveur d'erreur est émis, du type :

  ```
  [fallback] Lecture "projects" échouée — repli statique servi. Cause : <message d'erreur>
  ```

  Ce log contient le domaine concerné et la cause, **sans** `DATABASE_URL` ni
  secret. Consultez-le dans la sortie du serveur (`docker compose logs web` en
  conteneur, ou la console du process `next start`/standalone en local).

### 4. Rétablir la base et vérifier le retour au réel

```bash
docker compose start db      # la base redevient joignable
# attendre que "db" repasse "healthy"
docker compose ps
```

Rechargez la page (au besoin, ré-invalidez le cache comme à l'étape 3 pour ne pas
attendre la revalidation périodique d'1 h) :

```bash
curl -X POST "http://localhost:3000/api/revalidate?tag=projects" \
     -H "x-revalidate-secret: $REVALIDATE_SECRET"
curl -s http://localhost:3000/ -o /dev/null -w "%{http_code}\n"
```

**Attendu (AC3) :**
- Le **contenu réel** (issu de la base) est de nouveau servi, **sans intervention
  manuelle** autre que le rétablissement de la base.
- Plus aucun log `[fallback]` sur les rechargements suivants.

## Résultat attendu (résumé)

| Étape | Base | Page publique | Log serveur |
|-------|------|---------------|-------------|
| Référence | joignable | contenu réel | — |
| Panne simulée | injoignable | **contenu de repli, pas d'erreur** | `[fallback] … "projects" …` |
| Rétablie | joignable | **contenu réel de retour, auto** | — |

## Notes

- Le contenu de repli reflète le contenu de référence car `src/content/*.ts` est
  la **source unique** importée par le seed. Modifier le contenu ⇒ modifier ces
  fichiers, ce qui met à jour la base (au prochain seed) **et** le repli.
- La revalidation ciblée (`/api/revalidate`) requiert la variable d'environnement
  `REVALIDATE_SECRET` côté serveur (story 4.4). En dev local, elle est définie
  dans `apps/web/.env` (gitignoré).
