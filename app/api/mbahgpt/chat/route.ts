import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { currentSiteId } from "@/lib/site-resolve";
import {
  ANSWER_LOCK_STALE_MS,
  MAX_FILES,
  MAX_UPLOAD,
  MODEL,
  RATE_LIMIT,
  TEMPERATURE,
  WEB_RESULTS,
  chatConfigured,
} from "@/lib/mbahgpt/config";
import { extractMemories, rankMemories, systemPrompt, type ChatMemory } from "@/lib/mbahgpt/memory";
import {
  buildMessages,
  classify,
  followupHint,
  storageKind,
  trimHistory,
  type StoredMessage,
} from "@/lib/mbahgpt/messages";
import { UpstreamError, parseDelta, streamChat, toSources, type ChatMessage, type Source } from "@/lib/mbahgpt/openrouter";
import { contextBlock, expandQuery, runSearch, shouldSearch, stripWebPrefix } from "@/lib/mbahgpt/web-search";
import { translator } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";
import { effectivePlan, planLimits, withinLimit, PLANS, type PlanLimits } from "@/lib/plans";
import { chatMessagesUsed } from "@/lib/mbahgpt/quota";

/**
 * One chat turn: store the user's message, then stream the model's reply.
 *
 * WHY THIS IS A ROUTE HANDLER and not a Server Action (invariant I4 says
 * mutations are actions): the reply has to be readable while it is still being
 * written. A Server Action resolves once, with a finished value — there is no
 * body to follow. Everything about a chat that is not the token stream does live
 * in `lib/actions/chat.ts`.
 *
 * The wire format is deliberately unchanged from the standalone Python server:
 * OpenRouter's SSE lines are relayed VERBATIM, with our own events (`status`,
 * `sources`, `web_error`, `error`) written in the same `data: {…}` shape. That is
 * what let the browser-side stream reader port across without being rewritten.
 *
 * The browser sends only the NEW message. Context is rebuilt from Postgres on
 * every turn, so a reload, a second tab or a different device all see the same
 * conversation — the client holds no history of its own.
 *
 * ---- What the port had to give up, and why ----
 *
 * `server.py` produced replies in a worker thread writing into an in-memory
 * buffer, so a browser could reload mid-answer and re-attach via
 * `GET /api/stream/<id>`. That cannot survive here: there is no long-lived process
 * to hold the buffer, and the next request may land on a different instance.
 * Instead the partial answer is PERSISTED when the reader disconnects — the text
 * produced so far is in the transcript on reload, rather than the whole reply
 * being lost. Resuming the token stream itself is gone.
 *
 * Script execution (`tools.py`) is gone outright: it needs to spawn processes with
 * rlimits on a writable filesystem, none of which a serverless runtime has.
 */

// Long enough for a thinking model to finish a turn. Clamped by the hosting
// plan's own function limit, so a lower plan will cut a very long answer short —
// at which point the partial text is persisted, not lost.
export const maxDuration = 120;

type UploadRef = { path: string; name: string; mime: string; size: number };

type Body = {
  session_id?: string | null;
  content?: string;
  web?: "auto" | "on" | "off";
  retry?: boolean;
  attachments?: UploadRef[];
};

const encoder = new TextEncoder();

