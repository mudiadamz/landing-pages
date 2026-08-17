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

export const MAX_CONCURRENT = 3;

/** Where the last open chat is remembered, so a reload lands back in it. */
const LAST_SESSION_KEY = "mbahgpt:lastSession";

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
};

type Rec = LiveReply & { controller: AbortController };

export function useChat(options: { canChat: boolean }) {
  const { canChat } = options;

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
          setNotice("Chat itu sudah tidak ada.");
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
    [refreshSessions],
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
        setNotice(`Maksimal ${MAX_CONCURRENT} chat berjalan bersamaan — tunggu salah satunya selesai.`);
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

      const fail = async (message: string) => {
        recs.current.delete(key);
        flush();
        setFailure({ sessionId: rec.sessionId, message, text, files });
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
          const uploaded = await uploadChatFiles(files);
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
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          await fail(body.error || res.statusText || "Gagal mengirim pesan.");
          return;
        }

        // The server creates the session on the first message and reports its id.
        const created = res.headers.get("X-Session-Id");
        if (created && rec.sessionId === null) {
          rec.sessionId = created;
          recs.current.delete(key);
          rec.key = `s${created}`;
          recs.current.set(rec.key, rec);
          if (openRef.current === null) {
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

        await consume(rec, res.body, flush);

        // Reload from the database rather than promoting the local text: the stored
        // row carries the ids the attachment links need, and it is the copy every
        // other device will see.
        if (rec.sessionId && rec.sessionId === openRef.current) {
          const { messages: rows } = await getChatSession(rec.sessionId);
          setMessages(rows);
        } else if (rec.sessionId) {
          setUnread((prev) => new Set(prev).add(rec.sessionId!));
        }
        recs.current.delete(rec.key);
        flush();
        await refreshSessions();
      } catch (err) {
        const aborted = err instanceof DOMException && err.name === "AbortError";
        if (aborted) {
          // Stopped on purpose. The server keeps the partial answer, so the thread
          // is reloaded exactly like a completed turn.
          recs.current.delete(rec.key);
          flush();
          if (rec.sessionId && rec.sessionId === openRef.current) {
            const { messages: rows } = await getChatSession(rec.sessionId);
            setMessages(rows);
          }
          await refreshSessions();
          return;
        }
        await fail(err instanceof Error ? err.message : "Gagal mengirim pesan.");
      }
    },
    [canChat, flush, liveForOpenSession, refreshSessions],
  );

  const stop = useCallback(() => {
    liveForOpenSession()?.controller.abort();
  }, [liveForOpenSession]);

  const activeForOpen = liveForOpenSession();
  const openLive = activeForOpen ? live[activeForOpen.key] ?? null : null;

  return {
    sessions,
    sessionId,
    messages,
    /** The reply streaming into the chat on screen, if any. */
    openLive,
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
async function consume(rec: Rec, body: ReadableStream<Uint8Array>, flush: () => void) {
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
        throw new Error(error.message || "Model menolak permintaan.");
      }

      if (chunk.status) {
        const status = chunk.status as { searching?: boolean; memories_saved?: number };
        if (status.searching) rec.webSearch = true;
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
