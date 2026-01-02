"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";
import { MobileNav } from "./MobileNav";

function MenuIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  );
}

export function MobileHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleClose = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  return (
    <>
      <header className="mobile-header md:hidden">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsMenuOpen(true)}
            className="p-2 -ml-2 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            aria-label="Open menu"
          >
            <MenuIcon />
          </button>
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
              <span className="font-display text-sm font-bold text-primary">◈</span>
            </div>
            <div className="flex flex-col">
              <span className="font-display text-sm font-semibold text-foreground">Intelligence</span>
            </div>
          </Link>
        </div>
        <div className="flex items-center gap-3">
          {/* Live indicator */}
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-1">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400">Live</span>
          </div>
          <ThemeToggle />
        </div>
      </header>
      
      <MobileNav isOpen={isMenuOpen} onClose={handleClose} />
    </>
  );
}
