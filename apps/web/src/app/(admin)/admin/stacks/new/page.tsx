import { AdminBackLink } from "@/components/admin/admin-back-link";
import { AdminShell } from "@/components/admin/admin-shell";
import { auth } from "@/lib/auth";

import { StackForm } from "../stack-form";

// Story 5.15 — CRÉATION d'une technologie (AC1).
//
// La page ne fait que rendre le formulaire en mode « création » (aucune `stack`
// passée) : toute la logique vit dans `createStackAction` (AGENTS.md §6 — vue
// « bête »).
//
// ⚠️ Cette route DOIT rester sous `/admin/stacks/new`, donc AVANT le segment
// dynamique `[id]` dans l'ordre de résolution de Next : une route statique
// l'emporte sur une route dynamique de même profondeur. Aucune technologie ne
// peut donc être masquée par cette page.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Nouvelle technologie",
};

export default async function NewStackPage() {
  const session = await auth();
  const email = session?.user?.email ?? "";

  return (
    <AdminShell email={email}>
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-1">
          <AdminBackLink href="/admin/stacks">
            Retour aux technologies
          </AdminBackLink>
          <h1 className="text-2xl font-semibold">Nouvelle technologie</h1>
          <p className="text-sm text-muted-foreground">
            Seul le nom est obligatoire, et il doit être unique. Le niveau
            détermine la place de la technologie sur le site public.
          </p>
        </header>

        <StackForm />
      </div>
    </AdminShell>
  );
}
