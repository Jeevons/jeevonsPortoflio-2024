import StartIcon from "@/assets/icons/star.svg";
import { Fragment } from "react";

const words = [
  "Performant",
  "Accessible",
  "Secure",
  "Interactif",
  "Scalable",
  "User Friendly",
  "Maintenable",
  "SEO",
  "Responsive",
  "Intuitif",
  "Modulaire",
  "Fiable",
  "Optimisé",
  "Personnalisable",
  "Ergonomique",
  "Compatible",
  "Innovant",
  "Dynamique",
  "Flexible",
  "Automatisé",
];

export const TapeSection = () => {
  return (
    <div className="py-16 lg:py-24 overflow-x-clip">
      {/* Story 6.1 — `.bg-gradient-accent` : le dégradé de signature en fond. */}
      <div className="bg-gradient-accent  -rotate-3 -mx-1">
        <div className="flex [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
          <div className="flex flex-none gap-4 pr-4 py-3 animate-move-left [animation-duration:30s]">
            {[...new Array(2)].fill(0).map((_, idx) => (
              <Fragment key={idx}>
                {words.map((word) => (
                  <div key={word} className="inline-flex gap-4 items-center">
                    <span className="text-surface uppercase font-extrabold text-sm">
                      {word}
                    </span>
                    <StartIcon className="size-6 text-surface -rotate-12" />
                  </div>
                ))}
              </Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
