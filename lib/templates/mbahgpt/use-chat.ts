"use client";

/**
 * All chat state that outlives a single component: the open thread, the sidebar,
 * and every reply currently streaming.
 *
 * The shape is inherited from `index.html`, where it was hard-won:
 *
 *   * A reply keeps running when you switch away. So state cannot be "the current
 *     answer" — every in-flight request is its own record, keyed by session, and a
 *     record only draws to the screen while its session is the one on display.
 *     Coming back to a running chat shows the text so far and keeps streaming.
 *   * Tokens are accumulated in a ref and flushed to React state once per animation
 *     frame. Calling setState per token re-renders the whole transcript on every
 *     few characters; the frame budget is what makes a long answer stay smooth.
 *   * Three concurrent replies, maximum. Past that the machine, the wallet and the
 *     reader all lose track.
 *
 * Reads and mutations both go through the Server Actions in `lib/actions/chat.ts`.
 * Only the token stream uses a route handler, because only it needs a body that
 * can be read while it is still being written.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  deleteChatSession,
  getChatSession,
  listChatSessions,
  renameChatSession,
  type ChatMessageRow,
  type ChatSessionRow,
} from "@/lib/actions/chat";
import { uploadChatFiles, type PendingFile } from "./upload";
import { useT } from "@/lib/i18n/client";

export const MAX_CONCURRENT = 3;

/** Where the last open chat is remembered, so a reload lands back in it. */
const LAST_SESSION_KEY = "mbahgpt:lastSession";

/**
 * How often the open chat re-checks an answer lock it does not hold itself.
 *
 * Only ticks while such a lock exists, which is a rare state: another tab or
 * device answering this same chat, or a turn whose reader left before the lock
 * was released. Idle chats poll nothing.
 */
const LOCK_POLL_MS = 4_000;

export type Source = { title: string; url: string };

/** A reply being produced, as the UI needs to see it. */
export type LiveReply = {
  key: string;
  sessionId: string | null;
  /** The message being answered. Kept for the retry/edit affordances. */
  userText: string;
  /** Local previews for the optimistic user bubble; empty once stored. */
  userFiles: PendingFile[];
  /** False on a retry: the message is already in the loaded transcript. */
  showUserBubble: boolean;
  reply: string;
  reasoning: string;
  citations: Source[];
  webSearch: boolean;
  webFailed: boolean;
  /** The message needed a web search the plan does not include. */
  webLocked: boolean;
  query: string;
  savedMemories: number;
  startedAt: number;
  /** How long thinking took, once the first answer token arrives. */
  thoughtMs: number | null;
  uploading: boolean;
};

/** A failed turn, left on screen one click away from being sent again. */
export type ChatFailure = {
  sessionId: string | null;
  message: string;
  text: string;
  files: PendingFile[];
  /** The server said a bigger plan would have allowed this. */
  upgrade: boolean;
};

type Rec = LiveReply & { controller: AbortController };

/** The bound translator, threaded into the plain functions below. */
type Translate = ReturnType<typeof useT>;

