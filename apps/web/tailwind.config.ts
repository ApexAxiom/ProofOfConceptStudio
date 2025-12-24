import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["DM Sans", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"]
      },
      colors: {
        // Core background colors
        surface: {
          primary: "#0a0f1a",
          secondary: "#111827",
          tertiary: "#1e293b",
          elevated: "#1e2a3b"
        },
        // Accent colors
        accent: {
          primary: "#3b82f6",
          secondary: "#8b5cf6",
          success: "#10b981",
          warning: "#f59e0b",
          danger: "#ef4444",
          cyan: "#06b6d4"
        },
        // Category-specific colors
        category: {
          energy: "#f59e0b",
          steel: "#6b7280",
          freight: "#06b6d4",
          services: "#8b5cf6",
          cyber: "#10b981",
          facility: "#ec4899"
        }
      },
      backgroundImage: {
        "gradient-primary": "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
        "gradient-card": "linear-gradient(145deg, #141d2b 0%, #0d1420 100%)",
        "gradient-glow": "radial-gradient(ellipse at center, rgba(59, 130, 246, 0.15) 0%, transparent 70%)"
      },
      boxShadow: {
        card: "0 4px 20px -2px rgba(0, 0, 0, 0.5), 0 0 40px -10px rgba(59, 130, 246, 0.1)",
        elevated: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
        glow: "0 0 40px rgba(59, 130, 246, 0.2)",
        "glow-sm": "0 0 20px rgba(59, 130, 246, 0.15)"
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        shimmer: "shimmer 1.5s infinite"
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" }
        }
      }
    }
  },
  plugins: [typography]
};

export default config;
