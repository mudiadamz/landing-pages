"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "./profiles";

const HONEYPOT_FIELD = "fax"; // obscure name so autofill/bots don't match

export type ContactSubmission = {
  id: string;
  name: string;
  email: string;
  message: string;
  created_at: string;
};

export async function submitContact(formData: FormData) {
  const honeypot = formData.get(HONEYPOT_FIELD) as string | null;
  if (honeypot && String(honeypot).trim() !== "") {
    return { ok: true }; // pretend success to not tip off bots
  }

  const name = (formData.get("name") as string)?.trim() ?? "";
  const email = (formData.get("email") as string)?.trim() ?? "";
  const message = (formData.get("message") as string)?.trim() ?? "";

  if (!name || !email || !message) {
    return { ok: false, error: "Nama, email, dan pesan wajib diisi." };
  }

  if (message.length < 10) {
    return { ok: false, error: "Pesan minimal 10 karakter." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("contacts").insert({
    name,
    email,
    message,
  });

  if (error) {
    console.error("Contact submit error:", error);
    return { ok: false, error: "Gagal mengirim. Coba lagi nanti." };
  }

  return { ok: true };
}

export async function getContactsForAdmin(): Promise<ContactSubmission[]> {
  const isAdmin = await requireAdmin();
  if (!isAdmin) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("id, name, email, message, created_at")
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data ?? []) as ContactSubmission[];
}
