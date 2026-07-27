import { CV_PUBLIC_URL, getPublicCv } from "@/lib/cv";
import { Footer } from "@/sections/Footer";
import { Header } from "@/sections/Header";
import type { Metadata } from "next";
import Link from "next/link";

// Story 6.11 (AC1 → AC4) — PAGE PUBLIQUE DE CONSULTATION DU CV.
//
// PLAN §4.3 : « `/cv` : viewer PDF inline + bouton téléchargement (au lieu du
// lien brut actuel) ». Le lien brut existait déjà (carte « CV » de la section
// À propos) et forçait la sortie du site ; cette page le remplace.
//
// 🛑 ZÉRO DÉPENDANCE. Aucun lecteur PDF n'est installé (`react-pdf`,
// `pdfjs-dist`…) : ce sont plusieurs centaines de Ko de JavaScript pour ce que
// tout navigateur moderne fait nativement avec un `Content-Type:
// application/pdf`. L'intégration passe par un `<object>` — zéro JS, et son
// contenu enfant EST le repli d'AC3 (voir plus bas).
//
// 🛑 TOUTE LA PLOMBERIE VIENT DE LA STORY 5.17, CONSOMMÉE TELLE QUELLE :
// `getPublicCv()` (lecture cachée sous le tag `settings`, `null` si aucun CV)
// et `CV_PUBLIC_URL` (= `/api/cv`, URL STABLE qui résout le CV courant à chaque
// requête). ❌ Aucun chemin de fichier en dur, aucune URL reconstruite depuis
// `value.path` : ce serait exactement le couplage que 5.17 a démonté, et cela
// casserait AC2.
//
// ❌ `lib/cv.ts`, `app/api/cv/route.ts` et `robots.ts` NE SONT PAS MODIFIÉS.
// Le `Content-Disposition: inline` et le `Cache-Control: no-cache` de la route
// sont DÉLIBÉRÉS (AC2 de 5.17) : `inline` est précisément ce que l'affichage
// intégré demande, et `no-cache` garantit qu'un CV remplacé est servi tout de
// suite.

// Story 4.4 — même discipline que la home et que les fiches projet : rendu
// statique + revalidation d'1 h.
// ⚠️ Next exige un LITTÉRAL (analyse statique du segment), jamais un import de
// `REVALIDATE_SECONDS`.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "CV — Jeevons Eya",
  description:
    "Consultez et téléchargez le CV de Jeevons Eya, développeur web : parcours, compétences et expériences.",
  openGraph: {
    title: "CV — Jeevons Eya",
    description:
      "Consultez et téléchargez le CV de Jeevons Eya, développeur web.",
    type: "profile",
  },
  twitter: {
    title: "CV — Jeevons Eya",
    description:
      "Consultez et téléchargez le CV de Jeevons Eya, développeur web.",
  },
};

/**
 * Bouton de téléchargement (AC1).
 *
 * ⚠️ Un `<a download>`, PAS un `<button onClick>` : une navigation déclenchée
 * en JavaScript casserait le clic-milieu et « ouvrir dans un nouvel onglet »
 * pour rien.
 * ⚠️ ❌ NI `target="_blank"` NI `rel="noopener noreferrer"` : `/api/cv` est de
 * MÊME ORIGINE. La règle AGENTS.md §6 vise les liens sortants ; et l'attribut
 * `download` ne fonctionnerait pas sur une origine tierce.
 * ⚠️ L'attribut `download` prime côté client sur le `Content-Disposition:
 * inline` de la route pour une URL de même origine — le fichier arrive donc
 * bien nommé `cv-jeevons.pdf` (nom stable, sans numéro de version : contrat
 * 5.17).
 */
const DownloadButton = () => (
  <a
    href={CV_PUBLIC_URL}
    download="cv-jeevons.pdf"
    className="rounded-control bg-gradient-accent text-surface-sunken focus-visible:outline-accent-from inline-flex items-center gap-2 px-6 py-3 font-semibold transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
  >
    <span aria-hidden="true">&darr;</span>
    {/* Libellé EXPLICITE (« Télécharger » seul ne dit ni quoi ni quel format) :
        un lecteur d'écran qui liste les liens de la page doit pouvoir les
        distinguer hors contexte. */}
    <span>Télécharger le CV (PDF)</span>
  </a>
);

