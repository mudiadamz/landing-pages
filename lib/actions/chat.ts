"use server";

/**
 * MbahGPT: everything about a chat EXCEPT producing the reply.
 *
 * Sessions, preferences and memories are ordinary mutations, so they are Server
 * Actions per invariant I4 — one place for authorisation, and no hand-written
 * endpoint to keep in sync with the client.
 *
 * The one thing that is NOT here is the chat turn itself: streaming a reply token
 * by token needs a response body the caller can read while it is still being
 * written, which a Server Action cannot give. That lives in
 * `app/api/mbahgpt/chat/route.ts` and is the documented exception.
 *
 * Authorisation is RLS, not code: every table is owner-only (see the migration),
 * and these functions use the cookie-based client, so a missing `.eq("user_id")`
 * cannot leak somebody else's conversation. `requireUser()` exists to give a
 * clear error rather than a silent empty list.
 */

import { createClient } from "@/lib/supabase/server";
import { currentSiteId } from "@/lib/site-resolve";
import { ANSWER_LOCK_STALE_MS } from "@/lib/mbahgpt/config";
import { chatMessagesUsed } from "@/lib/mbahgpt/quota";
import { getPlanLimits } from "@/lib/actions/site-settings";
import { effectivePlan, resolvePlanLimits, type PlanKey, type PlanLimits } from "@/lib/plans";
import { t } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";

export type ChatSessionRow = {
  id: string;
  title: string;
  updated_at: string;
  /** Messages in the thread — what the sidebar shows under the title. */
  messages: number;
  /** A reply is being produced right now (fresh answer lock). */
  streaming: boolean;
};

export type ChatMessageRow = {
  id: string;
  role: "user" | "assistant";
  content: string;
  reasoning: string | null;
  sources: { title: string; url: string }[];
  created_at: string;
  attachments: ChatAttachmentRow[];
};

export type ChatAttachmentRow = {
  id: string;
  name: string;
  mime: string;
  kind: "image" | "document";
  size: number;
};

export type ChatMemoryRow = {
  id: string;
  text: string;
  pinned: boolean;
  created_at: string;
};

/**
 * The caller, plus the language to answer them in.
 *
 * The locale is resolved per call and passed to `t` explicitly — never held in a
 * module-level "current locale", because one server renders every tenant at once
 * and a mutable global would leak one visitor's language into another's response.
 */
async function requireUser() {
  const [supabase, locale] = await Promise.all([createClient(), requestLocale()]);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, locale, userId: user?.id ?? null };
}

/** Collapse runs of whitespace — the form a memory is stored and deduped in. */
function normalise(text: string): string {
  return (text || "").split(/\s+/).filter(Boolean).join(" ");
}

// -- sessions ---------------------------------------------------------------
export async function listChatSessions(): Promise<ChatSessionRow[]> {
  const { supabase, userId } = await requireUser();
  if (!userId) return [];

  // The message count comes from an embedded aggregate rather than a second
  // round trip per row: the sidebar shows it for every session, and N+1 queries
  // there is how a sidebar starts costing more than the conversation.
  const { data, error } = await supabase
    .from("lp_chat_sessions")
    .select("id, title, updated_at, answering_at, lp_chat_messages(count)")
    .order("updated_at", { ascending: false });
  if (error) return [];

  const staleBefore = Date.now() - ANSWER_LOCK_STALE_MS;
  type Row = {
    id: string;
    title: string;
    updated_at: string;
    answering_at: string | null;
    lp_chat_messages: { count: number }[] | { count: number } | null;
  };

  return ((data ?? []) as Row[]).map((row) => {
    const rel = row.lp_chat_messages;
    const count = Array.isArray(rel) ? (rel[0]?.count ?? 0) : (rel?.count ?? 0);
    // An expired lock is not a running reply: a generation killed mid-flight
    // (deploy, timeout, crash) would otherwise show a pulsing dot forever.
    const answering = row.answering_at ? new Date(row.answering_at).getTime() > staleBefore : false;
    return { id: row.id, title: row.title, updated_at: row.updated_at, messages: count, streaming: answering };
  });
}

