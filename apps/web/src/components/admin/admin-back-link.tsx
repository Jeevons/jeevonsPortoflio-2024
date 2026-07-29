import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Lien de retour vers une liste admin.
 *
 * Remplace l'ancien texte souligné discret par un vrai contrôle bouton
 * (outline + flèche), plus visible au doigt et au clavier, sans changer la
 * sémantique de lien.
 */
export function AdminBackLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        buttonVariants({ variant: "outline", size: "sm" }),
        "mb-1 w-fit gap-1.5 text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      <ArrowLeft aria-hidden className="size-3.5" />
      {children}
    </Link>
  );
}
