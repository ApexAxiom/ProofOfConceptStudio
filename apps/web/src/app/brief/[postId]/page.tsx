import { notFound } from "next/navigation";
import { BriefDetailContent } from "../BriefDetailContent";
import { fetchPost } from "../../../lib/api";

export default async function BriefDetailPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  const brief = await fetchPost(postId);
  if (!brief) return notFound();

  return <BriefDetailContent brief={brief} />;
}
