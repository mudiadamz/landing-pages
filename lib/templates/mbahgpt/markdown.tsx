"use client";

/**
 * The model-output renderer, ported from the DOM builder in `index.html`.
 *
 * The original never used `innerHTML` — every node was created and every string
 * assigned as `textContent` — because that was the only thing standing between
 * model output and an XSS. React gives the same guarantee by construction: text
 * children are escaped, and nothing here goes near `dangerouslySetInnerHTML`. The
 * rule survives the port; the mechanism is now the framework's.
 *
 * Deliberate divergences from ordinary markdown, all of them measured against
 * what actually shows up in these conversations:
 *
 *   * `_underscore_` is NOT italic. It would mangle `my_func_name` and
 *     `__dunder__`, which appear far more often than underscore italics.
 *   * Autolinking uses a CURATED TLD list. A naive `\.[a-z]+` turns `Node.js`,
 *     `index.html` and `config.json` into links.
 *   * `@handle` links only when the surrounding text names a platform. Guessing
 *     sends people to the wrong person's profile on the wrong network.
 *
 * One structural change from the original: the "which platform is this message
 * about" value was a module-level variable there. Here it is threaded through as
 * an argument — with React rendering, a module global would be shared across two
 * messages rendering in the same tick.
 */

import type { ReactNode } from "react";
import { CopyCodeButton } from "./copy-button";

const FENCE = /^\s*```(.*)$/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const RULE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;
const QUOTE = /^\s*>\s?(.*)$/;
const BULLET = /^(\s*)([-*+])\s+(.*)$/;
const NUMBER = /^(\s*)(\d+)[.)]\s+(.*)$/;
const TABLE_SEP = /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/;

/** Domains that become links on their own, so a bare "instagram.com/x" is clickable. */
const TLD_SAFE = [
  "com", "net", "org", "edu", "gov", "info", "biz", "io", "ai", "co", "tv",
  "fm", "xyz", "dev", "cloud", "online", "store", "site", "blog", "news",
  "wiki", "social", "link", "page", "shop", "live", "tech", "me",
  "uk", "us", "de", "fr", "es", "it", "nl", "jp", "kr", "cn", "br", "au",
  "ca", "ru", "se", "no", "fi", "pl", "tr", "ch", "be", "dk", "cz", "pt",
  "gr", "nz", "za", "sg", "my", "ph", "th", "vn", "hk", "tw", "ae", "mx",
].join("|");

/**
 * These collide with ordinary code ("session.id", "list.at", "run.sh"), so they
 * only link when a path follows: "kompas.id/berita" yes, "session.id" no.
 */
const TLD_RISKY = ["id", "at", "in", "is", "sh", "to", "so", "app", "ly"].join("|");

const HOST = "(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+";
const PATH = "(?:/[^\\s<>()]*)?";

type Platform = { re: RegExp; url: (handle: string) => string; name: string };

const PLATFORMS: Platform[] = [
  { re: /\b(?:instagram|insta|ig)\b/i, url: (h) => `https://instagram.com/${h}`, name: "Instagram" },
  { re: /\btik\s?tok\b/i, url: (h) => `https://tiktok.com/@${h}`, name: "TikTok" },
  // Bare "X" is too common a word to use as a keyword, so it only counts when
  // written as a label ("X: @someone") or as twitter/x.com.
  { re: /\b(?:twitter|x\.com)\b|(?:^|\s)x\s*[:：]\s*@/i, url: (h) => `https://x.com/${h}`, name: "X" },
  { re: /\byoutube\b/i, url: (h) => `https://youtube.com/@${h}`, name: "YouTube" },
  { re: /\b(?:facebook|fb)\b/i, url: (h) => `https://facebook.com/${h}`, name: "Facebook" },
  { re: /\bthreads\b/i, url: (h) => `https://threads.net/@${h}`, name: "Threads" },
  { re: /\btelegram\b/i, url: (h) => `https://t.me/${h}`, name: "Telegram" },
  { re: /\bgithub\b/i, url: (h) => `https://github.com/${h}`, name: "GitHub" },
  { re: /\blinkedin\b/i, url: (h) => `https://linkedin.com/in/${h}`, name: "LinkedIn" },
  { re: /\btwitch\b/i, url: (h) => `https://twitch.tv/${h}`, name: "Twitch" },
];

