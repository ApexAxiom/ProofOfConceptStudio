import { BriefSignalLevel } from "@proof/shared";
import { DigestEntry, RegionDigest } from "./build.js";

/**
 * Email rendering for the daily digest. Inline styles only (email clients
 * ignore stylesheets); light theme for readability across clients.
 */

const SIGNAL_STYLE: Record<BriefSignalLevel, { label: string; color: string; background: string }> = {
  act: { label: "ACT", color: "#b91c1c", background: "#fee2e2" },
  watch: { label: "WATCH", color: "#b45309", background: "#fef3c7" },
  awareness: { label: "FYI", color: "#0369a1", background: "#e0f2fe" }
};

export function digestSiteBaseUrl(): string {
  const configured = process.env.DIGEST_SITE_BASE_URL || process.env.SITE_URL || "";
  const base = configured.trim() || "https://proofofconceptstudio.com";
  return base.replace(/\/+$/, "");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function digestDateLabel(digest: RegionDigest): string {
  return new Date(digest.generatedAt).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

export function renderDigestSubject(digest: RegionDigest): string {
  const parts: string[] = [];
  if (digest.actCount > 0) parts.push(`${digest.actCount} act`);
  if (digest.watchCount > 0) parts.push(`${digest.watchCount} watch`);
  const status = parts.length > 0 ? parts.join(" · ") : "quiet day";
  return `Category Intel — ${digest.regionLabel} — ${status} — ${digestDateLabel(digest)}`;
}

function signalChipHtml(level?: BriefSignalLevel): string {
  if (!level || !SIGNAL_STYLE[level]) {
    return `<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;color:#6b7280;background:#f3f4f6;">—</span>`;
  }
  const style = SIGNAL_STYLE[level];
  return `<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;color:${style.color};background:${style.background};">${style.label}</span>`;
}

function entryRowHtml(entry: DigestEntry, baseUrl: string): string {
  const briefUrl = `${baseUrl}/brief/${encodeURIComponent(entry.postId)}`;
  return `
    <tr>
      <td style="padding:10px 12px 10px 0;vertical-align:top;white-space:nowrap;">${signalChipHtml(entry.signalLevel)}</td>
      <td style="padding:10px 0;vertical-align:top;">
        <p style="margin:0;font-size:13px;font-weight:700;color:#111827;">${escapeHtml(entry.portfolioLabel)}</p>
        <p style="margin:2px 0 0;font-size:14px;">
          <a href="${briefUrl}" style="color:#1d4ed8;text-decoration:none;">${escapeHtml(entry.title)}</a>
        </p>
        ${entry.summaryLine ? `<p style="margin:4px 0 0;font-size:13px;color:#4b5563;line-height:1.45;">${escapeHtml(entry.summaryLine)}</p>` : ""}
      </td>
    </tr>
    <tr><td colspan="2" style="border-bottom:1px solid #e5e7eb;"></td></tr>`;
}

export function renderDigestHtml(digest: RegionDigest): string {
  const baseUrl = digestSiteBaseUrl();
  const counts = [
    digest.actCount > 0 ? `<strong style="color:#b91c1c;">${digest.actCount} need action</strong>` : "",
    digest.watchCount > 0 ? `<strong style="color:#b45309;">${digest.watchCount} worth watching</strong>` : "",
    digest.awarenessCount > 0 ? `${digest.awarenessCount} for awareness` : ""
  ]
    .filter(Boolean)
    .join(" · ");

  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:28px;">
            <tr>
              <td>
                <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#6b7280;">Category Management Intelligence</p>
                <h1 style="margin:6px 0 0;font-size:20px;color:#111827;">${escapeHtml(digest.regionLabel)} — ${digestDateLabel(digest)}</h1>
                ${counts ? `<p style="margin:8px 0 0;font-size:13px;color:#374151;">${counts}</p>` : ""}
              </td>
            </tr>
            <tr><td style="padding-top:16px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${digest.entries.map((entry) => entryRowHtml(entry, baseUrl)).join("\n")}
              </table>
            </td></tr>
            <tr>
              <td style="padding-top:18px;">
                <a href="${baseUrl}" style="display:inline-block;padding:9px 16px;border-radius:8px;background:#111827;color:#ffffff;font-size:13px;font-weight:600;text-decoration:none;">Open the Today board</a>
                <p style="margin:14px 0 0;font-size:11px;color:#9ca3af;">
                  Automated daily digest from the Intelligence Hub. Signal levels: ACT = material event needing a decision,
                  WATCH = developing signal, FYI = awareness only.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function renderDigestText(digest: RegionDigest): string {
  const baseUrl = digestSiteBaseUrl();
  const lines: string[] = [
    `Category Intel — ${digest.regionLabel} — ${digestDateLabel(digest)}`,
    `${digest.actCount} act · ${digest.watchCount} watch · ${digest.awarenessCount} awareness`,
    ""
  ];
  for (const entry of digest.entries) {
    const level = entry.signalLevel ? entry.signalLevel.toUpperCase() : "-";
    lines.push(`[${level}] ${entry.portfolioLabel}: ${entry.title}`);
    if (entry.summaryLine) lines.push(`       ${entry.summaryLine}`);
    lines.push(`       ${baseUrl}/brief/${encodeURIComponent(entry.postId)}`);
    lines.push("");
  }
  lines.push(`Open the Today board: ${baseUrl}`);
  return lines.join("\n");
}
