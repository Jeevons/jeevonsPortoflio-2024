import * as React from "react";

import { cn } from "@/lib/utils";

// Story 5.7 — Primitive shadcn/ui `card` (composant COPIÉ dans le dépôt, pas
// une dépendance : c'est le modèle shadcn, le code nous appartient).
//
// Aucune logique, aucun état : ce sont des conteneurs stylés. Ils restent donc
// des Server Components (pas de "use client"), ce qui permet de les utiliser
// directement dans le dashboard sans frontière client inutile.

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card text-card-foreground shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col space-y-1.5 p-6", className)}
      {...props}
    />
  );
}

// Rendu en `<h3>` : les cartes du dashboard vivent sous le `<h1>` de la page,
// dans des sections `<h2>` — la hiérarchie de titres reste donc correcte sans
// saut de niveau (a11y, AGENTS.md §6).
function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      className={cn("font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)} {...props} />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex items-center p-6 pt-0", className)} {...props} />
  );
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
};
