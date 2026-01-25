import "../styles/globals.css";
import { ReactNode } from "react";
import { ThemeProvider } from "../components/ThemeProvider";
import { AppShell } from "../components/shell/AppShell";

/**
 * Root layout for the Intelligence Hub application.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0f1117" />
        <title>Intelligence Hub | Category Market Intelligence</title>
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>◈</text></svg>"
        />
      </head>
      <body className="min-h-screen">
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
