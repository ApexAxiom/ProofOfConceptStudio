import { RegionSlug, getBriefDayKey } from "@proof/shared";
import { getExpectedAgentsForRegions } from "./audit.js";
import { expectedCoverageDayKey } from "./day.js";
import { getLatestPublishedBrief } from "../db/previous-brief.js";

interface CoverageRow {
  agentId: string;
  portfolio: string;
  region: RegionSlug;
  hasBriefToday: boolean;
  latestPublishedAt: string;
  status: "published" | "carry-forward" | "baseline" | "stale" | "no-history";
}

function parseRegions(argv: string[]): RegionSlug[] {
  const arg = argv.find((token) => token.startsWith("--regions="));
  if (!arg) return ["au", "us-mx-la-lng"];
  const value = arg.slice("--regions=".length);
  const regions = value.split(",").map((item) => item.trim()) as RegionSlug[];
  const allowed = new Set<RegionSlug>(["au", "us-mx-la-lng"]);
  return regions.filter((region) => allowed.has(region));
}

function printTable(rows: CoverageRow[]): void {
  const headers = ["Agent", "Portfolio", "Region", "HasToday", "Status", "LatestPublished"];
  const widths = [
    Math.max(headers[0].length, ...rows.map((row) => row.agentId.length)),
    Math.max(headers[1].length, ...rows.map((row) => row.portfolio.length)),
    Math.max(headers[2].length, ...rows.map((row) => row.region.length)),
    headers[3].length,
    Math.max(headers[4].length, ...rows.map((row) => row.status.length)),
    Math.max(headers[5].length, ...rows.map((row) => row.latestPublishedAt.length))
  ];

  const rowToLine = (cells: string[]) =>
    cells
      .map((cell, idx) => cell.padEnd(widths[idx], " "))
      .join(" | ");

  console.log(rowToLine(headers));
  console.log(widths.map((width) => "-".repeat(width)).join("-+-"));
  for (const row of rows) {
    console.log(
      rowToLine([
        row.agentId,
        row.portfolio,
        row.region,
        row.hasBriefToday ? "yes" : "no",
        row.status,
        row.latestPublishedAt
      ])
    );
  }
}

async function main() {
  const regions = parseRegions(process.argv.slice(2));
  const strict = !process.argv.includes("--no-strict");
  const expectedDayByRegion = new Map(regions.map((region) => [region, expectedCoverageDayKey(region, new Date())]));
  const expected = getExpectedAgentsForRegions({ regions });

  const rows: CoverageRow[] = [];

  for (const expectedAgent of expected) {
    const latest = await getLatestPublishedBrief({
      portfolio: expectedAgent.portfolio,
      region: expectedAgent.region,
      beforeIso: new Date().toISOString()
    });
    const latestPublishedAt = latest?.publishedAt ?? "never";
    const dayKey = latest
      ? latest.briefDay ?? getBriefDayKey(expectedAgent.region, new Date(latest.publishedAt))
      : undefined;
    const hasBriefToday = Boolean(dayKey && dayKey === expectedDayByRegion.get(expectedAgent.region));
    const isCarryForward = Boolean(
      latest &&
        (latest.generationStatus === "no-updates" ||
          latest.generationStatus === "generation-failed" ||
          (latest.tags ?? []).some((tag) => tag.toLowerCase() === "carry-forward"))
    );
    const isBaseline = Boolean(latest && (latest.tags ?? []).some((tag) => tag.toLowerCase() === "baseline"));
    const status: CoverageRow["status"] = !latest
      ? "no-history"
      : !hasBriefToday
        ? "stale"
        : isBaseline
          ? "baseline"
          : isCarryForward
            ? "carry-forward"
            : "published";

    rows.push({
      agentId: expectedAgent.agentId,
      portfolio: expectedAgent.portfolio,
      region: expectedAgent.region,
      hasBriefToday,
      latestPublishedAt,
      status
    });
  }

  rows.sort((a, b) => `${a.region}:${a.portfolio}`.localeCompare(`${b.region}:${b.portfolio}`));
  printTable(rows);

  const missing = rows.filter((row) => !row.hasBriefToday);
  if (missing.length > 0) {
    console.error(`\nCoverage gaps: ${missing.length}`);
    if (strict) process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
