import Link from "next/link";
import { BriefPost, RegionSlug, portfolioLabel } from "@proof/shared";

interface CmQuickLinksProps {
  brief?: BriefPost;
  region: RegionSlug;
  portfolio: string;
}

export function CmQuickLinks({ brief, region, portfolio }: CmQuickLinksProps) {
  const portfolioText = portfolioLabel(portfolio);
  const actionCenterHref = `/actions/${region}?q=${encodeURIComponent(portfolioText)}`;
  const chatHref = `/chat?region=${encodeURIComponent(region)}&portfolio=${encodeURIComponent(portfolio)}`;

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm space-y-3">
      <h3 className="text-sm font-semibold text-foreground">Quick links</h3>
      <div className="space-y-2">
        <Link
          href={brief ? `/brief/${encodeURIComponent(brief.postId)}` : "#"}
          aria-disabled={!brief}
          className={`btn-primary block w-full text-center ${!brief ? "pointer-events-none opacity-60" : ""}`}
        >
          View brief
        </Link>
        <Link href={actionCenterHref} className="btn-secondary block w-full text-center">
          Open Action Center
        </Link>
        <Link href={chatHref} className="btn-secondary block w-full text-center">
          Ask AI about this portfolio
        </Link>
      </div>
    </div>
  );
}
