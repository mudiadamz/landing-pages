/**
 * Decide when a question needs live web results, and go fetch them. Port of `web.py`.
 *
 * The search runs as its OWN single-message request rather than as a plugin on
 * the main chat call. That is the biggest architectural decision in this feature
 * and it was forced, not chosen: OpenRouter's web plugin appends its results as a
 * TRAILING system message, and every provider serving qwen3.8-27b (Chutes, Io
 * Net, AkashML) rejects that with "System message must be at the beginning" the
 * moment the conversation has any history or a system prompt. Pinning a provider
 * did not help — all three refuse. So search would fail for every follow-up.
 *
 * Running it separately fixes that and buys something else: the query becomes
 * ours, so it can carry context from earlier turns. "final ucl" after "highlight
 * ucl 2005" has to search for the 2005 final, not the newest one.
 */
import { SEARCH_MODEL, TIMEOUT_MS } from "./config";
import { completeJson, toSources, type Source } from "./openrouter";

const SEARCH_PROMPT = (query: string) =>
  "Search the web and summarise the facts needed to answer this request:\n" +
  `${query}\n\n` +
  "Give concrete details — names, dates, numbers, scores. Stay factual and " +
  "brief. Reply in the same language as the request.";

/** Phrases that ask for a search outright, in English and Indonesian. */
const EXPLICIT = [
  "search the web", "search online", "look it up", "look this up", "google",
  "browse", "on the internet", "cari di internet", "cari online",
  "carikan di internet", "browsing", "telusuri",
];

/** Words implying "as of now", which training data cannot answer reliably. */
const RECENCY = [
  // English
  "latest", "newest", "recent", "recently", "current", "currently", "today",
  "tonight", "yesterday", "this week", "this month", "this year", "right now",
  "so far", "upcoming", "news", "headline", "score", "result", "results",
  "standings", "schedule", "fixture", "price", "stock", "weather", "forecast",
  "released", "release date", "who won", "winner", "live",
  // Indonesian
  "terbaru", "terkini", "terakhir", "sekarang", "saat ini", "hari ini",
  "kemarin", "minggu ini", "bulan ini", "tahun ini", "berita", "kabar",
  "hasil", "skor", "jadwal", "klasemen", "harga", "cuaca", "rilis",
  "siapa yang menang", "pemenang", "langsung",
];

const YEAR_RE = /\b(20\d{2})\b/g;

/** Lets the user force a search for one message: "/web who won …". */
const PREFIX_RE = /^\s*\/(?:web|search|cari)\b\s*/i;

/**
 * A message this short is treated as leaning on the previous turn. Kept tight:
 * anything longer usually carries its own subject, and widening it pulls in
 * unrelated questions ("tulis fungsi python untuk sorting list").
 */
const FOLLOWUP_MAX_WORDS = 6;

const WORD_RE_Q = /[\p{L}\p{N}']+/gu;

function escapeRe(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Return the text without a leading /web prefix, and whether it had one. */
export function stripWebPrefix(text: string): { text: string; forced: boolean } {
  const stripped = (text || "").replace(PREFIX_RE, "");
  return { text: stripped, forced: stripped !== text };
}

/**
 * True when the message looks like it needs live information.
 *
 * `afterSearch` means the previous reply in this session came from a search; a
 * short follow-up to that ("final ucl") is almost always about the same topic and
 * needs the web too, even though it carries no keyword of its own.
 */
export function shouldSearch(text: string, afterSearch = false): boolean {
  if (!text) return false;
  const lowered = text.toLowerCase();

  if (EXPLICIT.some((phrase) => lowered.includes(phrase))) return true;

  // A year at or after this is beyond what the model can be trusted to know.
  // Computed per call, not at module load: a serverless instance can outlive
  // New Year's Eve, and a stale threshold silently stops searching.
  const recentYear = new Date().getFullYear() - 2;
  for (const match of lowered.matchAll(YEAR_RE)) {
    if (parseInt(match[1], 10) >= recentYear) return true;
  }

  if (RECENCY.some((word) => new RegExp(`\\b${escapeRe(word)}\\b`).test(lowered))) return true;

  return afterSearch && text.trim().split(/\s+/).length <= FOLLOWUP_MAX_WORDS;
}

/**
 * Fold earlier turns into a short follow-up so the search stays on topic.
 *
 * `previous` is the session's earlier user messages, oldest first. A message long
 * enough to stand on its own is left alone.
 *
 * The anchor is the message that SET THE TOPIC, not an accumulation of every
 * earlier turn: accumulating them produces a run-on query ("… siapa pencetak
 * golnya di stadion mana berapa penontonnya") that finds nothing.
 */
export function expandQuery(current: string, previous: string[]): string {
  const query = (current || "").split(/\s+/).filter(Boolean).join(" ");
  if (!previous.length || query.split(" ").length > FOLLOWUP_MAX_WORDS) return query;
  YEAR_RE.lastIndex = 0;
  if (YEAR_RE.test(query)) return query; // already pins its own timeframe

  const anchor = (previous[0] || "").split(/\s+/).filter(Boolean).join(" ");
  const seen = new Set([...query.toLowerCase().matchAll(WORD_RE_Q)].map((m) => m[0]));
  const extra = anchor.split(" ").filter((word) => {
    WORD_RE_Q.lastIndex = 0;
    return !seen.has(word.toLowerCase()) && WORD_RE_Q.test(word);
  });
  if (!extra.length) return query;
  return `${extra.join(" ")} ${query}`.trim().slice(0, 300);
}

/** Single-message search request. Returns the digest and its sources. */
export async function runSearch(
  query: string,
  maxResults: number,
  signal?: AbortSignal,
): Promise<{ digest: string; sources: Source[] }> {
  const { content, annotations } = await completeJson({
    model: SEARCH_MODEL,
    messages: [{ role: "user", content: SEARCH_PROMPT(query) }],
    temperature: 0,
    maxTokens: 800,
    plugins: [{ id: "web", max_results: maxResults }],
    signal,
    // A search that outlasts the chat timeout is worse than no search: the reader
    // is left staring at a spinner for an answer that could have come without it.
    timeoutMs: Math.min(TIMEOUT_MS, 90_000),
  });
  return { digest: content, sources: toSources(annotations) };
}

/** Format search findings as a section of the system message. */
export function contextBlock(query: string, digest: string, found: Source[]): string {
  const today = new Date().toISOString().slice(0, 10);
  const lines = [`Web search results for "${query}" (retrieved ${today}):`, digest];
  if (found.length) {
    lines.push("Sources:");
    lines.push(...found.map((s, i) => `${i + 1}. ${s.title} — ${s.url}`));
  }
  lines.push("Base your answer on these results and say so if they are insufficient.");
  return lines.join("\n");
}
