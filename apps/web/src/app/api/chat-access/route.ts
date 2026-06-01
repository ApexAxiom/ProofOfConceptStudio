import { NextResponse } from "next/server";
import {
  buildChatSessionToken,
  CHAT_ACCESS_COOKIE,
  CHAT_ACCESS_MAX_AGE_SECONDS,
  getChatAccessConfig,
  getChatAccessState
} from "../../../lib/server/chat-access";

/**
 * Returns current chat access authentication state.
 */
export async function GET() {
  return NextResponse.json(await getChatAccessState());
}

/**
 * Authenticates an admin user for chat access and sets a session cookie.
 */
export async function POST(req: Request) {
  const config = getChatAccessConfig();
  if (!config) {
    return NextResponse.json({ authenticated: true, configured: false });
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
  const sessionToken = buildChatSessionToken(config.username, config.password);
  res.cookies.set({
    name: CHAT_ACCESS_COOKIE,
    value: sessionToken,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CHAT_ACCESS_MAX_AGE_SECONDS
  });

  return res;
}
