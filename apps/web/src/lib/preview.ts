import "server-only";

import { auth } from "@/lib/auth";
import { mfaStateFromToken } from "@/lib/auth.config";

// Story 5.11 — MODE APERÇU des brouillons (AC2, AC3).
//
// ⚠️ INVARIANT DE SÉCURITÉ (piège n°1, central) — un brouillon ne doit JAMAIS
// être servi à un visiteur. Deux règles en découlent :
//
//  1. La décision « montrer les brouillons » se prend CÔTÉ SERVEUR, sur la
//     SESSION (piège n°2). Atteindre l'URL d'aperçu ne suffit PAS : une URL est
//     publique, n'importe qui peut la saisir ou la recevoir en copie. Sans cette
//     vérification, l'AC3 (« pas d'aperçu sans session ») tomberait aussitôt.
//  2. La lecture d'aperçu ne passe PAS par le cache public (voir
//     `lib/projects.ts` → `getProjectsForPreview`) : un brouillon mis en cache
//     serait ensuite servi à tous.
//
// ⚠️ Pourquoi ne pas réutiliser `requireAdmin` ? Sa sémantique est « refuse et
// lève » : elle protège des MUTATIONS. Ici, l'absence de session n'est pas une
// erreur — c'est le cas nominal du visiteur, qui doit obtenir la page publique
// normale (AC3 : « le site se comporte comme pour un visiteur ordinaire »). On
// veut donc un booléen, pas une exception.
//
// ⚠️ Le proxy (5.2) protège `/admin`, pas les pages publiques : la surface
// d'aperçu doit elle-même lire la session (défense au bon endroit).

/**
 * L'aperçu est-il AUTORISÉ pour la requête courante ? (AC2, AC3)
 *
 * Vrai UNIQUEMENT si une session admin PLEINE est présente :
 *  - aucune session → `false`, comportement visiteur (AC3, c'est tout l'enjeu) ;
 *  - session PARTIELLE (second facteur non franchi, 5.5) → `false`. Une session
 *    à mi-chemin ne vaut pas autorisation : c'est la règle de `requireAdmin`, et
 *    la dupliquer ici la laisserait diverger. On réutilise `mfaStateFromToken`.
 *
 * ⚠️ C'est cette fonction, et elle seule, qui autorise l'affichage des
 * brouillons. Ne jamais déduire l'aperçu de l'URL atteinte.
 */
export async function isPreviewAllowed(): Promise<boolean> {
  const session = await auth();
  if (!session?.user) return false;

  return mfaStateFromToken(session) === "full";
}
