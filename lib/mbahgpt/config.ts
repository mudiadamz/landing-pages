/**
 * MbahGPT configuration. Server-only — this module reads the OpenRouter key.
 *
 * The variable names are kept from the standalone app (`OPENROUTER_*`) so an
 * existing .env moves across unchanged, and so the two stay comparable while
 * both exist.
 *
 * Model and temperature live HERE, in the environment, and the chat route
 * ignores whatever the client sends for them. They are set-once settings, not
 * per-message decisions; in the UI they would only add noise and a way for a
 * crafted request to pick an expensive model on the site owner's account.
 */

/** Bare numeric env read that survives an empty or malformed value. */
function num(name: string, fallback: number): number {
  const raw = (process.env[name] ?? "").trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const BASE_URL = (process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/+$/, "");

export const MODEL = process.env.OPENROUTER_MODEL || "qwen/qwen3.8-27b";

export const TEMPERATURE = num("OPENROUTER_TEMPERATURE", 0.7);

/** A small, fast, non-thinking model is enough to digest search results. */
export const SEARCH_MODEL = process.env.OPENROUTER_SEARCH_MODEL || "qwen/qwen3-30b-a3b-instruct-2507";

/**
 * Results per search. NOT a spend lever: OpenRouter bills a flat ~$0.007 per
 * search whatever the count (measured on the standalone app — 1 result cost the
 * same as 5). What controls spend is how OFTEN a search runs, which is why the
 * keyword-driven "auto" mode exists at all.
 */
export const WEB_RESULTS = num("OPENROUTER_WEB_RESULTS", 5);

/** Messages resent per turn. Caps the cost and latency of a long thread. */
export const MAX_HISTORY = num("OPENROUTER_MAX_HISTORY", 40);

/** Total attachment bytes accepted for one message. */
export const MAX_UPLOAD = num("OPENROUTER_MAX_UPLOAD", 8 * 1024 * 1024);

/** Files accepted for one message. */
export const MAX_FILES = num("OPENROUTER_MAX_FILES", 6);

/** Seconds to wait for OpenRouter before giving up on a turn. */
export const TIMEOUT_MS = num("OPENROUTER_TIMEOUT", 120) * 1000;

/**
 * Chat turns per minute per user (0 = off).
 *
 * The standalone server counted per IP in process memory. Neither half of that
 * survives here: instances are ephemeral and several users share an IP behind
 * NAT. Counting the user's own recent messages in Postgres is exact, shared
 * across instances, and free — the index is one the transcript needs anyway.
 */
export const RATE_LIMIT = num("OPENROUTER_RATE_LIMIT", 30);

/**
 * How long a session's answer lock is trusted before another turn may take it.
 *
 * The Python server released its lock in a `finally` block, which a killed
 * process never runs. Here the lock is a timestamp in the row, so it has to be
 * able to expire on its own: a shade longer than the upstream timeout, so a slow
 * but living generation is never stolen from.
 */
export const ANSWER_LOCK_STALE_MS = TIMEOUT_MS + 30_000;

/**
 * The API key, read at call time rather than at module load.
 *
 * Never sent to the browser: the page talks to /api/mbahgpt/chat, and only that
 * route talks to OpenRouter. This is the invariant the whole server-side of the
 * feature exists to preserve.
 */
export function apiKey(): string {
  const key = (process.env.OPENROUTER_API_KEY || "").trim();
  if (!key) throw new Error("OPENROUTER_API_KEY belum diisi di environment server");
  return key;
}

/** Whether the feature can work at all. Lets the UI say so instead of failing. */
export function chatConfigured(): boolean {
  return !!(process.env.OPENROUTER_API_KEY || "").trim();
}

/** The bits of the config the browser is allowed to know, for the file picker. */
export type ChatLimits = { maxFiles: number; maxUpload: number };

export function chatLimits(): ChatLimits {
  return { maxFiles: MAX_FILES, maxUpload: MAX_UPLOAD };
}
