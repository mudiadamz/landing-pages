import { redirect } from "next/navigation";
import { PanelSiteFilter } from "@/components/panel-site-filter";
import { requireFeature } from "@/lib/actions/profiles";
import { getContactsForAdmin } from "@/lib/actions/contacts";
import { panelScope } from "@/lib/site-scope";
import { SiteScopeCoverage } from "@/components/site-scope-coverage";
import { PanelPageHeader } from "@/components/panel-page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { translator } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";

export default async function ContactsPage() {
  const t = translator(await requestLocale());
  const ok = await requireFeature("contacts");
  if (!ok) redirect("/panel");

  const [contacts, scope] = await Promise.all([getContactsForAdmin(), panelScope()]);

  function formatDate(s: string) {
    return new Date(s).toLocaleString("id-ID", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="space-y-6">
      <PanelSiteFilter />
      <PanelPageHeader backHref="/panel" title={t("panel.titleContacts")} />

      <SiteScopeCoverage
        host={scope.site.host}
        name={scope.site.name}
        siteCount={scope.siteCount}
        includesUnattributed={scope.includesUnattributed}
        what="messages"
      />

      {contacts.length === 0 ? (
        <EmptyState
          title={t("panel.noContacts")}
          description={t("panel.contactsEmpty")}
        />
      ) : (
        <>
          <div className="sm:hidden space-y-3">
            {contacts.map((c) => (
              <div
                key={c.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm"
              >
                <p className="font-medium text-foreground">{c.name}</p>
                <a href={`mailto:${c.email}`} className="text-sm text-[var(--primary)] hover:underline">
                  {c.email}
                </a>
                <p className="mt-2 text-sm text-[var(--muted)] whitespace-pre-wrap">{c.message}</p>
                <p className="mt-2 text-xs text-[var(--muted)]">{formatDate(c.created_at)}</p>
              </div>
            ))}
          </div>
          <div className="hidden sm:block rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--background)]/50">
                    <th className="px-4 py-3.5 text-left text-sm font-medium text-foreground">{t("content.name")}</th>
                    <th className="px-4 py-3.5 text-left text-sm font-medium text-foreground">Email</th>
                    <th className="px-4 py-3.5 text-left text-sm font-medium text-foreground">{t("panel.navGroupMessages")}</th>
                    <th className="px-4 py-3.5 text-left text-sm font-medium text-foreground">{t("panel.date")}</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--background)]/30 transition-colors"
                    >
                      <td className="px-4 py-3.5 font-medium text-foreground">{c.name}</td>
                      <td className="px-4 py-3.5 text-sm">
                        <a href={`mailto:${c.email}`} className="text-[var(--primary)] hover:underline">
                          {c.email}
                        </a>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-[var(--muted)] max-w-xs whitespace-pre-wrap truncate">
                        {c.message}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-[var(--muted)]">{formatDate(c.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
