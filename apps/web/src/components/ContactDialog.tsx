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

  const isSuccess = state.status === "success";

  // 🛑 `showModal()` et NON l'attribut `open` : seule cette méthode active le
  // comportement modal (focus piégé, `Échap`, inertie de l'arrière-plan). Un
  // `<dialog open>` rendu en JSX est une simple boîte, sans rien de tout cela.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  // ⚠️ Plus de `reset()` au succès : le formulaire est désormais DÉMONTÉ au
  // profit de l'écran de confirmation, il n'y a donc plus de champs à vider.
  // La remise à zéro pour une éventuelle seconde demande est assurée par le
  // remontage du composant (voir `ContactClient`), qui repart d'un
  // `useActionState` neuf — sans quoi rouvrir la modale rejouerait l'écran de
  // confirmation du message précédent.

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
            {isSuccess ? "Message envoyé" : "Me contacter"}
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

        {isSuccess ? (
          /* 🛑 ÉCRAN DE CONFIRMATION PLEINE MODALE (retour Jeevons, 27/07 : le
             remerciement était « un tout petit truc en bas »). Le formulaire
             disparaît : le laisser en place inviterait à renvoyer le même
             message, et noierait la confirmation sous trois champs vidés.

             ⚠️ La région live reste la MÊME que celle du formulaire (voir plus
             bas) : une région `aria-live` montée en même temps que son texte
             n'est pas annoncée de façon fiable. C'est pourquoi le message vit
             ici dans un `<p role="status">` toujours rendu, et non dans un
             nœud apparu au moment du succès. */
          <div className="py-6 text-center">
            <div
              aria-hidden="true"
              className="bg-gradient-accent mx-auto flex size-16 items-center justify-center rounded-full"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-8 text-surface-sunken"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>

            <p
              role="status"
              aria-live="polite"
              className="mx-auto mt-6 max-w-sm text-balance text-white/80"
            >
              {state.message}
            </p>

            <button
              type="button"
              onClick={onClose}
              className="mt-8 inline-flex h-12 w-max items-center rounded-control border border-white/20 px-6 font-semibold transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Fermer
            </button>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-white/60">
              Écrivez-moi directement ici, je vous répondrai personnellement.
            </p>

            <form
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
                  // 🛑 CONSTATÉ EN VRAI, PAS THÉORIQUE (27/07) : le gestionnaire
                  // de Chrome a rempli ce champ avec l'adresse de Jeevons, dont
                  // la demande a donc été ignorée EN SILENCE — le formulaire
                  // répondait « merci » et rien n'arrivait en base. C'est le
                  // scénario que le commentaire d'origine redoutait ; il s'est
                  // produit.
                  //
                  // ❌ `autoComplete="off"` NE SUFFIT PAS : Chrome l'ignore
                  // délibérément pour l'autofill d'identité. Il reste posé, mais
                  // c'est `readOnly` qui fait le travail — un champ en lecture
                  // seule n'est jamais rempli par l'autofill, tout en étant
                  // TOUJOURS soumis.
                  //
                  // ❌ SURTOUT PAS `disabled` : un champ désactivé est exclu du
                  // `FormData`, le piège ne verrait plus jamais rien et
                  // laisserait passer tous les robots.
                  //
                  // ⚠️ Un robot, lui, écrit dans le DOM ou retire l'attribut :
                  // le piège reste donc efficace contre ce qu'il vise.
                  readOnly
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
                  aria-describedby={
                    fieldErrors.name ? errorId("name") : undefined
                  }
                  className={`mt-1 ${fieldClass(Boolean(fieldErrors.name))}`}
                />
                {fieldErrors.name && (
                  <p id={errorId("name")} className="mt-1 text-sm font-medium">
                    {fieldErrors.name}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor={emailId}
                  className="block text-sm font-semibold"
                >
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
                  aria-describedby={
                    fieldErrors.body ? errorId("body") : undefined
                  }
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

              {/* Messages globaux du formulaire : limitation de débit et panne.
                  Le SUCCÈS, lui, s'affiche dans l'écran de confirmation
                  ci-dessus — cette branche n'est alors plus rendue.

                  ⚠️ `role="status"` + `aria-live="polite"` : sans cela un
                  utilisateur au lecteur d'écran ne saurait pas que son envoi a
                  échoué. Le conteneur est TOUJOURS monté tant que le formulaire
                  l'est — une région live ajoutée au DOM en même temps que son
                  texte n'est pas annoncée de façon fiable. */}
              <p
                role="status"
                aria-live="polite"
                className="text-sm font-medium"
              >
                {state.message}
              </p>
            </form>
          </>
        )}
      </div>
    </dialog>
  );
};
