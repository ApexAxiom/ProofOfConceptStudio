import "../styles/globals.css";
import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Playfair_Display, Sora } from "next/font/google";
import { ReactNode } from "react";
import { ThemeProvider } from "../components/ThemeProvider";
import { AppShell } from "../components/shell/AppShell";

// Self-hosted via next/font so fonts load same-origin and comply with the
// strict CSP (style-src/font-src 'self') instead of a runtime Google Fonts
// import, which the CSP blocks.
const sora = Sora({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap"
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap"
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
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
  },
  icons: {
    icon: "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>◈</text></svg>"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f1117"
};

/**
 * Root layout for the Intelligence Hub application.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sora.variable} ${playfair.variable} ${plexMono.variable}`}>
      <body className="min-h-screen">
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
