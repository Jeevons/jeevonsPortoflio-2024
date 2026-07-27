"use client";

import grainImage from "@/assets/images/grain.jpg";
import { Reveal } from "@/components/Reveal";
import {
  submitContactMessage,
  type ContactFormState,
} from "@/app/contact-actions";
import { CONTACT_LIMITS, HONEYPOT_FIELD } from "@/lib/schemas/contact";
import { useActionState, useEffect, useId, useRef } from "react";

// Vue cliente de la section contact.
//
// Story 6.12 — LE BOUTON `mailto:` A DISPARU, remplacé par un vrai formulaire
// (décision Jeevons, PLAN §4.3 : le formulaire « remplace l'email en clair »).
// C'est l'aboutissement de la règle D10 : l'adresse n'est plus recomposée du
// tout côté client, donc plus aucun chemin ne peut la révéler. Le lien LinkedIn
// reste, comme voie de secours visible.
//
// 🛑 `id="contact"` est PRÉSERVÉ : c'est l'ancre du `Header` et l'identifiant
// unique dont dépend le repérage de section de la story 6.5.
//
// ⚠️ La prop `email` n'est plus consommée par la vue — mais `getContactSettings`
// et `lib/settings.ts` restent INTACTS (garde de cohérence qui jette au
// chargement du module), et le serveur en a toujours besoin : c'est le
// destinataire de la notification, recomposé côté serveur uniquement.
type ContactClientProps = {
  linkedinUrl: string;
};

const INITIAL_STATE: ContactFormState = {
  status: "idle",
  message: null,
  fieldErrors: {},
};

export const ContactClient = ({ linkedinUrl }: ContactClientProps) => {
  const [state, formAction, isPending] = useActionState(
    submitContactMessage,
    INITIAL_STATE,
  );

  const formRef = useRef<HTMLFormElement>(null);

  // `useId` plutôt que des identifiants en dur : la section est rendue à la
  // fois sur `/` et sur `/preview` (5.11), et deux `id` identiques dans un même
  // document casseraient l'association `aria-describedby`.
  const baseId = useId();
  const nameId = `${baseId}-name`;
  const emailId = `${baseId}-email`;
  const bodyId = `${baseId}-body`;
  const errorId = (field: string) => `${baseId}-${field}-error`;

  const { fieldErrors } = state;

  // Après un succès, on vide le formulaire : laisser la saisie en place inviterait
  // à renvoyer le même message (et à consommer le quota d'AC4 pour rien).
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
    <section className="py-16 pt-12 lg:py-24 lg:pt-20" id="contact">
      <div className="container">
        <Reveal className="bg-gradient-accent text-surface py-8 px-10 rounded-card relative overflow-hidden z-0">
          {/* Story 6.1 — calque de grain factorisé en `.surface-grain`. */}
          <div
            className="surface-grain -z-10"
            style={{ backgroundImage: `url(${grainImage.src})` }}
          ></div>
          <div className="flex flex-col gap-8 md:flex-row md:gap-16">
            <div className="md:w-2/5">
              {/* Story 6.3 (AC1) — échelle fluide 2xl→3xl. */}
              <h2 className="font-serif text-display-4">
                À la recherche d&apos;une nouvelle aventure
              </h2>
              <p className="text-sm mt-2 md:text-base">
                Je suis actuellement à la recherche d&apos;une alternance pour
                l&apos;année scolaire 2026-2027. Écrivez-moi directement ici, je
                vous répondrai personnellement.
              </p>
              <p className="mt-4 text-sm">
                <a
                  href={linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  Me retrouver sur LinkedIn
                </a>
              </p>
              {/* ⚠️ `<noscript>` MIS À JOUR : il parlait d'un bouton qui
                  n'existe plus. Le formulaire se soumet nativement même sans
                  JavaScript (les Server Actions dégradent en POST), et la
                  validation serveur d'AC5 tient dans ce cas aussi. */}
              <noscript>
                <p className="mt-4 text-sm">
                  Le formulaire fonctionne sans JavaScript : la confirmation
                  s&apos;affichera après le rechargement de la page.
                </p>
              </noscript>
            </div>

            <form
              ref={formRef}
              action={formAction}
              className="flex flex-col gap-4 md:w-3/5"
              noValidate
            >
              {/* 🛑 CHAMP PIÈGE (AC3) — invisible pour un humain, rempli par les
                  robots qui remplissent tout ce qu'ils trouvent.
                  ❌ PAS `type="hidden"` : les robots l'ignorent.
                  ❌ PAS `display:none` seul : certains robots le détectent.
                  ✅ Sorti du flux et rendu inatteignable au clavier
                  (`tabIndex={-1}`) comme au lecteur d'écran (`aria-hidden`) —
                  un visiteur légitime ne doit JAMAIS pouvoir le remplir par
                  accident, sous peine de voir sa demande ignorée en silence. */}
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
                  // ⚠️ Sans `autoComplete="off"`, le gestionnaire de mots de
                  // passe du visiteur peut pré-remplir le piège et faire
                  // ignorer une demande parfaitement légitime.
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

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="submit"
                  disabled={isPending}
                  className="text-white bg-surface items-center px-6 h-12 rounded-control gap-2 inline-flex w-max border border-surface transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  <span className="font-semibold">
                    {isPending ? "Envoi en cours…" : "Envoyer le message"}
                  </span>
                </button>
              </div>

              {/* Confirmation d'AC6 et messages globaux (limitation de débit,
                  panne). ⚠️ `role="status"` + `aria-live="polite"` : sans cela
                  un utilisateur au lecteur d'écran ne saurait pas que son envoi
                  a abouti. Le conteneur est TOUJOURS monté — une région live
                  ajoutée au DOM en même temps que son texte n'est pas annoncée
                  de façon fiable. */}
              <p
                role="status"
                aria-live="polite"
                className="text-sm font-medium"
              >
                {state.message}
              </p>
            </form>
          </div>
        </Reveal>
      </div>
    </section>
  );
};
