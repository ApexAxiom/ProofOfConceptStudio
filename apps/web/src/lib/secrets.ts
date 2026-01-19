import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { applySecretsToEnv, getSecretsConfig, type AppSecrets } from "@proof/shared";

let cachedSecrets: AppSecrets | null = null;
let cacheExpiry = 0;

async function fetchSecrets(): Promise<AppSecrets | null> {
  const config = getSecretsConfig();

  if (!config) {
    return null;
  }

  if (cachedSecrets && Date.now() < cacheExpiry) {
    return cachedSecrets;
  }

  const client = new SecretsManagerClient({ region: config.region });

  try {
    const response = await client.send(new GetSecretValueCommand({ SecretId: config.secretName }));

    if (!response.SecretString) {
      console.warn("AWS Secrets Manager returned empty secret");
      return null;
    }

    const secrets: AppSecrets = JSON.parse(response.SecretString);
    cachedSecrets = secrets;
    cacheExpiry = Date.now() + (config.cacheTtlMs ?? 5 * 60 * 1000);
    return secrets;
  } catch (error) {
    console.error("Failed to fetch secrets from AWS Secrets Manager:", error);
    return null;
  }
}

/**
 * Load secrets into process.env when AWS Secrets Manager is configured.
 */
export async function initializeSecrets(): Promise<void> {
  const secrets = await fetchSecrets();
  if (secrets) {
    applySecretsToEnv(secrets);
  }
}
