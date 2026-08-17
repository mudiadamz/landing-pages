"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { guardSignup } from "@/lib/signup-guard";
import { sendVerificationEmail } from "@/lib/email-verify";
import { currentOrigin } from "@/lib/site-resolve";
import { googleCallbackUrl } from "@/lib/oauth-return";
import { safeNextPath } from "@/lib/next-path";

export async function login(formData: FormData) {
  const supabase = await createClient();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const next = safeNextPath(formData.get("next") as string);
  // /panel is the default, not the rule: a sign-in that started on a storefront
  // page carries where it came from, and goes back there.
  const redirectTo = next ?? "/panel";

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const url = next ? `/login?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}` : `/login?error=${encodeURIComponent(error.message)}`;
    redirect(url);
  }

  redirect(redirectTo);
}

export async function signup(formData: FormData) {
  const supabase = await createClient();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const fullName = (formData.get("full_name") as string)?.trim() ?? "";

  // The domain the visitor is actually on, not a baked-in one: sending someone
  // who signed in on a niche storefront back to admuiux.com would set the session
  // cookie on the wrong host, and they would look logged out where they started.
  const baseUrl = await currentOrigin();
  // Carried through so someone who signs up mid-purchase lands back on the
  // product they were buying rather than the panel.
  const safeNext = safeNextPath(formData.get("next") as string);
  const withNext = (path: string) =>
    safeNext ? `${path}${path.includes("?") ? "&" : "?"}next=${encodeURIComponent(safeNext)}` : path;

  // Before auth, always: a rejected attempt must not cost us a confirmation
  // email or a row in lp_profiles. "silent" lands on the same screen a real
  // signup does, so a script can't tell it was caught.
  const guard = await guardSignup(formData);
  if (guard.verdict === "silent") {
    redirect(withNext("/signup?message=check_email"));
  }
  if (guard.verdict === "reject") {
    redirect(withNext(`/signup?error=${encodeURIComponent(guard.message)}`));
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: withNext(`${baseUrl}/login`),
    },
  });

  if (error) {
    redirect(withNext(`/signup?error=${encodeURIComponent(error.message)}`));
  }

  // Our own verification mail, sent alongside the session rather than in front
  // of it — the account works immediately and the panel nags until it's done.
  // Awaited so a Vercel function isn't frozen mid-send, but never fatal.
  if (data.user) {
    await sendVerificationEmail({ to: email, userId: data.user.id, name: fullName, origin: baseUrl });
  }

  if (data.session) {
    redirect(safeNext ?? "/panel");
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (!signInError) {
    redirect(safeNext ?? "/panel");
  }

  redirect(withNext("/signup?message=check_email"));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function signInWithGoogle(formData?: FormData) {
  const supabase = await createClient();
  const next = (formData?.get("next") as string)?.trim();
  // Sending someone who signed in on a niche storefront back to admuiux.com would
  // set the session cookie on the wrong host, and they would look logged out where
  // they started. But naming that storefront here doesn't work either — Supabase
  // silently swaps out a redirect_to it hasn't been told about. So the return trip
  // goes through the one URL it does know, which bounces back. See
  // lib/oauth-return.ts for why the code, not the session, is what travels.
  const redirectTo = await googleCallbackUrl(safeNextPath(next));
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      // No `prompt: "consent"` / `access_type: "offline"`: forcing the consent
      // screen every login adds an approval step for returning users, and we
      // never use Google's refresh token (Supabase manages the session). With
      // the defaults, users who've authorized once are redirected straight
      // through — at most a quick account picker.
      redirectTo,
    },
  });
  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }
  if (data.url) {
    redirect(data.url);
  }
  redirect("/login?error=Could not initiate Google sign in");
}

/**
 * Re-send our verification link (banner button). Goes through Resend, not
 * supabase.auth.resend — Supabase's mailer is capped at 2 messages an hour for
 * the whole project, so that button used to be a no-op most of the time.
 */
export type ResendState = { ok: boolean; message: string } | null;

export async function resendVerification(
  _prev: ResendState,
  _formData: FormData,
): Promise<ResendState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, message: "Sesi berakhir. Muat ulang halaman." };

  const sent = await sendVerificationEmail({
    to: user.email,
    userId: user.id,
    name: (user.user_metadata?.full_name as string | undefined) ?? null,
    origin: await currentOrigin(),
  });
  return sent
    ? { ok: true, message: `Link verifikasi dikirim ke ${user.email}.` }
    : { ok: false, message: "Gagal mengirim. Coba lagi sebentar lagi." };
}
