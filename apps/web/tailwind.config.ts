import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Sora", "system-ui", "sans-serif"],
        display: ["Playfair Display", "Georgia", "serif"],
        mono: ["IBM Plex Mono", "monospace"]
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
        
        // Premium accent colors
        gold: {
          DEFAULT: "hsl(var(--gold))",
          muted: "hsl(var(--gold-muted))"
        },
        silver: "hsl(var(--silver))",
        bronze: "hsl(var(--bronze))",
        
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
        card: "0 1px 3px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(255, 255, 255, 0.02) inset",
        elevated: "0 8px 30px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.05) inset",
        glow: "0 0 30px rgba(212, 175, 55, 0.15)",
        "glow-lg": "0 0 60px rgba(212, 175, 55, 0.2)",
        premium: "0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(212, 175, 55, 0.1)"
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        shimmer: "shimmer 2s infinite",
        float: "float 3s ease-in-out infinite",
        "reveal-up": "reveal-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "ticker-scroll": "ticker-scroll 60s linear infinite",
        "fade-in": "fade-in 0.3s ease-out",
        "slide-in": "slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite"
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" }
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" }
        },
        "reveal-up": {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" }
        },
        "ticker-scroll": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" }
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" }
        },
        "slide-in": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" }
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "1", boxShadow: "0 0 8px rgba(52, 211, 153, 0.6)" },
          "50%": { opacity: "0.7", boxShadow: "0 0 16px rgba(52, 211, 153, 0.8)" }
        }
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "gradient-gold": "linear-gradient(135deg, hsl(43, 74%, 49%) 0%, hsl(43, 90%, 65%) 50%, hsl(43, 74%, 49%) 100%)"
      },
      typography: {
        DEFAULT: {
          css: {
            "--tw-prose-body": "hsl(var(--foreground))",
            "--tw-prose-headings": "hsl(var(--foreground))",
            "--tw-prose-links": "hsl(var(--primary))",
            "--tw-prose-bold": "hsl(var(--foreground))",
            "--tw-prose-counters": "hsl(var(--muted-foreground))",
            "--tw-prose-bullets": "hsl(var(--primary))",
            "--tw-prose-quotes": "hsl(var(--foreground))",
            "--tw-prose-code": "hsl(var(--primary))",
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
