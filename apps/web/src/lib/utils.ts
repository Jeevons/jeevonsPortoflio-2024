import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Story 5.7 — Utilitaire standard shadcn/ui (`cn`), requis par toutes les
// primitives copiées dans `components/ui/`.
//
// `clsx` résout les classes conditionnelles, `twMerge` déduplique les conflits
// Tailwind (ex. `p-4` passé en prop qui doit écraser le `p-6` par défaut d'une
// Card). Sans lui, l'ordre de la chaîne déciderait au hasard.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
