import "server-only";

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import * as argon2 from "argon2";

import { prisma } from "@/lib/db";

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

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Le portfolio tourne DERRIÈRE un reverse proxy (Traefik/TLS, story 2.6) : la
  // requête reçue par le serveur a pour hôte `0.0.0.0:3000`, pas le domaine
  // public. Sans trustHost, Auth.js v5 refuse ces requêtes (UntrustedHost). On
  // fait donc confiance à l'hôte : c'est le réglage attendu en conteneur derrière
  // proxy. La sécurité de l'origine est assurée en amont par Traefik.
  trustHost: true,
  // Session JWT (AC3) : l'état de session vit dans un cookie signé, pas en base.
  session: { strategy: "jwt" },
  // AUTH_SECRET signe/chiffre le JWT. Obligatoire (piège n°3) ; lu depuis
  // l'environnement par Auth.js. La même clé dérivera le chiffrement du secret
  // TOTP en 5.3.
  secret: process.env.AUTH_SECRET,
  // Cookie de session DURCI (AC3). httpOnly : inaccessible au JS client (anti-XSS).
  // sameSite=lax : envoyé sur navigation top-level, bloque le CSRF cross-site.
  // secure : cookie transmis uniquement en HTTPS. En dev HTTP local, Auth.js
  // gère le préfixe/`secure` selon l'URL → on ne force PAS secure en dur (piège
  // n°3), on laisse Auth.js décider via `useSecureCookies` par défaut.
  cookies: {
    sessionToken: {
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      },
    },
  },
  pages: {
    // Page de connexion hors du groupe protégé (évite une boucle de redirection
    // quand 5.2 ajoutera le guard sur /admin).
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      authorize: async (raw) => {
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

        // Succès : Auth.js ouvre la session (JWT). On ne renvoie que l'identité
        // minimale — jamais le passwordHash.
        return { id: user.id, email: user.email, role: user.role };
      },
    }),
  ],
});
