import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Story 5.7 (AC1) — Compteur du tableau de bord (projets publiés, brouillons).

type StatCardProps = {
  label: string;
  /** `null` = valeur indisponible (base injoignable), à ne pas confondre avec 0. */
  value: number | null;
  hint?: string;
};

export function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        {/* La VALEUR est le titre de la carte : c'est l'information que l'œil
            cherche (« d'un coup d'œil »), le libellé la qualifie au-dessus.
            `tabular-nums` évite que la largeur saute entre 9 et 10. */}
        <CardTitle className="text-3xl tabular-nums">
          {value === null ? "—" : value}
        </CardTitle>
      </CardHeader>
      {hint ? (
        <CardContent className="pt-0">
          <p className="text-xs text-muted-foreground">{hint}</p>
        </CardContent>
      ) : null}
    </Card>
  );
}
