import Link from "next/link";
import { RegionSlug } from "@proof/shared";
import { PortfolioNav } from "./PortfolioNav";

type TabValue = "overview" | "briefs" | "sources";

interface PortfolioPageTabsProps {
  region: RegionSlug;
  portfolio: string;
  activeTab: TabValue;
}

export function PortfolioPageTabs({ region, portfolio, activeTab }: PortfolioPageTabsProps) {
  const base = `/${region}/${portfolio}`;
  const linkFor = (tab: TabValue) => (tab === "overview" ? base : `${base}?tab=${tab}`);

  const tabs: { value: TabValue; label: string }[] = [
    { value: "overview", label: "Overview" },
    { value: "briefs", label: "Briefs" },
    { value: "sources", label: "Sources" },
  ];

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      {/* Tab Switcher */}
      <div className="inline-flex rounded-lg border border-border bg-card p-1">
        {tabs.map((tab) => (
          <Link
            key={tab.value}
            href={linkFor(tab.value)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab.value
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Category Switcher Dropdown */}
      <details className="relative group">
        <summary className="btn-secondary text-xs cursor-pointer list-none select-none">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
          </svg>
          Switch category
        </summary>
        <div className="absolute right-0 z-20 mt-2 w-[min(720px,92vw)] rounded-lg border border-border bg-card p-4 shadow-lg">
          <PortfolioNav region={region} activePortfolio={portfolio} />
        </div>
      </details>
    </div>
  );
}
