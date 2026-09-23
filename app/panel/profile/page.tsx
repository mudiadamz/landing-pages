import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/db/admin";
import { currentSiteId } from "@/lib/site-resolve";
import type { MessageKey } from "@/lib/i18n";
import Link from "next/link";
import { createClient } from "@/lib/db/server";
import { signOut } from "@/lib/actions/auth";
import { getPurchasesForUser } from "@/lib/actions/purchases";
import { getMyFavorites } from "@/lib/actions/likes";
import { standingLabel } from "@/lib/profile-utils";
import { getProfile } from "@/lib/actions/profiles";
import { ProfileForm } from "./profile-form";
import { AvatarForm } from "./avatar-form";
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

// textKey, not text: this map is module scope, so a resolved string here would
// be whichever language rendered first for every request after it.
export default async function ProfilePage() {
  const t = translator(await requestLocale());
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: row }, purchases, favorites] = await Promise.all([
    db
      .from("lp_profiles")
      // One string literal, deliberately: supabase-js infers the row type from
      // the literal, and a concatenated expression collapses it to an error type.
      .select(
        "id, full_name, email_verified_at, avatar_url",
      )
      .eq("id", user.id)
      .single(),
    getPurchasesForUser(),
    getMyFavorites(),
  ]);

  // Kedudukan diturunkan, bukan dibaca dari satu kolom (Fase 5).
  const me = await getProfile();
  const standing = {
    isPlatform: !!me?.is_platform,
    businessRole: me?.business_role ?? null,
  };
  const fullName =
    row?.full_name?.trim() || (user.user_metadata?.full_name as string | undefined)?.trim() || "";
  const email = user.email ?? null;
  const avatarUrl = row?.avatar_url ?? "";
  const verified = !!row?.email_verified_at;

  const roleClass = standing.isPlatform
    ? "bg-[var(--primary)]/15 text-[var(--primary)]"
    : standing.businessRole
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
              {fullName || t("panel.noName")}
            </p>
            <p className="mt-0.5 break-all text-sm text-[var(--muted)]">{email || "—"}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-medium ${roleClass}`}>
                {standingLabel(standing)}
              </span>
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
          <p className="text-xs font-medium text-[var(--muted)]">{t("panel.dashPurchases")}</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{purchases.length}</p>
          <p className="mt-0.5 text-xs text-[var(--primary)]">{t("panel.viewAll")}</p>
        </Link>
        <Link
          href="/panel/favorites"
          className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm transition-colors hover:bg-[var(--background)]/50"
        >
          <p className="text-xs font-medium text-[var(--muted)]">{t("panel.navFavorites")}</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{favorites.length}</p>
          <p className="mt-0.5 text-xs text-[var(--primary)]">{t("panel.viewAll")}</p>
        </Link>
      </div>

      {/* Email + verification, next to the address it concerns. */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
        <header className="border-b border-[var(--border)] bg-[var(--background)]/50 p-4 sm:px-6">
          <h2 className="text-base font-semibold text-foreground">{t("sales.email")}</h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">{t("panel.emailIntro")}</p>
        </header>
        <div className="space-y-3 p-4 sm:p-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
              {t("panel.emailAddress")}
            </p>
            <p className="mt-1 break-all text-sm font-medium text-foreground">{email || "—"}</p>
          </div>
          <VerifyEmailRow verified={verified} />
        </div>
      </section>

      {/* Name */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
        <header className="border-b border-[var(--border)] bg-[var(--background)]/50 p-4 sm:px-6">
          <h2 className="text-base font-semibold text-foreground">{t("panel.displayName")}</h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">{t("panel.displayNameIntro")}</p>
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
          {t("panel.signOut")}
        </button>
      </form>
    </div>
  );
}
