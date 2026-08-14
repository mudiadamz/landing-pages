import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";
import { getPurchasesForUser } from "@/lib/actions/purchases";
import { getMyFavorites } from "@/lib/actions/likes";
import {
  normalizeRole,
  normalizePublisherStatus,
  roleLabel as roleLabelFor,
  type PublisherStatus,
} from "@/lib/profile-utils";
import { ProfileForm } from "./profile-form";
import { AvatarForm } from "./avatar-form";
import { PublisherCard } from "./publisher-card";
import { VerifyEmailRow } from "./verify-email-row";
import { PanelPageHeader } from "@/components/panel-page-header";
import { translator } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";

/**
 * Account page: who you are, what state the account is in, and the two things
 * you can change about it.
 *
 * Previously one card holding an email, a role chip, a name field and the
 * publisher application in a single column — which meant the page answered
 * "what is my name" and nothing else. It now leads with an identity header and
 * separates the questions people actually arrive with: is my email sorted, what
 * have I bought, can I sell here.
 */

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("id-ID", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const PUBLISHER_BADGE: Record<PublisherStatus, { text: string; className: string } | null> = {
  none: null,
  approved: null, // already carried by the role badge
  pending: {
    text: "Pengajuan publisher ditinjau",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  },
  rejected: {
    text: "Pengajuan publisher ditolak",
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  },
};

export default async function ProfilePage() {
  const t = translator(await requestLocale());
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: row }, purchases, favorites] = await Promise.all([
    supabase
      .from("lp_profiles")
      // One string literal, deliberately: supabase-js infers the row type from
      // the literal, and a concatenated expression collapses it to an error type.
      .select(
        "id, full_name, role, publisher_status, publisher_reject_note, email_verified_at, avatar_url, publisher_display_name, publisher_real_name, publisher_address, publisher_bank_name, publisher_bank_holder, publisher_bank_account, publisher_terms_accepted_at, publisher_applied_at",
      )
      .eq("id", user.id)
      .single(),
    getPurchasesForUser(),
    getMyFavorites(),
  ]);

  const role = row ? normalizeRole(row.role) : "customer";
  const publisherStatus = normalizePublisherStatus(row?.publisher_status);
  const fullName =
    row?.full_name?.trim() || (user.user_metadata?.full_name as string | undefined)?.trim() || "";
  const email = user.email ?? null;
  const avatarUrl = row?.avatar_url ?? "";
  const verified = !!row?.email_verified_at;
  const publisherBadge = PUBLISHER_BADGE[publisherStatus];

  const roleClass =
    role === "admin"
      ? "bg-[var(--primary)]/15 text-[var(--primary)]"
      : role === "publisher"
        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
        : "bg-[var(--accent-subtle)] text-[var(--muted)]";

  return (
    <div className="space-y-5">
      <PanelPageHeader backHref="/panel" title={t("nav.profile")} />

      {/* Identity header */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          {/* The photo is the control: tapping it opens the upload popup. */}
          <AvatarForm initialUrl={avatarUrl} initial={(fullName || email || "?").charAt(0)} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold text-foreground">
              {fullName || "Tanpa nama"}
            </p>
            <p className="mt-0.5 break-all text-sm text-[var(--muted)]">{email || "—"}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-medium ${roleClass}`}>
                {roleLabelFor(role)}
              </span>
              {publisherBadge && (
                <span
                  className={`inline-flex rounded-md px-2.5 py-1 text-xs font-medium ${publisherBadge.className}`}
                >
                  {publisherBadge.text}
                </span>
              )}
              <span className="text-xs text-[var(--muted)]">
                Bergabung {formatDate(user.created_at)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* What the account actually has in it — and a way through to it. */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/panel/purchases"
          className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm transition-colors hover:bg-[var(--background)]/50"
        >
          <p className="text-xs font-medium text-[var(--muted)]">Pembelian</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{purchases.length}</p>
          <p className="mt-0.5 text-xs text-[var(--primary)]">Lihat semua →</p>
        </Link>
        <Link
          href="/panel/favorites"
          className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm transition-colors hover:bg-[var(--background)]/50"
        >
          <p className="text-xs font-medium text-[var(--muted)]">Favorit</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{favorites.length}</p>
          <p className="mt-0.5 text-xs text-[var(--primary)]">Lihat semua →</p>
        </Link>
      </div>

      {/* Publisher */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
        <header className="border-b border-[var(--border)] bg-[var(--background)]/50 p-4 sm:px-6">
          <h2 className="text-base font-semibold text-foreground">Publisher</h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            Status Anda sebagai penjual produk digital di sini.
          </p>
        </header>
        <div className="p-4 sm:p-6">
          <PublisherCard
            role={role}
            status={publisherStatus}
            info={{
              displayName: row?.publisher_display_name ?? null,
              realName: row?.publisher_real_name ?? null,
              address: row?.publisher_address ?? null,
              bankName: row?.publisher_bank_name ?? null,
              bankHolder: row?.publisher_bank_holder ?? null,
              bankAccount: row?.publisher_bank_account ?? null,
              termsAcceptedAt: row?.publisher_terms_accepted_at ?? null,
              appliedAt: row?.publisher_applied_at ?? null,
              rejectNote: row?.publisher_reject_note ?? null,
            }}
          />
        </div>
      </section>

      {/* Email + verification, next to the address it concerns. */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
        <header className="border-b border-[var(--border)] bg-[var(--background)]/50 p-4 sm:px-6">
          <h2 className="text-base font-semibold text-foreground">Email</h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            Dipakai untuk masuk, invoice, dan link download.
          </p>
        </header>
        <div className="space-y-3 p-4 sm:p-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
              Alamat
            </p>
            <p className="mt-1 break-all text-sm font-medium text-foreground">{email || "—"}</p>
          </div>
          <VerifyEmailRow verified={verified} />
        </div>
      </section>

      {/* Name */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
        <header className="border-b border-[var(--border)] bg-[var(--background)]/50 p-4 sm:px-6">
          <h2 className="text-base font-semibold text-foreground">Nama tampilan</h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            Nama yang muncul di panel dan pada ulasan Anda.
          </p>
        </header>
        <div className="p-4 sm:p-6">
          <ProfileForm initialFullName={fullName} />
        </div>
      </section>

      {/* On mobile the sidebar is behind a menu, so the obvious place to look
          for "log me out" is the account page. */}
      <form action={signOut}>
        <button
          type="submit"
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm font-medium text-[var(--muted)] shadow-sm transition-colors hover:border-red-500/40 hover:text-red-600 dark:hover:text-red-400"
        >
          Keluar dari akun
        </button>
      </form>
    </div>
  );
}
