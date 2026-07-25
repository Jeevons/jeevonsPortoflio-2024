import "server-only";

import { listMedia, mediaUrl, type MediaSummary } from "@/lib/media";
import { mediaFileExists } from "@/lib/media/storage";
import { findAllMediaUsages, type MediaUsage } from "@/lib/media/usages";

// Story 5.13 — LECTURE de la bibliothèque pour l'administration (AC1).
//
// Même découpage qu'en 5.8 (`lib/admin/projects.ts`) : la page reste un simple
// gabarit, tout l'assemblage est ici et donc testable et réutilisable.
//
// L'écran a besoin de TROIS informations que personne ne détient seul :
//   - les métadonnées (base) ;
//   - qui utilise chaque image (base, autres tables) ;
//   - si le fichier est réellement là (volume).

/** Une image telle que la grille l'affiche. */
export type AdminMedia = MediaSummary & {
  /** URL publique, calculée une fois ici plutôt que dans le JSX. */
  url: string;
  /** Contenus qui référencent cette image — vide = supprimable. */
  usages: MediaUsage[];
  /** `false` si le fichier a disparu du volume (voir `mediaFileExists`). */
  fileExists: boolean;
};

export type AdminMediaList =
  { available: true; rows: AdminMedia[] } | { available: false; rows: [] };

/**
 * Liste les images avec leurs usages et l'état de leur fichier (AC1).
 *
 * ⚠️ Renvoie `available: false` au lieu de propager l'erreur si la base est
 * injoignable — même discipline qu'en 5.7/5.8 : l'écran DIT que la base est
 * indisponible plutôt que d'afficher une bibliothèque vide, qui laisserait
 * croire que toutes les images ont disparu.
 */
export async function listAdminMedia(): Promise<AdminMediaList> {
  let media: MediaSummary[];
  let usagesByMedia: Map<string, MediaUsage[]>;

  try {
    // Les deux lectures sont indépendantes : les paralléliser évite d'ajouter
    // un aller-retour base à l'affichage de l'écran.
    [media, usagesByMedia] = await Promise.all([
      listMedia(),
      findAllMediaUsages(),
    ]);
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    console.error(
      `[admin] Bibliothèque d'images illisible. Cause : ${raw.replace(/\s+/g, " ").trim()}`,
    );
    return { available: false, rows: [] };
  }

  // Un `access()` par image, en parallèle : ce sont des appels système locaux,
  // sans latence réseau. En série, une bibliothèque de 200 images ajouterait
  // 200 attentes successives au rendu.
  const existence = await Promise.all(
    media.map((item) => mediaFileExists(item.path)),
  );

  return {
    available: true,
    rows: media.map((item, index) => ({
      ...item,
      url: mediaUrl(item.path),
      usages: usagesByMedia.get(item.id) ?? [],
      fileExists: existence[index],
    })),
  };
}
