/**
 * How much of a plan's chat quota is already spent.
 *
 * Takes the Supabase client rather than making one: the chat route already holds
 * a request-scoped client, and the preferences dialog reads this through a Server
 * Action that holds another. Two clients for one count would be one more thing
 * that can disagree about who is asking.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The quota window. Rolling, not calendar — see `PlanLimits.chatMessagesPerDay`
 * for why midnight is a question this deployment cannot answer.
 */
export const QUOTA_WINDOW_MS = 24 * 60 * 60 * 1000;

/** User turns in the last 24 hours. Assistant replies are not charged for. */
export async function chatMessagesUsed(
  supabase: SupabaseClient,
  userId: string,
  now = Date.now(),
): Promise<number> {
  const since = new Date(now - QUOTA_WINDOW_MS).toISOString();
  const { count, error } = await supabase
    .from("lp_chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("role", "user")
    .gte("created_at", since);

  // A failed count must not hand out free turns: treat "unknown" as spent. The
  // alternative — assuming zero — makes a database blip into an open quota.
  if (error) return Number.MAX_SAFE_INTEGER;
  return count ?? 0;
}

/** When the oldest turn in the window falls out of it, so the UI can say "in 3h". */
export function quotaResetsAt(oldestInWindow: string | null, now = Date.now()): Date | null {
  if (!oldestInWindow) return null;
  const at = new Date(oldestInWindow).getTime();
  if (Number.isNaN(at)) return null;
  return new Date(at + QUOTA_WINDOW_MS > now ? at + QUOTA_WINDOW_MS : now);
}
