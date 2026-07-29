import { notFound } from "next/navigation";

import { AdminBackLink } from "@/components/admin/admin-back-link";
import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminMessage } from "@/lib/admin/messages";
import { auth } from "@/lib/auth";

import { DeleteMessageDialog } from "../delete-message-dialog";
import { MarkReadOnOpen } from "../mark-read-on-open";
import { ToggleReadButton } from "../toggle-read-button";

// Story 5.18 — LECTURE d'un message (AC3, AC4).
//
// Server Component : le message est chargé côté serveur (AGENTS.md §6).
// `force-dynamic`, même raison qu'ailleurs dans l'admin.
export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeStyle: "short",
});

export default async function AdminMessagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const email = session?.user?.email ?? "";

  const message = await getAdminMessage(id);

  if (!message) {
    notFound();
  }

  return (
    <AdminShell email={email}>
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        {/* Ne monte AUCUN élément visible : déclenche le marquage lu quand cet
            écran est réellement affiché (piège n°3). */}
        <MarkReadOnOpen messageId={message.id} alreadyRead={message.read} />

        <AdminBackLink href="/admin/messages">
          Retour aux messages
        </AdminBackLink>

        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold">{message.name}</h1>
            <a
              href={`mailto:${message.email}`}
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              {message.email}
            </a>
            <time
              dateTime={message.createdAt.toISOString()}
              className="text-xs text-muted-foreground"
            >
              Reçu le {dateFormatter.format(message.createdAt)}
            </time>
            {message.ip ? (
              <span className="text-xs text-muted-foreground">
                Adresse d&apos;origine : {message.ip}
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-start gap-2">
            <ToggleReadButton messageId={message.id} read={message.read} />
            <DeleteMessageDialog
              messageId={message.id}
              senderName={message.name}
              triggerLabel="Supprimer"
            />
          </div>
        </header>

        <div className="whitespace-pre-wrap rounded-lg border border-border bg-card p-6 text-sm leading-relaxed">
          {message.body}
        </div>
      </div>
    </AdminShell>
  );
}