/**
 * One platform named → use it. Several → ambiguous at this scope, so defer to a
 * narrower one (the line) rather than picking arbitrarily.
 */
function detectPlatform(text: string): Platform | null {
  const hits = PLATFORMS.filter((p) => p.re.test(text));
  return hits.length === 1 ? hits[0] : null;
}

/**
 * Code annotations and decorators that look like handles. Without this, a reply
 * that happens to mention Instagram would turn "@media" or "@app.route" into a
 * profile link.
 */
const HANDLE_DENY = new Set([
  "media", "keyframes", "import", "charset", "font-face", "supports",
  "param", "params", "return", "returns", "throws", "override", "deprecated",
  "since", "author", "see", "example", "todo", "fixme", "note", "link",
  "app", "route", "get", "post", "put", "patch", "delete", "staticmethod",
  "classmethod", "property", "dataclass", "pytest", "mock", "test", "fixture",
  "component", "injectable", "input", "output", "directive", "ngmodule",
  "autowired", "entity", "table", "column", "controller", "service", "bean",
  "click", "command", "decorator", "wraps", "cache", "type", "types",
]);

const INLINE_SRC = [
  "(`+)([\\s\\S]*?)\\1", // `code`
  "\\*\\*\\*([\\s\\S]+?)\\*\\*\\*", // ***bold italic***
  "\\*\\*([\\s\\S]+?)\\*\\*", // **bold**
  "~~([\\s\\S]+?)~~", // ~~strike~~
  "\\*([^*\\n]+?)\\*", // *italic*
  "\\[([^\\]]*)\\]\\(([^)\\s]+)\\)", // [text](url) — before autolink so it wins
  // bare URL / domain, not preceded by a word char, @ or dot
  "(?<![\\w@.])((?:https?://|www\\.)[^\\s<>()]+" +
    "|" + HOST + "(?:" + TLD_SAFE + ")" + PATH +
    "|" + HOST + "(?:" + TLD_RISKY + ")/[^\\s<>()]*)",
  // @handle — the lookbehind keeps it off email addresses
  "(?<![\\w@.])@([a-z0-9](?:[a-z0-9._]{0,28}[a-z0-9])?)",
].join("|");

const LINK_CLASS = "text-[var(--primary)] underline decoration-[var(--primary)]/30 underline-offset-2 hover:decoration-[var(--primary)]";

/** Only http(s)/mailto become real links, so `javascript:` can never be clickable. */
function safeLink(label: string, href: string, key: number): ReactNode {
  if (!/^(https?:\/\/|mailto:)/i.test(href)) return <span key={key}>{`${label} (${href})`}</span>;
  return (
    <a key={key} href={href} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
      {label || href}
    </a>
  );
}

/**
 * A bare URL found in prose. Sentence punctuation that trails it is not part of
 * the URL, so it goes back as plain text.
 */
