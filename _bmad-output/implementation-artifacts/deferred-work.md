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
