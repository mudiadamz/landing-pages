import Link from "next/link";
import { login } from "@/lib/actions/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-foreground">Sign in</h1>
          <p className="mt-1 text-sm text-foreground/70">
            Landing page manager
          </p>
        </div>
        {params.error && (
          <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950/30 dark:text-red-400 px-3 py-2 rounded-md">
            {params.error}
          </p>
        )}
        <form action={login} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-foreground mb-1"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full px-3 py-2 border border-foreground/20 rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/30"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-foreground mb-1"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full px-3 py-2 border border-foreground/20 rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/30"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2 px-4 bg-foreground text-background font-medium rounded-md hover:opacity-90 transition"
          >
            Sign in
          </button>
        </form>
        <p className="text-center text-sm text-foreground/70">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="underline hover:no-underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
