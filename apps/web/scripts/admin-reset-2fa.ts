import { appendFileSync } from "node:fs";

import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../src/generated/prisma/client";

// Story 5.6 — Commande de SECOURS : réinitialise le second facteur d'un compte
// admin (PLAN §9.3). Filet de dernier recours quand le téléphone ET les codes de
// récupération sont perdus — pour ne JAMAIS avoir à modifier la base de
// production à la main.
//
// Ce que fait la commande (AC1) : elle efface `totpSecret`, `totpEnabledAt`,
// `totpLastCounter` et `recoveryCodes`. `totpEnabledAt = null` suffit à ce que le
// guard de la story 5.3 (src/app/(admin)/admin/layout.tsx) force l'enrôlement à
// la connexion suivante — RIEN n'est réimplémenté côté web ici.
//
// ⚠️ Elle CONTOURNE une protection de sécurité. D'où deux garde-fous (AC2) :
//  1. `--confirm <email>` OBLIGATOIRE, avec l'e-mail exact du compte. Sans lui,
//     aucune écriture. Un `docker exec` n'a pas forcément de TTY : la
//     confirmation est donc un ARGUMENT, jamais une saisie interactive (qui
//     rendrait la commande inutilisable au pire moment — piège n°2).
//  2. Toute exécution (refus comme succès) est TRACÉE, horodatée, sur la sortie
//     du script ET dans le log du conteneur (voir `trace()` — un `docker exec`
//     n'alimente pas `docker logs` tout seul). Le modèle `AuditLog` n'existe
//     qu'en story 5.19 : la trace est volontairement un log conteneur, sans
//     dépendance à un modèle non encore créé.
//
// 🔒 Ce script ne LIT jamais le secret TOTP et n'a donc pas besoin d'AUTH_SECRET
// (il efface, il ne déchiffre pas). Aucun secret n'est loggué, jamais.
//
// Exécution :
//  - en local   : `bun run admin:reset-2fa -- --confirm <email>`
//  - en prod    : `node scripts/admin-reset-2fa.mjs --confirm <email>`
//    (l'étage `production` du Dockerfile n'a PAS Bun — story 4.6 : le script est
//    donc bundlé en .mjs node-exécutable par `bun run build:reset-2fa`, comme le
//    seed. Voir docs/ops/runbook-5-6-reset-2fa-secours.md.)
//
// On se connecte via `DATABASE_URL` + adapter-pg, comme prisma/seed.ts. ❌ Pas
// via src/lib/db.ts : ce module est "server-only" (réservé au runtime Next).

const USAGE = [
  "Usage : node scripts/admin-reset-2fa.mjs --confirm <email>",
  "",
  "Réinitialise le second facteur (2FA) du compte indiqué : le secret TOTP et les",
  "codes de récupération sont effacés, et la connexion suivante impose un nouvel",
  "enrôlement.",
  "",
  "L'e-mail exact du compte est EXIGÉ après --confirm : c'est la confirmation",
  "explicite qui empêche tout déclenchement accidentel.",
].join("\n");

/**
 * Trace horodatée d'une exécution (AC2), écrite à DEUX endroits :
 *
 *  1. la sortie standard du script — ce que voit l'opérateur dans son terminal ;
 *  2. la sortie standard du PROCESSUS 1 du conteneur (`/proc/1/fd/1`), qui est le
 *     flux capté par `docker logs`.
 *
 * Pourquoi (2) : un `docker exec` écrit dans le flux de SA session, pas dans le
 * log du conteneur. Sans cette seconde écriture, la trace disparaîtrait avec le
 * terminal — or AC2 exige que l'exécution soit tracée, y compris quand on ferme
 * la fenêtre juste après (c'est précisément un moment de panique).
 *
 * L'écriture (2) est TOLÉRANTE À L'ÉCHEC : hors conteneur (exécution locale via
 * Bun) ou si PID 1 n'est pas accessible, on ignore silencieusement — la trace (1)
 * suffit et une réinitialisation ne doit jamais échouer pour un problème de log.
 */
function trace(message: string): void {
  const line = `[admin:reset-2fa] ${new Date().toISOString()} — ${message}`;
  console.log(line);
  try {
    appendFileSync("/proc/1/fd/1", `${line}\n`);
  } catch {
    // Pas dans un conteneur, ou PID 1 hors d'atteinte : sans conséquence.
  }
}

