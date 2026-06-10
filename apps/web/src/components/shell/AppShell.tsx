import { ReactNode } from "react";
import { TopNav } from "./TopNav";
import { Sidebar } from "./Sidebar";
import { BottomTabBar } from "./BottomTabBar";
import { BrandMark } from "./BrandMark";

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
          <main className="w-full max-w-[1280px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
            {children}
          </main>
          {/* Bottom padding on mobile keeps the footer clear of the tab bar. */}
          <footer className="mt-auto border-t border-border px-4 py-6 pb-24 sm:px-6 md:pb-6 lg:px-10">
            <div className="flex w-full max-w-[1280px] flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <BrandMark size={20} />
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
      <BottomTabBar />
    </div>
  );
}
