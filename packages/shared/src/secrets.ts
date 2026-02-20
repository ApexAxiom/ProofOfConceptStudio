/**
 * AWS Secrets Manager configuration types and utilities.
 * The actual fetching is done in the app layer since the shared package
 * doesn't depend on AWS SDK.
 */

export interface AppSecrets {
  OPENAI_API_KEY?: string;
  CRON_SECRET?: string;
  ADMIN_TOKEN?: string;
  DDB_TABLE_NAME?: string;
  API_BASE_URL?: string;
  RUNNER_BASE_URL?: string;
}

export interface SecretsConfig {
  /** AWS Secrets Manager secret name/ARN */
  secretName: string;
  /** AWS region for Secrets Manager */
  region: string;
  /** Cache TTL in milliseconds (default: 5 minutes) */
  cacheTtlMs?: number;
}

/**
 * Default secret name for the application
 */
export const DEFAULT_SECRET_NAME = "daily-briefs/app-secrets";

/**
 * Get the secrets config from environment variables
 */
export function getSecretsConfig(): SecretsConfig | null {
  // Secrets Manager loading is explicit opt-in. If AWS_SECRET_NAME is not set,
  // services use runtime environment variables (for example App Runner env vars).
  const secretName = process.env.AWS_SECRET_NAME?.trim();
  if (!secretName) return null;
  
  return {
    secretName,
    region: process.env.AWS_REGION ?? "us-east-1",
    cacheTtlMs: process.env.SECRETS_CACHE_TTL_MS 
      ? Number(process.env.SECRETS_CACHE_TTL_MS) 
      : 5 * 60 * 1000 // 5 minutes default
  };
}

/**
 * Merge secrets into process.env, only setting values that aren't already set.
 * This allows environment variables to override secrets.
 */
export function applySecretsToEnv(secrets: AppSecrets): void {
  for (const [key, value] of Object.entries(secrets)) {
    if (value !== undefined && !process.env[key]) {
      process.env[key] = value;
    }
  }
}
