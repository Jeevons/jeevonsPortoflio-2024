import grainImage from "@/assets/images/grain.jpg";
import { ComponentPropsWithoutRef, PropsWithChildren } from "react";
import { twMerge } from "tailwind-merge";

export const Card = ({
  className,
  children,
  ...other
}: ComponentPropsWithoutRef<"div">) => {
  return (
    <div
      className={twMerge(
        // Story 6.1 — surface et rayon passés par tokens (`bg-surface-raised`
        // = gray-800, `rounded-card` = 1.5rem = l'ancien `rounded-3xl`).
        "bg-surface-raised rounded-card relative z-0 overflow-hidden after:z-10 after:content-['']  after:absolute after:inset-0 after:outline after:outline-2 after:-outline-offset-2 after:rounded-card after:outline-white/20 after:pointer-events-none",
        className,
      )}
      {...other}
    >
      {/* Story 6.1 — `.surface-grain` factorise le calque de grain partagé avec
          `Hero` et `ContactClient`. L'URL reste inline : elle porte un hash de
          build. Le `z-index` reste ici, il diffère selon la surface. */}
      <div
        className="surface-grain -z-10"
        style={{
          backgroundImage: `url(${grainImage.src})`,
        }}
      ></div>
      {children}
    </div>
  );
};
