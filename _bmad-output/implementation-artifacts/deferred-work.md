# Deferred work

## Deferred from: code review of 1-1-cibler-la-bonne-section-depuis-la-navigation.md (2026-07-21)

- Warning lint préexistant `Testimonials.tsx:78` (`react-hooks/exhaustive-deps`) — hors périmètre story 1.1 ; correction prévue hors de cette story (fichier touché par 1.2 / dette lint).
- Header `fixed top-3` sans `scroll-margin-top` sur les sections — la cible d'ancre peut arriver sous la barre de navigation ; documenté pour Epic 6 (stories 6.3 / 6.5).
