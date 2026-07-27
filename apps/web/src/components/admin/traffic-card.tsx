import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { TrafficSummary } from "@/lib/admin/dashboard";

// Story 5.7 (AC1) — Carte « fréquentation des sept derniers jours ».
//
// ⚠️ Aujourd'hui TOUJOURS indisponible : la mesure d'audience (Umami) est
// l'Epic 7 (PLAN §10, piège n°2 — ne rien installer ici). L'AC autorise
// explicitement « une mention si la mesure n'est pas encore disponible ».
//
// ⚠️ Ne JAMAIS afficher « 0 vue » dans ce cas : ce serait un mensonge (« personne
// n'est venu » au lieu de « on ne mesure pas encore »). D'où le type
// discriminé `TrafficSummary` plutôt qu'un simple `number`.

type TrafficCardProps = {
  traffic: TrafficSummary;
};

export function TrafficCard({ traffic }: TrafficCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Fréquentation — 7 derniers jours
        </CardTitle>
        <CardDescription>
          Visites du site public sur la semaine écoulée.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {traffic.available ? (
          <dl className="flex flex-wrap gap-x-10 gap-y-3">
            <div className="flex flex-col">
              <dt className="text-xs text-muted-foreground">Pages vues</dt>
              <dd className="text-2xl font-semibold tabular-nums">
                {traffic.views}
              </dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-xs text-muted-foreground">Visiteurs</dt>
              <dd className="text-2xl font-semibold tabular-nums">
                {traffic.visitors}
              </dd>
            </div>
          </dl>
        ) : (
          // Mention explicite, ton neutre : ce n'est pas une panne, c'est une
          // fonctionnalité pas encore branchée. Pas de `role="alert"`.
          <p className="text-sm text-muted-foreground">
            La mesure d&apos;audience n&apos;est pas encore disponible. Elle
            sera activée avec l&apos;outil de statistiques du site.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
