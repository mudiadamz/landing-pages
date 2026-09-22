import { safeNextPath } from "@/lib/next-path";
import Link from "next/link";
import { translator } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";
import { login } from "@/lib/actions/auth";
import { SubmitButton } from "./submit-button";
import { GoogleSignInButton } from "@/components/google-signin-button";
import { CheckoutIntent } from "./checkout-intent";
import { SiteLogo } from "@/components/site-logo";
import { siteBrand } from "@/lib/site-brand";
import { currentSite } from "@/lib/site-resolve";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const t = translator(await requestLocale());
  const params = await searchParams;
  const next = safeNextPath(params.next) ?? undefined;
  // The storefront being served, not the canonical one. This line used to read
  // "Storefront" on every domain — the sign-in box for a niche storefront named a
  // company the visitor had never heard of, which is both wrong and alarming on
  // the one screen where you're about to type a password.
  const brand = siteBrand(await currentSite());
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12 relative">
      <Link
        href="/"
        className="absolute top-4 left-4 flex items-center gap-2 text-sm text-[var(--muted)] hover:text-foreground transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        {t("auth.backHome")}
      </Link>
      <div className="absolute top-4 right-4">
        {/* Toggle hidden on public pages for now — see components/site-header.tsx. */}
      </div>
      <div className="w-full max-w-[400px]">
        {/* When the visitor came from a buy button, lead with what they're
            signing in for. */}
        <CheckoutIntent next={next} />
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 shadow-sm">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Masuk
            </h1>
            <div className="mt-2 flex justify-center">
              <SiteLogo
                brand={brand}
                imgClassName="h-8 w-auto max-w-[200px]"
                markClassName="h-4 w-4"
                nameClassName="text-sm text-[var(--muted)]"
              />
            </div>
          </div>
          {params.error && (
            <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-4 py-3">
              <p className="text-sm text-red-700 dark:text-red-300">{params.error}</p>
            </div>
          )}
          <GoogleSignInButton label={t("reader.signInGoogle")} next={next} />
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--border)]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-[var(--card)] text-[var(--muted)]">{t("analytics.engOr")}</span>
            </div>
          </div>
          <form action={login} className="space-y-5">
            {next && <input type="hidden" name="next" value={next} />}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-foreground mb-1.5"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="w-full px-4 py-2.5 border border-[var(--border)] rounded-lg bg-background text-foreground transition-all duration-200 focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent hover:border-[var(--muted)]/50"
                placeholder={t("auth.emailExample")}
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-foreground mb-1.5"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="w-full px-4 py-2.5 border border-[var(--border)] rounded-lg bg-background text-foreground transition-all duration-200 focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent hover:border-[var(--muted)]/50"
              />
            </div>
            <SubmitButton />
          </form>
            <p className="mt-6 text-center text-sm text-[var(--muted)]">
            {t("auth.noAccount")}{" "}
            <Link
              href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}
              className="font-medium text-[var(--primary)] hover:underline underline-offset-2 transition-colors duration-200 hover:opacity-90"
            >
              {t("auth.signUp")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
