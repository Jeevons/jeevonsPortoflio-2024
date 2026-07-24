// Story 5.1 — Handler de route Auth.js v5. Toute la config vit dans
// src/lib/auth.ts (source unique) ; on n'expose ici que les handlers GET/POST
// exigés par Next App Router.
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
