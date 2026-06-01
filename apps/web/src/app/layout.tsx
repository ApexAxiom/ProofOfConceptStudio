import "../styles/globals.css";
import type { Metadata, Viewport } from "next";
import { ReactNode } from "react";
import { ThemeProvider } from "../components/ThemeProvider";
import { AppShell } from "../components/shell/AppShell";

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
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen">
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
