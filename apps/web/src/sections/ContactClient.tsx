"use client";

import ArrowUpRightIcon from "@/assets/icons/arrow-up-right.svg";
import grainImage from "@/assets/images/grain.jpg";
import type { FragmentedEmail } from "@/lib/settings";

// Vue cliente (Story 4.3). Reçoit l'e-mail en FRAGMENTS et le lien LinkedIn en
// props. La chaîne e-mail complète n'existe jamais dans le HTML servi
// (anti-moisson Epic 1) : elle n'est recomposée qu'au clic, côté client.
type ContactClientProps = {
  email: FragmentedEmail;
  linkedinUrl: string;
};

export const ContactClient = ({ email, linkedinUrl }: ContactClientProps) => {
  const buildMail = () => `${email.user.join(".")}@${email.host.join(".")}`;

  return (
    <section className="py-16 pt-12 lg:py-24 lg:pt-20" id="contact">
      <div className="container">
        <div className="bg-gradient-to-r from-emerald-300 to-sky-400 text-gray-900 py-8 px-10 rounded-3xl text-center md:text-left relative overflow-hidden z-0">
          <div
            className="absolute inset-0 opacity-5 -z-10"
            style={{
              backgroundImage: `url(${grainImage.src})`,
            }}
          ></div>
          <div className="flex flex-col md:flex-row gap-8 md:gap-16 items-center">
            <div className="">
              <h2 className="font-serif text-2xl md:text-3xl">
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
                    className="text-sm font-bold underline"
                  >
                    Me retrouver sur LinkedIn
                  </a>
                </span>
              </p>
              <noscript>
                <p className="text-sm mt-4">
                  Le bouton de contact direct nécessite JavaScript. Vous pouvez
                  me joindre via le lien LinkedIn ci-dessus.
                </p>
              </noscript>
            </div>
            <div>
              <button
                type="button"
                aria-label="Envoyer un e-mail à Jeevons"
                onClick={() => {
                  window.location.href = `mailto:${buildMail()}`;
                }}
                className="text-white bg-gray-900 items-center px-6 h-12 rounded-xl gap-2 inline-flex w-max border border-gray-900 hover:scale-110 transform transition duration-300 ease-in-out"
              >
                <span className="font-semibold">Me Contacter</span>
                <ArrowUpRightIcon aria-hidden="true" className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
