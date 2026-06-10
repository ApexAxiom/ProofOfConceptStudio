import { redirect } from "next/navigation";
import { REGION_LIST } from "@proof/shared";

/**
 * The standalone watchlist page was an empty stub; the live watchlist
 * (signals from published briefs) lives in the Action Center. Redirect there
 * so the route and any old links keep working.
 */
export default function WatchlistPage() {
  redirect(`/actions/${REGION_LIST[0].slug}?tab=watchlist`);
}
