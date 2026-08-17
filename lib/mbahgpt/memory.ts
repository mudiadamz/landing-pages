/**
 * Memory capture and selection — a straight port of `memory.py`.
 *
 * Pure functions, no I/O and no model calls: this is the easiest part of the
 * feature to reason about and the one most worth keeping that way.
 *
 * Two jobs:
 *   1. `extractMemories()` spots "remember this: …" phrasing in a user message
 *      and returns the facts worth keeping.
 *   2. `rankMemories()` picks which stored facts are worth spending context on
 *      for the message at hand, so a large store is not injected wholesale.
 */

export type ChatMemory = {
  id: string;
  text: string;
  pinned: boolean;
  created_at: string;
  session_id?: string | null;
};

/**
 * A trigger has to open the line, optionally after a short lead-in clause
 * ("By the way, remember …") or a politeness word ("Please remember …").
 * Requiring that keeps incidental uses — "I want to remember this trip" — out of
 * the store, which is the difference between a memory list and a junk drawer.
 */
const LEAD = String.raw`^(?:[^,\n]{0,40},\s*)?(?:please\s+|also\s+|just\s+|and\s+|oh\s+)*`;

/** Phrasings that mean "store this". Each captures the rest of the line. */
const TRIGGERS = [
  new RegExp(LEAD + String.raw`remember\b\s*(?:that|this|to)?\s*[:,\-–]?\s*(.+)`, "i"),
  new RegExp(LEAD + String.raw`note to self\b\s*[:,\-–]?\s*(.+)`, "i"),
  new RegExp(LEAD + String.raw`keep in mind\b\s*(?:that)?\s*[:,\-–]?\s*(.+)`, "i"),
  new RegExp(LEAD + String.raw`don'?t forget\b\s*(?:that|to)?\s*[:,\-–]?\s*(.+)`, "i"),
  new RegExp(LEAD + String.raw`for future reference\b\s*[:,\-–]?\s*(.+)`, "i"),
];

/** "do you remember what I said?" is a question, not an instruction to store. */
const QUESTION_LEAD = /^\s*(do|does|did|can|could|would|will|are|is|was|were|have|has|any)\b/i;

const MAX_LEN = 300;
const MIN_LEN = 3;

function clean(text: string): string {
  const collapsed = text.split(/\s+/).join(" ").replace(/^[\s,;:\-–]+|[\s,;:\-–]+$/g, "");
  // Still a question after the trigger word: "remember what I told you?"
  if (collapsed.endsWith("?")) return "";
  if (collapsed.length < MIN_LEN) return "";
  return collapsed.slice(0, MAX_LEN).trimEnd();
}

/** Facts the user explicitly asked to remember, in the order they appear. */
export function extractMemories(message: string): string[] {
  const found: string[] = [];
  for (const raw of (message || "").split("\n")) {
    const line = raw.trim();
    if (!line || QUESTION_LEAD.test(line)) continue;
    for (const trigger of TRIGGERS) {
      const match = trigger.exec(line);
      if (!match) continue;
      const text = clean(match[1] ?? "");
      if (text && !found.includes(text)) found.push(text);
      break; // one memory per line
    }
  }
  return found;
}

// -- selection --------------------------------------------------------------
const STOPWORDS = new Set([
  "the", "and", "for", "you", "your", "that", "this", "with", "have", "has",
  "was", "were", "are", "but", "not", "all", "any", "can", "will", "would",
  "what", "when", "how", "why", "who",
  "about", "from", "into", "than", "then", "them", "they", "there", "here",
  "some", "more", "most", "much", "very", "just", "like", "also", "one",
  "two", "get", "got", "use", "used", "using", "make", "made", "please",
]);

const WORD_RE = /[a-z0-9']+/g;

/**
 * Crude suffix trim so 'commits'/'commit' and 'units'/'unit' match.
 *
 * Lexical only — it will not connect 'shell' to 'zsh'. Synonyms would need an
 * embedding model, which this deliberately stays free of; pinning is the answer
 * for a fact that must always apply.
 */
function stem(word: string): string {
  for (const suffix of ["ing", "ed", "es", "s"]) {
    if (word.length > suffix.length + 3 && word.endsWith(suffix)) {
      return word.slice(0, -suffix.length);
    }
  }
  return word;
}

function words(text: string): Set<string> {
  const out = new Set<string>();
  for (const match of (text || "").toLowerCase().matchAll(WORD_RE)) {
    const w = match[0];
    if (w.length > 2 && !STOPWORDS.has(w)) out.add(stem(w));
  }
  return out;
}

/**
 * Order memories by relevance to `query`, most useful first.
 *
 * Pinned always survives. Below the limit everything is included — ranking only
 * starts discarding once the store outgrows the context budget.
 */
export function rankMemories(memories: ChatMemory[], query: string, limit = 12): ChatMemory[] {
  const queryWords = words(query || "");
  return [...memories]
    .map((m) => ({
      memory: m,
      // Pinned outranks everything; then keyword overlap; then recency.
      score: (m.pinned ? 100 : 0) + [...words(m.text)].filter((w) => queryWords.has(w)).length * 10,
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // The SQLite version broke ties on the autoincrement id, i.e. by recency.
      // uuids carry no order, so the timestamp does that job explicitly.
      return b.memory.created_at.localeCompare(a.memory.created_at);
    })
    .slice(0, limit)
    .map((row) => row.memory);
}

/** Assemble the system message from preferences plus the selected memories. */
export function systemPrompt(instructions: string, memories: ChatMemory[]): string {
  const parts: string[] = [];
  if (instructions && instructions.trim()) parts.push(instructions.trim());
  if (memories.length) {
    parts.push("Things to remember about this user:\n" + memories.map((m) => `- ${m.text}`).join("\n"));
  }
  return parts.join("\n\n");
}
