import { BriefPost } from "@proof/shared";
import { InsightListCard } from "../InsightListCard";

interface CmDeltaCardProps {
  brief?: BriefPost;
}

export function CmDeltaCard({ brief }: CmDeltaCardProps) {
  if (!brief?.deltaSinceLastRun || brief.deltaSinceLastRun.length === 0) return null;

  return <InsightListCard title="What changed since last run" items={brief.deltaSinceLastRun} />;
}
