import { currentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/db/admin";
import { requirePlatform } from "@/lib/actions/profiles";
import { PanelPageHeader } from "@/components/panel-page-header";
import { ApplyBusinessForm } from "./apply-business-form";

export const metadata = { title: "Daftar sebagai Business" };

/**
 * Self-serve business signup (docs/plans/multi-business-saas.md, Fase 4). Any
 * logged-in user who is not already tied to a business can apply; the Platform
 * approves it from /panel/platform. The eligibility check here mirrors the one in
 * applyForBusiness so the form is only shown to people it will accept.
 */
export default async function ApplyBusinessPage() {
  const user = await currentUser();
  const isPlatform = await requirePlatform();

  let alreadyMember = false;
  if (user) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("lp_business_members")
      .select("business_id")
      .eq("user_id", user.id)
      .limit(1);
    alreadyMember = !!data && data.length > 0;
  }

  return (
    <div className="max-w-xl space-y-6">
      <PanelPageHeader
        backHref="/panel"
        title="Daftar sebagai Business"
        description="Jalankan toko sendiri di platform ini. Pengajuan ditinjau dulu sebelum aktif."
      />

      {isPlatform ? (
        <p className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-sm text-[var(--muted)]">
          Kamu operator platform — kelola business dari halaman Platform.
        </p>
      ) : alreadyMember ? (
        <p className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-sm text-[var(--muted)]">
          Kamu sudah terhubung ke sebuah business.
        </p>
      ) : (
        <ApplyBusinessForm />
      )}
    </div>
  );
}
