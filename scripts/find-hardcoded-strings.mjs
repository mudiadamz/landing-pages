#!/usr/bin/env node
/**
 * find-hardcoded-strings — inventory every user-facing string that is NOT in
 * the dictionary, and write it to docs/i18n-backlog.md.
 *
 *   node scripts/find-hardcoded-strings.mjs [--out docs/i18n-backlog.md]
 *
 * The i18n move is being done screen by screen, and the question at the start
 * of every session is the same one: what is left, and where. Answering it by
 * grep does not work — this codebase's comments are prose, much of it
 * Indonesian, so a regex for Indonesian words reports two hundred paragraphs of
 * explanation as untranslated UI.
 *
 * So this walks each file character by character, tracking string / template /
 * comment state, and only then decides what is copy:
 *
 *   - JSX text nodes (.tsx only — in a .ts file `new Map<string, X>()` reads as
 *     a text node between > and <)
 *   - string literals in label-ish attributes (label, placeholder, title, alt,
 *     aria-label, description, error, message, …)
 *   - anything containing Indonesian vocabulary, whatever position it is in
 *
 * and drops className strings, URLs, paths, enum values, Supabase column lists,
 * MIME types, console arguments, and regex shards.
 *
 * Each hit is cross-referenced against lib/i18n/id.ts by VALUE, so a string
 * that already has a key is reported as a swap rather than as translation work.
 * Re-run it after each batch; the counts at the top are the progress bar.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["app", "components", "lib"];
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "supabase"]);
const outArg = process.argv.indexOf("--out");
const OUT = outArg > -1 ? process.argv[outArg + 1] : "docs/i18n-backlog.md";

/* ------------------------------------------------------------ dictionary */

/** value → key, so a hardcoded string can be recognised as one we already have. */
function loadDictionary() {
  const src = readFileSync(join(ROOT, "lib/i18n/id.ts"), "utf8");
  const byValue = new Map();
  for (const m of src.matchAll(/"([a-zA-Z][\w.]*)":\s*("(?:[^"\\]|\\.)*")/gs)) {
    try {
      byValue.set(JSON.parse(m[2]), m[1]);
    } catch {
      // A value we cannot parse is a value we cannot match against. Skip it.
    }
  }
  return byValue;
}

/* --------------------------------------------------------------- scanner */

/**
 * Split a file into its string literals and a "skeleton" — the same text with
 * every string and comment blanked out, newlines preserved.
 *
 * The newline bookkeeping is the fiddly part: a template literal spanning four
 * lines must leave four newlines behind, or every line number reported after it
 * is wrong by four.
 */
