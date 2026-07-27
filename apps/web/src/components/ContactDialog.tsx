"use client";

import {
  submitContactMessage,
  type ContactFormState,
} from "@/app/contact-actions";
import { CONTACT_LIMITS, HONEYPOT_FIELD } from "@/lib/schemas/contact";
import { useActionState, useEffect, useId, useRef } from "react";

// Modale de contact (retour Jeevons, 27/07).
//
// ⚠️ POURQUOI CE COMPOSANT EXISTE. La story 6.12 avait posé le formulaire
// DIRECTEMENT dans la bannière d'accueil, ce qui l'alourdissait beaucoup pour un
// bandeau censé rester une invitation. La bannière retrouve donc son bouton, et
// le formulaire — inchangé sur le fond — vit ici.
//
// 🛑 CE QUI NE CHANGE PAS, ET NE DOIT PAS CHANGER : l'adresse e-mail ne franchit
// TOUJOURS PAS la frontière serveur/client (règle D10, aboutissement de 6.12).
// ❌ Ne pas ramener un `mailto:` sur le bouton sous prétexte de simplicité : ce
// serait rouvrir exactement la fuite que 6.12 a fermée. Le bouton ouvre cette
// modale, la Server Action fait le reste.
//
// 🛑 `<dialog>` NATIF plutôt qu'une modale maison. Le navigateur fournit alors
// gratuitement, et correctement : le piégeage du focus, la fermeture par
// `Échap`, l'inertie du reste de la page pour les lecteurs d'écran, et la
// couche supérieure (aucun `z-index` à arbitrer). ❌ Une div `fixed` maison
// redemanderait tout cela à la main, et le raterait probablement.

const INITIAL_STATE: ContactFormState = {
  status: "idle",
  message: null,
  fieldErrors: {},
};

