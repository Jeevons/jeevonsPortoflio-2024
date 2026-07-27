import Link from "next/link";

// Story 6.10 (AC4) — FRONTIÈRE « NON TROUVÉE » PROPRE AU SEGMENT PROJET.
//
// Message dédié : un visiteur qui tombe sur un slug inconnu ou un projet
// dépublié est renvoyé vers la LISTE des projets, pas vers le haut de
// l'accueil. La 404 racine (`app/not-found.tsx`) reste le filet générique pour
// tout le reste du site.
//
// 🛑 LIMITE CONNUE DE NEXT 16 (16.2.11), VÉRIFIÉE À LA SONDE — À NE PAS
// RE-DÉBOGUER.
//
// `notFound()` appelé depuis une route à paramètre dynamique renvoie bien un
// code 404, mais Next remplace TOUT le document par son enveloppe
// `<html id="__next_error__">` (avec `<meta name="next-error" content=
// "not-found">` et `noindex`) : le layout racine est écarté et le corps HTML
// servi est VIDE. Le markup ci-dessous n'existe que dans la charge utile RSC —
// il est donc peint à l'hydratation, et non présent dans le HTML initial.
//
// Pistes déjà écartées, mesures à l'appui :
//   • frontière déclarée dans le segment (ce fichier) — utilisée par Next, mais
//     le corps reste vide ;
//   • markup dupliqué ici au lieu d'un ré-export — aucun effet ;
//   • `generateStaticParams` renvoyant `[]` (route non pré-rendue) — aucun
//     effet non plus : le pré-rendu n'était donc PAS la cause.
//
// Conséquence assumée : sans JavaScript, la 404 d'un projet s'affiche nue. Le
// code 404 et le `noindex` restent corrects — les moteurs et les liens cassés
// sont donc traités justement — et les fiches projets valides, elles, sont bien
// rendues côté serveur. Rien ici n'est contournable sans élargir le proxy
// (`src/proxy.ts`, aujourd'hui limité à `/admin`) au site public, ce qui
// toucherait un fichier critique pour l'authentification pour un gain
// cosmétique.
const ProjectNotFound = () => {
  return (
    <div className="site-public flex min-h-screen items-center justify-center px-4 py-24">
      <div className="text-center">
        <p className="text-gradient-accent text-sm font-bold uppercase tracking-widest">
          Erreur 404
        </p>

        <h1 className="font-serif text-display-2 mt-6">Projet introuvable</h1>

        <p className="mx-auto mt-4 max-w-md text-white/60 md:text-lg">
          Ce projet n&apos;existe pas ou n&apos;est plus publié. Vous pouvez
          retrouver l&apos;ensemble des réalisations depuis l&apos;accueil.
        </p>

        <Link
          href="/#projects"
          className="text-surface-sunken rounded-control focus-visible:outline-accent-from mt-10 inline-flex h-12 items-center justify-center bg-white px-6 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          Voir tous les projets
        </Link>
      </div>
    </div>
  );
};

export default ProjectNotFound;
