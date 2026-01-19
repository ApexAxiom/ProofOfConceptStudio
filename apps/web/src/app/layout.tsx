import "../styles/globals.css";
import { ReactNode } from "react";
import Link from "next/link";
import { ThemeProvider } from "../components/ThemeProvider";
import { Sidebar } from "../components/Sidebar";
import { StatusBar } from "../components/StatusBar";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0f1117" />
        <title>Intelligence Hub | Category Market Intelligence</title>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>◈</text></svg>" />
      </head>
      <body className="min-h-screen">
        <ThemeProvider>
          {/* Premium background effects */}
          <div className="fixed inset-0 bg-mesh pointer-events-none opacity-50" aria-hidden="true" />
          
          <div className="app-layout relative">
            {/* Desktop Sidebar */}
            <Sidebar />
            
            {/* Main Content Area */}
            <div className="main-wrapper">
              <StatusBar />
              
              {/* Page Content */}
              <main className="main-content">
                {children}
              </main>
              
              {/* Footer */}
              <footer className="border-t border-border px-6 py-6 lg:px-8">
                <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-primary">◈</span>
                    <span>Category Intelligence Hub</span>
                    <span className="text-border">•</span>
                    <span>Powered by ApexAxiom</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-mono">v0.1</span>
                    <span className="text-border">|</span>
                    <span>Updated daily</span>
                  </div>
                </div>
              </footer>
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