export function useChat(options: { canChat: boolean }) {
  const { canChat } = options;
  const t = useT();

  const [sessions, setSessions] = useState<ChatSessionRow[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [live, setLive] = useState<Record<string, LiveReply>>({});
  const [failure, setFailure] = useState<ChatFailure | null>(null);
  const [unread, setUnread] = useState<Set<string>>(new Set());
  const [loadingThread, setLoadingThread] = useState(false);
  const [notice, setNotice] = useState("");

  const recs = useRef(new Map<string, Rec>());
  const tempKey = useRef(0);
  // Read inside async callbacks that were created before the switch happened.
  const openRef = useRef<string | null>(null);
  openRef.current = sessionId;

  // -- render coalescing ----------------------------------------------------
  const frame = useRef<number | null>(null);
  const flush = useCallback(() => {
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const snapshot: Record<string, LiveReply> = {};
      for (const [key, rec] of recs.current) {
        // Strip the controller: state must stay a plain, comparable snapshot.
        const { controller, ...view } = rec;
        void controller;
        snapshot[key] = { ...view };
      }
      setLive(snapshot);
    });
  }, []);

  /**
   * A record's turn is over: drop it, and stop the sidebar claiming the session is
   * still answering.
   *
   * Deleting by `rec.key` and not by whatever key the send STARTED with — the
   * X-Session-Id handshake re-keys a record mid-flight, and a delete under the old
   * name left it in the map forever, which made `liveForOpenSession()` keep finding
   * it and `send` return at the door.
   *
   * The `streaming` flag is cleared for the same reason it is cleared here rather
   * than left to the refresh that always follows: the flag came from a snapshot
   * taken while this turn was still running, and until the refresh lands the screen
   * would say "being answered elsewhere" about a turn this tab just watched end.
   */
  const finishRec = useCallback(
    (rec: Rec) => {
      recs.current.delete(rec.key);
      flush();
      const id = rec.sessionId;
      if (!id) return;
      setSessions((prev) => prev.map((s) => (s.id === id && s.streaming ? { ...s, streaming: false } : s)));
    },
    [flush],
  );

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      // Leaving the page ends the requests. The server persists whatever arrived,
      // so the transcript is complete-as-of-now rather than empty.
      for (const rec of recs.current.values()) rec.controller.abort();
      recs.current.clear();
    },
    [],
  );

  // -- sessions -------------------------------------------------------------
  const refreshSessions = useCallback(async () => {
    if (!canChat) return;
    try {
      setSessions(await listChatSessions());
    } catch {
      // A failed sidebar refresh leaves the previous list in place. It is stale,
      // not wrong, and blanking it would look like the chats were deleted.
    }
  }, [canChat]);

  const openSession = useCallback(
    async (id: string) => {
      setLoadingThread(true);
      setFailure(null);
      try {
        const { session, messages: rows } = await getChatSession(id);
        if (!session) {
          // Gone — deleted here or in another tab. Put the reader in a new chat
          // instead of leaving them staring at a dead one, and forget it so the
          // next reload does not try again.
          try {
            localStorage.removeItem(LAST_SESSION_KEY);
          } catch {
            /* nothing to forget */
          }
          setSessionId(null);
          openRef.current = null;
          setMessages([]);
          setNotice(t("chat.sessionGone"));
          await refreshSessions();
          return;
        }
        setSessionId(id);
        openRef.current = id;
        setMessages(rows);
        setUnread((prev) => {
          if (!prev.has(id)) return prev;
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        try {
          localStorage.setItem(LAST_SESSION_KEY, id);
        } catch {
          // Private browsing: the chat still opens, it just is not remembered.
        }
      } finally {
        setLoadingThread(false);
      }
    },
    [refreshSessions, t],
  );

  const newChat = useCallback(() => {
    setSessionId(null);
    openRef.current = null;
    setMessages([]);
    setFailure(null);
    setNotice("");
    try {
      localStorage.removeItem(LAST_SESSION_KEY);
    } catch {
      /* nothing to clean up */
    }
  }, []);

  // First paint: the sidebar, then the chat that was open before the reload.
  useEffect(() => {
    if (!canChat) return;
    let cancelled = false;
    (async () => {
      await refreshSessions();
      if (cancelled) return;
      let last: string | null = null;
      try {
        last = localStorage.getItem(LAST_SESSION_KEY);
      } catch {
        last = null;
      }
      if (last && !cancelled) await openSession(last);
    })();
    return () => {
      cancelled = true;
    };
  }, [canChat, refreshSessions, openSession]);

  const rename = useCallback(
    async (id: string, title: string) => {
      const result = await renameChatSession(id, title);
      if (result.error) setNotice(result.error);
      await refreshSessions();
    },
    [refreshSessions],
  );

  const remove = useCallback(
    async (id: string) => {
      const result = await deleteChatSession(id);
      if (result.error) setNotice(result.error);
      if (id === openRef.current) newChat();
      await refreshSessions();
    },
    [newChat, refreshSessions],
  );

  // -- the turn -------------------------------------------------------------
  const liveForOpenSession = useCallback((): Rec | null => {
    for (const rec of recs.current.values()) {
      if (rec.sessionId !== null && rec.sessionId === openRef.current) return rec;
      // A brand-new chat has no id yet; it belongs to whoever is looking at it.
      if (rec.sessionId === null && openRef.current === null) return rec;
    }
    return null;
  }, []);

  const send = useCallback(
    async (text: string, files: PendingFile[], opts: { retry?: boolean } = {}) => {
      if (!canChat) return;
      if (recs.current.size >= MAX_CONCURRENT) {
        setNotice(t("chat.maxConcurrent", { count: MAX_CONCURRENT }));
        return;
      }
      if (liveForOpenSession()) return; // one reply at a time within a session

      const startSessionId = openRef.current;
      const key = startSessionId ? `s${startSessionId}` : `new${++tempKey.current}`;
      if (recs.current.has(key)) return;

      const rec: Rec = {
        key,
        sessionId: startSessionId,
        userText: text,
        userFiles: files,
        showUserBubble: !opts.retry,
        reply: "",
        reasoning: "",
        citations: [],
        webSearch: false,
        webFailed: false,
        webLocked: false,
        query: "",
        savedMemories: 0,
        startedAt: Date.now(),
        thoughtMs: null,
        uploading: files.length > 0,
        controller: new AbortController(),
      };
      recs.current.set(key, rec);
      setFailure(null);
      setNotice("");
      flush();

      const fail = async (message: string, upgrade = false) => {
        finishRec(rec);
        setFailure({ sessionId: rec.sessionId, message, text, files, upgrade });
        // The user's message may already be stored — the server writes it before
        // it calls the model — so reload the thread rather than guessing.
        if (rec.sessionId && rec.sessionId === openRef.current) {
          const { messages: rows } = await getChatSession(rec.sessionId);
          setMessages(rows);
        }
        await refreshSessions();
      };

      try {
        let refs: { path: string; name: string; mime: string; size: number }[] = [];
        if (files.length) {
          const uploaded = await uploadChatFiles(files, t);
          if ("error" in uploaded) {
            await fail(uploaded.error);
            return;
          }
          refs = uploaded.refs;
          rec.uploading = false;
          flush();
        }

        const res = await fetch("/api/mbahgpt/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: rec.sessionId,
            content: text,
            // Keyword detection decides per message; "/web …" forces one turn.
            // A standing on/off switch would be config, and config does not belong
            // in the composer.
            web: "auto",
            retry: !!opts.retry,
            attachments: refs,
          }),
          signal: rec.controller.signal,
        });

        if (!res.ok || !res.body) {
          const body = (await res.json().catch(() => ({}))) as { error?: string; upgrade?: boolean };
          await fail(body.error || res.statusText || t("chat.sendFailed"), !!body.upgrade);
          return;
        }

        // The server reports which session it actually wrote to — a new one on the
        // first message, and ALSO a new one when the id we sent had gone stale
        // (deleted in another tab). Either way the answer belongs to that session,
        // so the record follows it rather than the other way round.
        const created = res.headers.get("X-Session-Id");
        if (created && created !== rec.sessionId) {
          const replaced = rec.sessionId !== null;
          rec.sessionId = created;
          recs.current.delete(rec.key);
          rec.key = `s${created}`;
          recs.current.set(rec.key, rec);
          // Follow it on screen when the reader was looking at the session that
          // just turned out not to exist, as well as on a brand-new chat.
          if (openRef.current === null || replaced) {
            setSessionId(created);
            openRef.current = created;
            try {
              localStorage.setItem(LAST_SESSION_KEY, created);
            } catch {
              /* not remembered, still open */
            }
          }
          flush();
          await refreshSessions();
        }

        await consume(rec, res.body, flush, t);

        // Reload from the database rather than promoting the local text: the stored
        // row carries the ids the attachment links need, and it is the copy every
        // other device will see.
        if (rec.sessionId && rec.sessionId === openRef.current) {
          const { messages: rows } = await getChatSession(rec.sessionId);
          setMessages(rows);
        } else if (rec.sessionId) {
          setUnread((prev) => new Set(prev).add(rec.sessionId!));
        }
        finishRec(rec);
        await refreshSessions();
      } catch (err) {
        const aborted = err instanceof DOMException && err.name === "AbortError";
        if (aborted) {
          // Stopped on purpose. The server keeps the partial answer, so the thread
          // is reloaded exactly like a completed turn.
          finishRec(rec);
          if (rec.sessionId && rec.sessionId === openRef.current) {
            const { messages: rows } = await getChatSession(rec.sessionId);
            setMessages(rows);
          }
          await refreshSessions();
          return;
        }
        await fail(err instanceof Error ? err.message : t("chat.sendFailed"));
      }
    },
    [canChat, finishRec, flush, liveForOpenSession, refreshSessions, t],
  );

  const stop = useCallback(() => {
    liveForOpenSession()?.controller.abort();
  }, [liveForOpenSession]);

  const activeForOpen = liveForOpenSession();
  const openLive = activeForOpen ? live[activeForOpen.key] ?? null : null;

  /**
   * A reply is being produced for the open chat, and it is NOT this tab producing
   * it — so there is no stream to draw and no controller to stop.
   *
   * Two ways to get here. The ordinary one is a second tab or another device
   * answering the same chat. The one this was written for is a RELOAD in the
   * middle of an answer: the session's answer lock lives in Postgres, so it
   * outlives the tab that took it, and until it clears the route refuses every
   * message with "sedang menjawab". Before this, the screen said nothing about
   * that — the composer sat open and invited a message straight into a 409.
   *
   * `sessions` already carries the flag; only the sidebar was reading it.
   */
  const remoteBusy =
    !!sessionId && !activeForOpen && (sessions.find((s) => s.id === sessionId)?.streaming ?? false);

  const wasRemoteBusy = useRef(false);
  useEffect(() => {
    const cleared = wasRemoteBusy.current && !remoteBusy;
    wasRemoteBusy.current = remoteBusy;

    if (cleared) {
      // Whatever that other reader produced — a whole answer, or the partial the
      // disconnect saved — exists only in the database. Nothing streamed here.
      const id = openRef.current;
      if (id) {
        void getChatSession(id).then(({ messages: rows }) => {
          if (openRef.current === id) setMessages(rows);
        });
      }
      return;
    }

    if (!remoteBusy) return;
    // The lock resolves either way on its own: released when that turn finishes,
    // or expired once it stops proving it is alive. Polling is what turns a dead
    // lock from "the chat is broken" into a wait with an end.
    const timer = setInterval(() => void refreshSessions(), LOCK_POLL_MS);
    return () => clearInterval(timer);
  }, [remoteBusy, refreshSessions]);

  return {
    sessions,
    sessionId,
    messages,
    /** The reply streaming into the chat on screen, if any. */
    openLive,
    /** The open chat is answering somewhere this tab cannot see. */
    remoteBusy,
    /** Every running reply, so the sidebar can mark them. */
    live,
    failure,
    unread,
    loadingThread,
    notice,
    setNotice,
    running: Object.keys(live).length,
    openSession,
    newChat,
    send,
    stop,
    rename,
    remove,
    refreshSessions,
    clearFailure: () => setFailure(null),
  };
}

