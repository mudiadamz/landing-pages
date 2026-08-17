import { safeNextPath } from "@/lib/next-path";
import Link from "next/link";
import { translator } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";
import { signup } from "@/lib/actions/auth";
import {
  captchaSiteKey,
  CAPTCHA_FIELD,
  issueSignupToken,
  SIGNUP_HONEYPOT_FIELD,
  SIGNUP_TOKEN_FIELD,
} from "@/lib/signup-guard";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { SubmitButton } from "./submit-button";
import { GoogleSignInButton } from "@/components/google-signin-button";
import { CheckoutIntent } from "../login/checkout-intent";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; next?: string }>;
}) {
  const t = translator(await requestLocale());
  const params = await searchParams;
  const next = safeNextPath(params.next) ?? undefined;
  // Null until Turnstile is configured; the guard skips the check to match.
  const siteKey = captchaSiteKey();
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
        <CheckoutIntent next={next} />
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 shadow-sm">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {t("auth.signUp")}
            </h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {t("auth.signUpSubtitle")}
            </p>
          </div>
          {params.error && (
            <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-4 py-3">
              <p className="text-sm text-red-700 dark:text-red-300">{params.error}</p>
            </div>
          )}
          {params.message === "check_email" && (
            <div className="mb-4 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 px-4 py-3">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                {t("auth.checkEmail")}
              </p>
            </div>
          )}
          <GoogleSignInButton label={t("auth.signUpGoogle")} next={next} />
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--border)]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-[var(--card)] text-[var(--muted)]">{t("analytics.engOr")}</span>
            </div>
          </div>
          <form action={signup} className="space-y-5">
            {next && <input type="hidden" name="next" value={next} />}
            {/* Signed render time — proves the form is ours and how long it was
                open. See lib/signup-guard. */}
            <input type="hidden" name={SIGNUP_TOKEN_FIELD} value={issueSignupToken()} />
            {/* Honeypot: off-screen, unreachable by keyboard; bots fill it. */}
            <div
              className="absolute -left-[9999px] top-0 h-0 w-0 overflow-hidden opacity-0 pointer-events-none"
              aria-hidden
            >
              <label htmlFor={SIGNUP_HONEYPOT_FIELD}>{t("contact.honeypot")}</label>
              <input
                id={SIGNUP_HONEYPOT_FIELD}
                name={SIGNUP_HONEYPOT_FIELD}
                type="text"
                tabIndex={-1}
                autoComplete="off"
              />
            </div>
            <div>
              <label
                htmlFor="full_name"
                className="block text-sm font-medium text-foreground mb-1.5"
              >
                {t("panel.fullName")}
              </label>
              <input
                id="full_name"
                name="full_name"
                type="text"
                autoComplete="name"
                required
                className="w-full px-4 py-2.5 border border-[var(--border)] rounded-lg bg-background text-foreground transition-all duration-200 focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent hover:border-[var(--muted)]/50"
                placeholder={t("auth.namePlaceholder")}
              />
            </div>
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
                autoComplete="new-password"
                required
                minLength={6}
                className="w-full px-4 py-2.5 border border-[var(--border)] rounded-lg bg-background text-foreground transition-all duration-200 focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent hover:border-[var(--muted)]/50"
              />
              <p className="mt-1 text-xs text-[var(--muted)]">{t("auth.minPassword")}</p>
            </div>
            {siteKey && <TurnstileWidget siteKey={siteKey} field={CAPTCHA_FIELD} />}
            <SubmitButton />
          </form>
            <p className="mt-6 text-center text-sm text-[var(--muted)]">
            {t("auth.haveAccount")}{" "}
            <Link
              href="/login"
              className="font-medium text-[var(--primary)] hover:underline underline-offset-2 transition-colors duration-200 hover:opacity-90"
            >
              {t("nav.signIn")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
