import Link from "next/link";

// Story 6.10 (AC4) — PAGE « NON TROUVÉE ».
//
// 🛑 IL N'EN EXISTAIT AUCUNE DANS LE DÉPÔT : toute URL inconnue affichait la 404
// par défaut de Next — une page nue, sans identité ni chemin de retour. La
// lacune était générale, pas propre aux projets.
//
// ✅ PORTÉE RACINE, ET C'EST DÉLIBÉRÉ. Placée dans `app/`, elle couvre
// `/projects/[slug]` ET toute autre adresse inconnue du site. La placer sous
// `app/projects/[slug]/` n'aurait rattrapé que la route projet en laissant le
// reste du site sur la 404 nue.
//
// ⚠️ ELLE S'APPLIQUE AUSSI À `/admin` ET `/login`. On n'y rend donc NI `Header`
// public NI `Footer` : un en-tête de portfolio au milieu du back-office serait
// incohérent. La page se limite à un message et à un retour vers l'accueil, ce
// qui reste valable quelle que soit la section d'origine. Le layout racine
// (`layout.tsx`) l'enveloppe dans tous les cas.
//
// ⚠️ Aucune dépendance à la base : une 404 doit s'afficher même base
// injoignable.

const NotFound = () => {
  return (
    <div className="site-public flex min-h-screen items-center justify-center px-4 py-24">
      <div className="text-center">
        <p className="text-gradient-accent text-sm font-bold uppercase tracking-widest">
          Erreur 404
        </p>

        {/* Un `<h1>` réel : la page a son propre titre de premier niveau, elle
            n'est pas un fragment d'une autre. */}
        <h1 className="font-serif text-display-2 mt-6">Page introuvable</h1>

        <p className="mx-auto mt-4 max-w-md text-white/60 md:text-lg">
          Cette adresse ne correspond à aucune page du site. Elle a peut-être
          été déplacée, ou le lien qui vous a mené ici est incomplet.
        </p>

        {/* AC4 — LE CHEMIN DE RETOUR. `focus-visible` explicite : le lien est
            le seul élément interactif de la page, il doit être atteignable et
            visible au clavier. Contraste AA (texte sombre sur fond blanc). */}
        <Link
          href="/"
          className="text-surface-sunken rounded-control focus-visible:outline-accent-from mt-10 inline-flex h-12 items-center justify-center bg-white px-6 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
