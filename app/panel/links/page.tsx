import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/actions/profiles";
import { getOtherLinks } from "@/lib/actions/site-settings";
import { PanelPageHeader } from "@/components/panel-page-header";
import { LinksForm } from "./links-form";

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

  const links = await getOtherLinks();

  return (
    <div className="space-y-6">
      <PanelPageHeader backHref="/panel" title="Link lainnya" />

      <p className="text-sm text-[var(--muted)]">
        Situs lain milik Anda — toko lain, portfolio, newsletter. Muncul di homepage
        lewat ikon link di samping ikon media sosial, dalam satu popup.
      </p>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:p-6">
        <LinksForm initial={links} />
      </div>
    </div>
  );
}
