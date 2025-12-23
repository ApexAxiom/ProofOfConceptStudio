import { BriefPost } from "@proof/shared";

export function validateBrief(brief: BriefPost): BriefPost {
  const body = brief.bodyMarkdown || "";
  const sources = new Set(brief.sources || []);
  const urlRegex = /(https?:\/\/[^\s)]+)/g;
  const bodyUrls = new Set<string>();
  for (const match of body.matchAll(urlRegex)) {
    bodyUrls.add(match[1]);
  }
  for (const s of sources) {
    if (!bodyUrls.has(s)) {
      throw new Error(`Source ${s} not found in body`);
    }
  }
  if (bodyUrls.size < 5) {
    throw new Error("Not enough citations in body");
  }
  return { ...brief, status: "published", sources: Array.from(bodyUrls) };
}
