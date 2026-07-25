import Link from "next/link";

import { AdminShell } from "@/components/admin/admin-shell";
import { RecentMessagesCard } from "@/components/admin/recent-messages-card";
import { StatCard } from "@/components/admin/stat-card";
import { TrafficCard } from "@/components/admin/traffic-card";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { auth } from "@/lib/auth";
import {
  getProjectCounts,
  getRecentMessages,
  getTrafficSummary,
} from "@/lib/admin/dashboard";
import { getRecoveryCodesStatus } from "@/lib/auth/recovery-codes";
import { cn } from "@/lib/utils";

import { RevalidateButton } from "./revalidate-button";

// Story 5.7 — TABLEAU DE BORD `/admin` (remplace le placeholder de la story 5.2).
//
// Premier écran de gestion du back-office : il pose le layout admin (`AdminShell`)
// que les stories 5.8-5.20 réutiliseront.
//
// Server Component : toutes les lectures se font côté serveur (AGENTS.md §6).
// La seule frontière client est `RevalidateButton` (état de soumission + retour
// visuel). La session est déjà garantie par le guard du layout — on la relit
// uniquement pour afficher l'identité connectée.
//
// Story 5.4 (AC4) — Le bandeau « plus de codes de récupération » du placeholder
// est CONSERVÉ : l'AC de 5.4 exige d'être averti « quand je consulte
// l'administration », et c'est ici l'entrée du back-office.

// Le tableau de bord lit l'état RÉEL de la base à chaque visite : aucune mise en
// cache de la page, sinon les compteurs seraient figés après une publication.
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const session = await auth();
  const email = session?.user?.email ?? "";

  // Lectures indépendantes lancées EN PARALLÈLE : sérialisées, elles
  // additionneraient inutilement leurs latences.
  const [counts, messages, traffic, recoveryCodes] = await Promise.all([
    getProjectCounts(),
    getRecentMessages(),
    getTrafficSummary(),
    getRecoveryCodesStatus(email),
  ]);

  // AC3 — Portfolio NEUF : aucun projet du tout (ni publié, ni brouillon), et la
  // base répond bien. `counts.available` est décisif : pendant une panne, les
  // compteurs valent 0 sans que le portfolio soit vide — afficher l'invitation
  // « créez votre premier projet » serait alors trompeur.
  const isFreshPortfolio =
    counts.available && counts.published === 0 && counts.drafts === 0;

  return (
    <AdminShell email={email}>
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Tableau de bord</h1>
          <p className="text-sm text-muted-foreground">
            L&apos;essentiel de votre portfolio en un coup d&apos;œil.
          </p>
        </header>

        {/* Story 5.4 (AC4) — Avertissement codes de récupération épuisés. */}
        {recoveryCodes.exhausted ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive-foreground"
          >
            <strong>Vous n&apos;avez plus de code de récupération.</strong> En
            cas de perte de votre téléphone, vous ne pourriez plus accéder à
            l&apos;administration.{" "}
            <Link
              href="/admin/settings/security"
              className="underline underline-offset-4"
            >
              Générer un nouveau jeu
            </Link>
            .
          </p>
        ) : null}

        {/* Base injoignable : on le DIT, plutôt que d'afficher des zéros
            trompeurs (voir `ProjectCounts.available`). Le site public, lui,
            continue de servir son repli statique (story 4.5). */}
        {!counts.available ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive-foreground"
          >
            <strong>Base de données injoignable.</strong> Les compteurs ne
            peuvent pas être affichés. Le site public reste en ligne grâce à son
            contenu de repli.
          </p>
        ) : null}

        {isFreshPortfolio ? (
          // ── AC3 — État vide ACCUEILLANT ────────────────────────────────────
          // Les compteurs à zéro sont présentés comme un état NORMAL de début,
          // avec une invitation à créer un premier contenu. Pas d'erreur, pas de
          // zone vide.
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Bienvenue — votre portfolio est prêt à être rempli
              </CardTitle>
              <CardDescription>
                Vous n&apos;avez encore aucun projet. C&apos;est normal : tout
                commence ici.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Créez votre premier projet pour le voir apparaître sur le site
                public. Vous pourrez ensuite compléter votre parcours et vos
                technologies.
              </p>
              {/* `buttonVariants()` sur un `<Link>` : apparence de bouton, mais
                  vraie sémantique de lien — et aucun `<button>` imbriqué dans un
                  `<a>` (HTML invalide, AGENTS.md §6).
                  Story 5.8 — l'écran de création existe désormais : le
                  placeholder désactivé devient le vrai lien annoncé. */}
              <Link
                href="/admin/projects/new"
                className={cn(buttonVariants({ variant: "outline" }), "w-fit")}
              >
                Créer mon premier projet
              </Link>
            </CardContent>
          </Card>
        ) : (
          // ── AC1 — Compteurs ───────────────────────────────────────────────
          <section
            aria-labelledby="stats-heading"
            className="flex flex-col gap-3"
          >
            <h2
              id="stats-heading"
              className="text-sm font-medium text-muted-foreground"
            >
              Projets
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <StatCard
                label="Projets publiés"
                value={counts.available ? counts.published : null}
                hint="Visibles sur le site public."
              />
              <StatCard
                label="Brouillons"
                value={counts.available ? counts.drafts : null}
                hint="Non visibles par les visiteurs."
              />
            </div>
          </section>
        )}

        {/* AC1 — Messages & fréquentation. Affichés MÊME sur un portfolio neuf :
            leurs états vides sont accueillants par construction (AC3). */}
        <section
          aria-labelledby="activity-heading"
          className="flex flex-col gap-3"
        >
          <h2
            id="activity-heading"
            className="text-sm font-medium text-muted-foreground"
          >
            Activité
          </h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <RecentMessagesCard messages={messages} />
            <TrafficCard traffic={traffic} />
          </div>
        </section>

        {/* AC2 — Bouton « Revalider le site ». */}
        <section
          aria-labelledby="cache-heading"
          className="flex flex-col gap-3"
        >
          <h2
            id="cache-heading"
            className="text-sm font-medium text-muted-foreground"
          >
            Site public
          </h2>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Revalider le site</CardTitle>
              <CardDescription>
                Le site public est mis en cache pour rester rapide. Utilisez ce
                bouton pour forcer la prise en compte immédiate de vos dernières
                modifications.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RevalidateButton />
            </CardContent>
          </Card>
        </section>

        {!recoveryCodes.exhausted ? (
          <p className="text-xs text-muted-foreground">
            {recoveryCodes.remaining} code(s) de récupération disponible(s) —{" "}
            <Link
              href="/admin/settings/security"
              className="underline underline-offset-4"
            >
              gérer
            </Link>
          </p>
        ) : null}
      </div>
    </AdminShell>
  );
}
