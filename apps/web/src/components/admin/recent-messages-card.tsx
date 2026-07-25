import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { RecentMessage } from "@/lib/admin/dashboard";

// Story 5.7 (AC1) — Carte « cinq derniers messages ».
//
// ⚠️ Aujourd'hui TOUJOURS en état vide : le modèle `ContactMessage` est la story
// 5.18 (piège n°2 — ne pas le créer ici). L'AC dit « s'il en existe » : l'état
// vide est conforme.
//
// La carte est écrite pour se remplir SANS RÉÉCRITURE quand 5.18 arrivera : elle
// consomme déjà `RecentMessage[]` et sait rendre la liste. Seul le corps de
// `getRecentMessages()` changera.

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

type RecentMessagesCardProps = {
  messages: RecentMessage[];
};

export function RecentMessagesCard({ messages }: RecentMessagesCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Derniers messages</CardTitle>
        <CardDescription>
          Les cinq messages les plus récents reçus via le formulaire de contact.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {messages.length === 0 ? (
          // AC3 — État vide ACCUEILLANT, pas une zone vide : une phrase qui
          // explique pourquoi c'est normal. Aucune erreur, aucun encart d'alerte.
          <p className="text-sm text-muted-foreground">
            Aucun message pour le moment. Les demandes envoyées depuis le
            formulaire de contact du site apparaîtront ici.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {messages.map((message) => (
              <li
                key={message.id}
                className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">{message.name}</span>
                  {/* `<time>` + `dateTime` : date lisible ET exploitable. */}
                  <time
                    dateTime={message.receivedAt.toISOString()}
                    className="text-xs text-muted-foreground"
                  >
                    {dateFormatter.format(message.receivedAt)}
                  </time>
                </div>
                <span className="truncate text-xs text-muted-foreground">
                  {message.email}
                </span>
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {message.excerpt}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
