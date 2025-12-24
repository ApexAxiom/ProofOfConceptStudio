import "../styles/globals.css";
import { ReactNode } from "react";
import Link from "next/link";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-100 text-slate-900">
        <header className="sticky top-0 z-20 border-b bg-white/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Proof of Concept Studio</p>
              <h1 className="text-xl font-semibold text-slate-900">Category Management Intelligence Hub</h1>
              <p className="text-sm text-slate-600">Concise daily briefs with citations and sources.</p>
            </div>
            <nav className="flex items-center gap-3 text-sm font-semibold">
              <Link className="rounded-full border border-slate-200 px-3 py-1.5 text-slate-800 hover:border-slate-300" href="/">
                Home
              </Link>
              <Link className="rounded-full border border-slate-200 px-3 py-1.5 text-slate-800 hover:border-slate-300" href="/chat">
                Chat
              </Link>
              <Link className="rounded-full border border-slate-200 px-3 py-1.5 text-slate-800 hover:border-slate-300" href="/admin">
                Admin
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto min-h-screen max-w-6xl px-6 py-6 space-y-6">{children}</main>
        <footer className="border-t bg-white/70 text-sm text-slate-600">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <span>Built for procurement teams. All data requires citations.</span>
            <span className="text-xs">Listening on all regions with timezone-aware runs.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
