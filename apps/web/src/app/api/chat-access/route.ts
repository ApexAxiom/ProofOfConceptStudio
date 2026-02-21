import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const CHAT_ACCESS_COOKIE = "chat_access_auth";
const MAX_AGE_SECONDS = 60 * 60 * 12;

const getConfig = () => {
  const username = process.env.CHAT_ADMIN_USERNAME;
  const password = process.env.CHAT_ADMIN_PASSWORD;

  if (!username || !password) {
    return null;
  }

  return { username, password };
};

const buildSessionToken = (username: string, password: string) =>
  crypto.createHash("sha256").update(`${username}:${password}`).digest("hex");

const isAuthorized = async () => {
  const config = getConfig();
  if (!config) return false;

  const cookieStore = await cookies();
  const session = cookieStore.get(CHAT_ACCESS_COOKIE)?.value;
  const expected = buildSessionToken(config.username, config.password);
  return session === expected;
};

/**
 * Returns current chat access authentication state.
 */
export async function GET() {
  const config = getConfig();
  if (!config) {
    return NextResponse.json({ authenticated: false, configured: false }, { status: 503 });
  }

  const authenticated = await isAuthorized();
  return NextResponse.json({ authenticated, configured: true });
}

/**
 * Authenticates an admin user for chat access and sets a session cookie.
 */
export async function POST(req: Request) {
  const config = getConfig();
  if (!config) {
    return NextResponse.json({ error: "chat access login is not configured" }, { status: 503 });
  }

  let payload: { username?: string; password?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  const isValid = payload.username === config.username && payload.password === config.password;
  if (!isValid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const res = NextResponse.json({ authenticated: true });
  const sessionToken = buildSessionToken(config.username, config.password);
  res.cookies.set({
    name: CHAT_ACCESS_COOKIE,
    value: sessionToken,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS
  });

  return res;
}
