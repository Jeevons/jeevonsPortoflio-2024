import grainImage from "@/assets/images/grain.jpg";
import { ComponentPropsWithoutRef, PropsWithChildren } from "react";
import { twMerge } from "tailwind-merge";

// Story 6.8 — `Card` reste le composant PARTAGÉ (cartes projet, parcours,
// hobbies). Les deux ajouts ci-dessous sont volontairement INERTES par défaut :
//
//   • `as` permet à un appelant client de faire rendre la racine par un
//     `motion.div`. Sans lui, un `<div>` — donc aucun changement pour les
//     appelants existants.
//   • le calque de halo ne peint RIEN tant que `--glow-opacity` n'est pas
//     défini (il vaut 0 par défaut). Les cartes de parcours et de hobbies, qui
//     ne définissent jamais ces variables, sont donc strictement inchangées.
//
// C'est ce qui permet de tenir la consigne « ne pas propager l'effet à toutes
// les cartes » sans dupliquer `Card` pour les seuls projets.
type CardProps = ComponentPropsWithoutRef<"div"> & {
  as?: React.ElementType;
};

export const Card = ({ className, children, as, ...other }: CardProps) => {
  const Root = as ?? "div";
  return (
    <Root
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

      {/* Story 6.8 (AC1) — HALO RADIAL SUIVANT LE POINTEUR.

          Un simple calque, sans nœud interactif : `pointer-events-none` est
          indispensable, il couvre toute la carte et avalerait sinon les clics du
          bouton « Visiter le site ».

          ⚠️ EMPILEMENT — il doit passer AU-DESSUS du grain (`-z-10`) et EN
          DESSOUS du liseré `after:` (`z-10`, story 1.8), qui doit rester visible
          par-dessus le halo. D'où `z-0`.

          ✅ INERTE PAR DÉFAUT : `--glow-opacity` vaut 0 si personne ne la
          définit, donc les cartes de parcours et de hobbies — qui partagent ce
          composant — ne peignent rien du tout. Seul l'appelant projet, côté
          client, alimente ces variables. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 transition-opacity"
        style={{
          opacity: "var(--glow-opacity, 0)",
          background:
            "radial-gradient(circle 320px at var(--glow-x, 50%) var(--glow-y, 50%), hsl(var(--accent-from) / 0.14), transparent 70%)",
        }}
      ></div>

      {children}
    </Root>
  );
};
