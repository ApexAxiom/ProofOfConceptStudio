import { BriefPost, RegionSlug } from "@proof/shared";
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
  const limit = asPositiveInt(parseArg("--limit"), 1000);
  const regionArg = parseArg("--region");
  const region = regionArg === "au" || regionArg === "us-mx-la-lng" ? (regionArg as RegionSlug) : undefined;
  const items = await fetchPublishedBriefItems({ limit, region });

  let scanned = 0;
  let updated = 0;

  for (const item of items) {
    scanned += 1;
    const brief = item as BriefPost;
    const shouldReplace = isGenericBriefTitle(brief.title, brief.portfolio);
    if (!shouldReplace) continue;

    const headline = buildHeadlineTitle(brief);
    if (!headline || headline === brief.title) continue;
    updated += 1;

    if (!dryRun) {
      await putBriefItem({
        ...(item as DynamoBriefItem),
        title: headline
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        command: "backfill:brief-titles",
        dryRun,
        scanned,
        updated,
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
