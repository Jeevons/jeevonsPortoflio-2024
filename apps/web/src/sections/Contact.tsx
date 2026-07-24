import { ContactClient } from "@/sections/ContactClient";
import { getContactSettings } from "@/lib/settings";

// Conteneur serveur async (Story 4.3) : lit le lien LinkedIn et l'e-mail
// fragmenté en base (avec défauts si clé absente, AC2/AC3), puis passe le tout
// en props à la vue cliente. L'e-mail transite en fragments — jamais recomposé
// côté serveur — pour ne pas apparaître dans le HTML servi (anti-moisson).
export const ContactSection = async () => {
  const { email, linkedin } = await getContactSettings();
  return <ContactClient email={email} linkedinUrl={linkedin} />;
};
