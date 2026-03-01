import Link from "next/link";
import { signup } from "@/lib/actions/auth";
import { SubmitButton } from "./submit-button";
import { ThemeSwitch } from "@/components/theme-switch";
import { GoogleSignInButton } from "@/components/google-signin-button";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12 relative">
      <div className="absolute top-4 right-4">
        <ThemeSwitch />
      </div>
      <div className="w-full max-w-[400px]">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 shadow-sm">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Daftar
            </h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Buat akun sebagai pelanggan
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
                Cek email Anda untuk verifikasi akun, lalu masuk.
              </p>
            </div>
          )}
          <GoogleSignInButton label="Daftar dengan Google" />
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--border)]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-[var(--card)] text-[var(--muted)]">atau</span>
            </div>
          </div>
          <form action={signup} className="space-y-5">
            <div>
              <label
                htmlFor="full_name"
                className="block text-sm font-medium text-foreground mb-1.5"
              >
                Nama lengkap
              </label>
              <input
                id="full_name"
                name="full_name"
                type="text"
                autoComplete="name"
                required
                className="w-full px-4 py-2.5 border border-[var(--border)] rounded-lg bg-background text-foreground transition-all duration-200 focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent hover:border-[var(--muted)]/50"
                placeholder="John Doe"
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
                autoComplete="new-password"
                required
                minLength={6}
                className="w-full px-4 py-2.5 border border-[var(--border)] rounded-lg bg-background text-foreground transition-all duration-200 focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent hover:border-[var(--muted)]/50"
              />
              <p className="mt-1 text-xs text-[var(--muted)]">Minimal 6 karakter</p>
            </div>
            <SubmitButton />
          </form>
            <p className="mt-6 text-center text-sm text-[var(--muted)]">
            Sudah punya akun?{" "}
            <Link
              href="/login"
              className="font-medium text-[var(--primary)] hover:underline underline-offset-2 transition-colors duration-200 hover:opacity-90"
            >
              Masuk
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
