"use client";

import { useReducedMotion } from "@/lib/motion";
import { useEffect, useState } from "react";

// Story 6.7 (AC2, AC3, AC4) — RÔLE DÉFILANT AVEC EFFET DE FRAPPE.
//
// 🛑 DEUX ÉCHECS D'AC TIENNENT CHACUN À UNE SEULE LIGNE MANQUANTE.
//
// 1. **L'inondation des lecteurs d'écran (AC2).** Un effet de frappe modifie le
//    DOM caractère par caractère. Un `aria-live` posé naïvement sur le conteneur
//    ferait annoncer « D… Dé… Dév… Déve… » — exactement ce que l'AC interdit
//    quand il demande une annonce « sans les inonder de mises à jour ».
//    ✅ Réponse : le texte animé est `aria-hidden`, et les rôles sont exposés
//    UNE FOIS pour toutes dans un nœud `sr-only` STATIQUE. Zéro mise à jour,
//    donc zéro inondation — et aucun `aria-live` nécessaire.
//
// 2. **Le saut de mise en page (AC3).** Un texte qui grandit lettre par lettre
//    change la largeur de son conteneur à chaque frame. Le bloc étant CENTRÉ,
//    un texte qui s'allonge décale ses DEUX côtés, et tout ce qui suit sautille
//    — CLS catastrophique. ✅ Réponse : le rôle le plus long est rendu en
//    `invisible` sous le texte animé, ce qui réserve la largeur ET la hauteur
//    définitives dès le premier rendu. Rien ne bouge plus ensuite.
//
// ⚠️ AC4 — LE CSS DE LA STORY 6.2 N'ATTEINT PAS UN MINUTEUR. La règle globale
// neutralise animations et transitions CSS ; un `setTimeout` est du JavaScript,
// il continuerait de tourner et le rôle continuerait de défiler. D'où le
// `if (shouldReduceMotion)` explicite ci-dessous, AVANT de démarrer quoi que ce
// soit. L'AC demande un rôle « fixe, sans effet de frappe » : on affiche donc le
// premier intitulé, en entier, définitivement.

/** Délai entre deux caractères pendant la frappe, en millisecondes. */
const TYPING_MS = 70;

/** Délai entre deux caractères pendant l'effacement — plus rapide que la frappe. */
const DELETING_MS = 35;

/** Temps d'affichage d'un rôle complet avant son effacement, en millisecondes. */
const HOLD_MS = 1800;

type HeroRolesProps = {
  /**
   * Intitulés à faire défiler, dans l'ordre. Administrable depuis `/admin`
   * (clé `hero.roles`) ; jamais vide, `getHeroSettings()` garantit un repli.
   */
  roles: string[];
};

/**
 * Affiche le rôle courant avec un effet de frappe, en boucle sur `roles`.
 *
 * 🛑 CE COMPOSANT EST UN ENFANT CLIENT D'UN CONTENEUR SERVEUR. `Hero.tsx` est un
 * Server Component `async` qui lit la base : il reste tel quel et passe les
 * rôles en props. C'est le pattern déjà en place dans le dépôt
 * (`Testimonials`/`TestimonialsClient`, `About`/`AboutClient`) — y ajouter
 * `"use client"` casserait la lecture serveur et l'ISR de la story 4.4.
 */
