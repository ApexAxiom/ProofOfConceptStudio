import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { RegionSlug } from "@proof/shared";
import { buildRegionDigest } from "./build.js";
import { renderDigestHtml, renderDigestSubject, renderDigestText } from "./render.js";

/**
 * Daily digest delivery via SES. Entirely env-gated: nothing is sent unless
 * DIGEST_ENABLED=true and both DIGEST_FROM_ADDRESS and DIGEST_RECIPIENTS are
 * configured, so deployments without email setup are unaffected.
 */

let cachedClient: SESv2Client | null = null;

function getClient(): SESv2Client {
  if (!cachedClient) {
    cachedClient = new SESv2Client({ region: process.env.DIGEST_SES_REGION || process.env.AWS_REGION || "us-east-1" });
  }
  return cachedClient;
}

export function isDigestEnabled(): boolean {
  if ((process.env.DIGEST_ENABLED ?? "false").trim().toLowerCase() !== "true") return false;
  return Boolean(process.env.DIGEST_FROM_ADDRESS?.trim()) && getDigestRecipients().length > 0;
}

export function getDigestRecipients(): string[] {
  return (process.env.DIGEST_RECIPIENTS ?? "")
    .split(",")
    .map((address) => address.trim())
    .filter((address) => address.includes("@"));
}

export async function sendRegionDigest(params: { region: RegionSlug; nowIso: string }): Promise<{
  sent: boolean;
  reason?: string;
  entryCount?: number;
}> {
  if (!isDigestEnabled()) {
    return { sent: false, reason: "digest_disabled" };
  }

  const digest = await buildRegionDigest({ region: params.region, nowIso: params.nowIso });
  if (!digest) {
    return { sent: false, reason: "no_briefs" };
  }

  const command = new SendEmailCommand({
    FromEmailAddress: process.env.DIGEST_FROM_ADDRESS!.trim(),
    Destination: { ToAddresses: getDigestRecipients() },
    Content: {
      Simple: {
        Subject: { Data: renderDigestSubject(digest) },
        Body: {
          Html: { Data: renderDigestHtml(digest) },
          Text: { Data: renderDigestText(digest) }
        }
      }
    }
  });

  await getClient().send(command);
  return { sent: true, entryCount: digest.entries.length };
}
