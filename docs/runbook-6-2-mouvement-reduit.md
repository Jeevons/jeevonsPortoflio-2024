# Runbook 6.2 — Mouvement réduit : socle, test et contrat

> Story 6.2. Ce document est le **mode d'emploi du socle de neutralisation du mouvement**.
> Il sert deux publics : celui qui **vérifie** le comportement (§2) et celui qui **ajoute une animation** (§3).
>
> Contexte : l'accessibilité est non négociable (AGENTS.md §6, PLAN §4.4 règle D11). Chaque animation du site doit être neutralisée sous `prefers-reduced-motion: reduce`.

---

## 1. Comment le socle fonctionne

La neutralisation repose sur **deux mécanismes complémentaires**. Comprendre lequel couvre quoi évite d'ajouter du code inutile — ou d'oublier le seul qui compte.

| | Où | Couvre | Ne couvre pas |
|---|---|---|---|
| **Socle CSS** | `apps/web/src/app/globals.css`, règle `@media (prefers-reduced-motion: reduce)` | Toutes les animations et transitions **CSS** : durées, itérations, **délais**, `scroll-behavior` | Les animations pilotées en **JS**, et tout **état initial** posé par un composant |
| **Socle JS** | `apps/web/src/lib/motion.ts` | Les animations `motion` : états initial/final, transitions | Rien de plus — il s'appuie sur `useReducedMotion` de `motion/react` |

### Pourquoi `0.01ms` et non `none`

La règle CSS raccourcit les animations au lieu de les supprimer :

```css
animation-duration: 0.01ms !important;
transition-duration: 0.01ms !important;
animation-delay: 0ms !important;
transition-delay: 0ms !important;
```

Deux raisons, toutes deux importantes :

1. **L'animation saute à son état FINAL**, pas à son état initial. Avec `animation: none`, un élément animé depuis `opacity: 0` reviendrait à l'invisibilité.
2. **Les évènements `animationend` / `transitionend` continuent de se déclencher.** Un composant qui attend la fin d'une animation pour révéler la suite ne reste pas bloqué.

Les **délais** sont neutralisés pour la même raison : une animation réduite à `0.01ms` mais précédée d'un `animation-delay: 400ms` laisserait l'élément dans son état initial — donc potentiellement invisible — pendant toute l'attente.

> ⚠️ La règle est **volontairement hors de tout `@layer`** : c'est ce qui lui permet de primer sur les utilitaires Tailwind. Ne pas la déplacer.

---

## 2. Comment tester (procédure de vérification)

### 2.1 Activer le réglage

**macOS (système entier — le test le plus fidèle)**
Réglages Système → Accessibilité → Affichage → cocher **« Réduire les animations »**.

**Chrome / Edge (sans toucher au système — recommandé au quotidien)**
DevTools → `Cmd+Shift+P` → taper `Show Rendering` → section **Emulate CSS media feature prefers-reduced-motion** → choisir `prefers-reduced-motion: reduce`.

**Firefox**
`about:config` → `ui.prefersReducedMotion` → valeur **`1`** (`0` = animations normales).

