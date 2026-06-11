"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { type ReactNode } from "react";

interface ThemeProviderProps {
  children: ReactNode;
}

/**
 * Provides theme context with a light default.
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
