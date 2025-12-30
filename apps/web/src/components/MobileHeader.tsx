"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";
import { MobileNav } from "./MobileNav";

function MenuIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
            className="p-2 -ml-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Open menu"
          >
            <MenuIcon />
          </button>
          <Link href="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="text-primary font-bold text-xs">W</span>
            </div>
            <span className="font-semibold text-foreground text-sm">Intelligence Hub</span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            Live
          </div>
          <ThemeToggle />
        </div>
      </header>
      
      <MobileNav isOpen={isMenuOpen} onClose={handleClose} />
    </>
  );
}
