"use server";

import { createClient } from "@/lib/db/server";
import { requireFeature } from "./profiles";
import { currentSiteId } from "@/lib/site-resolve";
import { panelScope } from "@/lib/site-scope";

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

  const db = await createClient();
  const { error } = await db.from("lp_contacts").insert({
    name,
    email,
    message,
    // Which storefront the form was submitted from, so /panel/contacts can be scoped.
    site_id: (await currentSiteId()) || null,
  });

  if (error) {
    console.error("Contact submit error:", error);
    return { ok: false, error: "Gagal mengirim. Coba lagi nanti." };
  }

  return { ok: true };
}

export async function getContactsForAdmin(): Promise<ContactSubmission[]> {
  const isAdmin = await requireFeature("contacts");
  if (!isAdmin) return [];

  const db = await createClient();
  // Scoped to the storefront the panel is managing; messages sent before the site_id
  // column existed count with the canonical site.
  const { filter: scope } = await panelScope();
  let query = db
    .from("lp_contacts")
    .select("id, name, email, message, created_at")
    .order("created_at", { ascending: false });
  if (scope) query = query.or(scope.or);
  const { data, error } = await query;

  if (error) return [];
  return (data ?? []) as ContactSubmission[];
}