const CvPage = async () => {
  const cv = await getPublicCv();

  return (
    <div className="site-public">
      <Header />

      {/* ⚠️ Marge haute RÉDUITE par rapport aux fiches projet (`py-24 lg:py-32`)
          et basse conservée : sur cette page, l'objectif est que le document
          soit visible au plus vite. Chaque rem d'en-tête est un rem de
          défilement imposé avant d'atteindre le CV. */}
      <main className="container pt-28 pb-20 lg:pt-32">
        {/* Chemin de retour, comme sur les fiches projet (6.10) : on peut
            arriver ici depuis un moteur de recherche, sans passer par
            l'accueil. */}
        <Link
          href="/#about"
          className="rounded-control focus-visible:outline-accent-from flex w-fit items-center gap-2 border border-white/15 px-4 py-2 text-sm text-white/70 transition-colors hover:border-white/30 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          <span aria-hidden="true">&larr;</span>
          <span>Retour au site</span>
        </Link>

        {cv ? (
          <>
            {/* 🛑 AC4 — L'ORDRE DU DOM EST VOLONTAIRE : vignette et bouton
                AVANT le cadre intégré.

                Sur iOS Safari et beaucoup de navigateurs Android, un PDF dans
                un `<object>` s'affiche tronqué, non défilable, voire pas du
                tout — SANS déclencher le repli enfant (le navigateur prétend
                savoir gérer le type). Une page « qui marche sur desktop » peut
                donc être inutilisable sur téléphone.

                AC4 offre deux issues ; on prend la plus sûre : sur mobile, la
                vignette de la 1ʳᵉ page et le bouton de téléchargement sont
                visibles D'EMBLÉE, et le cadre intégré est simplement masqué
                (`hidden md:block` plus bas).

                ❌ Aucune détection de navigateur ou d'OS en JavaScript :
                fragile, non testable, et cela rendrait la page cliente sans
                nécessité. Un simple point de rupture CSS suffit. */}
            <div className="mt-8 grid gap-8 md:grid-cols-[auto_1fr] md:items-center">
              {/* Vignette déjà normalisée en WebP par sharp (5.17) : `<img>`
                  natif plutôt que `next/image`, avec `width`/`height` réels —
                  le navigateur réserve la place avant le chargement, donc la
                  page ne saute pas (anti-CLS). Pattern repris de
                  `AboutClient`.

                  ⚠️ `md:hidden` — MOBILE UNIQUEMENT, et c'est délibéré : sur
                  desktop elle montrerait exactement ce que le lecteur affiche
                  juste en dessous, en consommant la hauteur d'écran qui oblige
                  à défiler avant d'atteindre le document. Sur mobile en
                  revanche le lecteur est masqué (AC4) : elle y est le SEUL
                  aperçu du CV, donc indispensable. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="rounded-card w-44 border border-white/10 shadow-2xl shadow-black/40 md:hidden"
                src={cv.thumbnailUrl}
                width={cv.thumbnailWidth}
                height={cv.thumbnailHeight}
                alt="Première page du CV"
                /* Story 6.18 (AC3) — `loading="lazy"`, comme les autres
                   médias publics. Même remarque que dans `AboutClient` :
                   `CurrentCv` (5.17) n'expose pas de `blurDataUrl`, les
                   `width`/`height` réels portent seuls l'anti-CLS. */
                loading="lazy"
              />

              {/* Titre et bouton sur UNE SEULE LIGNE en desktop : l'en-tête
                  tient en une bande courte, le document commence plus haut. */}
              <div className="md:col-span-2 md:flex md:items-end md:justify-between md:gap-8">
                <div>
                  <h1 className="font-serif text-display-1">Mon CV</h1>
                  <p className="mt-3 max-w-prose text-white/70">
                    Mon parcours, mes compétences et mes expériences — à lire
                    directement ici, ou à emporter au format PDF.
                  </p>
                </div>

                <div className="mt-6 shrink-0 md:mt-0">
                  <DownloadButton />
                </div>
              </div>

              <p className="max-w-md text-sm text-white/50 md:hidden">
                Sur téléphone, l&apos;affichage intégré des PDF est souvent peu
                lisible : téléchargez le document pour le consulter
                confortablement.
              </p>
            </div>

            {/* 🛑 AC1 + AC3 — `<object>` ET NON `<iframe>`, c'est LE point clé.
                Un `<object>` rend son CONTENU ENFANT lorsque le navigateur ne
                sait pas afficher le type MIME : le repli d'AC3 est donc
                PUREMENT DÉCLARATIF, sans une ligne de JavaScript ni la moindre
                détection. Un `<iframe>` n'a pas ce comportement — son contenu
                enfant n'est jamais rendu — et aurait imposé une détection
                d'échec en JS, plus fragile et inutile.

                ⚠️ `#toolbar=0&navpanes=0` — paramètres de FRAGMENT du lecteur
                PDF, pas des paramètres de requête : ils ne partent jamais au
                serveur (l'URL servie reste `/api/cv`, AC2 intact) et masquent
                la barre d'outils grise et le panneau de vignettes sous
                Chrome/Edge. Firefox et Safari les IGNORENT silencieusement,
                sans dégradation. C'est le seul levier existant sur l'habillage
                du lecteur : celui-ci appartient au navigateur, aucun CSS de la
                page ne l'atteint.

                ⚠️ `view=Fit` (et NON `FitH`) : `FitH` ajuste à la LARGEUR, ce
                qui fait déborder la page en hauteur et oblige à défiler DANS le
                lecteur. `Fit` ajuste la page ENTIÈRE au cadre — le CV est
                lisible d'un seul coup d'œil, sans défilement interne. Le CV
                tient sur une page ; c'est la seule vue qui a du sens ici.

                ⚠️ Le conteneur porte le cadre aux tokens (rayon, bordure, fond
                sombre) : le lecteur natif reste gris, mais il est SERTI dans
                l'identité du site plutôt que posé à nu sur la page.

                ⚠️ Hauteur EXPLICITE obligatoire : un `<object>` sans hauteur
                s'effondre à quelques pixels.
                ⚠️ `aria-label` obligatoire : sans lui, un lecteur d'écran
                annonce un cadre anonyme. */}
            <div className="rounded-card bg-surface-raised mx-auto mt-8 hidden w-full max-w-3xl overflow-hidden border border-white/10 p-2 md:block">
              {/* ⚠️ RATIO A4 (`aspect-[1/1.414]`) PLUTÔT QU'UNE HAUTEUR EN
                  `vh` : le cadre épouse exactement la forme du document, donc
                  `view=Fit` le remplit sans laisser de bande vide ni imposer de
                  défilement interne. Une hauteur en `vh` était arbitraire — sur
                  un écran large elle produisait un cadre trop court pour une
                  page A4, d'où le défilement. `max-w-4xl` + `mx-auto` évite
                  qu'un très grand écran n'étire le document au-delà du lisible. */}
              <object
                data={`${CV_PUBLIC_URL}#toolbar=0&navpanes=0&view=Fit`}
                type="application/pdf"
                aria-label="CV de Jeevons Eya, document PDF"
                className="rounded-card block aspect-[1/1.414] w-full"
              >
                {/* ⬇️ AC3 — rendu UNIQUEMENT si le navigateur ne sait pas
                    afficher le PDF intégré. */}
                <div className="p-8">
                  <p className="text-white/70">
                    Votre navigateur ne peut pas afficher ce document
                    directement. Téléchargez-le pour le consulter.
                  </p>
                  <div className="mt-6">
                    <DownloadButton />
                  </div>
                </div>
              </object>
            </div>
          </>
        ) : (
          // Hors AC — aucun CV téléversé. Ce n'est PAS une panne : `lib/cv.ts`
          // le documente (« un CV absent n'est pas une panne DB, c'est un état
          // de départ légitime »), et `getPublicCv()` renvoie `null` aussi bien
          // avant le premier téléversement que si la base est injoignable.
          //
          // 🛑 DÉCISION (tâche 0, validée par Jeevons) : ÉTAT NEUTRE plutôt que
          // `notFound()`. Le ton reprend celui de `AboutClient`. Un 404 aurait
          // rendu le lien de la carte « CV » mort tant que rien n'est
          // téléversé, à rebours d'AGENTS.md §3 (« ne jamais tomber en
          // erreur »). ❌ Pas de `readWithFallback` : il n'existe pas de CV par
          // défaut, et `getPublicCv()` gère déjà son propre `try/catch`.
          // ⚠️ Le `<h1>` est porté par CHACUNE des deux branches (ici et à côté
          // de la vignette) : la page doit toujours avoir exactement un titre
          // de niveau 1, quel que soit l'état.
          <div className="mt-10">
            <h1 className="font-serif text-display-1">Mon CV</h1>
            <p className="mt-4 max-w-prose text-lg text-white/70">
              CV bientôt disponible.
            </p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default CvPage;
