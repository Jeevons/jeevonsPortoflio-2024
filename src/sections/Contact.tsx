import ArrowUpRightIcon from "@/assets/icons/arrow-up-right.svg";
import grainImage from "@/assets/images/grain.jpg";

export const ContactSection = () => {
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
                À la recherche d'une nouvelle aventure
              </h2>
              <p className="text-sm mt-2 md:text-base flex flex-col gap-4">
                Je suis actuellement à la recherche d'un stage et je me projette
                déjà vers l'année scolaire 2025-2026, que j'aimerais effectuer
                en alternance. N'hésitez pas à me contacter !
                <span className="flex flex-col md:flex-row gap-2">
                  <span className="text-sm font-bold">07.81.38.43.95</span>
                  <span className="text-sm font-bold">
                    jeevons.eya.jr@gmail.com
                  </span>
                </span>
              </p>
            </div>
            <div>
              <a
                href="mailto:jeevons.eya.jr@gmail.com"
                className="text-white bg-gray-900 items-center px-6 h-12 rounded-xl gap-2 inline-flex w-max border border-gray-900 hover:scale-110 transform transition duration-300 ease-in-out"
              >
                <span className="font-semibold">Me Contacter</span>
                <ArrowUpRightIcon aria-hidden="true" className="size-4" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
