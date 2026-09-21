/**
 * The two little languages PostgREST speaks, parsed.
 *
 * Only the subset this codebase uses — measured before writing, see
 * docs/plans/remove-supabase.md fase 1 — but parsed properly rather than
 * pattern-matched, because a filter that silently parses to "match everything"
 * shows MORE data than it should, and that looks like success.
 *
 *   select:  `id, title, alias:col, col::text, rel(a, b), alias:rel!fk_name(a),
 *             rel!inner(col), rel(count), *`
 *   or():    `site_id.eq.<uuid>,site_id.is.null`, `a.not.is.null`,
 *            `title.ilike.%q%`, `x.in.(a,b)`, `and(a.eq.1,b.eq.2)`
 */

// ---------------------------------------------------------------------------
// select
// ---------------------------------------------------------------------------

export type SelectItem =
  | { kind: "star" }
  | { kind: "col"; name: string; alias?: string; cast?: string; path?: string[] }
  | { kind: "count"; alias?: string }
  | { kind: "embed"; rel: string; alias?: string; hint?: string; inner: boolean; items: SelectItem[] };

const IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/** Split on commas that are not inside parentheses or quotes. */
export function splitTop(s: string, sep = ","): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote = false;
  let cur = "";
  for (const ch of s) {
    if (ch === '"') quote = !quote;
    else if (!quote && ch === "(") depth++;
    else if (!quote && ch === ")") depth--;
    if (ch === sep && depth === 0 && !quote) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim()).filter((x) => x.length > 0);
}

function ident(name: string, what: string): string {
  if (!IDENT.test(name)) throw new GrammarError(`${what} tidak valid: "${name}"`);
  return name;
}

export class GrammarError extends Error {
  code = "PGRST100";
}

export function parseSelect(raw: string): SelectItem[] {
  const text = raw.replace(/\s+/g, " ").trim();
  if (text === "" || text === "*") return [{ kind: "star" }];
  return splitTop(text).map(parseItem);
}

function parseItem(token: string): SelectItem {
  if (token === "*") return { kind: "star" };

  // alias:rel!hint!inner( … )
  const embed = token.match(/^(?:([a-zA-Z_]\w*)\s*:\s*)?([a-zA-Z_]\w*)((?:\s*!\s*[a-zA-Z_]\w*)*)\s*\(([\s\S]*)\)$/);
  if (embed) {
    const [, alias, rel, bangs, inside] = embed;
    const flags = bangs
      .split("!")
      .map((x) => x.trim())
      .filter(Boolean);
    const inner = flags.includes("inner");
    const hint = flags.find((f) => f !== "inner" && f !== "left");
    const items = inside.trim() === "" ? [{ kind: "star" as const }] : splitTop(inside).map(parseItem);
    return { kind: "embed", rel: ident(rel, "relasi"), alias, hint, inner, items };
  }

  // alias:col->a->>b::type
  const col = token.match(/^(?:([a-zA-Z_]\w*)\s*:\s*)?([a-zA-Z_]\w*)((?:->>?[a-zA-Z_]\w*)*)(?:::([a-zA-Z_][\w ]*))?$/);
  if (!col) throw new GrammarError(`bagian select tidak dikenal: "${token}"`);
  const [, alias, name, pathRaw, cast] = col;
  if (name === "count" && !pathRaw && !cast) return { kind: "count", alias };
  const path = pathRaw ? pathRaw.match(/->>?[a-zA-Z_]\w*/g)! : undefined;
  return { kind: "col", name, alias, cast: cast?.trim(), path };
}

// ---------------------------------------------------------------------------
// filters
// ---------------------------------------------------------------------------

export type Op = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "like" | "ilike" | "is" | "in" | "cs" | "cd";

export type Filter =
  | { kind: "cond"; col: string; op: Op; value: unknown; negate?: boolean }
  | { kind: "or"; items: Filter[]; negate?: boolean }
  | { kind: "and"; items: Filter[]; negate?: boolean };

const OPS: ReadonlySet<string> = new Set(["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "is", "in", "cs", "cd"]);

/** `a.eq.1,b.is.null` → an OR group, as `.or()` means. */
export function parseOr(raw: string): Filter {
  return { kind: "or", items: splitTop(raw).map(parseCond) };
}

function parseCond(token: string): Filter {
  const group = token.match(/^(not\.)?(and|or)\(([\s\S]*)\)$/);
  if (group) {
    const [, not, kind, inside] = group;
    return { kind: kind as "and" | "or", items: splitTop(inside).map(parseCond), negate: !!not };
  }
  // col.[not.]op.value — the value may itself contain dots (timestamps, IPs).
  const m = token.match(/^([a-zA-Z_][\w.]*?)\.(not\.)?([a-z]+)\.([\s\S]*)$/);
  if (!m || !OPS.has(m[3])) throw new GrammarError(`filter tidak dikenal: "${token}"`);
  const [, col, not, op, rawValue] = m;
  return { kind: "cond", col, op: op as Op, value: parseValue(op as Op, rawValue), negate: !!not };
}

function unquote(v: string): string {
  return v.length >= 2 && v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1).replace(/\\"/g, '"') : v;
}

function parseValue(op: Op, v: string): unknown {
  if (op === "is") {
    const low = v.toLowerCase();
    if (low === "null") return null;
    if (low === "true") return true;
    if (low === "false") return false;
    if (low === "unknown") return "unknown";
    throw new GrammarError(`nilai is tidak valid: "${v}"`);
  }
  if (op === "in") {
    const inner = v.match(/^\(([\s\S]*)\)$/);
    if (!inner) throw new GrammarError(`nilai in harus berbentuk (a,b): "${v}"`);
    return splitTop(inner[1]).map(unquote);
  }
  if (op === "cs" || op === "cd") {
    const inner = v.match(/^\{([\s\S]*)\}$/);
    return inner ? splitTop(inner[1]).map(unquote) : unquote(v);
  }
  // PostgREST treats * as the LIKE wildcard in URLs; % is accepted too.
  if (op === "like" || op === "ilike") return unquote(v).replace(/\*/g, "%");
  return unquote(v);
}
