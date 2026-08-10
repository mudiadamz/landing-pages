import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/actions/profiles";
import { getOtherLinks, getSocialUrls } from "@/lib/actions/site-settings";
import { PanelPageHeader } from "@/components/panel-page-header";
import { LinksTabs } from "./tabs";

/**
 * The owner's other places on the internet, shown behind the link icon on the
 * homepage.
 *
 * Separate from /panel/sites, which manages STOREFRONTS this deployment serves.
 * These are somewhere else entirely — another shop, a portfolio, a newsletter —
 * and the visitor is being sent away rather than moved around.
 */
export default async function LinksPage() {
  if (!(await requireAdmin())) redirect("/panel");

  const [links, socialUrls] = await Promise.all([getOtherLinks(), getSocialUrls()]);

  return (
    <div className="space-y-6">
      <PanelPageHeader backHref="/panel" title="Link & sosial" />

      <LinksTabs socialUrls={socialUrls} otherLinks={links} />
    </div>
  );
}