export const ContactDialog = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => {
  const [state, formAction, isPending] = useActionState(
    submitContactMessage,
    INITIAL_STATE,
  );

  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // `useId` plutôt que des identifiants en dur : la section est rendue à la fois
  // sur `/` et sur `/preview` (5.11), et deux `id` identiques dans un même
  // document casseraient l'association `aria-describedby`.
  const baseId = useId();
  const nameId = `${baseId}-name`;
  const emailId = `${baseId}-email`;
  const bodyId = `${baseId}-body`;
  const titleId = `${baseId}-title`;
  const errorId = (field: string) => `${baseId}-${field}-error`;

  const { fieldErrors } = state;

  // 🛑 `showModal()` et NON l'attribut `open` : seule cette méthode active le
  // comportement modal (focus piégé, `Échap`, inertie de l'arrière-plan). Un
  // `<dialog open>` rendu en JSX est une simple boîte, sans rien de tout cela.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  // Après un succès, on vide le formulaire : laisser la saisie en place
  // inviterait à renvoyer le même message (et à consommer le quota pour rien).
  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.status]);

  // Champs communs — mêmes jetons 6.1 partout, pour que l'état d'erreur soit la
  // SEULE différence visuelle entre les trois champs.
  const fieldClass = (hasError: boolean) =>
    [
      "w-full rounded-control border bg-surface-sunken/40 px-4 py-3 text-white",
      "placeholder:text-white/40",
      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
      hasError ? "border-red-300" : "border-white/20",
    ].join(" ");

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      // `onClose` couvre TOUTES les fermetures, y compris `Échap` — que le
      // navigateur traite sans passer par notre bouton.
      onClose={onClose}
      // Clic sur l'arrière-plan : `<dialog>` reçoit l'événement quand on clique
      // en dehors de son contenu, la cible est alors l'élément lui-même.
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
      className="w-[min(36rem,calc(100vw-2rem))] rounded-card border border-white/15 bg-surface-raised p-0 text-white backdrop:bg-black/70"
    >
      <div className="max-h-[85vh] overflow-y-auto p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="font-serif text-display-4">
            Me contacter
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="-mr-2 -mt-1 rounded-control px-3 py-1 text-2xl leading-none text-white/60 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {/* `aria-hidden` : le nom accessible vient de `aria-label`. */}
            <span aria-hidden="true">&times;</span>
          </button>
        </div>

        <p className="mt-2 text-sm text-white/60">
          Écrivez-moi directement ici, je vous répondrai personnellement.
        </p>

        <form
          ref={formRef}
          action={formAction}
          className="mt-6 flex flex-col gap-4"
          noValidate
        >
          {/* 🛑 CHAMP PIÈGE — invisible pour un humain, rempli par les robots
              qui remplissent tout ce qu'ils trouvent.
              ❌ PAS `type="hidden"` : les robots l'ignorent.
              ❌ PAS `display:none` seul : certains robots le détectent.
              ✅ Sorti du flux et rendu inatteignable au clavier
              (`tabIndex={-1}`) comme au lecteur d'écran (`aria-hidden`) — un
              visiteur légitime ne doit JAMAIS pouvoir le remplir par accident,
              sous peine de voir sa demande ignorée en silence. */}
          <div
            aria-hidden="true"
            className="fixed -left-[9999px] top-0 h-0 w-0 overflow-hidden"
          >
            <label htmlFor={`${baseId}-${HONEYPOT_FIELD}`}>
              Ne remplissez pas ce champ
            </label>
            <input
              id={`${baseId}-${HONEYPOT_FIELD}`}
              name={HONEYPOT_FIELD}
              type="text"
              tabIndex={-1}
              // ⚠️ Sans `autoComplete="off"`, le gestionnaire de mots de passe
              // du visiteur peut pré-remplir le piège et faire ignorer une
              // demande parfaitement légitime.
              autoComplete="off"
              defaultValue=""
            />
          </div>

          <div>
            <label htmlFor={nameId} className="block text-sm font-semibold">
              Votre nom
            </label>
            <input
              id={nameId}
              name="name"
              type="text"
              required
              maxLength={CONTACT_LIMITS.nameMax}
              autoComplete="name"
              aria-invalid={fieldErrors.name ? true : undefined}
              aria-describedby={fieldErrors.name ? errorId("name") : undefined}
              className={`mt-1 ${fieldClass(Boolean(fieldErrors.name))}`}
            />
            {fieldErrors.name && (
              <p id={errorId("name")} className="mt-1 text-sm font-medium">
                {fieldErrors.name}
              </p>
            )}
          </div>

          <div>
            <label htmlFor={emailId} className="block text-sm font-semibold">
              Votre adresse e-mail
            </label>
            <input
              id={emailId}
              name="email"
              type="email"
              required
              maxLength={CONTACT_LIMITS.emailMax}
              autoComplete="email"
              aria-invalid={fieldErrors.email ? true : undefined}
              aria-describedby={
                fieldErrors.email ? errorId("email") : undefined
              }
              className={`mt-1 ${fieldClass(Boolean(fieldErrors.email))}`}
            />
            {fieldErrors.email && (
              <p id={errorId("email")} className="mt-1 text-sm font-medium">
                {fieldErrors.email}
              </p>
            )}
          </div>

          <div>
            <label htmlFor={bodyId} className="block text-sm font-semibold">
              Votre message
            </label>
            <textarea
              id={bodyId}
              name="body"
              required
              rows={5}
              minLength={CONTACT_LIMITS.bodyMin}
              maxLength={CONTACT_LIMITS.bodyMax}
              aria-invalid={fieldErrors.body ? true : undefined}
              aria-describedby={fieldErrors.body ? errorId("body") : undefined}
              className={`mt-1 resize-y ${fieldClass(Boolean(fieldErrors.body))}`}
            />
            {fieldErrors.body && (
              <p id={errorId("body")} className="mt-1 text-sm font-medium">
                {fieldErrors.body}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="inline-flex h-12 w-max items-center gap-2 rounded-control bg-gradient-accent px-6 font-semibold text-surface-sunken transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {isPending ? "Envoi en cours…" : "Envoyer le message"}
          </button>

          {/* Confirmation et messages globaux (limitation de débit, panne).
              ⚠️ `role="status"` + `aria-live="polite"` : sans cela un
              utilisateur au lecteur d'écran ne saurait pas que son envoi a
              abouti. Le conteneur est TOUJOURS monté — une région live ajoutée
              au DOM en même temps que son texte n'est pas annoncée de façon
              fiable. */}
          <p role="status" aria-live="polite" className="text-sm font-medium">
            {state.message}
          </p>
        </form>
      </div>
    </dialog>
  );
};
