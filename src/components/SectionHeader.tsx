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
        <p className="uppercase text-center font-semibold tracking-widest bg-gradient-to-r from-emerald-300 to-sky-400 bg-clip-text text-transparent">
          {eyebrow}
        </p>
      </div>

      <h2 className="font-serif text-3xl md:text-5xl text-center mt-6">
        {title}
      </h2>
      <p className="text-center flex flex-col md:flex-row md:items-baseline md:justify-center gap-1 md:text-lg text-white/60 mt-4 max-w-md mx-auto">
        {description}
        <span className="text-white/60 text-xs ">{indication}</span>
      </p>
    </>
  );
};
