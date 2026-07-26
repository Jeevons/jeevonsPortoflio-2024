import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/sections/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    screens: {
      sm: "375px",
      md: "768px",
      lg: "1200px",
    },
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        md: "2rem",
      },
    },
    extend: {
      fontFamily: {
        sans: "var(--font-sans)",
        serif: "var(--font-serif)",
      },
      // Story 6.3 (AC1) — Échelle typographique fluide, définie en `clamp()`
      // dans `globals.css`.
      //
      // ⚠️ CLÉS NOUVELLES uniquement (`display-1`…`display-4`). Redéfinir
      // `3xl`/`5xl`/`6xl` déborderait sur l'admin, qui utilise `text-3xl`
      // (`components/admin/stat-card.tsx`) — d'où l'avertissement « extension
      // uniquement » ci-dessous, qui vaut aussi pour `fontSize`.
      fontSize: {
        "display-1": "var(--text-display-1)",
        "display-2": "var(--text-display-2)",
        "display-3": "var(--text-display-3)",
        "display-4": "var(--text-display-4)",
      },
      // Story 5.7 — Tokens shadcn/ui, définis en HSL dans `globals.css`.
      // `<alpha-value>` est le placeholder Tailwind : il rend `bg-card/50`
      // fonctionnel, ce qu'un simple `var(--card)` ne permettrait pas.
      //
      // ⚠️ Ajout PAR EXTENSION uniquement : les couleurs Tailwind par défaut
      // (gray-900, emerald-300…) dont dépend tout le site public restent
      // disponibles. Ne jamais remplacer `theme.colors` ici.
      colors: {
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
        },
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },

        // Story 6.1 — Tokens du SITE PUBLIC (définis dans `globals.css`).
        //
        // ⚠️ Ces surfaces sont VOLONTAIREMENT distinctes de `background`/`card`
        // ci-dessus : ces derniers ne portent pas les valeurs publiques
        // (gray-900/gray-800), cf. le commentaire détaillé dans `globals.css`.
        // Les réutiliser ici changerait le rendu du site — ce que l'AC2 interdit.
        surface: {
          DEFAULT: "hsl(var(--surface) / <alpha-value>)",
          raised: "hsl(var(--surface-raised) / <alpha-value>)",
          sunken: "hsl(var(--surface-sunken) / <alpha-value>)",
        },
        // Bornes du dégradé d'accent, la signature visuelle du site.
        // Nommées `accent-from`/`accent-to` et non `accent-*` pour ne pas
        // entrer en collision avec le `accent` shadcn déjà défini plus haut.
        "accent-from": "hsl(var(--accent-from) / <alpha-value>)",
        "accent-to": "hsl(var(--accent-to) / <alpha-value>)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        // Story 6.1 — rayons du site public. Ajout par extension : les rayons
        // Tailwind par défaut (`rounded-3xl`, `rounded-full`…) restent intacts.
        card: "var(--radius-card)",
        control: "var(--radius-control)",
        badge: "var(--radius-badge)",
      },
      animation: {
        "ping-large": "ping-large 1s cubic-bezier(0, 0, 0.2, 1) infinite",
        "move-left": "move-left 1s linear infinite",
        "move-right": "move-right 1s linear infinite",
      },
      keyframes: {
        "ping-large": {
          "75%, 100%": {
            transform: "scale(3)",
            opacity: "0",
          },
        },
        "move-left": {
          "0%": {
            transform: "translateX(0%)",
          },
          "100%": {
            transform: "translateX(-50%)",
          },
        },
        "move-right": {
          "0%": {
            transform: "translateX(-50%)",
          },
          "100%": {
            transform: "translateX(-0%)",
          },
        },
      },
    },
  },
  plugins: [tailwindcssAnimate],
};
export default config;
