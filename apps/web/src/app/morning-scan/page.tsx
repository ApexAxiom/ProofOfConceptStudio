import { redirect } from "next/navigation";

/**
 * Morning Scan duplicated the Today view (same briefs + news on a second
 * page). Folded into the homepage; the route stays so old links keep working.
 */
export default function MorningScanPage() {
  redirect("/");
}
