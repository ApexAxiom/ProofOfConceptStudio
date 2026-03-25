import {
  BriefPost,
  getBriefDayKey,
  hasStructuredBody,
  upgradeBriefToNewFormat
} from "@proof/shared";
import { DynamoBriefItem, fetchPublishedBriefItems, putBriefItem } from "./shared.js";
import { buildHeadlineTitle, isGenericBriefTitle } from "./title-utils.js";

function parseArg(name: string): string | undefined {
  const hit = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : undefined;
}

function asPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const force = process.argv.includes("--force");
  const limit = asPositiveInt(parseArg("--limit"), 1000);
  const regionArg = parseArg("--region");
  const briefDayArg = parseArg("--brief-day");
  const useToday = process.argv.includes("--today");
  const region = regionArg === "au" || regionArg === "us-mx-la-lng" ? regionArg : undefined;
  const items = await fetchPublishedBriefItems({ limit, region: region as any });
  const targetBriefDay = briefDayArg;

  let scanned = 0;
  let updated = 0;
  let skippedStructured = 0;
  let skippedBriefDay = 0;

  for (const item of items) {
    scanned += 1;
    const brief = item as BriefPost;
    const briefDay = brief.briefDay ?? getBriefDayKey(brief.region, new Date(brief.publishedAt));
    const itemTargetBriefDay = targetBriefDay ?? (useToday ? getBriefDayKey(brief.region) : undefined);
    if (itemTargetBriefDay && briefDay !== itemTargetBriefDay) {
      skippedBriefDay += 1;
      continue;
    }
    if (!force && brief.report && hasStructuredBody(brief)) {
      skippedStructured += 1;
      continue;
    }

    const title = isGenericBriefTitle(brief.title, brief.portfolio) ? buildHeadlineTitle(brief) : brief.title;
    const upgraded = upgradeBriefToNewFormat(brief, {
      titleOverride: title
    });

    updated += 1;

    if (!dryRun) {
      await putBriefItem({
        ...(item as DynamoBriefItem),
        ...upgraded
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        command: "backfill:brief-upgrade",
        dryRun,
        force,
        scanned,
        updated,
        skippedStructured,
        skippedBriefDay,
        briefDay: targetBriefDay ?? (useToday ? "today-by-region" : "all"),
        region: region ?? "all"
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
