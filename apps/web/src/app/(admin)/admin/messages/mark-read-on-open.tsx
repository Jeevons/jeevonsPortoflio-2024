"use client";

import { useEffect, useRef } from "react";

// Story 5.18 — Marque un message LU quand l'écran de lecture est réellement
// OUVERT (AC3), sans dépendre d'une lecture GET qui aurait un effet de bord (ce
// que le protocole HTTP interdit) ni d'un simple survol/prefetch de `<Link>`
// (piège n°3 : le prefetch de Next ne monte JAMAIS de composant client, il ne
// récupère qu'un payload RSC — cet effet ne peut donc s'exécuter que si la page
// est vraiment affichée dans le navigateur).
//
// `fetch` en `keepalive` plutôt qu'une Server Action `useActionState` : cet
// effet est un geste de fond, pas une soumission pilotée par l'utilisateur — il
// n'y a ni bouton ni état de chargement à représenter (contrairement à
// `ToggleReadButton`, qui gère l'action symétrique « marquer non lu »).
export function MarkReadOnOpen({
  messageId,
  alreadyRead,
}: {
  messageId: string;
  alreadyRead: boolean;
}) {
  const fired = useRef(false);

  useEffect(() => {
    if (alreadyRead || fired.current) return;
    fired.current = true;

    const body = new FormData();
    body.append("id", messageId);
    void fetch("/api/admin/messages/mark-read", {
      method: "POST",
      body,
      keepalive: true,
    });
  }, [messageId, alreadyRead]);

  return null;
}
