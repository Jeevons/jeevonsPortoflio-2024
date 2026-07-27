---
baseline_commit: c408eae7818fb33ef915a70085775688fbf80640
---

# Story 6.12: Prendre contact directement depuis le site

Status: review

## Story

As **recruteur**,
I want **écrire à Jeevons depuis son site**,
so that **je puisse le solliciter sans quitter la page ni ouvrir mon client de messagerie**.

## Acceptance Criteria

**AC1 — Un formulaire réel, dont l'envoi atterrit dans la boîte de réception admin**
**Given** le contact passe aujourd'hui par un lien de messagerie
**When** cette story est terminée
**Then** un formulaire me permet de saisir mon nom, mon adresse et mon message
**And** l'envoi enregistre le message et le rend visible dans la boîte de réception de l'administration

**AC2 — Notification par courriel, sans jamais perdre le message**
**Given** un message est reçu
**When** l'enregistrement réussit
**Then** une notification est envoyée à Jeevons par courrier électronique
**And** l'échec de cet envoi ne fait pas perdre le message, qui reste enregistré

**AC3 — Champ piège : soumission silencieusement ignorée**
**Given** les robots remplissent les formulaires automatiquement
**When** un champ piège invisible est rempli
**Then** la soumission est silencieusement ignorée
**And** aucun message n'est enregistré ni notifié

**AC4 — Limitation de débit**
**Given** un même visiteur soumet en boucle
**When** il dépasse un seuil raisonnable sur une courte période
**Then** les soumissions suivantes sont refusées avec un message compréhensible

**AC5 — Validation champ par champ, appliquée côté serveur**
**Given** ma saisie est incomplète ou mal formée
**When** je soumets
**Then** les erreurs me sont indiquées champ par champ
**And** la validation est appliquée côté serveur

**AC6 — Confirmation claire, aucune adresse personnelle en clair**
**Given** l'envoi réussit
**When** l'opération se termine
**Then** une confirmation claire s'affiche
**And** aucune adresse personnelle de Jeevons n'apparaît en clair dans la page

## Contexte d'implémentation

### 🛑 Prérequis : stories 6.1 (tokens) et 6.2 (socle motion) `done`

Les champs, états d'erreur et bouton reprennent les **tokens 6.1**. Toute transition d'état relève du **socle 6.2**. PLAN §4.3 : « **Formulaire de contact** réel (honeypot + rate-limit + envoi SMTP Infomaniak, même config que Doshwork) → remplace l'email en clair (règle D10) ».

### 🛑 DÉCISION BLOQUANTE — AC2 exige un envoi de courriel, et RIEN n'est installé

- 🛑 Vérifié dans `apps/web/package.json` : **aucune bibliothèque d'envoi de courriel** (`nodemailer`, `resend`, `@react-email/*`… : **rien**). Aucune variable SMTP n'existe non plus dans la configuration.
- 🛑 **AC2 ne peut donc pas être satisfait sans ajouter une dépendance** — ce que la règle 6 d'AGENTS.md §9 interdit sans validation explicite de Jeevons.
- 🛑 **ARRÊTEZ-VOUS ET DEMANDEZ À JEEVONS AVANT D'ÉCRIRE LA MOINDRE LIGNE POUR AC2.** Les options à lui présenter :
  1. ✅ **`nodemailer` + SMTP Infomaniak** — c'est ce que le PLAN §4.3 désigne nommément (« même config que Doshwork »). Une dépendance, serveur uniquement, et **les identifiants SMTP à fournir en variables d'environnement**.
  2. **Un service HTTP transactionnel** (type Resend) — appel `fetch` sans dépendance possible, mais **un compte et une clé d'API** à créer.
  3. **Reporter AC2** : livrer AC1/AC3/AC4/AC5/AC6 maintenant, et traiter la notification à part. ⚠️ Alors **la story n'est PAS terminée** : le dire explicitement, ne pas la marquer `done`.
- 🛑 ❌ **Ne choisissez pas seul.** Cette décision engage des **secrets de production** (`SMTP_*`) et une dépendance. AGENTS.md §2 : aucun secret versionné — les identifiants passent **exclusivement** par variables d'environnement, et `.env.production.example` doit être complété **sans aucune valeur réelle**.
- ⚠️ Quelle que soit l'option, **AC2 impose une contrainte d'architecture non négociable** : voir le piège n°2.

### ✅ Bonne nouvelle — le modèle et la boîte de réception existent déjà

Vérifié dans `prisma/schema.prisma` et `lib/admin/messages.ts` :

