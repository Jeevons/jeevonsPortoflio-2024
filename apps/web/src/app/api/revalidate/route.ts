import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

import { CACHE_TAG_VALUES, isCacheTag } from "@/lib/cache-tags";

// Story 4.4 (AC3) — Capacité de revalidation ciblée, VÉRIFIABLE MANUELLEMENT.
//
// ⚠️ Périmètre : ici seule la CAPACITÉ est posée. Le déclenchement depuis
// l'admin (bouton « Revalider ») est Epic 5 — cette route est la surface que
// l'admin réutilisera.
//
// 🔒 Sécurité (piège n°3) : la route N'EST JAMAIS ouverte publiquement. Elle
// exige un secret partagé (`REVALIDATE_SECRET`). Elle échoue FERMÉE : si le
// secret n'est pas configuré côté serveur, toute requête est refusée (503).
//
// Usage manuel (preuve AC3) :
//   curl -X POST "http://localhost:3000/api/revalidate?tag=projects" \
//        -H "x-revalidate-secret: $REVALIDATE_SECRET"
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;

  // Échec fermé : pas de secret configuré → route inutilisable, jamais ouverte.
  if (!secret) {
    return NextResponse.json(
      { error: "Revalidation désactivée : REVALIDATE_SECRET non configuré." },
      { status: 503 },
    );
  }

  const provided = request.headers.get("x-revalidate-secret");
  if (provided !== secret) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const tag = request.nextUrl.searchParams.get("tag");
  if (!tag || !isCacheTag(tag)) {
    return NextResponse.json(
      {
        error: `Paramètre "tag" manquant ou invalide. Attendu : ${CACHE_TAG_VALUES.join(", ")}.`,
      },
      { status: 400 },
    );
  }

  // Next 16 : `revalidateTag(tag, profile)` exige un 2e argument. `{ expire: 0 }`
  // purge le tag immédiatement (invalidation à la demande), sans dépendre d'un
  // profil `cacheLife` nommé.
  revalidateTag(tag, { expire: 0 });

  return NextResponse.json({ revalidated: true, tag, now: Date.now() });
}