function autolink(raw: string, key: number): ReactNode[] {
  const url = raw.replace(/[.,;:!?'")\]]+$/, "");
  const trailing = raw.slice(url.length);
  const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  const out: ReactNode[] = [
    <a key={key} href={href} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
      {url}
    </a>,
  ];
  if (trailing) out.push(<span key={`${key}t`}>{trailing}</span>);
  return out;
}

/** "@someone" becomes a profile link only when the text says which platform. */
function handleLink(handle: string, platform: Platform | null, key: number): ReactNode[] {
  const clean = handle.replace(/[._]+$/, "");
  const lower = clean.toLowerCase();
  const denied = HANDLE_DENY.has(lower) || HANDLE_DENY.has(lower.split(".")[0]);
  if (!platform || !clean || denied) return [<span key={key}>{`@${handle}`}</span>];

  const out: ReactNode[] = [
    <a
      key={key}
      href={platform.url(clean)}
      target="_blank"
      rel="noopener noreferrer"
      title={`${platform.name}: @${clean}`}
      className={LINK_CLASS}
    >
      {`@${clean}`}
    </a>,
  ];
  if (handle.length > clean.length) out.push(<span key={`${key}t`}>{handle.slice(clean.length)}</span>);
  return out;
}

/** Inline spans of one line of text. */
function inline(text: string, messagePlatform: Platform | null): ReactNode[] {
  // A fresh regex per call: this function recurses for nested emphasis, and a
  // shared /g/ regex would have its lastIndex clobbered by the inner call.
  const re = new RegExp(INLINE_SRC, "gi");
  // This line's own platform wins ("TikTok: @a" inside an Instagram post);
  // otherwise the reply-wide one applies.
  const platform = detectPlatform(text) || messagePlatform;
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(<span key={key++}>{text.slice(last, m.index)}</span>);

    if (m[2] !== undefined) {
      out.push(
        <code
          key={key++}
          className="rounded border border-[var(--border)] bg-[var(--code-bg)] px-1 py-[0.06em] font-mono text-[0.88em]"
        >
          {m[2].trim()}
        </code>,
      );
    } else if (m[3] !== undefined) {
      out.push(
        <strong key={key++} className="font-semibold">
          <em>{inline(m[3], platform)}</em>
        </strong>,
      );
    } else if (m[4] !== undefined) {
      out.push(
        <strong key={key++} className="font-semibold">
          {inline(m[4], platform)}
        </strong>,
      );
    } else if (m[5] !== undefined) {
      out.push(<del key={key++}>{inline(m[5], platform)}</del>);
    } else if (m[6] !== undefined) {
      out.push(<em key={key++}>{inline(m[6], platform)}</em>);
    } else if (m[7] !== undefined) {
      out.push(safeLink(m[7], m[8], key++));
    } else if (m[9] !== undefined) {
      out.push(...autolink(m[9], key++));
    } else if (m[10] !== undefined) {
      out.push(...handleLink(m[10], platform, key++));
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(<span key={key++}>{text.slice(last)}</span>);
  return out;
}

function cells(line: string): string[] {
  let row = line.trim();
  if (row.startsWith("|")) row = row.slice(1);
  if (row.endsWith("|")) row = row.slice(0, -1);
  return row.split("|").map((c) => c.trim());
}

type ListItem = { indent: number; text: string; ordered: boolean };

/** Consecutive list lines → nested lists, using indent width for depth. */
function renderList(items: ListItem[], ordered: boolean, platform: Platform | null, key: number): ReactNode {
  // Group by depth into a tree first: JSX cannot be appended to after creation the
  // way DOM nodes could, so the nesting has to be resolved before rendering.
  type Node = { text: string; children: Node[]; ordered: boolean };
  const roots: Node[] = [];
  const stack: { indent: number; nodes: Node[] }[] = [{ indent: -1, nodes: roots }];

  for (const item of items) {
    while (stack.length > 1 && item.indent <= stack[stack.length - 1].indent) stack.pop();
    const level = stack[stack.length - 1];
    const node: Node = { text: item.text, children: [], ordered: item.ordered };
    if (item.indent > level.indent && level.nodes.length && stack.length > 1) {
      const parent = level.nodes[level.nodes.length - 1];
      parent.children.push(node);
      stack.push({ indent: item.indent, nodes: parent.children });
    } else {
      level.nodes.push(node);
      if (stack.length === 1) stack.push({ indent: item.indent, nodes: roots });
    }
  }

  const draw = (nodes: Node[], isOrdered: boolean, depth: number): ReactNode => {
    const Tag = isOrdered ? "ol" : "ul";
    return (
      <Tag
        key={`${key}-${depth}`}
        className={`mb-3 space-y-0.5 pl-6 ${isOrdered ? "list-decimal" : "list-disc"}`}
      >
        {nodes.map((node, i) => (
          <li key={i} className="my-0.5">
            {inline(node.text, platform)}
            {node.children.length > 0 && draw(node.children, node.children[0].ordered, depth + 1)}
          </li>
        ))}
      </Tag>
    );
  };

  return draw(roots, ordered, 0);
}

function parseBlocks(text: string, platform: Platform | null): ReactNode[] {
  const lines = text.split("\n");
  const out: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code. An UNCLOSED fence still renders as code, which is what keeps a
    // half-streamed code block from flashing as prose on every token.
    const fence = line.match(FENCE);
    if (fence) {
      const lang = fence[1].trim();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !FENCE.test(lines[i])) buf.push(lines[i++]);
      i++; // consume the closing fence if present
      const code = buf.join("\n");
      out.push(
        <div key={key++} className="group/code relative mb-3">
          <pre className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--code-bg)] p-4 text-[0.86em] whitespace-pre">
            <code className={`font-mono ${lang ? `language-${lang.replace(/[^\w+-]/g, "")}` : ""}`}>{code}</code>
          </pre>
          <CopyCodeButton
            getText={() => code}
            className="absolute top-2 right-2 opacity-0 transition-opacity group-hover/code:opacity-100 focus-visible:opacity-100 max-[900px]:opacity-80"
          />
        </div>,
      );
      continue;
    }

    if (!line.trim()) {
      i++;
      continue;
    }

    if (RULE.test(line)) {
      out.push(<hr key={key++} className="my-4 border-0 border-t border-[var(--border)]" />);
      i++;
      continue;
    }

    const heading = line.match(HEADING);
    if (heading) {
      const level = heading[1].length;
      const size = ["text-xl", "text-lg", "text-base", "text-sm", "text-sm", "text-sm"][level - 1];
      const Tag = (`h${level}` as unknown) as "h1";
      out.push(
        <Tag key={key++} className={`mt-6 mb-2 font-semibold tracking-tight first:mt-0 ${size}`}>
          {inline(heading[2], platform)}
        </Tag>,
      );
      i++;
      continue;
    }

    if (QUOTE.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i])) {
        buf.push(lines[i].match(QUOTE)![1]);
        i++;
      }
      out.push(
        <blockquote key={key++} className="mb-3 border-l-2 border-[var(--primary)] py-0.5 pl-4 text-[var(--muted)]">
          {parseBlocks(buf.join("\n"), platform)}
        </blockquote>,
      );
      continue;
    }

    // Table: a header row followed by a |---|---| separator.
    if (line.includes("|") && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1]) && lines[i + 1].includes("-")) {
      const header = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
        rows.push(cells(lines[i]));
        i++;
      }
      out.push(
        // Its own scroll container: a wide table must not make the page scroll
        // sideways.
        <div key={key++} className="mb-3 overflow-x-auto">
          <table className="border-collapse overflow-hidden rounded-lg text-[0.9em]">
            <thead>
              <tr>
                {header.map((c, n) => (
                  <th
                    key={n}
                    className="border border-[var(--border)] bg-[var(--accent-subtle)] px-2.5 py-1.5 text-left font-semibold"
                  >
                    {inline(c, platform)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r}>
                  {header.map((_, c) => (
                    <td key={c} className="border border-[var(--border)] px-2.5 py-1.5 text-left">
                      {inline(row[c] || "", platform)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    if (BULLET.test(line) || NUMBER.test(line)) {
      const ordered = NUMBER.test(line);
      const items: ListItem[] = [];
      while (i < lines.length) {
        const bullet = lines[i].match(BULLET);
        const number = lines[i].match(NUMBER);
        if (!bullet && !number) break;
        const m = (bullet || number)!;
        items.push({ indent: m[1].length, text: m[3], ordered: !!number });
        i++;
      }
      out.push(renderList(items, ordered, platform, key++));
      continue;
    }

    // Paragraph: consecutive plain lines, single newlines kept as breaks.
    const buf: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !FENCE.test(lines[i]) &&
      !HEADING.test(lines[i]) &&
      !QUOTE.test(lines[i]) &&
      !BULLET.test(lines[i]) &&
      !NUMBER.test(lines[i]) &&
      !RULE.test(lines[i])
    ) {
      buf.push(lines[i]);
      i++;
    }
    out.push(
      <p key={key++} className="mb-3 last:mb-0">
        {buf.map((l, n) => (
          <span key={n}>
            {n > 0 && <br />}
            {inline(l, platform)}
          </span>
        ))}
      </p>,
    );
  }

  return out;
}

/** Rendered model output. `source` is the raw markdown, exactly as streamed. */
export function Markdown({ source }: { source: string }) {
  return <>{parseBlocks(source, detectPlatform(source))}</>;
}
