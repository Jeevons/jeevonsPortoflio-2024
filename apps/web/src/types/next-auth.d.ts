import type { DefaultSession } from "next-auth";

// Story 5.5 — Augmentation de types Auth.js pour le login en deux temps.
//
// L'état intermédiaire « mot de passe validé, second facteur en attente » vit
// dans le JWT et doit être lisible SANS `any` depuis le proxy (edge), le layout
// admin et `requireAdmin`. On déclare donc explicitement les champs ajoutés par
// les callbacks `jwt` / `session` (voir src/lib/auth.config.ts).

declare module "next-auth" {
  interface Session {
    /** true tant que le second facteur n'est pas franchi (AC1). */
    mfaPending?: boolean;
    /** Échéance (ms epoch) de la session partielle — 5 min après le login. */
    mfaDeadline?: number;
    /**
     * Drapeau de PROMOTION, passé à `unstable_update` par la server action qui
     * vient de valider le second facteur. Il ne survit jamais dans la session :
     * le callback `jwt` le consomme pour retirer `mfaPending` (AC2).
     */
    mfaSatisfied?: boolean;
    user?: DefaultSession["user"];
  }

  /**
   * Valeur renvoyée par `authorize` (src/lib/auth.ts). `mfaPending` y est posé
   * quand le compte a une 2FA active : le callback `jwt` le transforme alors en
   * session partielle horodatée.
   */
  interface User {
    mfaPending?: boolean;
    role?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    mfaPending?: boolean;
    mfaDeadline?: number;
  }
}
