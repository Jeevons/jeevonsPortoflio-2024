import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://portfolio.doshwork.com";

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Le back-office arrive à l'Epic 5 : la règle est posée par anticipation.
      // Story 5.11 — `/preview` est la surface d'aperçu des brouillons. Elle ne
      // sert aucun contenu non publié sans session (la garde est côté serveur),
      // mais elle n'a rien à faire dans un index : elle duplique la home pour
      // les moteurs, et son référencement exposerait l'existence de l'aperçu.
      disallow: ["/admin", "/preview"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