export async function getChatSession(
  sessionId: string,
): Promise<{ session: { id: string; title: string } | null; messages: ChatMessageRow[] }> {
  const { supabase, userId } = await requireUser();
  if (!userId) return { session: null, messages: [] };

  const { data: session } = await supabase
    .from("lp_chat_sessions")
    .select("id, title")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return { session: null, messages: [] };

  const { data } = await supabase
    .from("lp_chat_messages")
    .select("id, role, content, reasoning, sources, created_at, lp_chat_attachments(id, name, mime, kind, size)")
    .eq("session_id", sessionId)
    // created_at then id, matching the index: two rows written in one turn are
    // microseconds apart, and the id keeps the order total rather than arbitrary.
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  type Row = Omit<ChatMessageRow, "sources" | "attachments"> & {
    sources: unknown;
    lp_chat_attachments: ChatAttachmentRow[] | null;
  };

  const messages = ((data ?? []) as Row[]).map(({ lp_chat_attachments, sources, ...rest }) => ({
    ...rest,
    sources: Array.isArray(sources) ? (sources as { title: string; url: string }[]) : [],
    attachments: lp_chat_attachments ?? [],
  }));

  return { session, messages };
}

/**
 * A new, empty session.
 *
 * The chat route also creates one on the first message, which is the path the UI
 * normally takes — "+ Chat baru" only clears the screen. This exists for the case
 * where a session has to exist before a message does (e.g. attaching files first).
 */
export async function createChatSession(): Promise<{ id: string } | { error: string }> {
  const { supabase, userId, locale } = await requireUser();
  if (!userId) return { error: t("chat.signInRequired", undefined, locale) };

  const siteId = await currentSiteId();
  const { data, error } = await supabase
    .from("lp_chat_sessions")
    .insert({ user_id: userId, site_id: siteId || null })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message || t("chat.createFailed", undefined, locale) };
  return { id: data.id };
}

export async function renameChatSession(sessionId: string, title: string): Promise<{ error?: string }> {
  const { supabase, userId, locale } = await requireUser();
  if (!userId) return { error: t("chat.signInShort", undefined, locale) };
  const clean = normalise(title).slice(0, 120);
  if (!clean) return { error: t("chat.titleRequired", undefined, locale) };

  const { error } = await supabase.from("lp_chat_sessions").update({ title: clean }).eq("id", sessionId);
  return error ? { error: error.message } : {};
}

export async function deleteChatSession(sessionId: string): Promise<{ error?: string }> {
  const { supabase, userId, locale } = await requireUser();
  if (!userId) return { error: t("chat.signInShort", undefined, locale) };

  // Messages and attachment ROWS go with it (ON DELETE CASCADE). The stored files
  // are removed first, because once the rows are gone their paths are unknown and
  // the objects would sit in the bucket forever.
  const { data: files } = await supabase
    .from("lp_chat_attachments")
    .select("storage_path, lp_chat_messages!inner(session_id)")
    .eq("lp_chat_messages.session_id", sessionId);

  const paths = ((files ?? []) as { storage_path: string }[]).map((f) => f.storage_path).filter(Boolean);
  if (paths.length) {
    await supabase.storage.from("chat-attachments").remove(paths);
  }

  const { error } = await supabase.from("lp_chat_sessions").delete().eq("id", sessionId);
  return error ? { error: error.message } : {};
}

// -- account ----------------------------------------------------------------
export type ChatAccount = {
  fullName: string | null;
  email: string | null;
  avatarUrl: string | null;
  plan: PlanKey;
  planExpiresAt: string | null;
  limits: PlanLimits;
  /** Chat turns spent in the rolling window. */
  used: number;
};

/**
 * Who is signed in, on what plan, and how much of it is left.
 *
 * ONE action rather than a profile reader and a plan reader, because both the
 * sidebar row and the preferences dialog need all of it and the sidebar renders
 * on every page load — two round trips for one row of avatar-name-tier is a cost
 * paid by every visitor on the critical path of the chat.
 *
 * No row is not an error: a profile is created lazily elsewhere, so a brand-new
 * account falls back to the address it signed up with and the free plan.
 */
