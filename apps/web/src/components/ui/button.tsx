import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Story 5.7 — Primitive shadcn/ui `button` (composant COPIÉ dans le dépôt).
//
// Volontairement SANS `asChild` : le `Slot` de Radix imposerait
// `@radix-ui/react-slot` (dépendance runtime) alors qu'aucun écran de cette
// story n'en a besoin. Pour un lien qui doit ressembler à un bouton, on applique
// `buttonVariants()` sur un `<Link>` — même rendu, zéro dépendance en plus.
//
// Pas de "use client" : sans état ni handler propre, le composant se rend côté
// serveur. Ce sont ses PARENTS interactifs (formulaires) qui portent la
// frontière client.

const buttonVariants = cva(
  // `focus-visible:ring` : focus visible obligatoire (AGENTS.md §6, a11y non
  // négociable). `disabled:` neutralise l'apparence pendant une soumission.
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-border bg-transparent hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-6",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
