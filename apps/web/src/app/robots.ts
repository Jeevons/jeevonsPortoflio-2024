import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://portfolio.doshwork.com";

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Le back-office arrive à l'Epic 5 : la règle est posée par anticipation.
      disallow: "/admin",
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
