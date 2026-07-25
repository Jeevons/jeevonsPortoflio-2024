import type { Metadata } from "next";
import QRCode from "qrcode";

import { preparePendingSecret } from "./actions";
import { EnrollForm } from "./enroll-form";

// Story 5.3 — Écran d'enrôlement 2FA (AC3 + AC4).
//
// Server Component : génère (ou réutilise) le secret en attente CÔTÉ SERVEUR,
// rend le QR code en SVG inline (le secret ne transite jamais par un service
// externe — le QR est produit localement, piège n°5) et affiche le secret en
// clair pour une saisie manuelle. La confirmation passe par une server action.
export const metadata: Metadata = {
  title: "Sécurité — Activer la double authentification",
  robots: { index: false, follow: false },
};

// Formate le secret base32 par blocs de 4 pour faciliter la saisie manuelle.
function formatSecret(secret: string): string {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}

export default async function SecurityEnrollPage() {
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
