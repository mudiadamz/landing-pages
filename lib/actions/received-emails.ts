"use server";

import { createClient } from "@/lib/supabase/server";
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

export async function getReceivedEmailsForAdmin(): Promise<ReceivedEmailRow[]> {
  const isAdmin = await requireAdmin();
  if (!isAdmin) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("received_emails")
    .select("*")
    .order("received_at", { ascending: false });

  if (error) return [];
  return (data ?? []) as ReceivedEmailRow[];
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
