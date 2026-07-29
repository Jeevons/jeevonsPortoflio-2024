import type { Metadata } from "next";
import QRCode from "qrcode";

import { AdminBackLink } from "@/components/admin/admin-back-link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getRecoveryCodesStatus } from "@/lib/auth/recovery-codes";

import { preparePendingSecret } from "./actions";
import { EnrollForm } from "./enroll-form";
import { RegenerateForm } from "./regenerate-form";

// Story 5.3 — Écran d'enrôlement 2FA (AC3 + AC4).
//
// Server Component : génère (ou réutilise) le secret en attente CÔTÉ SERVEUR,
// rend le QR code en SVG inline (le secret ne transite jamais par un service
// externe — le QR est produit localement, piège n°5) et affiche le secret en
// clair pour une saisie manuelle. La confirmation passe par une server action.
//
// Story 5.4 — L'écran a désormais DEUX MODES, selon `totpEnabledAt` :
//  - 2FA inactive  → enrôlement (QR + confirmation), qui se termine par
//    l'affichage unique des 8 codes de récupération (AC1) ;
//  - 2FA active    → gestion des codes de récupération : décompte des codes
//    restants, avertissement s'ils sont épuisés, et régénération (AC4).
// C'est pourquoi le guard du layout ne renvoie plus cette route vers /admin une
// fois la 2FA activée : elle reste le point d'entrée des codes de secours.
export const metadata: Metadata = {
  title: "Sécurité — Double authentification",
  robots: { index: false, follow: false },
};

// Formate le secret base32 par blocs de 4 pour faciliter la saisie manuelle.
function formatSecret(secret: string): string {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}

export default async function SecurityPage() {
  // La session est garantie par le guard du layout ; on relit l'e-mail (clé du
  // compte unique) pour connaître l'état réel de la 2FA en base.
  const session = await auth();
  const email = session?.user?.email ?? "";
  const user = await prisma.user.findUnique({
    where: { email },
    select: { totpEnabledAt: true },
  });

  // ── Mode GESTION (2FA déjà active) — codes de récupération, AC3/AC4 ────────
  if (user?.totpEnabledAt) {
    const { total, remaining, exhausted } = await getRecoveryCodesStatus(email);

    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 p-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">Codes de récupération</h1>
          <p className="text-sm text-white/70">
            Ces codes à usage unique vous permettent de vous connecter si vous
            perdez l&apos;accès à votre application d&apos;authentification.
          </p>
        </header>

        {exhausted ? (
          // AC4 — Épuisés (ou jamais générés) : avertissement explicite. C'est
          // le scénario « téléphone perdu ET plus aucun code » qu'on veut
          // rendre impossible : on pousse à régénérer TANT QUE l'accès est là.
          <p
            role="alert"
            className="rounded-lg border border-red-400/40 bg-red-400/10 p-4 text-sm text-red-200"
          >
            <strong>
              {total === 0
                ? "Vous n'avez aucun code de récupération."
                : "Tous vos codes de récupération ont été utilisés."}
            </strong>{" "}
            Si vous perdez votre téléphone maintenant, vous n&apos;aurez plus
            aucun moyen d&apos;accéder à l&apos;administration. Générez un
            nouveau jeu dès à présent.
          </p>
        ) : (
          <p className="rounded-lg border border-white/15 bg-white/5 p-4 text-sm text-white/80">
            Il vous reste <strong>{remaining}</strong> code(s) de récupération
            sur {total}.
          </p>
        )}

        <RegenerateForm remaining={remaining} />

        <AdminBackLink
          href="/admin"
          className="border-white/20 bg-transparent text-white/70 hover:bg-white/10 hover:text-white"
        >
          Retour à l&apos;administration
        </AdminBackLink>
      </main>
    );
  }

  // ── Mode ENRÔLEMENT (2FA pas encore active) — story 5.3 ────────────────────
  // Persiste le secret chiffré (totpEnabledAt reste null : pas encore actif) et
  // renvoie le clair + l'URI otpauth pour affichage.
  const { secret, uri } = await preparePendingSecret();

  // QR généré server-side en SVG : aucune requête réseau, aucun service tiers ne
  // voit le secret. Rendu inline (dangerouslySetInnerHTML sur du SVG produit par
  // la lib à partir d'une URI que NOUS construisons — pas d'entrée utilisateur).
  const qrSvg = await QRCode.toString(uri, {
    type: "svg",
    margin: 1,
    width: 220,
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">
          Activer la double authentification
        </h1>
        <p className="text-sm text-white/70">
          Le back-office est accessible publiquement : un second facteur est
          obligatoire. Scannez le QR code avec une application
          d&apos;authentification (Authy, Google Authenticator, 1Password,
          Bitwarden…), puis saisissez le code affiché pour confirmer.
        </p>
      </header>

      <section className="flex flex-col items-center gap-4">
        <div
          aria-label="QR code de configuration de la double authentification"
          role="img"
          className="rounded-lg bg-white p-3"
          // SVG produit localement par la lib qrcode à partir d'une URI interne.
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />

        <div className="flex w-full flex-col gap-1 text-center">
          <span className="text-xs uppercase tracking-wide text-white/50">
            Ou saisissez cette clé manuellement
          </span>
          <code className="select-all break-all rounded border border-white/15 bg-white/5 px-3 py-2 font-mono text-sm">
            {formatSecret(secret)}
          </code>
        </div>
      </section>

      <EnrollForm />
    </main>
  );
}
