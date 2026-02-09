import { notFound } from "next/navigation";
import { BriefDetailContent } from "../BriefDetailContent";
import { fetchPostWithFallback } from "../../../lib/api";

export const dynamic = "force-dynamic";

export default async function BriefDetailPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId: rawPostId } = await params;
  // Next.js route params may be URL-encoded; decode defensively.
  const postId = (() => {
    try {
      return decodeURIComponent(rawPostId);
    } catch {
      return rawPostId;
    }
  })();

  const brief = await fetchPostWithFallback(postId);
  if (!brief) return notFound();

  return <BriefDetailContent brief={brief} />;
}
