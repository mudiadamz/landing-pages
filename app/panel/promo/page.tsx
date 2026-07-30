import { redirect } from "next/navigation";

/** Renamed to /panel/popup. Kept so existing links and bookmarks still land. */
export default function PromoRedirect() {
  redirect("/panel/popup");
}
