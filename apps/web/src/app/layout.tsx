import "../styles/globals.css";
import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Inter, Source_Serif_4 } from "next/font/google";
import { ReactNode } from "react";
import { ThemeProvider } from "../components/ThemeProvider";
import { AppShell } from "../components/shell/AppShell";

// Self-hosted via next/font so fonts load same-origin and comply with the
// strict CSP (style-src/font-src 'self') instead of a runtime Google Fonts
// import, which the CSP blocks. Kept to three families with few weights to
// minimise font payload.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap"
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-display",
  display: "swap"
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap"
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "https://proofofconceptstudio.com";
const siteName = "ProofOfConceptStudio";
const description =
  "Category market intelligence for procurement teams, covering energy, logistics, materials, services, cyber, and facilities portfolios.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: siteName,
  title: {
    default: "Intelligence Hub | Category Market Intelligence",
    template: "%s | Category Market Intelligence"
  },
  description,
  openGraph: {
    type: "website",
    url: "/",
    siteName,
    title: "Intelligence Hub | Category Market Intelligence",
    description
  },
  robots: {
    index: true,
    follow: true
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#faf9f5"
};

/**
 * Root layout for the Intelligence Hub application.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${sourceSerif.variable} ${plexMono.variable}`}>
      <body className="min-h-screen">
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
