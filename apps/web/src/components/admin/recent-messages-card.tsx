import Link from "next/link";

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
// Story 5.18 (piège n°6) — `ContactMessage` existe désormais : la carte affiche
// aussi le compte RÉEL de messages non lus, avec un lien vers la boîte de
// réception complète (`/admin/messages`). `unreadCount === null` = lecture
// échouée (même discipline que `ProjectCounts.available`) : on tait le compte
// plutôt que d'afficher un 0 trompeur.

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

type RecentMessagesCardProps = {
  messages: RecentMessage[];
  /** `null` = lecture échouée (base injoignable), pas « aucun non lu ». */
  unreadCount: number | null;
};

export function RecentMessagesCard({
  messages,
  unreadCount,
}: RecentMessagesCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">Derniers messages</CardTitle>
            <CardDescription>
              Les cinq messages les plus récents reçus via le formulaire de
              contact.
            </CardDescription>
          </div>
          {unreadCount !== null && unreadCount > 0 ? (
            <span className="inline-flex shrink-0 items-center rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-foreground">
              {unreadCount} non lu{unreadCount > 1 ? "s" : ""}
            </span>
          ) : null}
        </div>
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
        <Link
          href="/admin/messages"
          className="mt-4 inline-block text-sm underline-offset-4 hover:underline"
        >
          Voir tous les messages
        </Link>
      </CardContent>
    </Card>
  );
}
