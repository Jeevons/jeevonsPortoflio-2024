import "server-only";

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import * as argon2 from "argon2";

import { headers } from "next/headers";

import { authConfig } from "@/lib/auth.config";
import { prisma } from "@/lib/db";
import {
  checkLoginRateLimit,
  clientIpFromHeaders,
} from "@/lib/login-rate-limit";

// Story 5.1 — Socle d'authentification par identifiants (Auth.js v5).
//
// Ce module est la SOURCE UNIQUE de la config Auth.js : il exporte `signIn`,
// `signOut`, `auth` et les handlers de route. La story 5.2 (middleware de
// protection des routes /admin) et les stories 5.3-5.5 (2FA/TOTP) l'ÉTENDENT
// sans le refaire.
//
// Choix de surface d'attaque minimale (PLAN §3.1) :
//  - Compte UNIQUE seedé (aucune inscription, aucun provider OAuth).
//  - Mot de passe haché en argon2id, jamais réversible (voir prisma/seed.ts).
//  - Session JWT (pas de session en base) : le cookie signé/chiffré porte l'état.

// Hash factice argon2id, calculé une fois au chargement du module. Sert la
// parade anti-oracle temporel (piège n°4) : quand l'e-mail est inconnu, on
// vérifie tout de même le mot de passe contre ce hash pour payer le coût argon2
// dans TOUS les cas. Sans ça, un e-mail inexistant répondrait plus vite et
// trahirait l'absence de compte (énumération par timing). AC4.
// Hash argon2id RÉEL et fixe (aux MÊMES paramètres que le seed : m=65536, t=3,
// p=4) : `argon2.verify` doit pouvoir le parser et exécuter le calcul complet,
// sinon le coût n'est pas payé et la parade timing tombe. Ne correspond à aucun
// mot de passe réel (généré une fois, jamais utilisé pour un vrai compte).
const DUMMY_HASH =
  "$argon2id$v=19$m=65536,p=4,t=3$cbfZqgNBtiILFtE3N4+FsQ$9GadnEJOUWqF5n8ARAU1IDlKufhXRLHY7ZiJKracCI8";

const credentialsSchema = (raw: unknown) => {
  if (typeof raw !== "object" || raw === null) return null;
  const { email, password } = raw as Record<string, unknown>;
  if (typeof email !== "string" || typeof password !== "string") return null;
  const trimmedEmail = email.trim().toLowerCase();
  if (trimmedEmail.length === 0 || password.length === 0) return null;
  return { email: trimmedEmail, password };
};

// Story 5.5 — `unstable_update` (nom d'API du beta Auth.js v5) est la seule
// façon de PROMOUVOIR une session partielle en session complète sans refaire un
// signIn : il ré-encode le JWT via le callback `jwt` (trigger "update"). Appelé
// UNIQUEMENT depuis la server action qui vient de valider le second facteur.
export const { handlers, signIn, signOut, auth, unstable_update } = NextAuth({
  // Base EDGE-SAFE partagée avec le middleware (trustHost, session JWT, secret,
  // cookie durci, pages, callback `authorized`). Voir src/lib/auth.config.ts.
  // Story 5.2 : on n'ajoute ICI que ce qui dépend de Node (Credentials + argon2
  // + Prisma), car ce module n'est jamais importé depuis l'edge.
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      authorize: async (raw) => {
        // Rate-limit anti-force-brute (AC4, story 5.2) — VRAIE frontière de
        // sécurité, placée ici car `authorize` est le point où le mot de passe
        // est effectivement vérifié : cela couvre AUSSI bien le login via la
        // server action que tout appel DIRECT à /api/auth/callback/credentials
        // (qui contournerait un rate-limit posé uniquement dans la server
        // action). IP réelle via X-Forwarded-For derrière Traefik (piège n°4).
        // Appliqué AVANT tout `argon2.verify` : on ne paie pas le coût de calcul
        // pour une IP déjà verrouillée. Refus par `null` → message générique
        // (l'anti-énumération de 5.1 est préservée).
        const ip = clientIpFromHeaders(await headers());
        if (!checkLoginRateLimit(ip).allowed) {
          return null;
        }

        const parsed = credentialsSchema(raw);
        // Entrée malformée : on paie quand même un verify pour ne pas offrir de
        // raccourci temporel, puis on refuse.
        if (!parsed) {
          await argon2.verify(DUMMY_HASH, "invalid").catch(() => false);
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: parsed.email },
        });

        // Anti-énumération (piège n°4, AC4) : si l'e-mail est inconnu, vérifier
        // contre le hash factice pour un temps de réponse comparable au cas d'un
        // e-mail connu. Le message d'échec renvoyé à l'utilisateur reste
        // générique et identique (voir la page de login) : rien ne révèle si le
        // compte existe.
        if (!user) {
          await argon2.verify(DUMMY_HASH, parsed.password).catch(() => false);
          return null;
        }

        const valid = await argon2
          .verify(user.passwordHash, parsed.password)
          .catch(() => false);
        if (!valid) return null;

        // Succès du PREMIER facteur. Story 5.5 (AC1) : si le compte a une 2FA
        // active, le mot de passe seul n'ouvre PAS l'administration — on marque
        // la session comme PARTIELLE (`mfaPending`). Le callback `jwt`
        // (auth.config.ts) lui donne alors une échéance de 5 min, et tous les
        // gardes (/admin) la refusent tant que le code n'est pas fourni.
        //
        // `totpEnabledAt === null` (2FA pas encore enrôlée) → session complète :
        // c'est le cas d'enrôlement forcé, géré par 5.3 (le layout admin renvoie
        // vers l'écran de sécurité). Ne pas le confondre avec l'état partiel.
        //
        // On ne renvoie que l'identité minimale — jamais le passwordHash.
        return {
          id: user.id,
          email: user.email,
          role: user.role,
          mfaPending: user.totpEnabledAt !== null,
        };
      },
    }),
  ],
});
