import ArrowUpRightIcon from "@/assets/icons/arrow-up-right.svg";
import { getSocialSettings } from "@/lib/settings";

// Server Component async (Story 4.3) : les 4 liens sociaux viennent de la base,
// avec valeur par défaut si une clé manque (AC2/AC3). L'ordre reste figé.
export const Footer = async () => {
  const social = await getSocialSettings();
  const footerLinks = [
    { title: "Twitter", href: social.twitter },
    { title: "Instagram", href: social.instagram },
    { title: "LinkedIn", href: social.linkedin },
    { title: "Github", href: social.github },
  ];

  return (
    <footer className="relative z-0 overflow-x-clip">
      <div className="absolute h-[400px] w-[1600px] bottom-0 left-1/2 -translate-x-1/2 bg-emerald-300/30 [mask-image:radial-gradient(50%_50%_at_bottom_center,black,transparent)] -z-10 pointer-events-none"></div>
      <div className="container">
        <div className="border-t border-white/15 py-6 text-sm flex flex-col md:flex-row md:justify-between items-center gap-8">
          <div className="text-white/40">
            &copy; {new Date().getFullYear()}. Tous droits réservés
          </div>
          <nav className="flex flex-col md:flex-row items-center gap-8">
            {footerLinks.map((link, index) => (
              <a
                key={index} // Ajout de la clé ici
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 hover:text-emerald-300 hover:scale-110 transform transition duration-300 ease-in-out"
              >
                <span>{link.title}</span>
                <ArrowUpRightIcon aria-hidden="true" className="size-4" />
              </a>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
};
