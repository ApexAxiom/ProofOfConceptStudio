"use client";

import { useMemo, useState, FormEvent, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { REGION_LIST } from "@proof/shared";
import { ThemeToggle } from "./ThemeToggle";
import { MobileNav } from "./MobileNav";

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

function MenuIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  );
}

/** Renders the main status bar with mobile navigation toggle. */
export function StatusBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const handleCloseMenu = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  const selectedRegion = useMemo(() => {
    const match = REGION_LIST.find((region) => pathname?.startsWith(`/${region.slug}`));
    return match?.slug ?? "global";
  }, [pathname]);

  const lastUpdated = useMemo(() => {
    return new Date().toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }, []);

  const handleRegionChange = (value: string) => {
    if (value === "global") {
      router.push("/");
      return;
    }
    router.push(`/${value}`);
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = search.trim();
    if (!query) return;
    router.push(`/?q=${encodeURIComponent(query)}`);
  };

  return (
    <>
      <header className="statusbar">
        <div className="statusbar-content">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setIsMenuOpen(true)}
              className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground md:hidden"
              aria-label="Open menu"
            >
              <MenuIcon />
            </button>
            <Link href="/" className="flex items-center gap-3">
              <div className="relative h-9 w-9 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center overflow-hidden">
                <span className="font-display text-base font-bold text-primary">◈</span>
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="font-display text-sm font-semibold text-foreground">Intelligence Hub</span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Executive Scan</span>
              </div>
            </Link>
          </div>

          <div className="statusbar-controls">
            <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground">
              <span className="uppercase tracking-[0.2em] text-[10px]">Last updated</span>
              <span className="font-mono text-foreground">{lastUpdated}</span>
            </div>

            <div className="flex items-center gap-2">
              <label className="sr-only" htmlFor="region-select">
                Region
              </label>
              <select
                id="region-select"
                value={selectedRegion}
                onChange={(event) => handleRegionChange(event.target.value)}
                className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground"
              >
                <option value="global">Global</option>
                {REGION_LIST.map((region) => (
                  <option key={region.slug} value={region.slug}>
                    {region.label}
                  </option>
                ))}
              </select>
              <LiveIndicator />
            </div>

            <form onSubmit={handleSearchSubmit} className="hidden md:flex items-center gap-2">
              <div className="relative">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search briefs & keywords"
                  className="w-56 rounded-md border border-border bg-background py-1.5 pl-9 pr-3 text-xs text-foreground"
                />
              </div>
              <button type="submit" className="btn-ghost text-xs py-1.5 px-3">
                Search
              </button>
            </form>

            <ThemeToggle />
          </div>
        </div>
      </header>

      <MobileNav isOpen={isMenuOpen} onClose={handleCloseMenu} />
    </>
  );
}