/**
 * Read one SSE response into a record.
 *
 * Drains to end of stream rather than stopping at `[DONE]`: the server saves the
 * reply just before closing, and the sidebar refresh that follows must see it.
 * That ordering bug — a two-message chat displaying "1 msg" — is the reason this
 * loop is written the way it is.
 */
async function consume(rec: Rec, body: ReadableStream<Uint8Array>, flush: () => void, t: Translate) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffered = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffered += decoder.decode(value, { stream: true });
    const lines = buffered.split("\n");
    buffered = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (!payload || payload === "[DONE]") continue;

      let chunk: Record<string, unknown>;
      try {
        chunk = JSON.parse(payload) as Record<string, unknown>;
      } catch {
        continue; // a malformed frame must not end a reply that is otherwise fine
      }

      if (chunk.error) {
        const error = chunk.error as { message?: string };
        throw new Error(error.message || t("chat.modelRefused"));
      }

      if (chunk.status) {
        const status = chunk.status as {
          searching?: boolean;
          search_locked?: boolean;
          memories_saved?: number;
        };
        if (status.searching) rec.webSearch = true;
        if (status.search_locked) rec.webLocked = true;
        rec.savedMemories = status.memories_saved ?? 0;
        flush();
        continue;
      }

      if (chunk.sources) {
        rec.citations = chunk.sources as Source[];
        rec.query = (chunk.query as string) ?? "";
        flush();
        continue;
      }

      if (chunk.web_error) {
        rec.webFailed = true;
        flush();
        continue;
      }

      const delta = (chunk.choices as { delta?: Record<string, unknown> }[] | undefined)?.[0]?.delta;
      if (!delta) continue;

      if (Array.isArray(delta.annotations)) {
        for (const item of delta.annotations) {
          const cite = (item as { url_citation?: { url?: string; title?: string } })?.url_citation;
          if (cite?.url && !rec.citations.some((s) => s.url === cite.url)) {
            rec.citations = [...rec.citations, { title: cite.title || cite.url, url: cite.url }];
          }
        }
      }

      // Thinking models stream `reasoning` for a long while before any content —
      // 2748 characters of it before 221 characters of answer, once measured.
      if (typeof delta.reasoning === "string" && delta.reasoning) {
        rec.reasoning += delta.reasoning;
        flush();
      }

      if (typeof delta.content === "string" && delta.content) {
        let content = delta.content;
        if (!rec.reply) {
          // Some models open with blank lines after the think phase.
          content = content.replace(/^\s+/, "");
          if (!content) continue;
          rec.thoughtMs = Date.now() - rec.startedAt;
        }
        rec.reply += content;
        flush();
      }
    }
  }
}
