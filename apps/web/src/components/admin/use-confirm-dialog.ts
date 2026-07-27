"use client";

import { useCallback, useEffect, useRef } from "react";

// Story 5.20 (AC2) — Restitution du focus au déclencheur.
//
// `<dialog showModal()>` apporte NATIVEMENT le piège du focus et la fermeture
// par Échap, mais PAS la restitution du focus à l'élément qui a ouvert le
// dialogue : au `close()` (natif ou via Échap), le focus retombe sur `<body>`,
// pas sur le bouton « Supprimer » qui a déclenché l'ouverture. C'est un vrai
// trou d'a11y clavier — un utilisateur qui enchaîne Tab après une annulation
// perd sa position dans la page.
//
// Ce hook mémorise l'élément actif au moment de l'ouverture et lui redonne le
// focus à la fermeture, quelle qu'en soit la cause (bouton Annuler, Échap, ou
// succès qui démonte le composant avant fermeture — dans ce dernier cas
// l'écoute `close` ne se déclenche jamais, ce qui est correct : il n'y a plus
// rien à quoi rendre le focus).
export function useConfirmDialog() {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    // Couvre les TROIS façons de fermer un `<dialog>` natif : le bouton
    // « Annuler » (`close()` explicite), la touche Échap (fermeture native),
    // et le clic sur le `::backdrop` (également natif) — toutes déclenchent
    // l'évènement `close`, un seul listener suffit.
    const handleClose = () => {
      triggerRef.current?.focus();
    };

    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, []);

  const open = useCallback((event: { currentTarget: HTMLElement }) => {
    triggerRef.current = event.currentTarget;
    dialogRef.current?.showModal();
  }, []);

  const close = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  return { dialogRef, open, close };
}
