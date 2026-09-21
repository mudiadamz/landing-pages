"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/db/admin";
import { requireFeature } from "./profiles";

export type ReceivedEmailRow = {
  id: string;
  resend_email_id: string;
  from_address: string;
  from_name: string | null;
  to_addresses: string[];
  subject: string;
  body_text: string | null;
  body_html: string | null;
  received_at: string;
  created_at: string;
};

export type ReceivedEmailListItem = Pick<
  ReceivedEmailRow,
  "id" | "from_address" | "from_name" | "subject" | "received_at"
>;

export async function getReceivedEmailsForAdmin(): Promise<ReceivedEmailListItem[]> {
  const isAdmin = await requireFeature("inbox");
  if (!isAdmin) return [];

  // Service role behind the gate above — the same shape as deleteReceivedEmail.
  // The inbox used to be read through the user client under an RLS policy
  // that let ANY signed-in user read it, so one PostgREST call from a customer's
  // browser returned the whole support inbox. That policy is gone
  // (20260919030000); requireFeature("inbox") is now the only way in.
  const db = createAdminClient();
  const { data, error } = await db
    .from("lp_received_emails")
    .select("id, from_address, from_name, subject, received_at")
    .order("received_at", { ascending: false });

  if (error) return [];
  return (data ?? []) as ReceivedEmailListItem[];
}

export async function getReceivedEmailById(id: string): Promise<ReceivedEmailRow | null> {
  const isAdmin = await requireFeature("inbox");
  if (!isAdmin) return null;

  const db = createAdminClient();
  const { data, error } = await db
    .from("lp_received_emails")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data as ReceivedEmailRow;
}

export async function deleteReceivedEmail(id: string) {
  const isAdmin = await requireFeature("inbox");
  if (!isAdmin) return { error: "Forbidden" };

  const db = createAdminClient();
  const { error } = await db
    .from("lp_received_emails")
    .delete()
    .eq("id", id);

  if (error) return { error: "Gagal menghapus email" };

  revalidatePath("/panel/inbox");
  return { success: true };
}
