/**
 * Turning stored history into an OpenRouter request. Port of `build_messages()`
 * and `trim_history()` from `server.py`, plus the file classification around them.
 *
 * Three kinds of attachment take three different routes to the model — chosen for
 * cost and fidelity, not for uniformity (all three measured on the standalone app):
 *
 *   | kind   | how it reaches the model              | extra cost        |
 *   |--------|---------------------------------------|-------------------|
 *   | image  | `image_url` part, as a data URI        | the model's image rate |
 *   | pdf    | `file` part + the `file-parser` plugin | none              |
 *   | text   | inlined into the message text         | none              |
 *
 * Bytes are read through an injected loader rather than fetched here, so this
 * module stays testable and has no idea Supabase exists.
 */
import { MAX_HISTORY } from "./config";
import type { ChatMessage, ContentPart } from "./openrouter";

export const PDF_TYPE = "application/pdf";

export const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

/** Text-ish documents are inlined as text: free, exact, and no plugin involved. */
const TEXT_TYPES = new Set([
  "text/plain", "text/markdown", "text/csv", "application/json",
  "text/html", "text/xml", "application/xml", "text/x-python",
  "application/javascript", "text/javascript", "text/css",
]);

const TEXT_SUFFIXES = [
  ".txt", ".md", ".csv", ".json", ".log", ".py", ".js", ".ts",
  ".html", ".css", ".yml", ".yaml", ".xml", ".sql", ".sh", ".ini",
];

const MIME_BY_SUFFIX: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".gif": "image/gif", ".pdf": PDF_TYPE,
  ".txt": "text/plain", ".md": "text/markdown", ".csv": "text/csv",
  ".json": "application/json", ".html": "text/html", ".xml": "text/xml",
  ".py": "text/x-python", ".js": "text/javascript", ".css": "text/css",
};

function extension(name: string): string {
  const dot = (name || "").lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot).toLowerCase();
}

export function guessMime(name: string): string {
  return MIME_BY_SUFFIX[extension(name)] ?? "application/octet-stream";
}

/** How a file will reach the model, or null when it cannot. */
export type FileKind = "image" | "pdf" | "text";

export function classify(name: string, mime: string): FileKind | null {
  const lower = (name || "").toLowerCase();
  const type = (mime || "").split(";")[0].trim().toLowerCase();
  if (IMAGE_TYPES.has(type)) return "image";
  if (type === PDF_TYPE || lower.endsWith(".pdf")) return "pdf";
  if (TEXT_TYPES.has(type) || TEXT_SUFFIXES.some((s) => lower.endsWith(s)) || type.startsWith("text/")) {
    return "text";
  }
  return null;
}

/** What the UI shows, which is coarser than what the request needs. */
export function storageKind(kind: FileKind): "image" | "document" {
  return kind === "image" ? "image" : "document";
}

/** Characters of an inlined document. Past this the message stops being a message. */
const MAX_TEXT_FILE = 80_000;

function dataUri(mime: string, bytes: Uint8Array): string {
  return `data:${mime || "application/octet-stream"};base64,${Buffer.from(bytes).toString("base64")}`;
}

export type StoredAttachment = {
  id: string;
  name: string;
  mime: string;
  size: number;
  storage_path: string;
};

export type StoredMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments: StoredAttachment[];
};

/**
 * History shaped for OpenRouter, with attachments folded in.
 *
 * Attachments are resent on EVERY turn of the session — that is why a follow-up
 * question about an image still gets answered, and also why a long conversation
 * full of images gets expensive. Both halves of that are deliberate.
 *
 * A file whose bytes cannot be read is skipped rather than fatal: one expired
 * object must not make an entire thread unanswerable.
 */
export async function buildMessages(
  history: StoredMessage[],
  loadBytes: (path: string) => Promise<Uint8Array | null>,
): Promise<{ messages: ChatMessage[]; needsPdf: boolean }> {
  const messages: ChatMessage[] = [];
  let needsPdf = false;

  for (const message of history) {
    let text = message.content;
    const parts: ContentPart[] = [];

    if (message.role === "user" && message.attachments.length) {
      for (const att of message.attachments) {
        const kind = classify(att.name, att.mime);
        if (!kind) continue;
        const bytes = await loadBytes(att.storage_path);
        if (!bytes) continue;

        if (kind === "image") {
          parts.push({ type: "image_url", image_url: { url: dataUri(att.mime, bytes) } });
        } else if (kind === "pdf") {
          needsPdf = true;
          parts.push({
            type: "file",
            file: { filename: att.name, file_data: dataUri(PDF_TYPE, bytes) },
          });
        } else {
          const body = new TextDecoder("utf-8", { fatal: false }).decode(bytes).slice(0, MAX_TEXT_FILE);
          text += `\n\n--- file contents: ${att.name} ---\n${body}`;
        }
      }
    }

    if (parts.length) {
      // The text part comes first, and is never empty: a parts array with no text
      // reads to the model as an image with no question attached.
      //
      // English, like the rest of the prompt scaffolding in this feature — it is
      // addressed to the model, not to the reader, and mixing the storefront's
      // language into instructions the model follows only adds noise.
      messages.push({
        role: message.role,
        content: [{ type: "text", text: text || "(see attachment)" }, ...parts],
      });
    } else if (text) {
      messages.push({ role: message.role, content: text });
    }
  }

  return { messages, needsPdf };
}

/**
 * Bound what is resent each turn, ALWAYS keeping the opening message.
 *
 * The opening message is what anchors terse follow-ups ("final ucl"), so trimming
 * from the middle keeps the thread answerable where trimming from the front would
 * quietly change the subject.
 */
export function trimHistory(messages: ChatMessage[], planCap?: number | null): ChatMessage[] {
  // The plan may only ever tighten the deployment's own ceiling, never widen it:
  // MAX_HISTORY is what the owner is willing to pay per turn, and no plan sold to
  // a visitor should be able to raise it.
  const cap = planCap == null ? MAX_HISTORY : Math.min(MAX_HISTORY, planCap);
  if (cap <= 0 || messages.length <= cap) return messages;
  return [messages[0], ...messages.slice(-(cap - 1))];
}

/**
 * A terse follow-up ("final ucl") means the previous turn's subject and timeframe
 * still apply. Telling the model the RESOLVED question outright works far better
 * than asking it to "use context" — with only a vague hint it keeps answering
 * generically and padding with background the reader already has.
 */
export function followupHint(resolved: string): string {
  return (
    `The user's latest message is a short follow-up. In the context of this ` +
    `conversation it means: "${resolved}".\n` +
    `Answer exactly that, directly and specifically. Do not broaden it into a ` +
    `general overview and do not restate background they already have.`
  );
}
