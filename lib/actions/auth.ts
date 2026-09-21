"use server";

import { redirect } from "next/navigation";
import { AuthError, signUpWithPassword, verifyPassword } from "@/lib/backend/auth";
import { googleConfig, startGoogle } from "@/lib/backend/google";
import { currentUser, endSession, setOAuthPending, startSession } from "@/lib/auth/session";
import { clientIp, guardSignup } from "@/lib/signup-guard";
import { sendVerificationEmail } from "@/lib/email-verify";
import { currentOrigin, currentSiteId } from "@/lib/site-resolve";
import { googleRedirect } from "@/lib/oauth-return";
import { safeNextPath } from "@/lib/next-path";
import { ensureSiteMembership } from "@/lib/actions/profiles";

export async function login(formData: FormData) {
  const email = formData.get("email");
  const password = formData.get("password");
  const next = safeNextPath(formData.get("next") as string);
  // /panel is the default, not the rule: a sign-in that started on a storefront
  // page carries where it came from, and goes back there.
  const redirectTo = next ?? "/panel";

  let failure: string | null = null;
  try {
    const user = await verifyPassword(email, password, await clientIp());
    await startSession(user.id);
  } catch (e) {
    if (!(e instanceof AuthError)) throw e;
    failure = e.message;
  }

  if (failure) {
    const url = next ? `/login?error=${encodeURIComponent(failure)}&next=${encodeURIComponent(next)}` : `/login?error=${encodeURIComponent(failure)}`;
    redirect(url);
  }

  redirect(redirectTo);
}

export async function signup(formData: FormData) {
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

  let user;
  try {
    user = await signUpWithPassword({ email: formData.get("email"), password: formData.get("password"), fullName });
  } catch (e) {
    if (!(e instanceof AuthError)) throw e;
    redirect(withNext(`/signup?error=${encodeURIComponent(e.message)}`));
  }

  // Anggota situs tempat dia MENDAFTAR, bukan situs kanonik: signup berjalan
  // di storefront yang dia buka, dan host itulah satu-satunya jawaban yang
  // tidak mengarang atribusi (fase 5, docs/plans/hierarchical-users.md).
  await ensureSiteMembership(user.id, await currentSiteId());
  await startSession(user.id);
  // Our own verification mail, sent alongside the session rather than in front
  // of it — the account works immediately and the panel nags until it's done.
  // Awaited so the send finishes before the response ends, but never fatal.
  await sendVerificationEmail({ to: user.email!, userId: user.id, name: fullName, origin: baseUrl });

  redirect(safeNext ?? "/panel");
}

export async function signOut() {
  await endSession();
  redirect("/login");
}

export async function signInWithGoogle(formData?: FormData) {
  const next = safeNextPath((formData?.get("next") as string)?.trim());
  if (!googleConfig()) {
    redirect(`/login?error=${encodeURIComponent("Masuk dengan Google belum dikonfigurasi.")}`);
  }
  // Sending someone who signed in on a niche storefront back to admuiux.com would
  // set the session cookie on the wrong host, and they would look logged out where
  // they started. See lib/oauth-return.ts for how the return trip goes through the
  // one callback Google knows, and why the code, not the session, is what travels.
  const { redirectUri, returnHost } = await googleRedirect();
  // No `prompt: "consent"`: forcing the consent screen every login adds an
  // approval step for returning users, and we never use Google's refresh token.
  const { url, pending } = startGoogle({ redirectUri, returnHost, next });
  await setOAuthPending(pending);
  redirect(url);
}

/**
 * Re-send our verification link (banner button). Goes through Resend — it once
 * used Supabase's mailer, capped at 2 messages an hour for the whole project,
 * so that button used to be a no-op most of the time.
 */
export type ResendState = { ok: boolean; message: string } | null;

export async function resendVerification(
  _prev: ResendState,
  _formData: FormData,
): Promise<ResendState> {
  const user = await currentUser();
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
