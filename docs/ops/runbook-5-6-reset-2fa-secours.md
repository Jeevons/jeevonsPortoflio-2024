# Runbook — Débloquer mon accès admin : réinitialiser la 2FA depuis le serveur (Story 5.6)

**À lire quand : j'ai perdu mon téléphone ET mes codes de récupération**, et que je
ne peux donc plus franchir le second facteur pour entrer dans `/admin`.

Cette procédure exécute une commande **dans le conteneur de production** qui
réinitialise le second facteur de mon compte. À la connexion suivante, mot de
passe puis **nouvel enrôlement 2FA** (nouveau QR code, nouveaux codes de secours).

> Aucun secret dans ce runbook. Ne collez jamais la `DATABASE_URL` réelle, un mot
> de passe, un secret TOTP ou un code de récupération dans un ticket, un chat ou
> un log.

## Avant de commencer — est-ce bien la bonne procédure ?

| Situation | Quoi faire |
|---|---|
| J'ai mon téléphone, il fonctionne | Connexion normale. Rien à faire ici. |
| Téléphone perdu, **mais** j'ai encore un code de récupération | Utilisez un **code de récupération** à l'étape du second facteur (story 5.4). Ne touchez pas au serveur. |
| Téléphone perdu **ET** codes perdus/épuisés | ✅ **C'est ce runbook.** |
| J'ai oublié mon **mot de passe** | ❌ Hors périmètre de cette commande (elle ne touche pas au mot de passe). Le mot de passe se repropage par le seed via `ADMIN_PASSWORD` (story 5.1). |

Il faut : un accès SSH au VPS (`89.167.90.7`), et **l'e-mail exact du compte
admin** (il sera exigé mot pour mot).

## Ce que fait la commande

Sur le compte indiqué, elle efface :

- le **secret TOTP** (`totpSecret`) → l'application d'authentification de
  l'ancien téléphone devient définitivement inutile ;
- l'**activation de la 2FA** (`totpEnabledAt`) → c'est ce champ qui déclenche
  l'enrôlement forcé à la connexion suivante ;
- le **compteur anti-rejeu** (`totpLastCounter`) → repart de zéro avec le nouveau
  secret ;
- les **codes de récupération** (`recoveryCodes`) → les anciens sont supprimés, un
  nouveau jeu de 8 codes sera généré pendant le nouvel enrôlement.

Elle **ne touche à rien d'autre** : ni le mot de passe, ni le contenu du site.

⚠️ Elle **contourne une protection de sécurité**. Elle est donc protégée par une
confirmation explicite : l'e-mail exact du compte doit être retapé après
`--confirm`. Sans cet argument, la commande **refuse d'agir** et ne modifie rien.
Chaque exécution (refus comme succès) est **tracée** dans les logs du conteneur,
horodatée et sans aucun secret.

## Procédure pas à pas (sur le VPS)

### 1. Se connecter au VPS

```bash
ssh <utilisateur>@89.167.90.7
```

### 2. Identifier le conteneur du portfolio

```bash
docker ps --format '{{.Names}}\t{{.Status}}' | grep -i portfolio
```

Le conteneur applicatif est nommé **`portfolio_web`** (`docker-compose.prod.yml`).
Sous Coolify, le nom peut être suffixé : **utilisez le nom réel affiché ici** dans
les commandes suivantes.

### 3. Lancer la réinitialisation

Remplacez `<email-admin>` par l'e-mail **exact** du compte admin :

```bash
docker exec portfolio_web \
  node scripts/admin-reset-2fa.mjs --confirm <email-admin>
```

**Sortie attendue :**

```
[admin:reset-2fa] 2026-07-25T10:12:34.567Z — 2FA réinitialisée pour « <email-admin> » (second facteur était actif). Enrôlement forcé à la prochaine connexion.
```

Le code de sortie est `0`.

**Si la commande refuse** (elle n'a alors **rien modifié**, on peut la relancer
sans risque) :

| Message | Cause | Correction |
|---|---|---|
| `REFUS : confirmation explicite manquante.` | `--confirm <email>` oublié | Relancez avec l'e-mail après `--confirm`. |
| `REFUS : aucun compte ne correspond à « … ».` | Faute de frappe dans l'e-mail | Vérifiez l'e-mail exact du compte et relancez. |
| `REFUS : DATABASE_URL est absente.` | Commande lancée hors du conteneur applicatif | Vérifiez le nom du conteneur (étape 2). |
| `Error: P1001: Can't reach database server…` | Base injoignable | Vérifiez l'état du Postgres mutualisé, puis relancez. |

### 4. Se reconnecter et se ré-enrôler

1. Ouvrir `https://portfolio.doshwork.com/admin`.
2. Saisir l'e-mail et le mot de passe habituels.
3. La navigation est **forcée vers l'écran de sécurité** : aucune autre page
   `/admin/*` n'est accessible avant la fin de l'enrôlement.
4. Scanner le **nouveau QR code** avec l'application d'authentification (sur le
   nouveau téléphone), puis saisir un premier code à 6 chiffres pour confirmer.
5. **Noter le nouveau jeu de 8 codes de récupération** et le ranger hors du
   téléphone (papier, gestionnaire de mots de passe). ⚠️ Ils ne sont affichés
   **qu'une seule fois**.

Tant que l'étape 4 n'est pas terminée, le second facteur n'est pas réactivé : la
commande peut être relancée sans conséquence.

### 5. Vérifier la trace

```bash
docker logs portfolio_web 2>&1 | grep 'admin:reset-2fa'
```

On doit y retrouver la ligne horodatée de l'étape 3 — ainsi que la trace de tout
refus éventuel. C'est la trace de l'opération (aucun secret n'y figure), et elle
survit à la fermeture du terminal.

## Notes d'exploitation

- **Pourquoi `node` et pas `bun run admin:reset-2fa`** : l'étage `production` de
  l'image tourne sur `node` **sans Bun** (story 4.6). Le script est donc bundlé au
  build (`bun run build:reset-2fa` → `scripts/admin-reset-2fa.mjs`) et copié à côté
  de `server.js`. `bun run admin:reset-2fa -- --confirm <email>` ne fonctionne
  qu'**en local**, sur le dépôt.
- **Rien à redéployer** : la commande écrit en base. Aucun rebuild, aucun
  redémarrage de conteneur n'est nécessaire — le guard admin relit l'état 2FA en
  base à chaque rendu.
- **Traçabilité** : chaque exécution (refus comme succès) est écrite à la fois sur
  la sortie de la commande et dans le **log du conteneur**. Un `docker exec`
  n'alimente pas `docker logs` spontanément : le script écrit donc aussi sur la
  sortie du processus 1 du conteneur, pour que la trace subsiste après la
  fermeture du terminal. Elle reste soumise à la rotation des logs Docker ; quand
  la story 5.19 aura créé le modèle `AuditLog`, cette opération pourra y être
  enregistrée durablement en plus du log.
- **Implémentation** : `apps/web/scripts/admin-reset-2fa.ts` (source),
  `apps/web/Dockerfile` (bundling + copie dans l'image).
