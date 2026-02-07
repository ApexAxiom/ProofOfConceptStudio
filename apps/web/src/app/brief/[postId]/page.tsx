import { notFound } from "next/navigation";
import { BriefDetailContent } from "../BriefDetailContent";
import { fetchPostWithFallback } from "../../../lib/api";

export const dynamic = "force-dynamic";

export default async function BriefDetailPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  const brief = await fetchPostWithFallback(postId);
  if (!brief) return notFound();

  return <BriefDetailContent brief={brief} />;
}
