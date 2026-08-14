import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSiteContent } from "@/lib/actions/site-settings";
import { normalizeRole, normalizePublisherStatus } from "@/lib/profile-utils";
import { PublisherApplyForm } from "./apply-form";
import { PanelPageHeader } from "@/components/panel-page-header";
import { translator } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";

export const metadata = { title: "Jadi publisher" };

/**
 * The publisher application, on its own page.
 *
 * It used to sit inline on /panel/profile, where a form asking for a legal
 * name, an ID photograph, a selfie and a bank account was competing with the
 * two fields that page actually exists to edit. The profile now shows a status
 * summary and links here; this page is the one place the application is filled
 * in.
 */
export default async function PublisherPage() {
  const t = translator(await requestLocale());
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: row }, content] = await Promise.all([
    supabase
      .from("lp_profiles")
      .select("role, publisher_status, publisher_reject_note")
      .eq("id", user.id)
      .single(),
    getSiteContent(),
  ]);

  const role = normalizeRole(row?.role);
  const status = normalizePublisherStatus(row?.publisher_status);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PanelPageHeader
        backHref="/panel/profile"
        backLabel="Kembali ke profil"
        title={t("panel.becomePublisher")}
      />

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:p-6">
        <PublisherApplyForm
          role={role}
          status={status}
          rejectNote={row?.publisher_reject_note ?? null}
          termsHeading={content.publisherTermsHeading}
          terms={content.publisherTerms}
        />
      </div>
    </div>
  );
}
