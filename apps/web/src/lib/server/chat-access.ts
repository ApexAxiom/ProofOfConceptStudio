import crypto from "node:crypto";
import { cookies } from "next/headers";

export const CHAT_ACCESS_COOKIE = "chat_access_auth";
export const CHAT_ACCESS_MAX_AGE_SECONDS = 60 * 60 * 12;

type ChatAccessConfig = {
  username: string;
  password: string;
};

export function getChatAccessConfig(): ChatAccessConfig | null {
  const username = process.env.CHAT_ADMIN_USERNAME;
  const password = process.env.CHAT_ADMIN_PASSWORD;

  if (!username || !password) {
    return null;
  }

  return { username, password };
}

export function buildChatSessionToken(username: string, password: string) {
  return crypto.createHash("sha256").update(`${username}:${password}`).digest("hex");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export async function getChatAccessState() {
  const config = getChatAccessConfig();
  if (!config) {
    return { authenticated: true, configured: false };
  }

  const cookieStore = await cookies();
  const session = cookieStore.get(CHAT_ACCESS_COOKIE)?.value ?? "";
  const expected = buildChatSessionToken(config.username, config.password);

  return {
    authenticated: safeEqual(session, expected),
    configured: true
  };
}
