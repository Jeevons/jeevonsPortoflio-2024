import type { Metadata } from "next";
import { Calistoga, Inter } from "next/font/google";
import { twMerge } from "tailwind-merge";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const calistoga = Calistoga({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["400"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://portfolio.doshwork.com";

const siteTitle = "Jeevons Eya — Développeur web";
const siteDescription =
  "Portfolio de Jeevons Eya, développeur web. Découvrez mes projets, mon parcours et mes compétences.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: siteTitle,
  description: siteDescription,
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    type: "website",
    locale: "fr_FR",
    siteName: "Jeevons Eya",
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body
        className={twMerge(
          inter.variable,
          calistoga.variable,
          // Story 6.1 — `bg-surface` = token du fond de page (gray-900).
          "bg-surface text-white antialiased font-sans",
        )}
      >
        {children}
      </body>
    </html>
  );
}
