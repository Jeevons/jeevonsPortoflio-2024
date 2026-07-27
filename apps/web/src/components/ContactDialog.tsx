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
  //
  // 🛑 `autofill:` NEUTRALISE LE REMPLISSAGE AUTOMATIQUE DE CHROME. Sans ces
  // trois règles, un champ pré-rempli passe au BLEU CLAIR OPAQUE avec du texte
  // noir : sur une modale sombre, deux champs déjà remplis juraient à côté du
  // troisième resté sombre (constaté sur la capture de Jeevons, 27/07).
  //
  // ⚠️ La couleur de fond de l'autofill ne se surcharge PAS par `background` —
  // le navigateur la peint par-dessus. L'astuce reconnue est une ombre interne
  // massive de la couleur voulue, plus `-webkit-text-fill-color` pour le texte,
  // que `color` seul n'atteint pas non plus. La transition longue empêche le
  // flash au moment du remplissage.
  const fieldClass = (hasError: boolean) =>
    [
      "w-full rounded-control border bg-surface-sunken/60 px-4 py-3 text-white",
      "placeholder:text-white/30",
      "transition-colors duration-200",
      "hover:border-white/25",
      // Anneau de focus DANS le champ (`focus:` et non `focus-visible:` : sur un
      // champ de saisie, le focus au clic doit se voir autant qu'au clavier).
      "focus:border-accent-from/60 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent-from/40",
      // ⚠️ `hsl(var(--surface-sunken))` ET NON `theme(colors.surface.sunken)` :
      // les couleurs du thème sont définies en `hsl(var(--x) / <alpha-value>)`,
      // et `theme()` rendrait la chaîne littérale avec `<alpha-value>` non
      // résolu — une valeur CSS invalide, donc une ombre ignorée.
      "autofill:shadow-[inset_0_0_0_1000px_hsl(var(--surface-sunken))]",
      "autofill:[-webkit-text-fill-color:white]",
      "autofill:[transition:background-color_9999s_ease-in-out_0s]",
      hasError
        ? "border-red-400/70 focus:border-red-400 focus:outline-red-400/40"
        : "border-white/15",
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
      // Ombre portée large : détache la modale du fond assombri, sinon les deux
      // surfaces sombres se confondent sur leur bord.
      className="w-[min(34rem,calc(100vw-2rem))] rounded-card border border-white/10 bg-surface-raised p-0 text-white shadow-2xl shadow-black/60 backdrop:bg-black/80 backdrop:backdrop-blur-sm"
    >
      {/* Liseré d'accent en haut de la modale — même signature visuelle que les
          `Card` du site (story 6.1), à l'échelle de la boîte de dialogue. */}
      <div aria-hidden="true" className="bg-gradient-accent h-1 w-full" />

      <div className="max-h-[85vh] overflow-y-auto p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="font-serif text-display-4">
              {isSuccess ? "Message envoyé" : "Me contacter"}
            </h2>
            {!isSuccess && (
              <p className="mt-1.5 text-sm text-white/50">
                Je réponds personnellement, sous quelques jours.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="-mr-1 -mt-1 flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 text-white/50 transition-colors hover:border-white/20 hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {/* Croix dessinée plutôt que le caractère `×`, dont le rendu et
                l'alignement optique varient selon la police.
                `aria-hidden` : le nom accessible vient d'`aria-label`. */}
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="size-4"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
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
          <div className="flex flex-col items-center py-8 text-center">
            {/* Halo concentrique autour de la pastille : donne du poids au
                moment de confirmation, qui est le point d'orgue du parcours. */}
            <div
              aria-hidden="true"
              className="flex size-24 items-center justify-center rounded-full bg-accent-from/5"
            >
              <div className="flex size-16 items-center justify-center rounded-full bg-accent-from/10">
                <div className="bg-gradient-accent flex size-12 items-center justify-center rounded-full">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-6 text-surface-sunken"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </div>
              </div>
            </div>

            <p
              role="status"
              aria-live="polite"
              className="mt-6 max-w-sm text-balance leading-relaxed text-white/70"
            >
              {state.message}
            </p>

            <button
              type="button"
              onClick={onClose}
              className="mt-8 inline-flex h-12 w-full items-center justify-center rounded-control border border-white/15 px-7 font-semibold transition-colors hover:border-white/25 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:w-max"
            >
              Fermer
            </button>
          </div>
        ) : (
          <>
            {/* ⚠️ L'accroche vit désormais SOUS LE TITRE (voir l'en-tête) : la
                répéter ici ferait deux phrases d'introduction l'une sur l'autre. */}
            <form
              action={formAction}
              className="mt-7 flex flex-col gap-5"
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

              {/* Nom et adresse côte à côte au-delà de 640 px : deux champs
                  courts sur une seule ligne raccourcissent le formulaire d'un
                  cran, sans rien tasser. Ils repassent l'un sous l'autre en
                  dessous, où la largeur ne le permet plus. */}
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor={nameId}
                    className="block text-xs font-semibold uppercase tracking-wider text-white/60"
                  >
                    Votre nom
                  </label>
                  <input
                    id={nameId}
                    name="name"
                    type="text"
                    required
                    maxLength={CONTACT_LIMITS.nameMax}
                    autoComplete="name"
                    placeholder="Camille Durand"
                    aria-invalid={fieldErrors.name ? true : undefined}
                    aria-describedby={
                      fieldErrors.name ? errorId("name") : undefined
                    }
                    className={`mt-2 ${fieldClass(Boolean(fieldErrors.name))}`}
                  />
                  {fieldErrors.name && (
                    <p
                      id={errorId("name")}
                      className="mt-1.5 text-sm font-medium text-red-300"
                    >
                      {fieldErrors.name}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor={emailId}
                    className="block text-xs font-semibold uppercase tracking-wider text-white/60"
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
                    placeholder="camille@exemple.fr"
                    aria-invalid={fieldErrors.email ? true : undefined}
                    aria-describedby={
                      fieldErrors.email ? errorId("email") : undefined
                    }
                    className={`mt-2 ${fieldClass(Boolean(fieldErrors.email))}`}
                  />
                  {fieldErrors.email && (
                    <p
                      id={errorId("email")}
                      className="mt-1.5 text-sm font-medium text-red-300"
                    >
                      {fieldErrors.email}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label
                  htmlFor={bodyId}
                  className="block text-xs font-semibold uppercase tracking-wider text-white/60"
                >
                  Votre message
                </label>
                <textarea
                  id={bodyId}
                  name="body"
                  required
                  rows={5}
                  minLength={CONTACT_LIMITS.bodyMin}
                  maxLength={CONTACT_LIMITS.bodyMax}
                  placeholder="Parlez-moi de votre projet, de votre équipe, ou de ce qui vous amène."
                  aria-invalid={fieldErrors.body ? true : undefined}
                  aria-describedby={
                    fieldErrors.body ? errorId("body") : undefined
                  }
                  className={`mt-2 resize-y ${fieldClass(Boolean(fieldErrors.body))}`}
                />
                {fieldErrors.body && (
                  <p
                    id={errorId("body")}
                    className="mt-1.5 text-sm font-medium text-red-300"
                  >
                    {fieldErrors.body}
                  </p>
                )}
              </div>

              {/* Pied du formulaire : séparateur, mention rassurante à gauche,
                  action à droite — la disposition attendue d'une boîte de
                  dialogue, plutôt qu'un bouton flottant seul en bas à gauche. */}
              <div className="mt-1 flex flex-col-reverse gap-4 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-white/40">
                  Votre adresse ne sert qu&apos;à vous répondre.
                </p>

                <button
                  type="submit"
                  disabled={isPending}
                  className="bg-gradient-accent inline-flex h-12 w-full items-center justify-center gap-2 rounded-control px-7 font-semibold text-surface-sunken transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:w-max"
                >
                  {isPending ? (
                    <>
                      {/* Indicateur d'attente : une action réseau sans retour
                          visuel donne l'impression d'un bouton mort, et invite à
                          cliquer une seconde fois.
                          ⚠️ `animate-spin` est une animation CSS : la règle
                          globale de la story 6.2 la fige sous mouvement réduit,
                          où le libellé « Envoi en cours… » porte seul
                          l'information. */}
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        fill="none"
                        className="size-4 animate-spin"
                      >
                        <circle
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeOpacity="0.3"
                          strokeWidth="3"
                        />
                        <path
                          d="M12 2a10 10 0 0 1 10 10"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                        />
                      </svg>
                      Envoi en cours…
                    </>
                  ) : (
                    "Envoyer le message"
                  )}
                </button>
              </div>

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
                className={
                  state.message
                    ? "rounded-control border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm font-medium text-red-200"
                    : "sr-only"
                }
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
