import { redirect } from "next/navigation";

/** Renamed to /panel/sales. Kept so existing links and bookmarks still land. */
export default function StatsRedirect() {
  redirect("/panel/sales");
}