**Safari**
Suit le réglage système macOS ci-dessus (pas d'émulation en DevTools).

### 2.2 Ce qui doit être constaté

Parcourir `/` avec le réglage **actif** :

- [ ] Orbites du Hero (`HeroOrbit`) **immobiles** — ni rotation, ni scintillement
- [ ] Bandeau `Tape` **arrêté** (pas de défilement horizontal)
- [ ] Badge « disponible » du Hero **sans pulsation**
- [ ] Clic sur les ancres du menu → saut **direct**, sans défilement animé
- [ ] Vignettes « centres d'intérêt » (`AboutClient`) **non déplaçables** (drag désactivé)
- [ ] Témoignages : **pas de défilement automatique**, mais toutes les cartes restent atteignables **au défilement manuel**
- [ ] 🛑 **Aucun contenu manquant, vide ou invisible** — c'est le point critique (voir §3)

Puis sur `/admin` :

- [ ] Squelettes de chargement **sans pulsation**

### 2.3 Le second test, aussi obligatoire

**Désactiver** le réglage et refaire le parcours : **tout doit remarcher**. Une neutralisation trop large qui casse le mode normal est un échec au même titre qu'une animation non neutralisée.

---

## 3. Contrat pour toute animation future (stories 6.4 → 6.18)

### 3.1 Animation purement CSS

Rien à faire. La règle globale la couvre. Vérifier tout de même avec §2.

### 3.2 Animation pilotée en JS (`motion`)

🛑 **Le piège à connaître** — c'est le bug classique du reveal au scroll :

> Un composant part de `opacity: 0` et devient visible **par** l'animation.
> Sous mouvement réduit, l'animation est neutralisée **mais l'état initial reste appliqué**.
> → Le contenu est **invisible pour toujours**.

La règle CSS ne protège **pas** de ce cas : l'état initial est posé en JS, ce n'est pas une animation.

❌ **Mauvaise approche** — « appliquer l'état initial, puis accélérer la transition » :

```tsx
// Le contenu reste à opacity 0 si quoi que ce soit empêche l'animation de partir.
<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
```

✅ **Approche imposée** — « sous mouvement réduit, ne pas appliquer l'état initial du tout » :

```tsx
"use client";

import { motion } from "motion/react";
import {
  motionTransition,
  resolveMotionStates,
  useReducedMotion,
} from "@/lib/motion";

export const Reveal = ({ children }: { children: React.ReactNode }) => {
  const shouldReduceMotion = useReducedMotion();

  const states = resolveMotionStates(shouldReduceMotion, {
    initial: { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
  });

  return (
    <motion.div
      {...states}
      transition={motionTransition(shouldReduceMotion, { duration: 0.5 })}
    >
      {children}
    </motion.div>
  );
};
```

Sous mouvement réduit, `resolveMotionStates` renvoie `initial === animate === l'état final` : il n'y a plus rien à animer, et **plus rien qui puisse masquer le contenu**.

### 3.3 Les trois règles

1. **Passer par `@/lib/motion`**, jamais par un `matchMedia` maison — `useReducedMotion` de `motion/react` est la source de vérité unique.
2. **Ne jamais laisser un état initial masquant s'appliquer** sous mouvement réduit → utiliser `resolveMotionStates`.
3. **Toute boucle JS** (`setInterval`, `requestAnimationFrame`) doit être **conditionnée** par `shouldReduceMotion` (voir `TestimonialsClient.tsx` pour l'exemple en place), et l'alternative doit rester utilisable — ici, le défilement manuel.

---

## 4. État des animations au moment de la story 6.2

Audit réalisé — **toutes déjà neutralisées**, aucune refonte nécessaire :

| Animation | Où | Mécanisme |
|---|---|---|
| `animate-spin` (orbites + rotation) | `HeroOrbit.tsx` | Socle CSS (le `animationDuration` inline est battu par le `!important` de la règle) |
| `animate-move-left` / `animate-move-right` | `Tape.tsx` | Socle CSS |
| `animate-ping-large` | badge du Hero | Socle CSS |
| `animate-ping` | pastille de `AboutClient` | Socle CSS |
| `animate-pulse` | squelettes admin | Socle CSS (acquis 5.20) |
| `hover:scale-110`, transitions `.nav-item` | `ProjectCard`, `Header` | Socle CSS (`transition-duration`) |
| Drag des vignettes | `AboutClient.tsx` | `useReducedMotion` → `drag={!shouldReduceMotion}` |
| Auto-scroll des témoignages | `TestimonialsClient.tsx` | `useReducedMotion` → `setInterval` non démarré |
| `scroll-behavior: smooth` | `globals.css` | Socle CSS (`scroll-behavior: auto !important`) |
