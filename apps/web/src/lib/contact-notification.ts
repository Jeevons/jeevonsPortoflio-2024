import "server-only";

import { getContactSettings } from "@/lib/settings";

// Story 6.12 — Notification par courriel d'un nouveau message (AC2).
//
// 🛑 CE MODULE NE PEUT PAS FAIRE ÉCHOUER L'ENVOI DU FORMULAIRE. C'est la
// contrainte n°1 de la story, et la décision explicite de Jeevons : « je ne
// veux pas que l'envoi d'un mail conditionne que ça soit utilisable ou pas ».
// Le message est DÉJÀ en base quand cette fonction est appelée ; la notification
// n'est qu'un confort (Jeevons lit de toute façon `/admin/messages`, story
// 5.18). `notifyNewContactMessage` ne rejette donc JAMAIS : elle retourne un
// booléen indicatif et avale tout, y compris une configuration absente.
//
// ⚠️ AUCUN accusé de réception au visiteur (décision Jeevons) : un seul
// courriel part, vers Jeevons. Le visiteur est remercié à l'écran, point. Cela
// évite aussi de transformer le formulaire en relais d'envoi vers des tiers.
//
// ⚠️ Identifiants EXCLUSIVEMENT par variables d'environnement (AGENTS.md §2).
// Les clés `MAIL_*` étaient déjà prévues par la story 2.5 et déclarées dans
// `.env.production.example` — on les consomme, on n'en invente pas de nouvelles.
//
// ⚠️ `nodemailer` est importé DYNAMIQUEMENT : c'est une dépendance serveur
// lourde qui n'a aucune raison d'être chargée au démarrage alors qu'elle ne sert
// qu'au POST d'un formulaire. Même intention qu'en 5.17 pour `pdf-to-img` — et
// même précaution associée : le paquet est déclaré dans `serverExternalPackages`
// (`next.config.mjs`) pour que webpack ne tente pas de le bundler.

/** Délai d'attente de l'envoi. Voir `notifyNewContactMessage`. */
const SEND_TIMEOUT_MS = 8000;

type MailConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
};

/**
 * Lit la configuration SMTP. Retourne `null` — sans jeter — si elle est
 * incomplète : en développement local aucune variable `MAIL_*` n'est définie, et
 * ce n'est pas une panne. Le formulaire doit rester pleinement utilisable.
 */
function readMailConfig(): MailConfig | null {
  const host = process.env.MAIL_HOST?.trim();
  const port = Number.parseInt(process.env.MAIL_PORT?.trim() ?? "", 10);
  const user = process.env.MAIL_USER?.trim();
  const password = process.env.MAIL_PASSWORD?.trim();
  const from = process.env.MAIL_FROM?.trim();

  if (!host || !user || !password || !from || !Number.isFinite(port)) {
    return null;
  }
  return { host, port, user, password, from };
}

/**
 * Destinataire de la notification : l'adresse de Jeevons, recomposée depuis les
 * fragments de `lib/settings.ts`.
 *
 * 🛑 La recomposition a lieu ICI, dans un module `server-only`, et la chaîne ne
 * transite JAMAIS vers le client — c'est ce qui la rend sûre. L'anti-moisson
 * D10 interdit l'adresse en clair dans le HTML SERVI ; elle n'a jamais interdit
 * au serveur de connaître sa propre adresse.
 *
 * ⚠️ `lib/settings.ts` n'est PAS modifié (sa garde de cohérence jette au
 * chargement du module en cas de dérive) : on se contente de le lire.
 */
async function resolveRecipient(): Promise<string | null> {
  try {
    const { email } = await getContactSettings();
    const address = `${email.user.join(".")}@${email.host.join(".")}`;
    // Garde-fou : des fragments vides produiraient « @. », inutile à envoyer.
    return email.user.length > 0 && email.host.length > 0 ? address : null;
  } catch {
    return null;
  }
}

/** Aplati une cause d'erreur sur une seule ligne (discipline `lib/admin/*`). */
function flatten(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw.replace(/\s+/g, " ").trim().slice(0, 300);
}

/**
 * Notifie Jeevons qu'un nouveau message est arrivé.
 *
 * 🛑 NE JETTE JAMAIS. Retourne `true` si le courriel est parti, `false` sinon.
 * L'appelant (la Server Action) ignore délibérément cette valeur pour la
 * réponse au visiteur : elle n'existe que pour la journalisation.
 *
 * ⚠️ Un délai d'attente est posé (`SEND_TIMEOUT_MS`) : un SMTP injoignable peut
 * PENDRE plusieurs dizaines de secondes au niveau TCP. Sans lui, le visiteur
 * attendrait un envoi déjà sans conséquence, alors que son message est en base.
 * Les délais de nodemailer sont doublés d'un `Promise.race`, car ils ne
 * couvrent pas toutes les phases de la connexion.
 *
 * ⚠️ Ce qui est journalisé : la CAUSE, sur une ligne. Jamais les identifiants
 * SMTP, jamais le corps du message (donnée personnelle d'un tiers, AGENTS.md §6).
 */
export async function notifyNewContactMessage(message: {
  name: string;
  email: string;
  body: string;
}): Promise<boolean> {
  try {
    const config = readMailConfig();
    if (!config) {
      console.warn(
        "[contact] Notification ignorée : configuration MAIL_* absente ou incomplète. Le message EST enregistré et consultable dans /admin/messages.",
      );
      return false;
    }

    const to = await resolveRecipient();
    if (!to) {
      console.warn(
        "[contact] Notification ignorée : destinataire introuvable. Le message EST enregistré et consultable dans /admin/messages.",
      );
      return false;
    }

    const nodemailer = (await import("nodemailer")).default;
    const transport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      // 465 = TLS implicite ; les autres ports (587) passent par STARTTLS.
      secure: config.port === 465,
      auth: { user: config.user, pass: config.password },
      connectionTimeout: SEND_TIMEOUT_MS,
      greetingTimeout: SEND_TIMEOUT_MS,
      socketTimeout: SEND_TIMEOUT_MS,
    });

    const send = transport.sendMail({
      from: config.from,
      to,
      // ⚠️ `replyTo` et NON `from` : usurper l'adresse du visiteur dans `from`
      // ferait échouer SPF/DKIM et enverrait le courriel en indésirable. Ici
      // « Répondre » dans le client de messagerie vise bien le visiteur.
      replyTo: message.email,
      subject: `Nouveau message de ${message.name} — portfolio`,
      text: [
        `De : ${message.name} <${message.email}>`,
        "",
        message.body,
        "",
        "—",
        "Message reçu via le formulaire de contact du portfolio.",
      ].join("\n"),
    });

    await Promise.race([
      send,
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`délai dépassé (${SEND_TIMEOUT_MS} ms)`)),
          SEND_TIMEOUT_MS,
        ),
      ),
    ]);

    return true;
  } catch (error) {
    // 🛑 Le `catch` est TOTAL et c'est l'intention : aucune panne d'envoi ne
    // doit remonter jusqu'au visiteur, dont le message est déjà enregistré.
    console.error(
      `[contact] Notification non envoyée — le message EST enregistré. Cause : ${flatten(error)}`,
    );
    return false;
  }
}
