"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { REGION_LIST } from "@proof/shared";

const primaryNav = [
  { href: "/", label: "Morning Scan" },
  { href: "/portfolios", label: "My Portfolios" },
  { href: `/actions/${REGION_LIST[0].slug}`, label: "Action Center" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/chat", label: "Assistant" }
];

const utilityNav = [{ href: "/admin", label: "Admin" }];

const isActivePath = (pathname: string, href: string) => {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
};

/**
 * Renders the top navigation bar for primary destinations.
 */
export function TopNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-4 px-6 lg:px-10">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-primary">
            ◈
          </span>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-foreground">Intelligence Hub</p>
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Market signals</p>
          </div>
        </Link>

        <nav className="flex flex-1 items-center gap-2 overflow-x-auto text-sm">
          {primaryNav.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition-colors ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          {utilityNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-full border border-border px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground ${
                isActivePath(pathname, item.href) ? "bg-secondary text-foreground" : ""
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}