/**
 * Extrait l'e-mail de confirmation des arguments. Renvoie `null` si `--confirm`
 * est absent ou n'est pas suivi d'une valeur exploitable → l'appelant REFUSE.
 *
 * On accepte `--confirm <email>` et `--confirm=<email>` (les deux formes se
 * tapent naturellement).
 */
function parseConfirmedEmail(argv: string[]): string | null {
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--confirm") {
      const value = argv[i + 1];
      // Un flag qui suit n'est pas une valeur : `--confirm --force` doit être
      // refusé, pas interprété comme l'e-mail "--force".
      if (!value || value.startsWith("-")) return null;
      return value.trim();
    }
    if (arg.startsWith("--confirm=")) {
      const value = arg.slice("--confirm=".length).trim();
      return value.length > 0 ? value : null;
    }
  }
  return null;
}

async function main(): Promise<void> {
  const confirmedEmail = parseConfirmedEmail(process.argv.slice(2));

  // GARDE-FOU 1 (AC2) — pas de confirmation, pas d'écriture. On sort AVANT même
  // d'ouvrir une connexion à la base : une exécution accidentelle ne touche rien.
  if (!confirmedEmail) {
    trace(
      "REFUS : confirmation explicite manquante. Aucune modification effectuée.",
    );
    console.error(`\n${USAGE}\n`);
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    trace("REFUS : DATABASE_URL est absente. Aucune modification effectuée.");
    process.exit(1);
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    // GARDE-FOU 2 (AC2) — l'e-mail confirmé doit correspondre à un compte réel.
    // Une faute de frappe ne réinitialise donc jamais « le mauvais compte » en
    // silence : elle échoue franchement.
    const user = await prisma.user.findUnique({
      where: { email: confirmedEmail },
      select: { id: true, email: true, totpEnabledAt: true },
    });

    if (!user) {
      // On répète l'e-mail saisi : ce n'est pas un secret, et c'est l'information
      // dont on a besoin pour comprendre le refus (faute de frappe ?).
      trace(
        `REFUS : aucun compte ne correspond à « ${confirmedEmail} ». Aucune modification effectuée.`,
      );
      process.exit(1);
    }

    const wasEnabled = user.totpEnabledAt !== null;

    // Remise à zéro COMPLÈTE du second facteur (AC1) :
    //  - totpSecret      : le secret chiffré est effacé (l'ancienne application
    //                      d'authentification devient définitivement inutile) ;
    //  - totpEnabledAt   : null → le guard de 5.3 force l'enrôlement au prochain
    //                      login. C'est le champ qui PORTE l'effet attendu ;
    //  - totpLastCounter : null → le compteur anti-rejeu (5.5) repart de zéro
    //                      avec le nouveau secret ; le laisser fausserait la
    //                      validation des codes du nouvel enrôlement ;
    //  - recoveryCodes   : les anciens codes de secours (hachés) sont supprimés ;
    //                      un nouveau jeu sera généré à l'enrôlement.
    //
    // `recoveryCodes` est une colonne Json? : Prisma distingue le NULL SQL du
    // `null` JSON, et refuse un `null` nu. `Prisma.DbNull` écrit un vrai NULL SQL
    // — exactement l'état d'un compte fraîchement seedé, que
    // `parseStoredRecoveryCodes` (5.4) lit déjà comme « aucun code ».
    await prisma.user.update({
      where: { id: user.id },
      data: {
        totpSecret: null,
        totpEnabledAt: null,
        totpLastCounter: null,
        recoveryCodes: Prisma.DbNull,
      },
    });

    // Trace de succès (AC2) : qui, quand, et l'état de départ — jamais le secret
    // ni un code de récupération.
    trace(
      `2FA réinitialisée pour « ${user.email} » (second facteur ${
        wasEnabled ? "était actif" : "n'était pas encore actif"
      }). Enrôlement forcé à la prochaine connexion.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  // On loggue l'erreur telle quelle (messages Prisma : au plus l'hôte:port de la
  // base, jamais les identifiants) et on sort en non-zéro pour que l'échec soit
  // visible dans `docker exec`.
  trace("ÉCHEC : la réinitialisation n'a pas abouti.");
  console.error(error);
  process.exit(1);
});
