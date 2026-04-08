"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "./profiles";

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
  const isAdmin = await requireAdmin();
  if (!isAdmin) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("received_emails")
    .select("id, from_address, from_name, subject, received_at")
    .order("received_at", { ascending: false });

  if (error) return [];
  return (data ?? []) as ReceivedEmailListItem[];
}

export async function getReceivedEmailById(id: string): Promise<ReceivedEmailRow | null> {
  const isAdmin = await requireAdmin();
  if (!isAdmin) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("received_emails")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data as ReceivedEmailRow;
}

export async function deleteReceivedEmail(id: string) {
  const isAdmin = await requireAdmin();
  if (!isAdmin) return { error: "Forbidden" };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("received_emails")
    .delete()
    .eq("id", id);

  if (error) return { error: "Gagal menghapus email" };

  revalidatePath("/panel/inbox");
  return { success: true };
}
