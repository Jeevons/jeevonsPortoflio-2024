"use client";

import { AnimatedCounter } from "@/components/AnimatedCounter";

// Story 6.14 — Vue cliente des chiffres clés (AC2, AC3).
//
// ⚠️ Cliente UNIQUEMENT pour l'animation. Le calcul, lui, reste côté serveur
// (`lib/stats.ts`) : ce composant ne reçoit que des nombres déjà arrêtés.
//
// 🛑 FORMATAGE PARTAGÉ SERVEUR/CLIENT. `Intl.NumberFormat("fr-FR")` est
// instancié ici, une seule fois, et utilisé aussi bien pour le rendu initial que
// pendant le défilement. ⚠️ Un formatage différent entre les deux provoquerait
// une divergence d'hydratation — d'où un formateur unique passé au compteur.

const NUMBER_FORMAT = new Intl.NumberFormat("fr-FR");

const formatNumber = (value: number): string => NUMBER_FORMAT.format(value);

export type StatItem = {
  /** Clé stable pour `key` React. */
  key: string;
  value: number;
  /** Libellé au singulier / pluriel, déjà résolu par le conteneur serveur. */
  label: string;
  /** Suffixe éventuel (« + », « ans »), affiché collé au nombre. */
  suffix?: string;
};

export const StatsClient = ({ items }: { items: StatItem[] }) => {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <li
          key={item.key}
          className="rounded-card border border-white/15 bg-surface-raised/60 px-6 py-8 text-center"
        >
          {/* 🛑 LA PAIRE D'ACCESSIBILITÉ.
              — Le nombre qui défile est `aria-hidden` : sans cela, ses dizaines
                de mutations par seconde seraient autant d'annonces.
              — La valeur finale est exposée à côté en `sr-only`, une seule fois,
                dans une phrase complète.
              ❌ Aucun `aria-live` : ce n'est pas une région live, c'est un
                contenu statique dont la présentation est animée. */}
          <p aria-hidden="true" className="font-serif text-display-2">
            <AnimatedCounter value={item.value} format={formatNumber} />
            {item.suffix ? <span className="ml-0.5">{item.suffix}</span> : null}
          </p>
          <p aria-hidden="true" className="mt-2 text-white/60">
            {item.label}
          </p>

          {/* ⚠️ Texte construit en UNE chaîne, pas en fragments JSX : React
              intercale sinon des marqueurs de commentaire entre les nœuds, ce
              qui hache inutilement le contenu annoncé. */}
          <span className="sr-only">
            {[formatNumber(item.value), item.suffix, item.label]
              .filter(Boolean)
              .join(" ")}
          </span>
        </li>
      ))}
    </ul>
  );
};
