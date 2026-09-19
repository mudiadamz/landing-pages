import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sql } from "./sql";

/**
 * Every column the code names must exist in the database.
 *
 * This repo has no generated `Database` type: every query is typed by hand, so
 * TypeScript has no idea what columns a table has. When a migration drops or
 * moves a column, nothing complains — the query fails at runtime, and most call
 * sites here do not read the error. That is how, after the account_type
 * remodel (300121e / 20260903010000):
 *
 *   - /panel/users answered 500 for everyone (`.order("role")`),
 *   - the customer list rendered every buyer nameless (a select of four
 *     columns from lp_site_members, which has none of them),
 *   - rejecting a publisher left the membership row pointing at KTP photos
 *     that had just been deleted (an update to columns that moved tables),
 *
 * and not one test noticed. This is the net the compiler would have been.
 *
 * It is a static scan, not a parser: it reads the literal strings and object
 * keys in each `.from("lp_…")` chain. Anything built at runtime (a spread
 * payload, `.or(filterString)`) is skipped rather than guessed at — and the
 * count assertion at the bottom keeps the scan from quietly finding nothing.
 */

type Ref = { table: string; column: string; where: string };

const SOURCES = [
  ...["app", "lib", "components"].flatMap((dir) =>
    (readdirSync(dir, { recursive: true }) as string[])
      .filter((f) => /\.tsx?$/.test(f))
      .map((f) => `${dir}/${f}`),
  ),
  "middleware.ts",
];

/** Top-level comma split that respects (), {}, [] and quotes. */
function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote = "";
  let cur = "";
  for (const ch of s) {
    if (quote) {
      cur += ch;
      if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    else if ("({[".includes(ch)) depth++;
    else if (")}]".includes(ch)) depth--;
    if (ch === "," && depth === 0) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}

/** The text between an opening bracket at `start` and its match. */
function balanced(s: string, start: number): string | null {
  const open = s[start];
  const close = open === "(" ? ")" : open === "{" ? "}" : "]";
  let depth = 0;
  let quote = "";
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    else if (ch === open) depth++;
    else if (ch === close && --depth === 0) return s.slice(start + 1, i);
  }
  return null;
}

/** Columns a PostgREST select string names on its own table. */
function selectColumns(select: string): string[] {
  return splitTop(select)
    .filter((t) => t !== "*" && !t.includes("(")) // embedded relations: other tables
    .map((t) => t.replace(/^[\w]+:/, "")) //         alias:column
    .map((t) => t.split("::")[0].split("->")[0].trim())
    .filter((t) => /^[a-z_][a-z0-9_]*$/.test(t));
}

/** Top-level keys of an object literal, or [] if it is not a plain literal. */
function objectKeys(body: string): string[] {
  return splitTop(body)
    .filter((t) => !t.startsWith("..."))
    .map((t) => (t.match(/^["']?([a-z_][a-z0-9_]*)["']?\s*(:|$)/) ?? [])[1])
    .filter((k): k is string => Boolean(k));
}

function lineOf(src: string, index: number): number {
  return src.slice(0, index).split("\n").length;
}

function scan(): Ref[] {
  const refs: Ref[] = [];
  for (const file of SOURCES) {
    let src: string;
    try {
      src = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    // Same-file string constants, so `.select(PROFILE_COLUMNS)` is checked too.
    const consts = new Map<string, string>();
    for (const m of src.matchAll(/const\s+([A-Z_][A-Z0-9_]*)\s*=\s*\n?\s*"([^"]*)"/g)) consts.set(m[1], m[2]);

    for (const m of src.matchAll(/\.from\(\s*"(lp_[a-z_]+)"\s*\)/g)) {
      const table = m[1];
      const at = m.index! + m[0].length;
      // The chain runs until the next .from( or the end of the statement.
      const rest = src.slice(at);
      const stop = Math.min(
        ...[rest.search(/\.from\(/), rest.search(/;\s*(\n|$)/)].filter((i) => i >= 0),
        rest.length,
      );
      const chain = rest.slice(0, stop);
      const where = `${file}:${lineOf(src, m.index!)}`;
      const add = (column: string) => refs.push({ table, column, where });

      // .select("…") / .select(CONST)
      for (const s of chain.matchAll(/\.select\(\s*(?:"([^"]*)"|`([^`$]*)`|([A-Z_][A-Z0-9_]*))/g)) {
        const text = s[1] ?? s[2] ?? consts.get(s[3] ?? "");
        if (text !== undefined) selectColumns(text).forEach(add);
      }
      // Filters and ordering whose first argument is a column of this table.
      for (const f of chain.matchAll(
        /\.(eq|neq|gt|gte|lt|lte|like|ilike|is|in|contains|containedBy|overlaps|order|not)\(\s*"([a-z_][a-z0-9_]*)"/g,
      )) {
        add(f[2]);
      }
      // onConflict: "a,b"
      for (const c of chain.matchAll(/onConflict:\s*"([^"]+)"/g)) c[1].split(",").forEach((x) => add(x.trim()));
      // .insert({…}) .update({…}) .upsert({…}) — literal objects only.
      for (const w of chain.matchAll(/\.(insert|update|upsert)\(\s*(\[?\s*\{)/g)) {
        const braceAt = w.index! + w[0].lastIndexOf("{");
        const body = balanced(chain, braceAt);
        if (body !== null) objectKeys(body).forEach(add);
      }
    }
  }
  return refs;
}

describe("kontrak skema: kolom yang disebut kode ada di database", () => {
  it("setiap kolom di setiap rantai .from('lp_…') ada di tabelnya", async () => {
    const { rows } = await sql<{ t: string; c: string }>(
      `select table_name as t, column_name as c from information_schema.columns
        where table_schema = 'public' and table_name like 'lp\\_%'`,
    );
    const columns = new Map<string, Set<string>>();
    for (const r of rows) {
      if (!columns.has(r.t)) columns.set(r.t, new Set());
      columns.get(r.t)!.add(r.c);
    }

    const refs = scan();
    const broken = refs
      .filter((r) => !columns.get(r.table)?.has(r.column))
      .map((r) => `${r.where}  ${r.table}.${r.column}${columns.has(r.table) ? "" : "  (TABEL TIDAK ADA)"}`);

    expect(broken, `Kolom yang tidak ada di database:\n${broken.join("\n")}`).toEqual([]);

    // Guard against the scan silently matching nothing — a regex that stops
    // matching would make this test pass forever while checking nothing.
    expect(refs.length).toBeGreaterThan(300);
    expect(new Set(refs.map((r) => r.table)).size).toBeGreaterThan(20);
  });
});
