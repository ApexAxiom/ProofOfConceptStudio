/**
 * Temporary bootstrap secrets used when deployment-specific secrets are not configured.
 * Replace these with secure values via environment variables or secret stores in production.
 */
export const BOOTSTRAP_CRON_SECRET = "gP9etqOVYJEIrvY0SGWGQSarMrdqZ6ydAX1n73Fq8fw";
export const BOOTSTRAP_ADMIN_TOKEN = "jWKImyAWikMjdYU6E7vwt0m8trPFr1Rjx3nKDn77ZC0";

/**
 * Resolve the cron secret, falling back to the bootstrap value when the environment variable is absent.
 */
export function getCronSecret(): string {
  return process.env.CRON_SECRET || BOOTSTRAP_CRON_SECRET;
}

/**
 * Resolve the admin token, falling back to the bootstrap value when the environment variable is absent.
 */
export function getAdminToken(): string {
  return process.env.ADMIN_TOKEN || BOOTSTRAP_ADMIN_TOKEN;
}

/**
 * Determine whether the bootstrap cron secret is in use.
 */
export function usingBootstrapCron(): boolean {
  return !process.env.CRON_SECRET;
}

/**
 * Determine whether the bootstrap admin token is in use.
 */
export function usingBootstrapAdmin(): boolean {
  return !process.env.ADMIN_TOKEN;
}
