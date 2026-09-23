import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { getSiteContent } from "@/lib/actions/site-settings";
import { normalizePublisherStatus } from "@/lib/profile-utils";
import { currentSiteStanding } from "@/lib/actions/profiles";
import { createAdminClient } from "@/lib/db/admin";
import { currentSiteId } from "@/lib/site-resolve";
import { PublisherApplyForm } from "./apply-form";
import { PanelPageHeader } from "@/components/panel-page-header";
import { translator } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";

export async function generateMetadata() {
  return { title: translator(await requestLocale())("panel.becomePublisher") };
}

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
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");

  // Kedudukan DI SITUS INI (Fase 5): pengelola business pemilik situs ini tidak
  // perlu melamar — tapi pengelola business LAIN tetap perlu, dan model
  // account_type lama tidak bisa membedakan keduanya.
  const [siteStanding, content] = await Promise.all([currentSiteStanding(), getSiteContent()]);
  const standing = {
    isPlatform: !!siteStanding?.isPlatform,
    businessRole: siteStanding?.businessRole ?? null,
  };
  // Pengajuan ini milik pasangan (orang, situs): statusnya dibaca dari
  // keanggotaan di situs yang sedang dibuka, bukan dari profilnya.
  const { data: membership } = await createAdminClient()
    .from("lp_site_members")
    .select("publisher_status, publisher_reject_note")
    .eq("user_id", user.id)
    .eq("site_id", await currentSiteId())
    .maybeSingle();
  const status = normalizePublisherStatus(membership?.publisher_status);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PanelPageHeader
        backHref="/panel/profile"
        backLabel={t("panel.backToProfile")}
        title={t("panel.becomePublisher")}
      />

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:p-6">
        <PublisherApplyForm
          standing={standing}
          status={status}
          rejectNote={membership?.publisher_reject_note ?? null}
          termsHeading={content.publisherTermsHeading}
          terms={content.publisherTerms}
        />
      </div>
    </div>
  );
}