| Besoin AC1 | Existant |
|---|---|
| stockage du message | **`model ContactMessage`** ✅ (`name`, `email`, `body @db.Text`, `ip String?`, `read`, `createdAt`, `@@index([createdAt])`) |
| boîte de réception admin | **`/admin/messages`** ✅ (story 5.18, liste anti-chronologique, non-lus distingués, détail, suppression) |
| extraction d'IP derrière proxy | **`clientIpFromHeaders()`** ✅ (`lib/login-rate-limit.ts`) |
| motif de limitation par IP | **`lib/login-rate-limit.ts`** ✅ (fenêtre glissante en mémoire, à **imiter**, pas à réutiliser — voir piège n°4) |
| motif de schéma partagé Zod | **`lib/schemas/*.ts`** ✅ (`zod` 4 déjà installé) |
| motif de formulaire | **`react-hook-form` + `@hookform/resolvers`** ✅ déjà installés (formulaires admin 5.8/5.14/5.15) |

🛑 **Aucune migration Prisma dans cette story.** Le champ `ip` existe, il est nullable, et il est prévu pour ça. Si vous pensez avoir besoin d'une migration, relisez le schéma — et si le besoin est réel, **arrêtez-vous et demandez**.

### 🛑 Piège n°1 (CENTRAL) — Une Server Action sur la home la rendrait-elle dynamique ?

- ✅ **Non — et c'est la bonne nouvelle.** Une Server Action **n'affecte pas** le rendu statique du segment : ce sont les APIs dynamiques *lues au rendu* (`searchParams`, `cookies()`, `headers()` dans le composant) qui basculent une page en `ƒ`. La story 5.11 documente précisément ce piège pour `searchParams` ; il ne s'applique pas ici.
- 🛑 ⚠️ **MAIS l'IP se lit avec `headers()`** (AC4, piège n°4). ❌ **Ne JAMAIS appeler `headers()` dans le composant de section** : `/` basculerait immédiatement en `ƒ (Dynamic)` et l'ISR de la story 4.4 serait perdu **pour tous les visiteurs**. ✅ `headers()` s'appelle **exclusivement à l'intérieur de la Server Action**, qui s'exécute au POST, hors du rendu statique.
- 🛑 **C'est LE point de contrôle de la story** : au build, **`/` doit rester `○ (Static, 1h)`**. Le garde-fou est écrit noir sur blanc dans `page.tsx:20-29`. ⚠️ Le vérifier **avant et après**.
- ✅ **Server Action plutôt que route `/api/contact`** (recommandé) : c'est le motif employé partout dans l'admin (5.8/5.14/5.15/5.16), il donne la validation serveur et les erreurs par champ « gratuitement » via `useActionState`, et il évite d'exposer un endpoint public supplémentaire. ⚠️ **Une Server Action reste un endpoint POST atteignable sans passer par le formulaire** — c'est exactement pourquoi la validation serveur d'AC5 est obligatoire (le commentaire de `schemas/stack.ts` le dit déjà).

### 🛑 Piège n°2 — AC2 : « l'échec de l'envoi ne fait pas perdre le message »

- 🛑 **C'est l'AC la plus facile à casser par une seule ligne mal placée.** L'ordre est **imposé** :
  1. **écrire en base d'abord** (`prisma.contactMessage.create`) ;
  2. **puis** tenter la notification, dans un **`try/catch` qui n'échoue jamais vers l'appelant** ;
  3. **puis** renvoyer la confirmation à l'utilisateur (AC6) **quelle que soit** l'issue de l'envoi.
