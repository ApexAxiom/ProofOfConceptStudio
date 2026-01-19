"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PORTFOLIOS, categoryForPortfolio, CATEGORY_META, REGION_LIST } from "@proof/shared";

function DashboardIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function ActionIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

export function MobileNav({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const defaultActionCenter = REGION_LIST[0].slug;
  const groupedPortfolios = Object.values(CATEGORY_META).map((category) => ({
    category,
    portfolios: PORTFOLIOS.filter((portfolio) => categoryForPortfolio(portfolio.slug) === category.id)
  }));

  // Close on route change
  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div 
        className="mobile-nav-overlay"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Drawer */}
      <div className="mobile-nav-drawer">
        <div className="mobile-nav-header">
          <Link href="/" className="flex items-center gap-3" onClick={onClose}>
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
              <span className="font-display text-base font-bold text-primary">◈</span>
            </div>
            <div className="flex flex-col">
              <span className="font-display text-sm font-semibold text-foreground">Intelligence</span>
              <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-primary">Market Hub</span>
            </div>
          </Link>
          <button 
            onClick={onClose} 
            className="p-2 -mr-2 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <CloseIcon />
          </button>
        </div>

        <nav className="mobile-nav-content">
          <Link
            href="/"
            onClick={onClose}
            className={`mobile-nav-link ${pathname === "/" ? "active" : ""}`}
          >
            <DashboardIcon />
            <span>Executive View</span>
          </Link>
          <Link
            href={`/actions/${defaultActionCenter}`}
            onClick={onClose}
            className={`mobile-nav-link ${pathname?.startsWith("/actions") ? "active" : ""}`}
          >
            <ActionIcon />
            <span>Action Center</span>
          </Link>

          <div className="mobile-nav-section">
            <span className="mobile-nav-section-title flex items-center gap-2">
              <span className="text-primary/60">◈</span>
              Categories
            </span>
            <div className="space-y-3">
              {groupedPortfolios.map(({ category, portfolios }) => (
                <div key={category.id} className="space-y-2">
                  <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: category.color }} />
                    {category.label}
                  </div>
                  <div className="space-y-1">
                    {portfolios.map((portfolio) => {
                      const isActive = pathname === `/portfolio/${portfolio.slug}`;

                      return (
                        <Link
                          key={portfolio.slug}
                          href={`/portfolio/${portfolio.slug}`}
                          onClick={onClose}
                          className={`mobile-nav-category ${isActive ? "active" : ""}`}
                        >
                          <span 
                            className="h-2 w-2 rounded-full flex-shrink-0 transition-transform" 
                            style={{ 
                              backgroundColor: category.color,
                              boxShadow: isActive ? `0 0 8px ${category.color}60` : 'none'
                            }}
                          />
                          <span className="truncate">{portfolio.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mobile-nav-section mt-auto pt-6 border-t border-border">
            <Link
              href="/chat"
              onClick={onClose}
              className={`mobile-nav-link ${pathname === "/chat" ? "active" : ""}`}
            >
              <ChatIcon />
              <span>AI Assistant</span>
              <span className="ml-auto text-[9px] font-semibold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded">Beta</span>
            </Link>
            <Link
              href="/admin"
              onClick={onClose}
              className={`mobile-nav-link ${pathname === "/admin" ? "active" : ""}`}
            >
              <SettingsIcon />
              <span>Admin</span>
            </Link>
          </div>
        </nav>
      </div>
    </>
  );
}
