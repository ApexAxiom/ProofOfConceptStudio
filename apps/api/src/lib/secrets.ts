import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import {
  getSecretsConfig,
  applySecretsToEnv,
  type AppSecrets,
} from "@proof/shared";

let cachedSecrets: AppSecrets | null = null;
let cacheExpiry: number = 0;

/**
 * Fetch secrets from AWS Secrets Manager with caching.
 * Falls back gracefully if AWS Secrets Manager is not configured.
 */
export async function fetchSecrets(): Promise<AppSecrets | null> {
  const config = getSecretsConfig();
  
  if (!config) {
    // AWS Secrets Manager not configured, use environment variables only
    return null;
  }

  // Return cached secrets if still valid
  if (cachedSecrets && Date.now() < cacheExpiry) {
    return cachedSecrets;
  }

  const client = new SecretsManagerClient({ region: config.region });

  try {
    const response = await client.send(
      new GetSecretValueCommand({ SecretId: config.secretName })
    );

    if (!response.SecretString) {
      console.warn("AWS Secrets Manager returned empty secret");
      return null;
    }

    const secrets: AppSecrets = JSON.parse(response.SecretString);
    
    // Cache the secrets
    cachedSecrets = secrets;
    cacheExpiry = Date.now() + (config.cacheTtlMs ?? 5 * 60 * 1000);

    return secrets;
  } catch (error) {
    console.error("Failed to fetch secrets from AWS Secrets Manager:", error);
    return null;
  }
}

/**
 * Initialize secrets from AWS Secrets Manager and apply to process.env.
 * Should be called once at application startup.
 */
export async function initializeSecrets(): Promise<void> {
  const secrets = await fetchSecrets();
  
  if (secrets) {
    applySecretsToEnv(secrets);
    console.log("Loaded secrets from AWS Secrets Manager");
  } else {
    console.log("Using environment variables (AWS Secrets Manager not configured or unavailable)");
  }
}
