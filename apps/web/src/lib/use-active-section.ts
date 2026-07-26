"use client";

import { useEffect, useState } from "react";

// Story 6.5 (AC3) — SCROLL-SPY : quelle section occupe l'essentiel de l'écran ?
//
// ⚠️ `IntersectionObserver` et NON un listener `scroll` calculant des offsets :
// l'observateur est asynchrone et hors du thread de composition, là où un calcul
// d'offsets à chaque évènement provoque du layout thrashing (piège n°4).

/**
 * 🛑 L'ASYMÉTRIE CENTRALE DE CETTE STORY (piège n°1).
 *
 * La page compte **six** sections (`hero`, `projects`, `side-projects`,
 * `parcours`, `about`, `contact`) mais le menu n'a que **cinq** entrées :
 * `side-projects` n'a **délibérément pas** de lien, par décision explicite de la
 * story 1.1 (AC3) — « la navigation reste sans lien dédié aux projets
 * personnels, la section reste atteignable en poursuivant le défilement ».
 *
 * Un scroll-spy naïf produirait donc, en traversant `side-projects`, soit un
 * état actif qui s'éteint brutalement, soit — bien pire — l'ajout spontané d'une
 * sixième entrée qui annulerait cette décision d'Epic 1.
 *
 * **Décision retenue : `side-projects` est REPLIÉ sur `projects`.**
 *
 * Pourquoi celle-ci plutôt que « aucune entrée active » : les deux sections
 * forment une même zone de lecture (des projets, phares puis personnels), et
 * `side-projects` suit immédiatement `projects`. Garder « Projets » en évidence
 * traduit fidèlement où se trouve le visiteur, là où éteindre toute mise en
 * évidence lui donnerait l'impression d'être sorti de la page. Aucune entrée de
 * menu n'est ajoutée.
 */
const SECTION_TO_NAV_ID: Record<string, string> = {
  hero: "hero",
  projects: "projects",
  "side-projects": "projects",
  parcours: "parcours",
  about: "about",
  contact: "contact",
};

/** Les six sections observées, dans l'ordre du document. */
const OBSERVED_SECTIONS = Object.keys(SECTION_TO_NAV_ID);

/**
 * Renvoie l'identifiant d'entrée de menu à mettre en évidence, ou `null` tant
 * qu'aucune section ne domine l'écran.
 *
 * ⚠️ `null` au premier rendu, et c'est nécessaire : le rendu serveur ne connaît
 * pas la position de défilement. Poser une entrée active par défaut créerait une
 * divergence d'hydratation, et surtout un état actif faux le temps que
 * l'observateur se prononce.
 */
export function useActiveSection(): string | null {
  const [activeNavId, setActiveNavId] = useState<string | null>(null);

  useEffect(() => {
    const sections = OBSERVED_SECTIONS.map((id) =>
      document.getElementById(id),
    ).filter((node): node is HTMLElement => node !== null);

    if (sections.length === 0) {
      return;
    }

    // AC3 dit « occupe l'essentiel de l'écran », pas « touche le haut ». On
    // retient donc la section la plus visible parmi celles qui intersectent,
    // plutôt que la première rencontrée.
    const visibility = new Map<string, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visibility.set(entry.target.id, entry.intersectionRatio);
        }

        let bestId: string | null = null;
        let bestRatio = 0;

        for (const [id, ratio] of visibility) {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestId = id;
          }
        }

        // Sous ce seuil, aucune section ne « domine » réellement : on conserve
        // la dernière mise en évidence plutôt que de faire clignoter le menu
        // pendant les transitions entre sections.
        if (bestId !== null && bestRatio >= 0.25) {
          setActiveNavId(SECTION_TO_NAV_ID[bestId] ?? null);
        }
      },
      {
        // Plusieurs seuils : sans eux, l'observateur ne se prononce qu'à
        // l'entrée et à la sortie, et les longues sections (les projets, qui
        // dépassent la hauteur de l'écran) ne rapporteraient jamais de ratio
        // intermédiaire exploitable.
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    );

    for (const section of sections) {
      observer.observe(section);
    }

    // ⚠️ Pas de `unobserve` par section ici, contrairement au reveal de la 6.4 :
    // le scroll-spy doit rester actif tant que la page vit — la mise en évidence
    // change dans les deux sens de défilement. On libère tout à la sortie.
    return () => observer.disconnect();
  }, []);

  return activeNavId;
}