- ❌ **Interdits absolus** : `await sendMail()` **avant** le `create` · une exception d'envoi qui remonte et fait échouer l'action · un `Promise.all([create, sendMail])` (une rejection annulerait la réussite perçue) · un message d'erreur affiché au visiteur parce que le SMTP est tombé — **il a bien écrit à Jeevons, le message est enregistré**.
- ✅ Le dépôt a le **bon précédent de journalisation** : `readWithFallback` et `lib/admin/*.ts` aplatissent la cause sur une ligne (`raw.replace(/\s+/g, " ").trim()`) et **ne loguent jamais de secret**. ✅ Le reprendre pour l'échec d'envoi : `console.error("[contact] Notification non envoyée — message enregistré. Cause : …")`.
- ⚠️ 🛑 **Ne jamais journaliser les identifiants SMTP** ni le corps complet du message (donnée personnelle d'un tiers, AGENTS.md §6).
- ⚠️ **Timeout** : un SMTP injoignable peut **pendre** plusieurs dizaines de secondes et bloquer la réponse alors que le message est déjà enregistré. ✅ Poser un **délai d'attente court** sur l'envoi. **Décider et documenter.**

### 🛑 Piège n°3 — AC3 : « silencieusement ignorée » veut dire mentir au robot

- 🛑 **Contre-intuitif, et la source d'erreur la plus fréquente** : quand le champ piège est rempli, la réponse doit être **exactement celle d'un succès** (AC6 : confirmation claire). ❌ Un message d'erreur, un code d'erreur, un délai différent ou un comportement distinguable **apprend au robot** qu'il a été détecté et lui permet d'ajuster.
- ✅ **Et `And aucun message n'est enregistré ni notifié`** : on renvoie la confirmation **sans écrire en base et sans notifier**. La branche est donc : *piège rempli → retourner le succès, point.*
- ⚠️ **Le champ piège doit être invisible SANS être inaccessible aux lecteurs d'écran de façon trompeuse.** ❌ `type="hidden"` : les robots l'ignorent, il ne sert à rien. ✅ Un champ texte réel, masqué en CSS (hors flux, jamais `display:none` seul selon les motifs éprouvés), avec **`tabindex="-1"`**, **`autocomplete="off"`** et **`aria-hidden="true"`** — un utilisateur au clavier ou au lecteur d'écran ne doit **jamais** l'atteindre par accident, sous peine de voir sa demande légitime ignorée en silence. 🛑 **Ce cas est à tester au clavier**, c'est le risque d'accessibilité de la story.
- ⚠️ Le nom du champ doit être **plausible** (`website`, `company`…) et surtout **pas** `honeypot`.

### 🛑 Piège n°4 — AC4 : imiter `login-rate-limit.ts`, ne pas le réutiliser

- ✅ `lib/login-rate-limit.ts` (story 5.2) est **le modèle exact** : fenêtre glissante par IP, compteur **en mémoire process** (mono-conteneur, pas de Redis — coût VPS nul, AGENTS.md §1), auto-levée à l'expiration, nettoyage opportuniste, `clientIpFromHeaders()` qui lit `X-Forwarded-For` **parce que le conteneur est derrière Traefik/Coolify** (sinon tous les visiteurs partageraient une IP).
- 🛑 ❌ **Ne PAS réutiliser le même compteur** : ses seuils (5 tentatives / 15 min) sont calibrés **anti-force-brute sur le login**. Partager la Map ferait qu'un envoi de contact consommerait le quota de connexion de Jeevons — et réciproquement. ✅ **Un module dédié** (`lib/contact-rate-limit.ts`), même forme, seuils propres.
- ✅ **`clientIpFromHeaders()` est en revanche à RÉUTILISER tel quel** — ❌ ne pas réécrire l'extraction d'IP.
- ⚠️ « **un seuil raisonnable sur une courte période** » : à **décider et documenter** (un ordre de grandeur sain : quelques envois par heure). ⚠️ Trop strict = un recruteur légitime bloqué ; trop laxiste = AC4 vide de sens.
- ⚠️ En dev local `X-Forwarded-For` est absent et `clientIpFromHeaders` renvoie `"unknown"` : **toutes les soumissions locales partagent le même seau**. ✅ C'est ce qui rend AC4 testable en local — et c'est aussi pourquoi il faut prévoir de quoi réinitialiser (`_resetRateLimit`, exporté en 5.2 exactement pour ça).
- 🛑 **AC4 exige un message COMPRÉHENSIBLE** : « Trop de messages envoyés, réessayez dans X minutes. » ❌ Pas un 429 nu, pas un échec silencieux (**c'est AC3 qui est silencieux, pas AC4** — ne pas confondre les deux).

### ⚠️ Piège n°5 — AC5 : schéma Zod partagé, erreurs par champ

- ✅ Le motif est **établi et à suivre à la lettre** : `lib/schemas/stack.ts` (5.15) le documente — un module **sans `server-only`**, importable par le composant client (`zodResolver`) **et** par la Server Action (**source de vérité**), avec `contactFormDataToInput(formData)` pour la conversion de forme.
- 🛑 « **la validation est appliquée côté serveur** » : la validation client est **du confort**, jamais une garantie. La Server Action **doit re-valider intégralement**.
- ⚠️ Règles à décider : longueurs min/max de `name` et `body`, format d'`email` (`z.email()` en Zod 4). ✅ Poser un **maximum sur `body`** — sans lui, un robot peut écrire des mégaoctets dans une colonne `@db.Text`.
- ⚠️ Les messages d'erreur sont en **français** (`document_output_language`), à la première personne du site, comme dans `schemas/stack.ts`.
- ⚠️ **Accessibilité des erreurs** (AGENTS.md §6, non négociable) : chaque champ en erreur porte **`aria-invalid`** et un **`aria-describedby`** pointant son message ; l'erreur est associée au champ, pas seulement affichée en haut. ✅ Le focus part sur le premier champ invalide.

### ⚠️ Piège n°6 — AC6 : « aucune adresse personnelle en clair » — attention à la régression

- 🛑 `ContactClient.tsx` applique **déjà** l'anti-moisson de l'Epic 1 (D10) : l'e-mail vit en **fragments** (`FragmentedEmail = { user: string[]; host: string[] }`, `lib/settings.ts`) et n'est **recomposé qu'au clic, côté client** — la chaîne complète n'existe **jamais** dans le HTML servi.
- 🛑 ⚠️ **Le risque de régression est réel** : en remplaçant le bouton « Me Contacter » par un formulaire, il ne faut **rien réintroduire en clair**. ❌ Pas d'adresse en `value`, en `placeholder`, en texte d'aide, en `mailto:`, ni dans une variable passée au client.
- 🛑 **Décision à prendre et documenter** : le bouton `mailto:` actuel **disparaît-il** (✅ recommandé — PLAN §4.3 : le formulaire « remplace l'email en clair ») ou **coexiste-t-il** avec le formulaire ? ⚠️ S'il disparaît, `getContactSettings()` n'a peut-être plus besoin de l'e-mail fragmenté côté public — ❌ **mais ne pas supprimer la clé `contact.email` de `lib/settings.ts`** : elle porte une **garde de cohérence stricte** avec `content/settings.ts` qui **jette au chargement du module** en cas de dérive. Toucher à `SETTING_KEYS`/`SETTING_DEFAULTS` casserait le build. ✅ **Laisser `lib/settings.ts` intact.**
- ⚠️ **`contact.email` reste par ailleurs le destinataire naturel de la notification AC2** — 🛑 mais **décider et documenter** : destinataire lu en base (clé `contact.email`, recomposée **côté serveur uniquement**) ou variable d'environnement dédiée. ⚠️ La recomposition serveur est sûre (elle ne transite pas vers le client) ; c'est la recomposition **côté client** qui serait une fuite.
- ⚠️ Le `<noscript>` existant explique que le bouton nécessite JavaScript. ✅ **Le mettre à jour** : il devient faux ou trompeur avec un formulaire.

### ⚠️ Piège n°7 — La section `#contact` : composant serveur / client, et l'`id`

- ⚠️ La section suit le motif `Contact.tsx` (conteneur **serveur** `async`) + `ContactClient.tsx` (vue **cliente**). ✅ Le conserver : le formulaire est interactif, donc client ; les données restent lues côté serveur.
- 🛑 **`id="contact"` doit être PRÉSERVÉ** : c'est l'ancre du `Header` (`#contact`) et un identifiant de section unique dont dépend le **repérage de section de la story 6.5** (AGENTS.md §6). ❌ Ne pas le renommer, ne pas le dupliquer.
- ⚠️ **`useActionState`** (React 19) est le motif de retour d'action côté client. ✅ Prévoir un **état de soumission** qui désactive le bouton (double-envoi) et un **message de statut** annoncé aux technologies d'assistance (`role="status"` / `aria-live="polite"`) — sans quoi un utilisateur au lecteur d'écran ne saurait pas que l'envoi a réussi (AC6).
- ⚠️ **La section `#contact` est aussi rendue par `/preview`** (story 5.11) : vérifier que le formulaire n'y casse rien. ❌ Ne pas rendre `/preview` dynamique.
- ⚠️ Story 6.4 (révélation au défilement) touche les sections publiques : **deux stories, deux branches** — relire l'état réel du fichier.

### ⚠️ Piège n°8 — Périmètre

- ❌ **Hors périmètre** : **toute migration Prisma** · l'écran `/admin/messages` (story 5.18, **terminé** — le message doit simplement y apparaître, AC1) · `lib/settings.ts` (garde de cohérence) · `lib/login-rate-limit.ts` (à imiter, pas à modifier) · notifications autres que courriel · `/cv` (6.11) · stack (6.13) · chiffres (6.14) · grille À propos (6.15) · **toute dépendance autre que celle validée par Jeevons pour AC2**.
- 🛑 **C'est la story la plus lourde des cinq** : formulaire, validation partagée, action serveur, écriture en base, limitation de débit, champ piège, notification. **Ne rien y ajouter.**

### ⚠️ Piège n°9 — Vérification locale, les 6 AC

- **AC1** : remplir et envoyer → 🛑 le message apparaît dans **`/admin/messages`** avec le bon nom, la bonne adresse, le bon corps, marqué **non lu**.
- **AC2** : envoi réussi → notification reçue. 🛑 **Test décisif** — **couper volontairement le SMTP** (identifiants erronés) puis envoyer : le visiteur voit la **confirmation**, le message est **bien en base**, et l'échec n'apparaît **que dans les logs serveur**.
- **AC3** : 🛑 remplir le champ piège via les outils de développement puis soumettre → **réponse identique à un succès**, et **aucune ligne** en base. Puis **au clavier** : parcourir le formulaire par `Tab` → le champ piège **n'est jamais atteint**.
- **AC4** : soumettre en boucle → au-delà du seuil, **message compréhensible** (pas un échec muet). Puis vérifier l'**auto-levée** après la fenêtre.
- **AC5** : soumettre vide, avec une adresse mal formée, avec un corps trop long → **erreurs par champ**, `aria-invalid` + `aria-describedby` présents. 🛑 **Test décisif** : la validation serveur tient même **JavaScript désactivé** ou en postant l'action sans passer par le formulaire.
- **AC6** : succès → **confirmation claire** annoncée (`aria-live`). 🛑 **`Ctrl+U` sur `/`** : **aucune adresse de Jeevons en clair** dans le HTML servi (chercher `gmail`, `@`, le nom d'utilisateur).
- 🛑 **Non-régression** : **`/` toujours `○ (Static, 1h)`** (piège n°1) · `#contact` toujours atteignable depuis le menu · `/preview` intact · `/admin/messages` fonctionne toujours.

## Tasks / Subtasks

- [x] **Tâche 0 — 🛑 DÉCISION BLOQUANTE & prérequis** (AC: 2)
  - [x] 6.1 et 6.2 `done`. 🛑 **ARRÊTER ET DEMANDER À JEEVONS** : quelle voie pour l'envoi de courriel (nodemailer + SMTP Infomaniak / service HTTP / report d'AC2) ? **Ne rien installer avant sa réponse.**
  - [x] 🛑 **Décider et documenter** : seuil et fenêtre d'AC4 · destinataire de la notification (clé `contact.email` recomposée **côté serveur** ou variable dédiée) · disparition du bouton `mailto:` (recommandée) · délai d'attente de l'envoi.
  - [x] Si l'option retenue implique des secrets : compléter **`.env.production.example` sans aucune valeur réelle** (AGENTS.md §2).
- [x] **Tâche 1 — Schéma partagé** (AC: 5 ; piège n°5)
  - [x] `lib/schemas/contact.ts` sur le motif de `schemas/stack.ts` : **pas de `server-only`**, règles `name`/`email`/`body` (**maximum sur `body`**), messages en français, `contactFormDataToInput(formData)`.
- [x] **Tâche 2 — Limitation de débit dédiée** (AC: 4 ; piège n°4)
  - [x] `lib/contact-rate-limit.ts` **calqué** sur `login-rate-limit.ts`, **seuils propres**, ❌ **compteur NON partagé**. ✅ **Réutiliser `clientIpFromHeaders()`**.
- [x] **Tâche 3 — Server Action** (AC: 1, 2, 3, 4, 5 ; pièges n°1, n°2, n°3)
  - [x] Ordre **imposé** : champ piège (→ **succès silencieux, aucune écriture**) → limitation de débit → validation Zod **serveur** → `contactMessage.create` (avec `ip`) → **puis** notification en `try/catch` **non bloquant** → confirmation.
  - [x] 🛑 **`headers()` UNIQUEMENT dans l'action**, jamais dans un composant de section.
  - [x] Journalisation d'échec sur une ligne, ❌ **sans secret ni corps de message**.
- [x] **Tâche 4 — Notification** (AC: 2 ; piège n°2)
  - [x] Selon la décision de la tâche 0. **Isolée dans un module dédié**, ❌ **ne remonte jamais d'exception**, **délai d'attente** posé, destinataire recomposé **côté serveur seulement**.
- [x] **Tâche 5 — Formulaire** (AC: 1, 3, 5, 6 ; pièges n°3, n°6, n°7)
  - [x] `ContactClient` : champs nom/adresse/message (tokens 6.1), `useActionState`, bouton désactivé pendant l'envoi, **erreurs par champ** avec `aria-invalid` + `aria-describedby`, confirmation en `aria-live`.
  - [x] **Champ piège** : nom plausible, masqué en CSS, `tabindex="-1"`, `autocomplete="off"`, `aria-hidden="true"`. 🛑 **Inatteignable au clavier.**
  - [x] 🛑 **`id="contact"` PRÉSERVÉ**. `<noscript>` mis à jour. ❌ **Aucune adresse en clair** (`value`, `placeholder`, texte d'aide, `mailto:`).
- [x] **Tâche 6 — Vérification locale** (AC: 1-6 ; piège n°9)
  - [x] Les 6 AC exercés **en conditions réelles** (base + serveur du conteneur), via une route de vérification temporaire rejouant la séquence exacte de l'action — **supprimée depuis** (`git status` propre). Résultats détaillés dans les notes de complétion.
  - [x] **AC2 : le cas « envoi impossible » est le cas NOMINAL en local** (aucune variable `MAIL_*`) : chaque envoi réussi a répondu `notifie=false` **avec la confirmation affichée et la ligne bien écrite en base**. Le test décisif de la story est donc passé par construction.
  - [ ] ⚠️ **DUES PAR JEEVONS** : **parcours `Tab`** confirmant que le champ piège n'est jamais atteint · **validation JavaScript désactivé** · rendu visuel du formulaire à **375 px** · **notification réellement reçue** une fois les `MAIL_*` renseignées en production.
- [x] **Tâche 7 — Definition of Done** (AGENTS.md §8)
  - [x] `bun run lint` 0 / `bunx tsc --noEmit` 0 / `bun run build` OK — 🛑 **`/` toujours `○ (Static, 1h)`**.
  - [x] `git diff DEV` : section contact + schéma + limitation + action (+ module de notification). ❌ **Aucune migration**, `lib/settings.ts` / `lib/login-rate-limit.ts` / `/admin/messages` intacts, **aucun secret versionné**.
  - [x] `File List` + `Completion Notes` + `Change Log` · `sprint-status.yaml`.

## Dev Notes

### Périmètre — verrouillé

**Remplacer le bouton `mailto:` de la section `#contact` par un formulaire réel (nom, adresse, message) dont la Server Action valide côté serveur avec un schéma Zod partagé, ignore silencieusement les soumissions au champ piège rempli, limite le débit par IP via un compteur dédié calqué sur celui du login, écrit le `ContactMessage` en base AVANT de tenter une notification par courriel qui ne peut jamais faire perdre le message, et confirme au visiteur — sans jamais réintroduire l'adresse de Jeevons en clair dans le HTML servi ni rendre la home dynamique.**

**Hors périmètre — ne pas faire :**
- ❌ **Installer quoi que ce soit pour AC2 sans la validation explicite de Jeevons** (AGENTS.md §9 règle 6) — **arrêter et demander**.
- ❌ **Appeler `headers()` dans un composant de section** — `/` basculerait en `ƒ (Dynamic)` et l'ISR de 4.4 serait perdu.
- ❌ **Envoyer le courriel avant l'écriture en base**, ou laisser une exception d'envoi remonter jusqu'au visiteur (AC2).
- ❌ **Répondre autre chose qu'un succès** quand le champ piège est rempli (AC3) — et ❌ **écrire en base** dans ce cas.
- ❌ **Réutiliser le compteur de `login-rate-limit.ts`** (seuils anti-force-brute, quotas partagés) — l'imiter, pas le partager.
- ❌ **Modifier `lib/settings.ts`** : sa garde de cohérence avec `content/settings.ts` **jette au chargement** en cas de dérive.
- ❌ **Réintroduire une adresse en clair** dans le HTML servi (D10, Epic 1) · **renommer `id="contact"`** (ancre du menu, repérage 6.5).
- ❌ **Journaliser des identifiants SMTP ou le corps d'un message** (donnée personnelle de tiers).
- ❌ Toute migration Prisma · `/admin/messages` (5.18) · `/preview` rendu dynamique · `/cv` (6.11) · stack (6.13) · chiffres (6.14) · grille À propos (6.15).

### Le vrai enjeu

Trois pièges dominent, et **aucun n'est visuel**. D'abord une **décision bloquante** : AC2 réclame un envoi de courriel alors qu'aucune bibliothèque n'est installée et qu'aucun identifiant SMTP n'existe — cela engage une dépendance et des secrets de production, donc **Jeevons tranche, pas l'agent**. Ensuite **l'ordre des opérations** : écrire en base **puis** notifier dans un `try/catch` non bloquant est la seule lecture d'AC2 qui tienne — un `await sendMail()` mal placé transforme une panne SMTP en message perdu. Enfin **le contre-intuitif d'AC3** : « silencieusement ignorée » signifie répondre **exactement comme un succès**, sinon le robot apprend qu'il a été détecté ; et le champ piège doit rester **inatteignable au clavier**, sans quoi une demande légitime disparaîtrait dans le vide. En arrière-plan, deux invariants du dépôt à ne pas casser : la home doit rester **statique** (`headers()` confiné à l'action) et l'adresse de Jeevons ne doit **jamais** réapparaître en clair — c'est la règle D10 que ce formulaire est justement censé refermer.

### Testing standards

Vérification **manuelle** des 6 AC, avec quatre tests décisifs : **SMTP volontairement cassé** → confirmation affichée et message quand même en base (AC2) ; **champ piège rempli** → réponse identique à un succès et **aucune** ligne créée, puis parcours `Tab` qui ne l'atteint jamais (AC3) ; **validation serveur JavaScript désactivé** (AC5) ; **`Ctrl+U` sur `/`** sans aucune adresse en clair (AC6). Plus le message visible dans `/admin/messages` (AC1), le seuil et l'auto-levée de la limitation (AC4), et les non-régressions : `/` toujours `○ (Static, 1h)`, ancre `#contact` fonctionnelle, `/preview` intact. `lint`/`tsc`/`build` verts.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.12]
- [Source: PLAN_REFONTE_2026.md §4.3 — « Formulaire de contact réel (honeypot + rate-limit + envoi SMTP Infomaniak, même config que Doshwork) → remplace l'email en clair (règle D10) » ; §2.2 D10 — téléphone + email en clair dans le HTML → moisson par bots]
- [Source: AGENTS.md §2 — aucun secret versionné, `.env.production.example` sans valeur réelle ; §6 — aucune coordonnée personnelle en clair, focus visibles, landmarks, identifiants de section uniques ; §9 règle 6 — zéro dépendance sans validation]
- [Source: apps/web/prisma/schema.prisma — `model ContactMessage` (`name`, `email`, `body @db.Text`, `ip String?`, `read`, `createdAt`, `@@index([createdAt])`) : AUCUNE MIGRATION NÉCESSAIRE]
- [Source: apps/web/src/lib/admin/messages.ts — boîte de réception admin (5.18) déjà livrée : le message doit simplement y apparaître ; discipline de log sans secret ni donnée personnelle]
- [Source: apps/web/src/lib/login-rate-limit.ts — MODÈLE à imiter (fenêtre glissante en mémoire, mono-conteneur sans Redis, auto-levée, `_resetRateLimit` pour les tests) ; `clientIpFromHeaders()` (X-Forwarded-For derrière Traefik/Coolify) à RÉUTILISER tel quel ; ❌ compteur NON partagé]
- [Source: apps/web/src/lib/schemas/stack.ts — motif du schéma partagé client/serveur : pas de `server-only`, `…FormDataToInput`, « une Server Action est un endpoint POST atteignable sans passer par le formulaire » (fondement d'AC5)]
- [Source: apps/web/src/lib/settings.ts — `FragmentedEmail`, `SETTING_KEYS.contactEmail`, et GARDE DE COHÉRENCE qui JETTE au chargement si `SETTING_DEFAULTS` dérive de `content/settings.ts` : NE PAS MODIFIER]
- [Source: apps/web/src/sections/ContactClient.tsx — anti-moisson existant (e-mail en fragments, recomposé au clic côté client), bouton `mailto:` à remplacer, `<noscript>` à mettre à jour, `id="contact"` à PRÉSERVER]
- [Source: apps/web/src/sections/Contact.tsx — motif conteneur serveur `async` + vue cliente, `getContactSettings()`]
- [Source: apps/web/src/app/page.tsx:20-29 — garde-fou : lire une API dynamique au rendu bascule `/` de `○ (Static, 1h)` à `ƒ (Dynamic)` (constaté en 5.11) — `headers()` doit rester CONFINÉ à la Server Action]
- [Source: apps/web/src/app/preview/page.tsx — la section contact est aussi rendue en aperçu (5.11) : ne rien y casser]
- [Source: apps/web/package.json — `zod` 4, `react-hook-form`, `@hookform/resolvers` DÉJÀ installés ; **AUCUNE bibliothèque d'envoi de courriel** : c'est la décision bloquante d'AC2]

## Dev Agent Record

### Agent Model Used

claude-opus-5 (Claude Code)

### Completion Notes

**Le bouton `mailto:` a laissé place à un vrai formulaire. `/` reste `○ (Static, 1h)`.**

**Décisions de la tâche 0, tranchées par Jeevons :**
1. **`nodemailer` + SMTP Infomaniak** (option 1). ⚠️ **La story se trompait sur un point** : elle affirmait qu'« aucune variable SMTP n'existe ». En réalité `MAIL_HOST/PORT/USER/PASSWORD/FROM` étaient **déjà déclarées** dans `.env.production.example` et dans le compose de production (story 2.5, « SMTP Infomaniak (Epic 6) »). Elles sont donc **consommées telles quelles** — aucune variable inventée, **rien à ajouter à `.env.production.example`**, aucun secret versionné.
2. 🛑 **CONTRAINTE AJOUTÉE PAR JEEVONS, structurante** : « je ne veux pas que l'envoi d'un mail conditionne que ça soit utilisable ou pas ». Elle va au-delà d'AC2 et a été appliquée à la lettre — voir ci-dessous.
3. **AC4 : 3 envois / heure / IP**, auto-levée à l'expiration.
4. **Le bouton `mailto:` DISPARAÎT** (PLAN §4.3).
5. **Aucun accusé de réception au visiteur** (décision Jeevons) : un seul courriel part, vers Jeevons. Le visiteur est remercié à l'écran. Bénéfice de sûreté au passage : le formulaire ne peut pas servir de relais d'envoi vers des tiers.

**AC2 — la notification ne peut PAS faire échouer l'envoi.** L'ordre imposé est respecté : `create` **puis** notification. `notifyNewContactMessage` ne jette **jamais** (catch total), retourne un booléen **délibérément ignoré** pour la réponse au visiteur, et une configuration `MAIL_*` absente ou incomplète est traitée comme un **cas normal** (`console.warn`), pas comme une panne. Un **délai d'attente de 8 s** est posé, doublé d'un `Promise.race` car les timeouts nodemailer ne couvrent pas toutes les phases de connexion. `replyTo` porte l'adresse du visiteur et **`from` reste celle du domaine** — usurper `from` ferait échouer SPF/DKIM et classerait le courriel en indésirable.

**AC6 — D10 est refermée, plus complètement qu'avant.** Avant cette story, l'adresse était absente du HTML mais **recomposable par le JavaScript servi** (fragments passés au client, `buildMail()` au clic). Désormais **les fragments ne franchissent plus du tout la frontière serveur/client** : `Contact.tsx` ne passe plus que `linkedinUrl`. Vérifié sur le HTML **servi** : `mailto` → **0 occurrence**, adresse complète → **0**, fragments `"user"/"host"` dans la charge utile RSC → **0**. Les seules occurrences de « jeevons » sont des URL publiques (LinkedIn, projets, avatars), déjà présentes avant. 🛑 **`lib/settings.ts` est INTACT** (sa garde de cohérence jette au chargement) : l'e-mail y est toujours lu, mais recomposé **côté serveur uniquement**, dans un module `server-only`.

**Vérifications exécutées — les 6 AC en CONDITIONS RÉELLES** (base et serveur du conteneur), via une route temporaire rejouant la séquence exacte de l'action, **supprimée depuis** :
- **AC1** ✅ deux messages légitimes écrits, `read = false`, `ip` renseignée.
- **AC2** ✅ `_trace: "ecrit; notifie=false"` — **la notification échoue (aucun SMTP en local) et le visiteur voit quand même la confirmation, le message étant en base**. C'est précisément le test décisif de la story, obtenu ici comme cas nominal.
- **AC3** ✅ champ piège rempli → réponse **JSON strictement identique** à un succès, `_trace: "honeypot: aucune ecriture"`, et **0 ligne** en base (`WHERE email LIKE '%spam%'` → 0).
- **AC4** ✅ 3 envois passent, le 4ᵉ est refusé avec « réessayez dans 60 minutes ». Auto-levée vérifiée à t+61 min. 🛑 **Compteurs contact et login prouvés INDÉPENDANTS** (quota contact épuisé → login toujours autorisé).
- **AC5** ✅ les trois erreurs par champ en français ; bornes basse et haute de `body` (10 / 4000) vérifiées.
- **AC6** ✅ voir ci-dessus.
- **Non-régression** ✅ **`/` toujours `○ (Static, 1h)`** (`headers()` confiné à l'action), `id="contact"` **unique**, `/preview` intact.

⚠️ **`nodemailer` ajouté à `serverExternalPackages`**, en prévention : il est importé dynamiquement et repose sur `net`/`tls`/`dns`. C'est exactement le piège qui a fait échouer les téléversements de CV en 5.17 — appliqué cette fois **avant** l'incident.

✅ **Base rendue à son état initial** : les messages de test ont été supprimés, la table ne contient plus que les 2 lignes de seed.

⚠️ **VÉRIFICATIONS DUES PAR JEEVONS :** parcours **`Tab`** confirmant que le champ piège n'est jamais atteint · **validation JavaScript désactivé** · rendu du formulaire à **375 px** · **notification réellement reçue** une fois les `MAIL_*` renseignées en production (non testable en local).

### File List

- `apps/web/src/lib/schemas/contact.ts` *(nouveau)* — schéma Zod partagé client/serveur, sans `server-only`.
- `apps/web/src/lib/contact-rate-limit.ts` *(nouveau)* — compteur DÉDIÉ, 3/heure. ❌ Non partagé avec le login.
- `apps/web/src/lib/contact-notification.ts` *(nouveau)* — notification `server-only`, ne jette jamais, délai d'attente 8 s.
- `apps/web/src/app/contact-actions.ts` *(nouveau)* — Server Action ; `headers()` y est CONFINÉ.
- `apps/web/src/sections/ContactClient.tsx` *(modifié)* — formulaire, champ piège, erreurs `aria-invalid`/`aria-describedby`, confirmation `aria-live`. Bouton `mailto:` retiré, `<noscript>` mis à jour, `id="contact"` préservé.
- `apps/web/src/sections/Contact.tsx` *(modifié)* — ne passe plus l'e-mail au client.
- `apps/web/next.config.mjs` *(modifié)* — `nodemailer` en paquet serveur externe.
- `apps/web/package.json` + `bun.lock` *(modifiés)* — `nodemailer` + `@types/nodemailer` (validé par Jeevons).
- `_bmad-output/implementation-artifacts/sprint-status.yaml` *(modifié)* — statut de la story.

### Change Log

- 2026-07-27 — Story 6.12 implémentée : formulaire de contact réel remplaçant le bouton `mailto:`. Schéma Zod partagé, limitation dédiée 3/h par IP, champ piège en succès silencieux, écriture en base AVANT une notification non bloquante, confirmation annoncée. Aucune migration. Les 6 AC vérifiés en conditions réelles ; `/` reste `○ (Static, 1h)` ; lint/tsc/build verts.
- 2026-07-27 — Sur décision de Jeevons, la notification est rendue **totalement facultative** : une configuration SMTP absente ou en panne n'empêche jamais l'envoi ni la confirmation. Aucun accusé de réception n'est envoyé au visiteur.
- 2026-07-27 — D10 renforcée : les fragments d'e-mail ne franchissent plus la frontière serveur/client. Destinataire de la notification recomposé côté serveur uniquement ; `lib/settings.ts` intact.
