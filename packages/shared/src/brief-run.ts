import type { BriefRunIdentity } from "./types.js";

/**
 * Build a stable brief run key from the canonical run identity.
 */
export function buildBriefRunKey(identity: BriefRunIdentity): string {
  return `${identity.briefDay}#${identity.region}#${identity.portfolio}`;
}

/**
 * Build a deterministic brief post ID for a run identity.
 */
export function buildBriefPostId(identity: BriefRunIdentity): string {
  return `brief_${buildBriefRunKey(identity)}`;
}
