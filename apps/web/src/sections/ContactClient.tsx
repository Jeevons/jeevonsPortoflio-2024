"use client";

import ArrowUpRightIcon from "@/assets/icons/arrow-up-right.svg";
import grainImage from "@/assets/images/grain.jpg";
import { ContactDialog } from "@/components/ContactDialog";
import { Reveal } from "@/components/Reveal";
import { useState } from "react";

// Vue cliente de la section contact.
//
// 🛑 RETOUR JEEVONS (27/07) — LA BANNIÈRE RETROUVE SON BOUTON. La story 6.12
// avait posé le formulaire complet DANS ce bandeau, ce qui le transformait en
// gros bloc de saisie alors qu'il doit rester une invitation. Le formulaire est
// donc reparti dans une MODALE (`ContactDialog`), et cette bannière retrouve la
// mise en page qu'elle avait avant 6.12 : un texte, un lien LinkedIn, un bouton.
//
// 🛑 CE QUE 6.12 A ACQUIS ET QU'ON NE REPERD PAS : le bouton n'est PLUS un
// `mailto:`. L'adresse e-mail ne franchit toujours pas la frontière
// serveur/client (règle D10) — ❌ ne pas la réintroduire ici « puisque le bouton
// est revenu ». Il ouvre la modale ; la Server Action fait le reste.
//
// 🛑 `id="contact"` est PRÉSERVÉ : c'est l'ancre du `Header` et l'identifiant
// unique dont dépend le repérage de section de la story 6.5.
//
// ⚠️ La prop `email` n'est toujours pas consommée par la vue — mais
// `getContactSettings` et `lib/settings.ts` restent INTACTS (garde de cohérence
// qui jette au chargement du module), et le serveur en a toujours besoin : c'est
// le destinataire de la notification, recomposé côté serveur uniquement.
type ContactClientProps = {
  linkedinUrl: string;
};

export const ContactClient = ({ linkedinUrl }: ContactClientProps) => {
  const [isDialogOpen, setDialogOpen] = useState(false);

  return (
    <section className="py-16 pt-12 lg:py-24 lg:pt-20" id="contact">
      <div className="container">
        <Reveal className="bg-gradient-accent text-surface py-8 px-10 rounded-card relative overflow-hidden z-0">
          {/* Story 6.1 — calque de grain factorisé en `.surface-grain`. */}
          <div
            className="surface-grain -z-10"
            style={{ backgroundImage: `url(${grainImage.src})` }}
          ></div>
          <div className="flex flex-col md:flex-row gap-8 md:gap-16 items-center">
            <div>
              {/* Story 6.3 (AC1) — échelle fluide 2xl→3xl. */}
              <h2 className="font-serif text-display-4">
                À la recherche d&apos;une nouvelle aventure
              </h2>
              <p className="text-sm mt-2 md:text-base flex flex-col gap-4">
                Je suis actuellement à la recherche d&apos;une alternance pour
                l&apos;année scolaire 2026-2027. N&apos;hésitez pas à me
                contacter !
                <span className="flex flex-col md:flex-row gap-2">
                  <a
                    href={linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-bold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    Me retrouver sur LinkedIn
                  </a>
                </span>
              </p>
              {/* ⚠️ Sans JavaScript, la modale ne peut pas s'ouvrir : on indique
                  la voie de secours plutôt que de laisser un bouton inerte. */}
              <noscript>
                <p className="text-sm mt-4">
                  Le formulaire de contact nécessite JavaScript. Vous pouvez me
                  joindre via le lien LinkedIn ci-dessus.
                </p>
              </noscript>
            </div>
            <div>
              <button
                type="button"
                onClick={() => setDialogOpen(true)}
                className="text-white bg-surface items-center px-6 h-12 rounded-control gap-2 inline-flex w-max border border-surface hover:scale-110 transform transition duration-300 ease-in-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <span className="font-semibold">Me Contacter</span>
                <ArrowUpRightIcon aria-hidden="true" className="size-4" />
              </button>
            </div>
          </div>
        </Reveal>
      </div>

      {/* ⚠️ Hors du `Reveal` : ce dernier applique un `transform` pendant sa
          révélation, et un ancêtre transformé crée un bloc conteneur qui
          casserait le positionnement en couche supérieure du `<dialog>`. */}
      <ContactDialog open={isDialogOpen} onClose={() => setDialogOpen(false)} />
    </section>
  );
};
