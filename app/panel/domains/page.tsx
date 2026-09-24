import { redirect } from "next/navigation";
import { PanelPageHeader } from "@/components/panel-page-header";
import { listMyDomains } from "@/lib/actions/domains";
import { requireSiteAdmin } from "@/lib/actions/profiles";
import { translator } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";
import { deniedPath } from "@/lib/panel-view";
import { DomainsManager } from "./domains-manager";

/**
 * Where a business points its own domain here, without anyone editing a config
 * file or opening a ticket.
 *
 * Separate from /panel/sites, which is Platform's screen for every storefront
 * in the deployment and carries create/delete for all of them. This one is
 * scoped by `listMyDomains()` to the business the caller owns — the same data,
 * a different question, and merging them would mean one screen whose
 * capabilities depend on who is looking.
 */
export async function generateMetadata() {
  return { title: translator(await requestLocale())("domains.heading") };
}

export default async function DomainsPage() {
  const t = translator(await requestLocale());
  // The same gate the sidebar shows this behind. It had none — it leaned on
  // listMyDomains() returning nothing, which is not a refusal, it is an empty
  // page that looks like a bug.
  if (!(await requireSiteAdmin())) redirect(deniedPath("domains"));

  const domains = await listMyDomains();

  return (
    <div className="space-y-6">
      <PanelPageHeader backHref="/panel" title={t("domains.heading")} />
      <p className="max-w-2xl text-sm text-[var(--muted)]">{t("domains.intro")}</p>
      <DomainsManager domains={domains} />
    </div>
  );
}
