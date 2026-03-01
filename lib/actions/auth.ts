"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  const supabase = await createClient();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const next = (formData.get("next") as string)?.trim();
  const redirectTo = next && next.startsWith("/") ? next : "/panel";

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

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${baseUrl}/login`,
    },
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }

  if (data.session) {
    redirect("/panel");
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (!signInError) {
    redirect("/panel");
  }

  redirect("/signup?message=check_email");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function signInWithGoogle(formData?: FormData) {
  const supabase = await createClient();
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const next = (formData?.get("next") as string)?.trim();
  const redirectTo = next && next.startsWith("/")
    ? `${baseUrl}/auth/callback?next=${encodeURIComponent(next)}`
    : `${baseUrl}/auth/callback`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: { access_type: "offline", prompt: "consent" },
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

export async function resendVerification(_formData?: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return;
  await supabase.auth.resend({
    type: "signup",
    email: user.email,
  });
}
