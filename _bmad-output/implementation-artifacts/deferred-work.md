# Deferred work

## Deferred from: code review of 1-1-cibler-la-bonne-section-depuis-la-navigation.md (2026-07-21)

- Warning lint préexistant `Testimonials.tsx:78` (`react-hooks/exhaustive-deps`) — hors périmètre story 1.1 ; correction prévue hors de cette story (fichier touché par 1.2 / dette lint).
- Header `fixed top-3` sans `scroll-margin-top` sur les sections — la cible d'ancre peut arriver sous la barre de navigation ; documenté pour Epic 6 (stories 6.3 / 6.5).

## Deferred from: story 1.9 (2026-07-21)

- `public/assets/docs/photoIDD.jpg` (136 846 o) — **asset orphelin** (`grep -rn "photoIDD" src/` → 0 résultat). Hors des AC de la story 1.9, donc **non supprimé**. Une photo d'identité peut servir plus tard (CV, back-office Epic 5) : **décision à prendre par Jeevons** — conserver ou supprimer.
- Autres candidats orphelins possibles dans `src/assets/images/` (`memoji-avatar-*.png`, `map.png`, `book-cover.png`, `dark-saas-landing-page.png`…) — **non audités ni supprimés**, l'AC de la story 1.9 énumérait 13 fichiers précis. Un inventaire complet des assets inutilisés reste à faire.
## Deferred from: vérification navigateur de l'Epic 1 (2026-07-21)

- **Header en mobile (375px)** : « À propos » se coupe sur deux lignes et « Contact » touche le bord droit de la barre de navigation. Constaté sur appareil réel. **Préexistant** — `src/sections/Header.tsx` n'a été modifié par aucune story de l'Epic 1 (seul `Card.tsx` l'a été côté `components/`). Hors périmètre ; à traiter dans la refonte visuelle de l'**Epic 6**.
- **Titres de projets quasi identiques** : « Landing page. » et « Landing Page. » (seule la majuscule diffère) dans `SelfProject.tsx`. Rend peu discriminants les `aria-label` introduits par la story 1.4. Correction = modifier les données `portfolioProjects`, **décision de Jeevons**.

## Deferred from: story 1.9 (2026-07-21) — suite

- Les 15 Mo supprimés en story 1.9 **restent dans l'historique Git** : un `git clone` complet les téléchargera toujours. Réécriture d'historique volontairement écartée (destructive). À rouvrir seulement si le poids du clone devient un problème réel.

## Deferred from: élargissement du registre d'icônes (2026-07-28)

Contexte : le registre `src/lib/stack-icons.ts` est passé de 6 à 20 clés, ce qui couvre la pile réellement employée. Le besoin exprimé par Jeevons allait plus loin — **téléverser ses propres icônes depuis l'administration**, pour ne plus dépendre d'un déploiement à chaque nouvelle techno. Cadré ici, **non implémenté** : c'est une story Epic 5 à part entière, pas un ajustement.

### Story pressentie — « Ajouter une icône de technologie sans déploiement »

**En tant que** Jeevons, **je veux** téléverser l'icône d'une technologie depuis `/admin/stacks`, **afin de** présenter une techno absente du registre sans attendre une livraison.

**Critères d'acceptation pressentis :**

1. Le formulaire de technologie propose, en plus du registre, le téléversement d'un fichier d'icône ; l'icône téléversée s'affiche dans la toolbox publique.
2. Une icône téléversée est prévisualisée avant enregistrement, et reste remplaçable ou supprimable (retour au registre / icône neutre).
3. Un fichier refusé (format, poids, contenu) affiche un message explicite et **ne remplace jamais** l'icône en place.
4. Une technologie dont l'icône a été supprimée du disque continue de s'afficher avec l'icône neutre — jamais de carré vide (règle déjà en vigueur, story 5.15).

**🛑 LE POINT DUR, À NE PAS SOUS-ESTIMER — la sanitisation SVG.** Un SVG est du **XML exécutable** : il peut porter `<script>`, `onload=`, `href="javascript:"`, `<foreignObject>`, une entité XXE. Les icônes actuelles sont sûres parce qu'elles sont **compilées au build** par SVGR depuis des fichiers versionnés et relus. Une icône téléversée, elle, serait rendue **au runtime depuis la base** : c'est un vecteur XSS stocké direct, dans une page publique. Trois issues possibles, à trancher dans la story :

- **la plus sûre** — n'accepter que du **raster** (PNG/WebP) et le faire passer par le pipeline `sharp` déjà en place (story 5.12) ; on perd la mise à l'échelle nette et la teinte `currentColor` ;
- **intermédiaire** — accepter le SVG mais le servir en `<img src>` depuis `/api/media/...` (contexte inerte, pas de script exécuté), au prix de la perte de `currentColor` ;
- **la plus coûteuse** — inliner le SVG après passage par une allow-list stricte (bibliothèque de sanitisation dédiée, jamais une regex maison).

**Autres impacts :** migration Prisma sur `Stack` (l'icône devient `iconKey` **ou** référence `MediaAsset`, les deux s'excluant) ; `resolveStackIcon` doit gérer une troisième source ; le repli statique `src/content/stacks.ts` (story 4.5) ne peut pas porter d'icône téléversée — sans base, retour à l'icône neutre.

**Alternative moins coûteuse, si le besoin reste occasionnel :** continuer d'enrichir le registre. Ajouter une icône = déposer un SVG relu dans `src/assets/icons/`, une clé dans `STACK_ICON_KEYS`, un libellé et une ligne dans `ICONS`. Le `Record<StackIconKey, …>` de `StackIcon.tsx` garantit qu'on ne peut pas en oublier une — l'oubli est une erreur de compilation.
