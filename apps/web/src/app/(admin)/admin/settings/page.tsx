import Link from "next/link";

import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminSettings } from "@/lib/admin/settings";
import { auth } from "@/lib/auth";
import { CV_PUBLIC_URL, getAdminCv } from "@/lib/cv";
import { mediaUrl } from "@/lib/media";

import { CvUploader } from "./cv-uploader";
import { SettingsForm } from "./settings-form";

// Story 5.16 — ÉCRAN DES RÉGLAGES du site (AC1, AC4).
//
// Server Component : les valeurs sont lues côté serveur puis passées en props au
// formulaire (vue « bête », AGENTS.md §6).
//
// `force-dynamic`, même raison qu'ailleurs dans l'admin : on édite l'état RÉEL
// de la base, jamais une copie cachée — c'est précisément ce que cet écran sert
// à vérifier après une modification.
//
// ⚠️ Cette page cohabite avec `/admin/settings/security` (socle 2FA), qui est une
// route SŒUR et reste inchangée. Le CV, lui, arrive en 5.17 : ne pas l'anticiper
// ici, même si l'écran s'appelle aussi « réglages ».
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Réglages",
};

export default async function AdminSettingsPage({
  searchParams,
}: {
  // Next 16 : `searchParams` est une promesse.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const session = await auth();
  const email = session?.user?.email ?? "";

  const settings = await getAdminSettings();
  const cv = await getAdminCv();

  // Retour d'action posé par la redirection de la Server Action : la
  // confirmation survit à la redirection, ce qu'un état React ne ferait pas.
  const justSaved = params.saved === "1";

  return (
    <AdminShell email={email}>
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Réglages</h1>
          <p className="text-sm text-muted-foreground">
            Les textes et liens de votre site. Tout se corrige ici, sans
            intervention technique et sans remise en ligne.
          </p>
        </header>

        {justSaved ? (
          <p
            role="status"
            className="rounded-lg border border-border bg-card p-4 text-sm"
          >
            Vos réglages ont été enregistrés et sont déjà visibles sur le site
            public.
          </p>
        ) : null}

        {!settings.available ? (
          // Base injoignable : on le DIT plutôt que d'afficher un formulaire
          // pré-rempli de valeurs par défaut, que l'enregistrement écraserait
          // sur les vraies (même discipline qu'au tableau de bord, 5.7).
          <p
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive-foreground"
          >
            <strong>Base de données injoignable.</strong> Vos réglages ne
            peuvent pas être chargés, et les modifier maintenant risquerait
            d&apos;écraser vos textes actuels. Réessayez dans un instant.
          </p>
        ) : (
          <SettingsForm values={settings.values} />
        )}

        <CvUploader
          initialCv={
            cv
              ? {
                  thumbnailUrl: mediaUrl(cv.thumbnailPath),
                  thumbnailWidth: cv.thumbnailWidth,
                  thumbnailHeight: cv.thumbnailHeight,
                }
              : null
          }
          cvUrl={CV_PUBLIC_URL}
        />

        <p className="border-t border-border pt-6 text-sm text-muted-foreground">
          Votre mot de passe et la double authentification se règlent sur{" "}
          <Link
            href="/admin/settings/security"
            className="underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            l&apos;écran Sécurité
          </Link>
          .
        </p>
      </div>
    </AdminShell>
  );
}
