import "../styles/globals.css";
import { ReactNode } from "react";
import Link from "next/link";

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg shadow-blue-500/20">
        <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <div className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface-primary bg-emerald-400" />
      </div>
      <div>
        <h1 className="text-lg font-bold text-white">POC Studio</h1>
        <p className="text-xs font-medium text-slate-400">Category Intelligence Hub</p>
      </div>
    </div>
  );
}

function NavLink({ href, children, icon }: { href: string; children: ReactNode; icon: ReactNode }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-2.5 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-300 transition-all duration-200 hover:bg-slate-800/60 hover:text-white"
    >
      <span className="text-slate-500 transition-colors group-hover:text-blue-400">{icon}</span>
      {children}
    </Link>
  );
}

function DashboardIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function LiveIndicator() {
  return (
    <div className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      Live Updates
    </div>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>POC Studio | Category Intelligence Hub</title>
      </head>
      <body className="min-h-screen antialiased">
        {/* Header */}
        <header className="glass sticky top-0 z-50 border-b border-slate-800/50">
          <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-3">
            <div className="flex items-center gap-8">
              <Logo />
              <nav className="hidden items-center gap-1 md:flex">
                <NavLink href="/" icon={<DashboardIcon />}>Dashboard</NavLink>
                <NavLink href="/chat" icon={<ChatIcon />}>AI Assistant</NavLink>
                <NavLink href="/admin" icon={<SettingsIcon />}>Admin</NavLink>
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <LiveIndicator />
              <div className="hidden h-8 w-px bg-slate-700 lg:block" />
              <div className="hidden items-center gap-3 lg:flex">
                <div className="text-right">
                  <p className="text-sm font-medium text-white">Category Manager</p>
                  <p className="text-xs text-slate-400">Procurement Intel</p>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-sm font-bold text-white">
                  CM
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="mx-auto min-h-[calc(100vh-140px)] max-w-[1600px] px-6 py-8">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-800/50 bg-surface-primary/80">
          <div className="mx-auto flex max-w-[1600px] flex-col items-center justify-between gap-4 px-6 py-6 md:flex-row">
            <div className="flex items-center gap-6">
              <span className="text-sm text-slate-400">
                Built for procurement teams • All data requires citations
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="status-dot live" />
                Listening on all regions
              </span>
              <span>•</span>
              <span>Timezone-aware runs</span>
              <span>•</span>
              <span className="font-mono">v1.0.0</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
