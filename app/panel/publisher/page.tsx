import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSiteContent } from "@/lib/actions/site-settings";
import { normalizeRole, normalizePublisherStatus } from "@/lib/profile-utils";
import { PublisherApplyForm } from "./apply-form";

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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <Link
          href="/panel/profile"
          className="text-sm text-[var(--muted)] transition-colors hover:text-foreground"
        >
          ← Kembali ke profil
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">Jadi publisher</h1>
      </div>

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
