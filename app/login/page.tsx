import Link from "next/link";
import { login } from "@/lib/actions/auth";
import { SubmitButton } from "./submit-button";
import { ThemeSwitch } from "@/components/theme-switch";
import { GoogleSignInButton } from "@/components/google-signin-button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const next = params.next && params.next.startsWith("/") ? params.next : undefined;
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12 relative">
      <Link
        href="/"
        className="absolute top-4 left-4 flex items-center gap-2 text-sm text-[var(--muted)] hover:text-foreground transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back home
      </Link>
      <div className="absolute top-4 right-4">
        <ThemeSwitch />
      </div>
      <div className="w-full max-w-[400px]">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 shadow-sm">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Masuk
            </h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              ADM.UIUX
            </p>
          </div>
          {params.error && (
            <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-4 py-3">
              <p className="text-sm text-red-700 dark:text-red-300">{params.error}</p>
            </div>
          )}
          <GoogleSignInButton label="Masuk dengan Google" next={next} />
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--border)]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-[var(--card)] text-[var(--muted)]">atau</span>
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
                placeholder="you@example.com"
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
            Belum punya akun?{" "}
            <Link
              href="/signup"
              className="font-medium text-[var(--primary)] hover:underline underline-offset-2 transition-colors duration-200 hover:opacity-90"
            >
              Daftar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
