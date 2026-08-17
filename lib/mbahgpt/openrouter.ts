/**
 * OpenRouter transport. Server-only: this is the module that holds the key.
 *
 * Port of the request builder in `qwen.py` plus the SSE collector that used to
 * live in `server.py`. Two shapes only — a streamed chat completion and a
 * one-shot JSON completion for the web-search digest — because those are the two
 * the app has ever needed.
 */
import { BASE_URL, TIMEOUT_MS, apiKey } from "./config";

/** A part of a multimodal user message. */
export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "file"; file: { filename: string; file_data: string } };

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
};

/** OpenRouter's `web` plugin, used only by the separate search request. */
export type Plugin = Record<string, unknown>;

export class UpstreamError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "UpstreamError";
    this.status = status;
  }
}

type Payload = Record<string, unknown>;

async function post(path: string, payload: Payload, signal?: AbortSignal, timeoutMs = TIMEOUT_MS): Promise<Response> {
  // Two reasons a request must be able to end: the caller went away (signal) and
  // OpenRouter stalled (timeout). AbortSignal.any composes them without either
  // one having to know about the other.
  const timeout = AbortSignal.timeout(timeoutMs);
  const composed = signal ? AbortSignal.any([signal, timeout]) : timeout;

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: composed,
      // Streaming responses must not be cached or buffered by the runtime.
      cache: "no-store",
    });
  } catch (err) {
    // A timeout and a dead network look the same from here, and both mean the
    // same thing to the reader: we could not reach the model.
    const reason = err instanceof Error ? err.message : String(err);
    throw new UpstreamError(`tidak bisa menghubungi OpenRouter: ${reason}`, 502);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new UpstreamError(body || res.statusText, res.status);
  }
  return res;
}

/**
 * Start a streamed chat completion. The caller relays the body.
 *
 * `plugins` carries the PDF file-parser when a message has a PDF attached —
 * measured on the standalone app as costing nothing beyond the tokens it
 * produces, which is why PDFs go this way instead of being inlined as text.
 */
export function streamChat(args: {
  model: string;
  messages: ChatMessage[];
  temperature: number;
  plugins?: Plugin[];
  signal?: AbortSignal;
}): Promise<Response> {
  const payload: Payload = {
    model: args.model,
    messages: args.messages,
    temperature: args.temperature,
    stream: true,
  };
  if (args.plugins?.length) payload.plugins = args.plugins;
  return post("/chat/completions", payload, args.signal);
}

/** One-shot completion, used for the web-search digest. */
export async function completeJson(args: {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  plugins?: Plugin[];
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<{ content: string; annotations: unknown[] }> {
  const payload: Payload = {
    model: args.model,
    messages: args.messages,
    temperature: args.temperature ?? 0,
  };
  if (args.maxTokens) payload.max_tokens = args.maxTokens;
  if (args.plugins?.length) payload.plugins = args.plugins;

  const res = await post("/chat/completions", payload, args.signal, args.timeoutMs);
  const data = (await res.json()) as {
    choices?: { message?: { content?: string; annotations?: unknown[] } }[];
  };
  const message = data.choices?.[0]?.message ?? {};
  return { content: (message.content ?? "").trim(), annotations: message.annotations ?? [] };
}

/** The fields of a streamed delta this app reads. */
export type Delta = {
  content?: string;
  reasoning?: string;
  annotations?: unknown[];
};

/**
 * Pull the delta out of one `data: …` line, or null if the line carries none.
 *
 * Returns null for `[DONE]`, for keep-alive comments, and for anything that does
 * not parse — a malformed frame must not end a reply that is otherwise fine.
 */
export function parseDelta(line: string): Delta | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data: ")) return null;
  const body = trimmed.slice(6);
  if (!body || body === "[DONE]") return null;
  try {
    const chunk = JSON.parse(body) as {
      choices?: { delta?: Delta }[];
      error?: { message?: string };
    };
    if (chunk.error) throw new UpstreamError(chunk.error.message || "model menolak permintaan", 502);
    return chunk.choices?.[0]?.delta ?? null;
  } catch (err) {
    if (err instanceof UpstreamError) throw err;
    return null;
  }
}

/** Flatten OpenRouter url_citation annotations into {title, url} records. */
export type Source = { title: string; url: string };

export function toSources(annotations: unknown): Source[] {
  const out: Source[] = [];
  const seen = new Set<string>();
  if (!Array.isArray(annotations)) return out;
  for (const item of annotations) {
    const cite = (item as { url_citation?: { url?: string; title?: string } })?.url_citation;
    const url = cite?.url;
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push({ title: cite?.title || url, url });
  }
  return out;
}
