// Story 5.2 — Assainit une `callbackUrl` de login (AC3, piège n°3).
//
// Après un login réussi on renvoie l'utilisateur vers la page qu'il demandait.
// Cette valeur vient de la query string : un attaquant pourrait y glisser une
// URL EXTERNE (`https://evil.example`) pour transformer notre login en tremplin
// d'hameçonnage (open-redirect). On n'accepte donc QUE des chemins internes.
//
// Règle : la valeur doit être un chemin absolu du site (`/quelque-chose`) et
// surtout PAS un `//` (URL protocol-relative → externe) ni un schéma. Tout le
// reste retombe sur un défaut interne sûr.

const DEFAULT_CALLBACK = "/admin";

export function safeCallbackUrl(
  raw: string | null | undefined,
  fallback: string = DEFAULT_CALLBACK,
): string {
  if (typeof raw !== "string" || raw.length === 0) return fallback;

  // Doit commencer par un unique "/" (chemin interne). `//x` et `/\x` sont des
  // formes protocol-relative interprétées comme externes par les navigateurs.
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return fallback;

  // Défense supplémentaire : rejeter tout ce qui contient un schéma explicite
  // (ex. une valeur mal décodée `/redirect?url=javascript:...` reste interne au
  // niveau du chemin, mais on refuse les caractères de contrôle et backslashes).
  if (/[\x00-\x1f\\]/.test(raw)) return fallback;

  return raw;
}
