"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FolderKanban,
  GaugeCircle,
  History,
  Image as ImageIcon,
  Layers,
  Mail,
  Route,
  Settings,
  ShieldCheck,
} from "lucide-react";

import { cn } from "@/lib/utils";

// Story 5.7 — Navigation du back-office. FONDATION des écrans 5.8-5.20 : chaque
// story suivante n'aura qu'à basculer son entrée de `ready: false` à `true`.
//
// `"use client"` justifié : `usePathname()` est nécessaire pour marquer l'entrée
// courante (`aria-current`). Le composant ne reçoit aucune donnée sensible — il
// ne rend qu'une liste de liens statique.

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  /**
   * `false` tant que l'écran n'est pas construit. L'entrée est alors affichée
   * mais DÉSACTIVÉE : Jeevons voit la structure complète de son back-office
   * sans tomber sur un 404. Chaque story 5.8+ passe la sienne à `true`.
   */
  ready: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Tableau de bord", icon: GaugeCircle, ready: true },
  // Story 5.8 — écran livré : l'entrée devient un vrai lien.
  {
    href: "/admin/projects",
    label: "Projets",
    icon: FolderKanban,
    ready: true,
  },
  // Story 5.14 — écran de gestion du parcours livré.
  { href: "/admin/timeline", label: "Parcours", icon: Route, ready: true },
  // Story 5.15 — écran de gestion des technologies livré.
  { href: "/admin/stacks", label: "Technologies", icon: Layers, ready: true },
  // Story 5.13 — bibliothèque d'images livrée : l'entrée devient un vrai lien.
  { href: "/admin/media", label: "Médias", icon: ImageIcon, ready: true },
  // Story 5.18 — boîte de réception livrée.
  { href: "/admin/messages", label: "Messages", icon: Mail, ready: true },
  // Story 5.16 — écran d'édition des textes du site livré.
  { href: "/admin/settings", label: "Réglages", icon: Settings, ready: true },
  {
    href: "/admin/settings/security",
    label: "Sécurité",
    icon: ShieldCheck,
    ready: true,
  },
  // Story 5.19 — journal des mutations livré.
  { href: "/admin/audit", label: "Journal", icon: History, ready: true },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navigation de l'administration">
      <ul className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon, ready }) => {
          // Correspondance EXACTE, pas `startsWith` : sinon « Tableau de bord »
          // (/admin) serait marqué courant sur toutes les sous-pages.
          const current = pathname === href;

          if (!ready) {
            return (
              <li key={href}>
                {/* `<span>`, pas un `<a>` désactivé : un lien sans href n'est
                    pas focusable et reste annoncé comme lien par les lecteurs
                    d'écran. `aria-disabled` sur un non-interactif serait
                    trompeur — on décrit l'état en texte via `title` + le suffixe
                    visible « à venir ». */}
                <span
                  className="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground/50"
                  title={`${label} — écran à venir`}
                >
                  <Icon aria-hidden className="size-4 shrink-0" />
                  <span className="truncate">{label}</span>
                  <span className="ml-auto text-3xs uppercase tracking-wide">
                    à venir
                  </span>
                </span>
              </li>
            );
          }

          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  current
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
              >
                <Icon aria-hidden className="size-4 shrink-0" />
                <span className="truncate">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
