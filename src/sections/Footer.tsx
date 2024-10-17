import ArrowUpRightIcon from "@/assets/icons/arrow-up-right.svg";

const footerLinks = [
  {
    title: "Twitter",
    href: "https://x.com/Jeevons__",
  },
  {
    title: "Instagram",
    href: "https://www.instagram.com/jeevons_/profilecard/?igsh=eGE4YnBtazhobmk0",
  },
  {
    title: "LinkedIn",
    href: "https://www.linkedin.com/in/jeevons-eya-jr-iq-3660a7297/",
  },
  {
    title: "Github",
    href: "https://github.com/Jeevons",
  },
];

export const Footer = () => {
  return (
    <footer className="relative z-0 overflow-x-clip">
      <div className="absolute h-[400px] w-[1600px] bottom-0 left-1/2 -translate-x-1/2 bg-emerald-300/30 [mask-image:radial-gradient(50%_50%_at_bottom_center,black,transparent)] -z-10 pointer-events-none"></div>
      <div className="container">
        <div className="border-t border-white/15 py-6 text-sm flex flex-col md:flex-row md:justify-between items-center gap-8">
          <div className="text-white/40">&copy; 2024. Tous droits réservés</div>
          <nav className="flex flex-col md:flex-row items-center gap-8">
            {footerLinks.map((link) => (
              <a
                href={link.href}
                target="_blanck"
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