export const HeroRoles = ({ roles }: HeroRolesProps) => {
  const shouldReduceMotion = useReducedMotion();

  // ⚠️ UN SEUL ÉTAT POUR TOUT LE CYCLE, et non trois indépendants.
  //
  // Le passage au rôle suivant change SIMULTANÉMENT trois choses (on cesse
  // d'effacer, on avance d'un rôle, le compteur repart de zéro). Avec trois
  // `useState` séparés, ce passage devait s'écrire dans le CORPS de l'effet —
  // c'est-à-dire un `setState` synchrone, cascade de rendus que la règle
  // `react-hooks/set-state-in-effect` signale à juste titre. Regroupés, la
  // transition devient une seule écriture, faite depuis le callback du minuteur
  // comme toutes les autres : l'effet ne fait plus que PROGRAMMER la suite.
  const [state, setState] = useState({
    roleIndex: 0,
    charCount: 0,
    isDeleting: false,
  });
  const { roleIndex, charCount, isDeleting } = state;

  useEffect(() => {
    // 🛑 AC4 — LA GARDE QUI COMPTE. Sans elle, le minuteur continuerait de
    // tourner sous mouvement réduit : la règle CSS de la story 6.2 ne peut rien
    // contre du JavaScript. `useReducedMotion` étant réactif, basculer le
    // réglage sans recharger la page arrête bien le défilement — l'effet est
    // rejoué et sort immédiatement.
    if (shouldReduceMotion || roles.length === 0) {
      return;
    }

    const current = roles[roleIndex] ?? "";

    // Rôle entièrement frappé : on le laisse à l'écran, puis on l'efface.
    if (!isDeleting && charCount === current.length) {
      const timer = setTimeout(
        () => setState((previous) => ({ ...previous, isDeleting: true })),
        HOLD_MS,
      );
      return () => clearTimeout(timer);
    }

    // Rôle entièrement effacé : on passe au suivant, en boucle. La transition
    // est programmée comme les autres (et non appliquée sur-le-champ), au même
    // rythme qu'un caractère effacé — l'enchaînement reste donc régulier.
    if (isDeleting && charCount === 0) {
      const timer = setTimeout(
        () =>
          setState((previous) => ({
            roleIndex: (previous.roleIndex + 1) % roles.length,
            charCount: 0,
            isDeleting: false,
          })),
        DELETING_MS,
      );
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(
      () =>
        setState((previous) => ({
          ...previous,
          charCount: previous.charCount + (previous.isDeleting ? -1 : 1),
        })),
      isDeleting ? DELETING_MS : TYPING_MS,
    );
    return () => clearTimeout(timer);
  }, [shouldReduceMotion, roles, roleIndex, charCount, isDeleting]);

  // Le rôle le plus long dicte la place à réserver (voir l'en-tête, point 2).
  const longestRole = roles.reduce(
    (longest, role) => (role.length > longest.length ? role : longest),
    "",
  );

  // Sous mouvement réduit, le premier rôle s'affiche ENTIER et le reste.
  const visibleText = shouldReduceMotion
    ? (roles[0] ?? "")
    : (roles[roleIndex] ?? "").slice(0, charCount);

  return (
    <p className="mt-4 text-center">
      {/* ✅ L'ANNONCE ACCESSIBLE, EN UN SEUL MORCEAU ET UNE SEULE FOIS.
          Statique : ce nœud ne change jamais, il ne peut donc rien inonder. Les
          rôles y sont listés en clair, séparés par des virgules — un lecteur
          d'écran énonce « Développeur Full-Stack, UI Engineer, Créatif » et
          passe à la suite. */}
      <span className="sr-only">{roles.join(", ")}</span>

      {/* Le texte animé est purement visuel : il n'existe pas pour les
          technologies d'assistance, qui ont déjà lu le nœud ci-dessus. */}
      <span aria-hidden="true" className="relative inline-block">
        {/* 🛑 LA CALE ANTI-CLS. Occupe la largeur et la hauteur définitives dès
            le premier rendu ; `invisible` la retire de l'affichage sans la
            retirer du flux (contrairement à `hidden`, qui ne réserverait rien).
            Le texte animé, lui, est superposé en `absolute` : il peut donc
            grandir et rétrécir sans jamais déplacer quoi que ce soit.

            🛑 LA CALE PORTE LES MÊMES CLASSES DE FONTE QUE LE TEXTE ANIMÉ, ET
            RÉSERVE AUSSI LA PLACE DU CURSEUR (retour Jeevons, 27/07 : sur
            « Développeur Full-Stack », le curseur repassait à la ligne et la fin
            du mot disparaissait).

            ❌ Sans `font-semibold md:text-lg`, la cale était mesurée dans la
            fonte du paragraphe — plus étroite que le texte animé, donc trop
            courte : le rôle le plus long débordait.
            ❌ Sans la réplique du curseur, il manquait encore sa largeur plus
            sa marge, et c'est LUI qui passait à la ligne.
            ⚠️ `whitespace-nowrap` est la ceinture de sécurité : même à quelques
            pixels près, plus rien ne peut se replier. */}
        <span className="invisible whitespace-nowrap font-semibold md:text-lg">
          {longestRole}
          <span className="ml-0.5 inline-block w-0.5" />
        </span>

        <span className="text-gradient-accent absolute inset-0 whitespace-nowrap font-semibold md:text-lg">
          {visibleText}
          {/* Le curseur de frappe. Il clignote par une animation CSS, donc la
              règle globale de la story 6.2 le fige sous mouvement réduit — et
              comme le rôle y est alors complet et définitif, un curseur immobile
              à la fin du mot est exactement ce qu'on veut. */}
          <span className="bg-accent-from ml-0.5 inline-block h-[1em] w-0.5 translate-y-[0.15em] animate-pulse" />
        </span>
      </span>
    </p>
  );
};
