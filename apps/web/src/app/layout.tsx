import "../styles/globals.css";
import { ReactNode } from "react";
import Link from "next/link";
import { ThemeProvider } from "../components/ThemeProvider";
import { ThemeToggle } from "../components/ThemeToggle";
import { Sidebar } from "../components/Sidebar";
import { MobileHeader } from "../components/MobileHeader";

function LiveIndicator() {
  return (
    <div className="flex items-center gap-2 rounded-full bg-amber-500/10 border border-amber-500/20 px-3 py-1.5">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
      </span>
      <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Live / Estimated</span>
    </div>
  );
}

function TopBar() {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  return (
    <header className="topbar hidden md:block">
      <div className="topbar-content">
        <div className="flex items-center gap-6">
          {/* Editorial-style date & title */}
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{today}</span>
            <h1 className="font-display text-xl font-semibold text-foreground tracking-tight">Intelligence Hub</h1>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Live Market Status */}
          <LiveIndicator />
          
          {/* Premium divider */}
          <div className="h-8 w-px bg-border" />
          
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

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
              {/* Mobile Header */}
              <MobileHeader />
              
              {/* Desktop Top Bar */}
              <TopBar />
              
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
                    <span>Powered by AI Market Analysis</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-mono">v1.0</span>
                    <span className="text-border">|</span>
                    <span>Updated every 15 minutes</span>
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