export async function getChatAccount(): Promise<ChatAccount | null> {
  const { supabase, userId } = await requireUser();
  if (!userId) return null;

  const [{ data: auth }, { data: profile }, overrides] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("lp_profiles").select("full_name, avatar_url, plan, plan_expires_at").eq("id", userId).maybeSingle(),
    getPlanLimits(),
  ]);

  const plan = effectivePlan(profile?.plan, profile?.plan_expires_at ?? null);
  return {
    fullName: profile?.full_name ?? (auth.user?.user_metadata?.full_name as string) ?? null,
    email: auth.user?.email ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    plan,
    planExpiresAt: profile?.plan_expires_at ?? null,
    limits: resolvePlanLimits(plan, overrides),
    used: await chatMessagesUsed(supabase, userId),
  };
}

// -- preferences ------------------------------------------------------------
export async function getChatPrefs(): Promise<{ responseInstructions: string }> {
  const { supabase, userId } = await requireUser();
  if (!userId) return { responseInstructions: "" };

  const { data } = await supabase
    .from("lp_chat_prefs")
    .select("response_instructions")
    .eq("user_id", userId)
    .maybeSingle();
  return { responseInstructions: data?.response_instructions ?? "" };
}

export async function saveChatPrefs(responseInstructions: string): Promise<{ error?: string }> {
  const { supabase, userId, locale } = await requireUser();
  if (!userId) return { error: t("chat.signInShort", undefined, locale) };

  const { error } = await supabase.from("lp_chat_prefs").upsert(
    {
      user_id: userId,
      // Capped: this text is prepended to every request in every chat, so an
      // accidental paste of a whole document would be paid for on each turn.
      response_instructions: (responseInstructions || "").slice(0, 4000),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  return error ? { error: error.message } : {};
}

// -- memories ---------------------------------------------------------------
export async function listChatMemories(): Promise<ChatMemoryRow[]> {
  const { supabase, userId } = await requireUser();
  if (!userId) return [];

  const { data } = await supabase
    .from("lp_chat_memories")
    .select("id, text, pinned, created_at")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });
  return (data ?? []) as ChatMemoryRow[];
}

/**
 * Store a fact. A duplicate is a no-op, not an error.
 *
 * Dedupe is the unique index on (user_id, lower(text)) — checked in the database
 * rather than by reading first and then writing, which two turns arriving together
 * would race past.
 */
export async function addChatMemory(text: string, pinned = false): Promise<ChatMemoryRow[]> {
  const { supabase, userId } = await requireUser();
  if (!userId) return [];
  const clean = normalise(text).slice(0, 300);
  if (!clean) return listChatMemories();

  const { error } = await supabase
    .from("lp_chat_memories")
    .insert({ user_id: userId, text: clean, pinned });
  // 23505 = unique violation: the same fact, already remembered.
  if (error && error.code !== "23505") return listChatMemories();
  return listChatMemories();
}

export async function updateChatMemory(
  memoryId: string,
  patch: { text?: string; pinned?: boolean },
): Promise<ChatMemoryRow[]> {
  const { supabase, userId } = await requireUser();
  if (!userId) return [];

  const update: { text?: string; pinned?: boolean } = {};
  if (typeof patch.text === "string") update.text = normalise(patch.text).slice(0, 300);
  if (typeof patch.pinned === "boolean") update.pinned = patch.pinned;
  if (!Object.keys(update).length) return listChatMemories();

  await supabase.from("lp_chat_memories").update(update).eq("id", memoryId);
  return listChatMemories();
}

export async function deleteChatMemory(memoryId: string): Promise<ChatMemoryRow[]> {
  const { supabase, userId } = await requireUser();
  if (!userId) return [];
  await supabase.from("lp_chat_memories").delete().eq("id", memoryId);
  return listChatMemories();
}