function scan(src) {
  const strings = [];
  const skel = [];
  let i = 0;
  let line = 1;
  const n = src.length;

  while (i < n) {
    const c = src[i];
    const next = src[i + 1];

    if (c === "/" && next === "/") {
      while (i < n && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && next === "*") {
      i += 2;
      while (i < n - 1 && !(src[i] === "*" && src[i + 1] === "/")) {
        if (src[i] === "\n") {
          line++;
          skel.push("\n");
        }
        i++;
      }
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      const startLine = line;
      const buf = [];
      i++;
      while (i < n) {
        if (src[i] === "\\") {
          buf.push(src[i], src[i + 1] ?? "");
          i += 2;
          continue;
        }
        if (src[i] === quote) {
          i++;
          break;
        }
        if (src[i] === "\n") {
          line++;
          // An unterminated quote is not a string, it is an apostrophe in JSX
          // text or a shard left by a regex literal. Stop rather than swallow
          // the rest of the file.
          if (quote !== "`") break;
        }
        buf.push(src[i]);
        i++;
      }
      const context = skel.join("").slice(-80);
      strings.push({ line: startLine, text: buf.join(""), context });
      skel.push("\0" + "\n".repeat(line - startLine));
      continue;
    }
    if (c === "\n") line++;
    skel.push(c);
    i++;
  }
  return { strings, skeleton: skel.join("") };
}

/* --------------------------------------------------------------- filters */

const CODE_ATTRS = new Set([
  "classname", "class", "href", "src", "id", "key", "htmlfor", "type", "name",
  "accept", "rel", "target", "method", "action", "as", "ref", "path", "url",
  "slug", "locale", "value", "defaultvalue", "role", "scope", "lang", "dir",
  "charset", "content", "property", "sizes", "srcset", "loading", "style",
  "autocomplete", "inputmode", "pattern", "form", "list", "step", "min", "max",
  "viewbox", "d", "fill", "stroke", "transform", "xmlns", "points", "cx", "cy",
  "r", "x", "y", "width", "height", "bucket", "table", "column", "tag", "event",
  "from", "to", "op", "mode", "rootmargin", "site_columns", "columns", "cols",
  "fields", "sql", "query", "body", "signature", "hash", "secret",
  // Calls whose arguments are never read by a person.
  "select", "insert", "update", "upsert", "eq", "neq", "gt", "lt", "gte", "lte",
  "in", "like", "ilike", "order", "rpc", "match", "throw", "revalidatetag",
  "revalidatepath", "setitem", "getitem", "removeitem", "queryselector",
  "queryselectorall", "addeventlistener", "matchmedia", "createelement",
  "setattribute", "getattribute", "includes", "startswith", "endswith", "split",
  "join", "replace", "test", "require", "import", "error", "warn", "log",
  "info", "debug", "trace", "notfound", "headers", "cookies", "has", "get",
  "set", "add", "remove", "contains", "settimeout", "assign",
  // `t("panel.order")` is the fix, not a finding — and a key like "common.edit"
  // contains "edit", so the Indonesian word list would otherwise keep it.
  "t", "translator", "usetranslator",
  // State setters whose argument is a tab id or an enum, not copy.
  "settab", "usestate", "setview", "setmode", "setsort", "font_stack",
]);

const UI_ATTRS = new Set([
  "label", "placeholder", "title", "alt", "aria-label", "arialabel", "hint",
  "description", "heading", "sub", "text", "message", "backlabel", "note",
  "emptytext", "confirmtext", "confirmlabel", "cta", "tooltip", "caption",
  "badge", "buttonlabel", "summary", "subtitle", "help", "labeltext", "empty",
  "footer", "header", "prompt", "eyebrow", "question",
]);

const CSSISH =
  /(^|\s)(px-|py-|pt-|pb-|pl-|pr-|mx-|my-|mt-|mb-|ml-|mr-|text-|bg-|border|rounded|flex|grid|gap-|w-|h-|min-|max-|absolute|relative|hidden|sm:|md:|lg:|hover:|focus:|dark:|shadow|opacity|space-|truncate|font-|items-|justify-|overflow|z-|inline|block\b|ring-|leading-|tracking-|transition-|whitespace-|active:|duration-|cursor-|select-none|pointer-events|backdrop|animate-|snap-|aspect-|object-|first:|last:|disabled:|placeholder:|group-|peer-|motion-)/;

const NOISE_TEXT =
  /(charset=|\(function|display-mode:|@media|=>|\){|;\s*}|font-family|^[a-z]+\/[a-z+.-]+$|^\(.*:.*\)$|^\$\{[^}]*\}$|^[A-Z_]{3,}$|\bpx\b|^[\d.,\s%+-]+$|width=|http-equiv|application\/|image\/|text\/|utm_[a-z]+=|^[a-z-]+, [A-Z])/;

/**
 * A .tsx generic also sits between a > and a <, and so does the gap between one
 * function's closing brace and the next one's opening brace. Prose contains
 * none of this.
 */
