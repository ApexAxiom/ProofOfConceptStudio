import "../styles/globals.css";
import { ReactNode } from "react";
import Link from "next/link";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="px-6 py-4 border-b flex justify-between items-center bg-white">
          <div>
            <h1 className="text-2xl font-semibold">Category Management Intelligence Hub</h1>
            <p className="text-sm text-gray-600">Internal prototype – citations required</p>
          </div>
          <nav className="space-x-4 text-sm">
            <Link href="/">Home</Link>
            <Link href="/admin">Admin</Link>
            <Link href="/chat">Chat</Link>
          </nav>
        </header>
        <main className="px-6 py-6 bg-gray-50 min-h-screen">{children}</main>
        <footer className="px-6 py-4 border-t text-sm text-gray-600">Built for procurement teams. All data requires citations.</footer>
      </body>
    </html>
  );
}