/** Our own event, in the same wire shape as OpenRouter's lines. */
function sse(obj: unknown): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(obj)}\n\n`);
}

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/** A bound translator, for the messages this route sends back. */
type Translate = ReturnType<typeof translator>;

export async function POST(req: NextRequest) {
  // The reader's language, resolved once per request and threaded down. Every
  // message this route can produce is read by a person, including the ones that
  // travel inside the stream.
  const [supabase, locale] = await Promise.all([createClient(), requestLocale()]);
  const t = translator(locale);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail(t("chat.signInRequired"), 401);

  // Said plainly rather than surfaced as a 500 from the first upstream call: an
  // unset key is a deployment state, not a bug in the request.
  if (!chatConfigured()) return fail(t("chat.notConfigured"), 503);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return fail(t("chat.badRequest"), 400);
  }

  const { text: content, forced } = stripWebPrefix((body.content ?? "").trim());
  const mode = body.web === "on" || body.web === "off" ? body.web : "auto";
  const uploads = Array.isArray(body.attachments) ? body.attachments : [];

  if (!content && !uploads.length) return fail(t("chat.emptyMessage"), 400);

  /**
   * The plan decides how much of this the caller gets.
   *
   * Read once, here, and threaded down — not read again inside the stream, where a
   * second lookup could disagree with the one the quota was checked against.
   */
  const { data: profile } = await supabase
    .from("lp_profiles")
    .select("plan, plan_expires_at")
    .eq("id", user.id)
    .maybeSingle();
  const plan = effectivePlan(profile?.plan, profile?.plan_expires_at ?? null);
  const limits = planLimits(plan);

  // The tighter of the two ceilings. The plan may narrow what the deployment
  // allows; it may never widen it.
  const fileCap = Math.min(MAX_FILES, limits.chatMaxFiles);
  if (uploads.length > fileCap) return fail(t("chat.maxFiles", { count: fileCap }), 400);

  // Files were uploaded straight to Storage by the browser (Server Actions and
  // route bodies are capped at ~4.5 MB on Vercel), so what arrives here is a set
  // of paths. Two things are checked: the path is inside this user's own folder,
  // and the type is one the model can actually be given. The byte ceiling that is
  // really ENFORCED is the bucket's own file_size_limit — `size` below is what the
  // browser claimed, and it is used for the running total and the UI only.
  for (const file of uploads) {
    if (!file?.path || !file.path.startsWith(`${user.id}/`)) {
      return fail(t("chat.unknownAttachment"), 400);
    }
    if (!classify(file.name ?? "", file.mime ?? "")) {
      return fail(t("chat.unsupportedType", { type: file.mime || file.name }), 400);
    }
  }
  const claimed = uploads.reduce((n, f) => n + (Number(f.size) || 0), 0);
  if (claimed > MAX_UPLOAD) return fail(t("chat.uploadTooBig"), 413);

  // Rate limit: this user's own messages in the last minute, counted in Postgres.
  // Per user rather than per IP — instances here are ephemeral so an in-process
  // counter would reset constantly, and several people share an IP behind NAT.
  if (RATE_LIMIT > 0) {
    const since = new Date(Date.now() - 60_000).toISOString();
    const { count } = await supabase
      .from("lp_chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("role", "user")
      .gte("created_at", since);
    if ((count ?? 0) >= RATE_LIMIT) return fail(t("chat.rateLimited"), 429);
  }

  // The plan's daily quota. A different guard from the rate limit above: that one
  // stops a burst, this one stops a day.
  const spent = await chatMessagesUsed(supabase, user.id);
  if (!withinLimit(spent, limits.chatMessagesPerDay)) {
    return fail(
      t("chat.quotaSpent", { plan: PLANS[plan].label, limit: limits.chatMessagesPerDay ?? 0 }),
      429,
    );
  }

  // -- session ---------------------------------------------------------------
  const requested = (body.session_id ?? "").trim();
  let sessionId: string;
  if (requested) {
    // RLS scopes this read to the caller, so "not found" covers both a bad id and
    // somebody else's chat — and says the same thing either way.
    const { data } = await supabase.from("lp_chat_sessions").select("id").eq("id", requested).maybeSingle();
    if (!data) return fail(t("chat.notFound"), 404);
    sessionId = requested;
  } else {
    const siteId = await currentSiteId();
    const { data, error } = await supabase
      .from("lp_chat_sessions")
      .insert({ user_id: user.id, site_id: siteId || null, model: MODEL })
      .select("id")
      .single();
    if (error || !data) return fail(t("chat.createFailed"), 500);
    sessionId = data.id;
  }

  // One reply per session at a time. The composer is disabled client-side too, but
  // a second tab or a stray script must not interleave two answers into one
  // conversation — and the browser cannot enforce that for the browser next door.
  const claimedAt = new Date().toISOString();
  const staleBefore = new Date(Date.now() - ANSWER_LOCK_STALE_MS).toISOString();
  const { data: locked } = await supabase
    .from("lp_chat_sessions")
    .update({ answering_at: claimedAt })
    .eq("id", sessionId)
    .or(`answering_at.is.null,answering_at.lt.${staleBefore}`)
    .select("id")
    .maybeSingle();
  if (!locked) return fail(t("chat.busy"), 409);

  const release = async () => {
    await supabase.from("lp_chat_sessions").update({ answering_at: null }).eq("id", sessionId);
  };

  try {
    return await runTurn({
      supabase,
      userId: user.id,
      sessionId,
      content,
      uploads,
      forced,
      mode,
      retry: !!body.retry,
      release,
      t,
      limits,
    });
  } catch (err) {
    await release();
    console.error("[mbahgpt] chat gagal:", err);
    return fail(t("chat.startFailed"), 500);
  }
}

type Ctx = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  sessionId: string;
  content: string;
  uploads: UploadRef[];
  forced: boolean;
  mode: "auto" | "on" | "off";
  retry: boolean;
  release: () => Promise<void>;
  t: Translate;
  limits: PlanLimits;
};

async function runTurn(ctx: Ctx): Promise<Response> {
  const { supabase, userId, sessionId, content, uploads, forced, mode, retry, limits } = ctx;

  // Earlier turns decide two things: whether a bare follow-up still needs the web,
  // and what the search query should actually say.
  const history = await loadHistory(supabase, sessionId);

  // A retry re-sends a message that already failed. "Failed to fetch" can mean the
  // request never arrived OR that it arrived and the connection then broke, so when
  // the stored transcript already ends with this exact message it is reused and
  // only the reply is regenerated — otherwise the turn would appear twice.
  const last = history[history.length - 1];
  const alreadyStored = retry && !!last && last.role === "user" && last.content === content;
  const prior = alreadyStored ? history.slice(0, -1) : history;

  const earlierUser = prior.filter((m) => m.role === "user").map((m) => m.content);
  const afterSearch = prior.slice(-2).some((m) => m.role === "assistant" && m.hadSources);
  // What the message asks for, and what the plan actually allows. Kept apart so
  // the UI can say "this needed the web and your plan does not include it" rather
  // than silently answering from training data and looking out of date.
  const wantsSearch = forced || mode === "on" || (mode === "auto" && shouldSearch(content, afterSearch));
  const searching = wantsSearch && limits.chatWebSearch;
  const searchLocked = wantsSearch && !limits.chatWebSearch;

  // -- store the user's message ---------------------------------------------
  if (!alreadyStored) {
    const { data: inserted, error: insertError } = await supabase
      .from("lp_chat_messages")
      .insert({ session_id: sessionId, user_id: userId, role: "user", content })
      .select("id")
      .single();
    if (insertError || !inserted) throw new Error(insertError?.message || "could not store the message");

    if (uploads.length) {
      await supabase.from("lp_chat_attachments").insert(
        uploads.map((file) => ({
          message_id: inserted.id,
          user_id: userId,
          name: (file.name || "file").slice(0, 120),
          mime: (file.mime || "application/octet-stream").split(";")[0].trim().toLowerCase(),
          kind: storageKind(classify(file.name ?? "", file.mime ?? "") ?? "text"),
          size: Math.max(0, Number(file.size) || 0),
          storage_path: file.path,
        })),
      );
    }

    // Name an untitled session after its first message. Guarded on title = '' so a
    // renamed chat is never overwritten by a later turn.
    const title = content.split(/\s+/).filter(Boolean).join(" ").slice(0, 60);
    if (title) {
      await supabase.from("lp_chat_sessions").update({ title }).eq("id", sessionId).eq("title", "");
    }
  }

  // "remember this: …" is captured BEFORE the model sees the message, so the fact
  // is available from this turn onward rather than only from the next one. Skipped
  // on a retry: the facts were already stored when the message first arrived, and
  // the dedupe index would make the chip say "0 saved" anyway.
  const captured = alreadyStored ? 0 : await captureMemories(supabase, userId, sessionId, content);

  const [prefs, memories] = await Promise.all([
    supabase.from("lp_chat_prefs").select("response_instructions").eq("user_id", userId).maybeSingle(),
    supabase.from("lp_chat_memories").select("id, text, pinned, created_at"),
  ]);

  const selected = rankMemories((memories.data ?? []) as ChatMemory[], content);
  let system = systemPrompt(prefs.data?.response_instructions ?? "", selected);

  const resolved = expandQuery(content, earlierUser);
  if (earlierUser.length && resolved !== content) {
    const hint = followupHint(resolved);
    system = system ? `${system}\n\n${hint}` : hint;
  }

  return streamTurn(ctx, { system, searching, searchLocked, resolved, captured });
}

/** Whether an assistant turn came from a search — enough to steer the next one. */
type HistoryRow = StoredMessage & { hadSources: boolean };

async function loadHistory(supabase: Ctx["supabase"], sessionId: string): Promise<HistoryRow[]> {
  const { data } = await supabase
    .from("lp_chat_messages")
    .select("id, role, content, sources, lp_chat_attachments(id, name, mime, size, storage_path)")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  type Row = {
    id: string;
    role: "user" | "assistant";
    content: string;
    sources: unknown;
    lp_chat_attachments: StoredMessage["attachments"] | null;
  };

  return ((data ?? []) as Row[]).map((row) => ({
    id: row.id,
    role: row.role,
    content: row.content,
    attachments: row.lp_chat_attachments ?? [],
    hadSources: Array.isArray(row.sources) && row.sources.length > 0,
  }));
}

/** Store what the user asked to remember; returns how many were new. */
async function captureMemories(
  supabase: Ctx["supabase"],
  userId: string,
  sessionId: string,
  content: string,
): Promise<number> {
  const facts = extractMemories(content);
  if (!facts.length) return 0;

  // Insert one by one so a duplicate (unique index on lower(text)) only drops
  // itself — a single batch would fail whole and lose the new facts with it.
  let saved = 0;
  for (const text of facts) {
    const { error } = await supabase
      .from("lp_chat_memories")
      .insert({ user_id: userId, text, session_id: sessionId });
    if (!error) saved += 1;
  }
  return saved;
}

/**
 * The streaming half: search (optional), then relay the model's reply and persist
 * it before the stream closes.
 */
function streamTurn(
  ctx: Ctx,
  turn: { system: string; searching: boolean; searchLocked: boolean; resolved: string; captured: number },
): Response {
  const { supabase, userId, sessionId, release, t, limits } = ctx;

  // What the reply accumulates to. Held out here so the disconnect path can
  // persist exactly what had arrived.
  const state = {
    reply: "" as string,
    reasoning: "" as string,
    citations: [] as Source[],
    found: [] as Source[],
    finished: false,
  };
  const upstreamAbort = new AbortController();

  /** Persist the reply and release the lock. Safe to call twice; runs once. */
  async function finalize() {
    if (state.finished) return;
    state.finished = true;
    try {
      const text = state.reply.replace(/^\s+/, "");
      if (text || state.reasoning) {
        // Search sources first, then any the model cited itself, deduped by URL.
        const merged = [...state.found];
        const known = new Set(merged.map((s) => s.url));
        for (const source of state.citations) {
          if (!known.has(source.url)) {
            known.add(source.url);
            merged.push(source);
          }
        }
        await supabase.from("lp_chat_messages").insert({
          session_id: sessionId,
          user_id: userId,
          role: "assistant",
          content: text,
          reasoning: state.reasoning || null,
          sources: merged.length ? merged : null,
        });
      }
      // Bump updated_at so the sidebar keeps most-recent-first order.
      await supabase.from("lp_chat_sessions").update({ updated_at: new Date().toISOString() }).eq("id", sessionId);
    } finally {
      await release();
    }
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      /**
       * Writing to a stream the reader has already left throws, and that throw
       * would land in the very handler trying to report the disconnect — turning a
       * closed tab into an unhandled rejection, and skipping the persist below it.
       * Every write goes through here so a gone reader is simply nothing to write to.
       */
      const write = (chunk: Uint8Array) => {
        try {
          controller.enqueue(chunk);
        } catch {
          /* reader gone; the generation still finishes and is saved */
        }
      };

      try {
        write(
          sse({
            status: {
              searching: turn.searching,
              // The message wanted the web and the plan does not include it.
              search_locked: turn.searchLocked,
              memories_saved: turn.captured,
            },
          }),
        );

        let system = turn.system;
        if (turn.searching) {
          let digest = "";
          try {
            const result = await runSearch(turn.resolved, WEB_RESULTS, upstreamAbort.signal);
            digest = result.digest;
            state.found = result.sources;
          } catch (err) {
            // A failed search must not be fatal: answering without the web beats
            // not answering. The chip in the UI says so rather than staying silent.
            // The client shows its own translated chip; this carries the reason
            // for anyone reading the network tab.
            write(sse({ web_error: String(err instanceof Error ? err.message : err).slice(0, 200) }));
          }
          write(sse({ sources: state.found, query: turn.resolved }));
          if (digest) {
            const block = contextBlock(turn.resolved, digest, state.found);
            system = system ? `${system}\n\n${block}` : block;
          }
        }

        // Rebuilt AFTER the user message was stored, so the turn being answered is
        // part of it — the same reason the Python version read the DB here.
        const history = await loadHistory(supabase, sessionId);
        const { messages, needsPdf } = await buildMessages(history, (path) => loadBytes(supabase, path));
        const trimmed = trimHistory(messages, limits.chatHistory);
        const payload: ChatMessage[] = system ? [{ role: "system", content: system }, ...trimmed] : trimmed;

        const upstream = await streamChat({
          model: MODEL,
          messages: payload,
          temperature: TEMPERATURE,
          // pdf-text pulls out the embedded text layer; measured as costing nothing
          // beyond the tokens it produces.
          plugins: needsPdf ? [{ id: "file-parser", pdf: { engine: "pdf-text" } }] : undefined,
          signal: upstreamAbort.signal,
        });

        const body = upstream.body;
        if (!body) throw new UpstreamError("OpenRouter sent no reply body", 502, "chat.upstreamEmpty");

        const reader = body.getReader();
        const decoder = new TextDecoder();
        let buffered = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          // Relayed byte for byte: the browser parses OpenRouter's own frames, so
          // re-encoding them here would be one more thing to keep in step.
          write(value);
          buffered += decoder.decode(value, { stream: true });
          const lines = buffered.split("\n");
          buffered = lines.pop() ?? "";
          for (const line of lines) collect(line, state);
        }

        // Saved BEFORE the stream closes, not after: the browser refreshes its
        // sidebar the moment the response ends, and in the original that ordering
        // was reversed — a two-message chat displayed "1 msg".
        await finalize();
      } catch (err) {
        // An UpstreamError we wrote carries a key; one built from the provider's
        // own HTTP body does not, and relaying that verbatim beats replacing it
        // with a vaguer sentence in the right language.
        const message =
          err instanceof UpstreamError
            ? err.key
              ? t(err.key, err.vars)
              : err.message.slice(0, 400)
            : err instanceof Error
              ? err.message
              : t("chat.unexpected");
        // The error goes down the stream rather than as a status code: by now the
        // response has already started, and the UI knows how to offer a retry from
        // an in-band error event.
        write(sse({ error: { message } }));
        await finalize();
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed by a cancel */
        }
      }
    },

    /**
     * The reader left — a reload, a closed tab, a navigation.
     *
     * The standalone server kept generating into a buffer the page could re-attach
     * to. There is no such buffer here, so the next best thing is done instead:
     * stop the upstream call (no point paying for tokens nobody will read) and
     * persist what already arrived, so the transcript holds a partial answer
     * rather than nothing at all.
     */
    async cancel() {
      upstreamAbort.abort();
      await finalize();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // The session is created on the first message; this is how the page learns
      // its id without a second round trip.
      "X-Session-Id": sessionId,
      // Proxies that buffer would defeat the whole point of streaming.
      "X-Accel-Buffering": "no",
    },
  });
}

/** Pull content/reasoning/citations out of one relayed SSE line. */
function collect(line: string, state: { reply: string; reasoning: string; citations: Source[] }) {
  const delta = parseDelta(line);
  if (!delta) return;
  if (delta.content) state.reply += delta.content;
  if (delta.reasoning) state.reasoning += delta.reasoning;
  if (delta.annotations) {
    for (const source of toSources(delta.annotations)) {
      if (!state.citations.some((s) => s.url === source.url)) state.citations.push(source);
    }
  }
}

/** Attachment bytes, or null when the object is gone. */
async function loadBytes(supabase: Ctx["supabase"], path: string): Promise<Uint8Array | null> {
  const { data, error } = await supabase.storage.from("chat-attachments").download(path);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}
