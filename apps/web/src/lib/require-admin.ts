import "server-only";

import type { Session } from "next-auth";

import { auth } from "@/lib/auth";
import { mfaStateFromToken } from "@/lib/auth.config";

// Story 5.2 — Garde SERVEUR réutilisable pour toute logique d'administration.
//
// C'est la brique de « défense en profondeur » exigée par AC2 : la protection
// vit CÔTÉ SERVEUR, indépendante du navigateur et du middleware. Toutes les
// mutations admin des stories 5.7-5.19 (Server Actions et routes API) passent
// par ici, jamais par une simple vérification côté client.
//
// Le compte est UNIQUE et de rôle ADMIN (5.1, aucune inscription) : une session
// valide suffit donc à identifier l'administrateur. On garde malgré tout la
// vérification centralisée pour que le durcissement futur (ex. re-check du rôle)
// ait un seul point d'entrée.

/**
 * Erreur levée quand une opération admin est appelée sans session valide.
 * Les Server Actions peuvent la laisser remonter ; les routes API la
 * traduisent en réponse 401 (voir `requireAdminApi`).
 */
export class UnauthorizedError extends Error {
  constructor(message = "Non autorisé") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/**
 * Exige une session admin valide. À utiliser dans les Server Actions et tout
 * code serveur admin. Renvoie la session si elle est valide, sinon LÈVE
 * `UnauthorizedError` (aucune donnée n'est renvoyée sans session — AC2).
 */
export async function requireAdmin(): Promise<Session> {
  const session = await auth();
  if (!session?.user) {
    throw new UnauthorizedError();
  }
  // Story 5.5 (AC1) — Une session PARTIELLE (second facteur non franchi, ou
  // dont les 5 min sont écoulées) ne vaut PAS autorisation : elle ne doit
  // exécuter aucune mutation admin, même si l'appelant contourne les écrans.
  if (mfaStateFromToken(session) !== "full") {
    throw new UnauthorizedError();
  }
  return session;
}

/**
 * Variante pour les Route Handlers (API). Renvoie la session si valide, sinon
 * une `Response` 401 JSON explicite (refus sans donnée — AC2). Usage :
 *
 *   const guard = await requireAdminApi();
 *   if (guard instanceof Response) return guard;
 *   // ... `guard` est la session valide
 */
export async function requireAdminApi(): Promise<Session | Response> {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Non autorisé" }, { status: 401 });
  }
  // Story 5.5 (AC1) — Idem `requireAdmin` : une session partielle est refusée
  // comme une absence de session, sans divulguer l'état intermédiaire.
  if (mfaStateFromToken(session) !== "full") {
    return Response.json({ error: "Non autorisé" }, { status: 401 });
  }
  return session;
}
