import "../styles/globals.css";
import { ReactNode } from "react";
import Link from "next/link";
import { ThemeProvider } from "../components/ThemeProvider";
import { ThemeToggle } from "../components/ThemeToggle";
import { Sidebar } from "../components/Sidebar";
import { MobileHeader } from "../components/MobileHeader";

function TopBar() {
  return (
    <header className="topbar hidden md:block">
      <div className="topbar-content">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-foreground">Category Intelligence Hub</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Live
          </div>
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
        <title>Category Intelligence Hub</title>
      </head>
      <body className="min-h-screen">
        <ThemeProvider>
          <div className="app-layout">
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
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
