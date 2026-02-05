import { ReactNode } from "react";
import { TopNav } from "./TopNav";
import { Sidebar } from "./Sidebar";

/**
 * Provides the primary application shell with navigation and layout scaffolding.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopNav />
      <div className="flex min-h-[calc(100vh-64px)]">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="mx-auto w-full max-w-[1280px] px-6 py-8 lg:px-10">
            {children}
          </main>
          <footer className="border-t border-border px-6 py-6 lg:px-10">
            <div className="mx-auto flex max-w-[1280px] flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <span className="font-display text-primary">◈</span>
                <span>Category Intelligence Hub</span>
                <span className="text-border">•</span>
                <span>Executive and category manager intelligence</span>
              </div>
              <div className="flex items-center gap-3">
                <span>Hourly market refresh</span>
                <span className="text-border">|</span>
                <span>Daily brief coverage checks</span>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
