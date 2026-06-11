import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "IBM Plex Mono", "monospace"]
      },
      colors: {
        // Token-based colors (CSS variable driven)
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
          elevated: "hsl(var(--card-elevated))"
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))"
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))"
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))"
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))"
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))"
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))"
        },
        border: {
          DEFAULT: "hsl(var(--border))",
          subtle: "hsl(var(--border-subtle))"
        },
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",

        // Signal colors
        positive: "hsl(var(--positive))",
        negative: "hsl(var(--negative))",
        warning: "hsl(var(--warning))",

        // Category-specific colors
        category: {
          energy: "var(--category-energy)",
          steel: "var(--category-steel)",
          freight: "var(--category-freight)",
          services: "var(--category-services)",
          cyber: "var(--category-cyber)",
          facility: "var(--category-facility)"
        }
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)"
      },
      boxShadow: {
        card: "0 1px 2px rgba(0, 0, 0, 0.05)",
        elevated: "0 4px 16px rgba(0, 0, 0, 0.08)"
      },
      animation: {
        "fade-in": "fade-in 0.3s ease-out"
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" }
        }
      },
      typography: {
        DEFAULT: {
          css: {
            "--tw-prose-body": "hsl(var(--foreground))",
            "--tw-prose-headings": "hsl(var(--foreground))",
            "--tw-prose-links": "hsl(var(--primary))",
            "--tw-prose-bold": "hsl(var(--foreground))",
            "--tw-prose-counters": "hsl(var(--muted-foreground))",
            "--tw-prose-bullets": "hsl(var(--muted-foreground))",
            "--tw-prose-quotes": "hsl(var(--foreground))",
            "--tw-prose-code": "hsl(var(--foreground))",
            "--tw-prose-hr": "hsl(var(--border))",
            "--tw-prose-th-borders": "hsl(var(--border))"
          }
        }
      }
    }
  },
  plugins: [typography]
};

export default config;
