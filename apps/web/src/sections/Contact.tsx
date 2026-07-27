import { ContactClient } from "@/sections/ContactClient";
import { getContactSettings } from "@/lib/settings";

// Conteneur serveur async (Story 4.3) : lit les réglages de contact en base
// (avec défauts si clé absente, AC2/AC3), puis passe le lien LinkedIn à la vue
// cliente.
//
// 🛑 Story 6.12 — L'E-MAIL N'EST PLUS PASSÉ AU CLIENT DU TOUT. Le bouton
// `mailto:` a laissé place à un formulaire : plus rien côté client n'a besoin de
// l'adresse, pas même en fragments. C'est l'aboutissement de la règle D10 —
// avant, la chaîne était absente du HTML mais recomposable par le JavaScript
// servi ; désormais elle ne franchit plus la frontière serveur/client.
//
// ⚠️ `getContactSettings()` continue d'être appelée telle quelle et
// `lib/settings.ts` reste INTACT (sa garde de cohérence jette au chargement du
// module) : l'e-mail y est toujours lu — c'est le destinataire de la
// notification, recomposé côté serveur uniquement (`lib/contact-notification.ts`).
export const ContactSection = async () => {
  const { linkedin } = await getContactSettings();
  return <ContactClient linkedinUrl={linkedin} />;
};
