"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { REGION_LIST } from "@proof/shared";
import { AskAiLink } from "../chat/ChatPinGate";

function TodayIcon({ active }: { active: boolean }) {
  return (
    <svg className="h-5 w-5" fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.15 : 0} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
    </svg>
  );
}

function PortfoliosIcon({ active }: { active: boolean }) {
  return (
    <svg className="h-5 w-5" fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.15 : 0} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6a1.125 1.125 0 01-1.125-1.125v-3.75zM14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-8.25zM3.75 16.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-2.25z" />
    </svg>
  );
}

function ActionsIcon({ active }: { active: boolean }) {
  return (
    <svg className="h-5 w-5" fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.15 : 0} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  );
}

function AssistantIcon({ active }: { active: boolean }) {
  return (
    <svg className="h-5 w-5" fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.15 : 0} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
    </svg>
  );
}

const tabs = [
  { href: "/", label: "Today", icon: TodayIcon, match: (p: string) => p === "/" },
  { href: "/portfolios", label: "Portfolios", icon: PortfoliosIcon, match: (p: string) => p.startsWith("/portfolio") },
  { href: `/actions/${REGION_LIST[0].slug}`, label: "Actions", icon: ActionsIcon, match: (p: string) => p.startsWith("/actions") },
  { href: "/chat", label: "Assistant", icon: AssistantIcon, match: (p: string) => p.startsWith("/chat") }
];

/**
 * One-thumb primary navigation on small screens. Hidden at md+ where the top
 * nav and sidebar take over.
 */
export function BottomTabBar() {
  const pathname = usePathname() ?? "/";

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary"
    >
      <div className="grid grid-cols-4">
        {tabs.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;
          const className = `flex flex-col items-center gap-1 py-2.5 transition-colors ${
            active ? "text-primary" : "text-muted-foreground active:text-foreground"
          }`;
          const content = (
            <>
              <Icon active={active} />
              <span className="text-[10px] font-semibold tracking-wide">{tab.label}</span>
            </>
          );
          return tab.href === "/chat" ? (
            <AskAiLink
              key={tab.href}
              href={tab.href}
              className={className}
              ariaCurrent={active ? "page" : undefined}
            >
              {content}
            </AskAiLink>
          ) : (
            <Link
              key={tab.href}
              href={tab.href}
              className={className}
              aria-current={active ? "page" : undefined}
            >
              {content}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
