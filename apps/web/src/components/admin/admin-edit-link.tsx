import Link from "next/link";
import { Pencil } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Lien d'édition compact (icône crayon).
 *
 * Le libellé visible disparaît au profit de l'icône pour gagner de la place
 * dans les listes admin ; `aria-label` porte le sens pour le clavier et les
 * lecteurs d'écran.
 */
export function AdminEditLink({
  href,
  label,
  className,
}: {
  href: string;
  /** Ex. « Modifier le projet Quantum » — obligatoire (bouton icône). */
  label: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className={cn(
        buttonVariants({ variant: "outline", size: "icon" }),
        "size-8",
        className,
      )}
    >
      <Pencil aria-hidden className="size-4" />
    </Link>
  );
}
