import { initializeSecrets } from "./secrets";

const FALLBACK_API_BASE_URL = "http://localhost:3001";

/**
 * Resolve the API base URL after loading secrets (if configured).
 */
export async function getApiBaseUrl(): Promise<string> {
  await initializeSecrets();
  return process.env.API_BASE_URL ?? FALLBACK_API_BASE_URL;
}
