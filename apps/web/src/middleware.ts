import { NextRequest, NextResponse } from "next/server";

/**
 * Optional site-wide access gate.
 *
 * Enabled only when SITE_ACCESS_GATE=true and the chat admin credentials are
 * configured; it reuses the existing chat-access session cookie, so logging
 * in once unlocks both the site and the assistant. Disabled by default —
 * deployments without the env vars behave exactly as before.
 *
 * Runs on the Edge runtime, so hashing uses Web Crypto (node:crypto is not
 * available here).
 */

const SESSION_COOKIE = "chat_access_auth";

const PUBLIC_PATHS = [
  "/login",
  "/api/chat-access",
  "/api/healthz",
  "/robots.txt",
  "/sitemap.xml",
  "/favicon.ico"
];

function isGateEnabled(): boolean {
  if ((process.env.SITE_ACCESS_GATE ?? "false").trim().toLowerCase() !== "true") return false;
  return Boolean(process.env.CHAT_ADMIN_USERNAME && process.env.CHAT_ADMIN_PASSWORD);
}

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

let cachedToken: { key: string; value: string } | null = null;

async function expectedSessionToken(): Promise<string> {
  const key = `${process.env.CHAT_ADMIN_USERNAME}:${process.env.CHAT_ADMIN_PASSWORD}`;
  if (cachedToken?.key === key) return cachedToken.value;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  const value = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  cachedToken = { key, value };
  return value;
}

export async function middleware(request: NextRequest) {
  if (!isGateEnabled()) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  const session = request.cookies.get(SESSION_COOKIE)?.value ?? "";
  if (session && session === (await expectedSessionToken())) {
    return NextResponse.next();
  }

  // API calls get a 401 instead of an HTML redirect.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Skip framework internals and static assets entirely.
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|txt|xml)$).*)"]
};
