import Link from "next/link";

import { AdminNav } from "@/components/admin/admin-nav";

// Story 5.7 — Coquille visuelle du back-office (Tâche 1).
//
// FONDATION des écrans 5.8-5.20 : chaque page admin se contente désormais de
// rendre son contenu, la chrome (barre latérale, navigation, lien retour) vit
// ici. Server Component — aucun état, seule `AdminNav` est cliente
// (`usePathname`).
//
// ⚠️ La coquille N'AJOUTE AUCUN gating : l'autorisation reste entièrement dans
// `app/(admin)/admin/layout.tsx` (guard serveur 5.2/5.3/5.5) et dans
// `requireAdmin` pour les mutations. Un composant de présentation ne doit jamais
// être le seul rempart.

type AdminShellProps = {
  children: React.ReactNode;
  /**
   * E-mail du compte connecté, affiché en pied de barre latérale.
   * Optionnel : les `loading.tsx` (story 5.20) réutilisent cette coquille pour
   * que la silhouette de chargement occupe exactement la même mise en page
   * que le contenu final (AC3), sans relire la session (un `loading.tsx` doit
   * rester synchrone).
   */
  email?: string;
};

export function AdminShell({ children, email }: AdminShellProps) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* `<aside>` + `<nav>` : landmarks corrects, navigation clavier directe
          (AGENTS.md §6). En dessous de `lg` la barre passe au-dessus du contenu
          plutôt que de disparaître — le back-office reste utilisable au mobile
          sans introduire un menu burger (hors périmètre de cette story). */}
      <aside className="flex shrink-0 flex-col gap-6 border-b border-border bg-card/40 p-4 lg:w-64 lg:border-b-0 lg:border-r">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold">Administration</span>
          <Link
            href="/"
            className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Voir le site public
          </Link>
        </div>

        <AdminNav />

        {/* `mt-auto` : collé en bas de la barre sur grand écran. `break-all`
            évite qu'un e-mail long ne déborde de la colonne de 16rem. */}
        <p className="mt-auto break-all text-xs text-muted-foreground">
          Connecté en tant que {email || "administrateur"}.
        </p>
      </aside>

      {/* Un seul `<main>` par page : les pages admin ne doivent donc PAS en
          rendre un second (elles rendent des `<section>`). */}
      <main className="min-w-0 flex-1 p-4 lg:p-8">{children}</main>
    </div>
  );
}