const CODEISH =
  /(;|=>|&&|\|\||!==|\?\?|[={}]|^[:.(),]|^if\s|\($|^<|\w+\.\w+\s*\?|\b(function|export|const|let|var|return|async|await|else|catch|typeof|interface|import|class|Props|useState|useEffect)\b)/;
/**
 * No regex-literal state in the scanner, so shards like `/gi, "")` get through.
 * Deliberately not matching `\n`: a confirm() body is full of them and is copy.
 */
const REGEXISH = /(\/g[im]*[,)]|\.replace\(|\.trim\(|\[\^)/;

const INDONESIAN =
  /\b(yang|dan|dari|untuk|tidak|belum|sudah|bisa|atau|ini|itu|akan|pada|dengan|saat|kalau|jangan|harus|hanya|semua|masih|juga|tanpa|pakai|dipakai|ke|di|per|buat|bikin|sini|adalah|karena|supaya|agar|lalu|setelah|sebelum|setiap|antara|lebih|kurang|maks|misal|contoh|[Ss]impan|[Hh]apus|[Bb]atal|[Tt]ambah|[Uu]bah|[Kk]embali|[Cc]ari|[Gg]agal|[Bb]erhasil|[Pp]ilih|[Kk]irim|[Uu]nggah|[Uu]nduh|[Mm]uat|[Pp]roduk|[Pp]embeli|[Pp]enjualan|[Pp]engguna|[Ss]itus|[Hh]alaman|[Kk]ategori|[Hh]arga|[Gg]ratis|[Nn]ama|[Jj]udul|[Kk]eterangan|[Ww]ajib|[Kk]osong|[Tt]ersimpan|[Mm]enyimpan|[Mm]emuat|[Ss]elesai|[Aa]ktif|[Nn]onaktif|[Tt]erbaru|[Ww]aktu|[Jj]umlah|[Mm]etode|[Tt]anggal|[Pp]esan|[Kk]ontak|[Pp]engaturan|[Bb]ahasa|[Bb]erkas|[Uu]kuran|[Tt]ampil|[Tt]ampilkan|[Ss]embunyikan|[Uu]rutan|[Cc]atatan|[Rr]incian|[Kk]elola|[Dd]aftar|[Pp]encarian|[Cc]oba|[Ll]agi|[Ii]si|[Ee]dit|[Bb]aru|[Ll]ama|[Tt]erakhir)\b/;

/** "id" = certainly Indonesian copy. "maybe" = a label that still needs a key. */
function classify(text, attr) {
  const t = text.trim();
  if (t.length < 2 || !/[A-Za-z]/.test(t)) return null;
  if (/^(\/|https?|\.\/|\.\.\/|@\/|#|data:|use )/.test(t)) return null;
  const indo = INDONESIAN.test(t);
  if (CSSISH.test(t) && !indo) return null;
  if (CODE_ATTRS.has(attr) || CODE_ATTRS.has(attr.split(".").pop())) return null;
  if (NOISE_TEXT.test(t) || REGEXISH.test(t)) return null;
  if (/^[\w.-]+$/.test(t) && !indo) return null;
  // A Supabase column list: four or more bare identifiers, comma separated.
  if (t.split(",").filter((p) => /^\s*[a-z_][a-z0-9_]*\s*$/.test(p)).length >= 4) return null;
  // Mostly interpolation: `${num} · ${named}`, `${m}min`, `statusCode: ${c}`.
  if (t.includes("${")) {
    const outside = t.replace(/\$\{[^}]*\}/g, "");
    if ((outside.match(/[A-Za-z]/g) ?? []).length < 6) return null;
  }
  if (indo) return "id";
  if (UI_ATTRS.has(attr) || t.includes(" ")) return "maybe";
  return null;
}

function attrOf(context) {
  return (
    context.match(/([A-Za-z][\w-]*)\s*=\s*\{?\s*$/)?.[1] ??
    context.match(/([A-Za-z][\w-]*)\s*:\s*$/)?.[1] ??
    context.match(/([A-Za-z][\w.]*)\(\s*$/)?.[1] ??
    ""
  ).toLowerCase();
}

/* --------------------------------------------------------------- buckets */

function bucketOf(f) {
  if (f.startsWith("app/panel/")) return "A. Panel screens";
  if (f.startsWith("components/")) return "B. Shared components";
  if (f.startsWith("app/api/") || f.startsWith("lib/actions/")) return "D. Actions & API messages";
  if (
    f === "lib/content-config.ts" ||
    f === "lib/hiring-questions.ts" ||
    f.startsWith("lib/templates/") ||
    f.includes("email")
  ) {
    return "E. Content defaults & email copy";
  }
  if (f.startsWith("app/")) return "C. Public pages";
  return "F. Other lib";
}

const BUCKET_ORDER = [
  "A. Panel screens",
  "B. Shared components",
  "C. Public pages",
  "D. Actions & API messages",
  "E. Content defaults & email copy",
  "F. Other lib",
];

const BUCKET_BLURB = {
  "A. Panel screens":
    "Admin/publisher UI under `app/panel/`. The switcher in the sidebar already offers a language, so every string here is visibly wrong in English today.",
  "B. Shared components":
    "Rendered on both the storefront and the panel. Converting these fixes two surfaces at once — and `useT()` works in the client ones without touching their callers.",
  "C. Public pages":
    "What a buyer reads. Highest stakes for a second language: a storefront set to `en` still sells in Indonesian.",
  "D. Actions & API messages":
    'Strings returned to a form and rendered as-is (`{ error: "…" }`). Server Actions can call `t(key, vars, locale)` directly; the locale has to be resolved by the action, not assumed.',
  "E. Content defaults & email copy":
    "Seed content and emails, not chrome. Site content defaults are per-site data an admin can edit, and emails are sent outside a request — both need a decision (translate, or leave as the seed) before any key is written.",
  "F. Other lib":
    "Config modules that hold labels: palette names, feature names, hero/popup defaults, upload and domain error text.",
};

/* ------------------------------------------------------------------ walk */

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith(".ts") || full.endsWith(".tsx")) out.push(full);
  }
  return out;
}

function collect(dictionary) {
  // Keys also travel as data — `labelKey: "product.tabDetail"` in a tab list —
  // so a bare key string anywhere is a use of the dictionary, not a bypass.
  const keys = new Set(dictionary.values());
  const hits = [];
  for (const dir of SCAN_DIRS) {
    for (const full of walk(join(ROOT, dir))) {
      const file = relative(ROOT, full);
      if (file.startsWith("lib/i18n") || file.endsWith(".d.ts")) continue;
      const src = readFileSync(full, "utf8");
      const { strings, skeleton } = scan(src);

      for (const s of strings) {
        const attr = attrOf(s.context);
        const trimmed = s.text.trim();
        const kind =
          keys.has(trimmed) || trimmed.startsWith("<") ? null : classify(s.text, attr);
        if (kind) hits.push({ file, line: s.line, where: attr || "literal", kind, text: s.text.trim() });
      }

      if (!file.endsWith(".tsx")) continue;
      // Three shapes, because half the copy in this codebase sits next to an
      // interpolation: `>plain text<`, `{count} dicabut<`, and `>Dicabut {date}`.
      // Matching only the first missed every counter and every date line.
      for (const m of skeleton.matchAll(/[>}]([^<>{}\0]+)[<{]/g)) {
        const text = m[1].split(/\s+/).join(" ").trim();
        if (!text) continue;
        const kind = classify(text, "");
        if (!kind || CODEISH.test(text)) continue;
        const line = (skeleton.slice(0, m.index).match(/\n/g) ?? []).length + 1;
        hits.push({ file, line, where: "text", kind, text });
      }
    }
  }
  for (const h of hits) {
    h.existingKey = dictionary.get(h.text) ?? dictionary.get(h.text.replace(/\.$/, "").trim()) ?? null;
    h.bucket = bucketOf(h.file);
  }
  hits.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  return hits;
}

/* ---------------------------------------------------------------- output */

const esc = (s) => s.replaceAll("|", "\\|").replaceAll("`", "'");
const groupBy = (rows, pick) => {
  const m = new Map();
  for (const r of rows) m.set(pick(r), [...(m.get(pick(r)) ?? []), r]);
  return m;
};

function render(hits, today) {
  const L = [];
  const w = (s = "") => L.push(s);
  const swaps = hits.filter((h) => h.existingKey);
  const files = new Set(hits.map((h) => h.file));

  w("# Hardcoded UI strings — inventory");
  w();
  w(`Generated by \`node scripts/find-hardcoded-strings.mjs\` on ${today}, from \`app/\`, \`components/\` and \`lib/\` (excluding \`lib/i18n/\`). Every entry is a string a user can read that does **not** come from the dictionary. Re-run it after each batch — the counts are the progress bar.`);
  w();
  w(`**${hits.length} strings** across **${files.size} files**. ${hits.filter((h) => h.kind === "id").length} are unambiguously Indonesian prose or labels; the rest are short or English-identical strings that still need a key. ${swaps.length} of them already exist in \`id.ts\` under a key — those are swaps, not translations.`);
  w();
  w("| Bucket | Strings | Files | Already keyed |");
  w("|---|---:|---:|---:|");
  for (const b of BUCKET_ORDER) {
    const rows = hits.filter((h) => h.bucket === b);
    w(`| ${b} | ${rows.length} | ${new Set(rows.map((r) => r.file)).size} | ${rows.filter((r) => r.existingKey).length} |`);
  }
  w();
  w("## What this will have missed");
  w();
  w("- **Single-word English labels** in a text node — `Preview`, `Assets`, `Analytics` — are dropped as probable identifiers. Real, but they read the same in both languages, so they are the cheapest thing left.");
  w('- **Strings built by concatenation** (`"Sisa " + n + " hari"`) are captured as their fragments, which is how they are found but not how they can be translated — each becomes one `{var}` key.');
  w("- **Labels held in a variable** far from their use site are listed at the definition, not at the render.");
  w("- **Pluralisation** is not flagged anywhere. Indonesian does not need it; English does, and a few counters here will need two keys or a count-aware helper `t()` does not have today.");
  w("- A line number on a text node points at the line its tag opens on, sometimes one above the words. `literal` in place of an attribute name means the string was not attached to a named prop — usually an options array or a variable read further down.");
  w();
  w("## Converting a file");
  w();
  w("The rules come from `lib/i18n/`; collected here so a session does not have to re-derive them.");
  w();
  w("- **Server component** — `const t = translator(await requestLocale());`. A shared component the pages cannot pass a locale to may become `async` and resolve its own, as `SiteFooter` and the scope notices do.");
  w("- **Client component** — `const t = useT();`, above any early return. Panel and public shell both sit inside a `LocaleProvider`.");
  w("- **Server action** — `t(key, vars, locale)` with an explicit locale. Never a module-level current locale: one server renders every tenant at once.");
  w("- **Data carrying a label** (tab lists, option arrays, `features.ts`) — store the KEY, translate at render. A label resolved in a module-scope array freezes whichever language loaded first.");
  w("- Add the key to `id.ts` **and** `en.ts`; a key missing from `en.ts` is a type error, which is the point.");
  w("- Run `pnpm exec vitest run tests/i18n.test.ts`. It fails on a key nothing calls, so a converted screen must also drop its key from `NOT_YET_CONVERTED`; and it fails on a new duplicate VALUE, so two keys that genuinely share a word need a declared reason in `INTENTIONAL_DUPLICATES`.");
  w();
  w("## Free swaps — the string is already in the dictionary");
  w();
  w(`These render text \`id.ts\` already holds under a key: replace the literal with \`t("…")\`, no new keys and nothing to translate. Doing them first clears ${Math.round((100 * swaps.length) / hits.length)}% of the backlog.`);
  w();
  w("| Key | Text | Used raw in |");
  w("|---|---|---|");
  const byKey = [...groupBy(swaps, (h) => h.existingKey)].sort((a, b) => b[1].length - a[1].length);
  for (const [key, rows] of byKey) {
    const where = rows.slice(0, 4).map((r) => `\`${r.file}:${r.line}\``).join(", ");
    w(`| \`${key}\` | ${esc(rows[0].text.slice(0, 60))} | ${where}${rows.length > 4 ? `, +${rows.length - 4} more` : ""} |`);
  }
  w();

  for (const bucket of BUCKET_ORDER) {
    const rows = hits.filter((h) => h.bucket === bucket);
    if (!rows.length) continue;
    w(`## ${bucket} — ${rows.length} strings`);
    w();
    w(BUCKET_BLURB[bucket]);
    w();
    const byFile = [...groupBy(rows, (r) => r.file)].sort(
      (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]),
    );
    for (const [file, frows] of byFile) {
      const keyed = frows.filter((r) => r.existingKey).length;
      w(`### \`${file}\` — ${frows.length}${keyed ? ` (${keyed} already keyed)` : ""}`);
      w();
      for (const r of frows.sort((a, b) => a.line - b.line)) {
        const text = r.text.length > 160 ? r.text.slice(0, 157) + "…" : r.text;
        w(`- \`L${r.line}\` *${r.where}* — ${esc(text)}${r.existingKey ? `  → \`${r.existingKey}\`` : ""}`);
      }
      w();
    }
  }
  return L.join("\n") + "\n";
}

const hits = collect(loadDictionary());
const today = new Date().toISOString().slice(0, 10);
writeFileSync(join(ROOT, OUT), render(hits, today));
console.log(`${hits.length} strings in ${new Set(hits.map((h) => h.file)).size} files → ${OUT}`);
