export const SectionHeader = ({
  title,
  eyebrow,
  description,
  indication,
}: {
  title: string;
  eyebrow: string;
  description: string;
  indication?: string;
}) => {
  return (
    <>
      <div className="flex justify-center">
        {/* Story 6.1 — `.text-gradient-accent` remplace la recette de dégradé
            qui était dupliquée telle quelle ici et dans `ProjectCard`. */}
        <p className="uppercase text-center font-semibold tracking-widest text-gradient-accent">
          {eyebrow}
        </p>
      </div>

      {/* Story 6.3 (AC1) — échelle fluide 3xl→5xl. Ce composant sert TOUTES les
          sections : c'est le meilleur point de levier de la story. */}
      <h2 className="font-serif text-display-2 text-center mt-6">{title}</h2>
      <p className="text-center flex flex-col gap-2 md:flex-row md:items-baseline md:justify-center md:text-lg text-white/60 mt-4 max-w-md mx-auto">
        {description}
        <span className="text-white/60 text-sm ">{indication}</span>
      </p>
    </>
  );
};
