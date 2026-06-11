"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { type ReactNode } from "react";

interface ThemeProviderProps {
  children: ReactNode;
}

/**
 * Provides theme context with a light default.
 *
 * storageKey is versioned so the redesign's light default overrides theme
 * preferences saved under the old dark-first design; the toggle still works
 * and choices made from here on persist under the new key.
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      storageKey="ih-theme-v2"
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
