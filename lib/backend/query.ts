import type pg from "pg";
import { type Filter, GrammarError, type Op, parseOr, parseSelect, type SelectItem } from "./grammar";
import { withRls, type Who } from "./rls";
import { schema, type Schema } from "./schema";

/**
 * A query builder with the shape of supabase-js's, executed as plain SQL.
 *
 * The 77 files that query the database keep calling `.from(…).select(…).eq(…)`
 * exactly as before; this is what answers them now. It is deliberately NOT a
 * general PostgREST: only what the codebase uses (measured), and anything else
 * throws instead of guessing.
 *
 * Output is built the way PostgREST builds it — `json_agg` over the row set,
 * `json_populate_recordset` for writes — so numbers, bigints, timestamps,
 * arrays and jsonb come back byte-for-byte the same shape. The differential
 * test (tests/db/adapter-diff.test.ts) runs every query shape through both and
 * compares.
 */

export type DbError = { message: string; code: string; details: string | null; hint: string | null };

/**
 * Same shape as supabase-js's response: a success/failure union, so that
 * `if (error) return …` narrows `data` to non-null exactly as call sites expect.
 * Rows are `any` because this client, like the untyped supabase-js one it
 * replaces, has no generated schema types.
 */
export type DbResult<T = any> =
  | { data: T; error: null; count: number | null; status: number; statusText: string }
  | { data: null; error: DbError; count: number | null; status: number; statusText: string };

type Order = { col: string; ascending: boolean; nullsFirst?: boolean };
type Mode = "select" | "insert" | "update" | "upsert" | "delete";

const q = (name: string) => `"${name.replace(/"/g, '""')}"`;
const T = (table: string) => `public.${q(table)}`;

function toError(e: unknown): DbError {
  const err = e as { message?: string; code?: string; detail?: string; hint?: string };
  return {
    message: err.message ?? String(e),
    code: err.code ?? "UNKNOWN",
    details: err.detail ?? null,
    hint: err.hint ?? null,
  };
}

class Params {
  values: unknown[] = [];
  add(v: unknown): string {
    this.values.push(v);
    return `$${this.values.length}`;
  }
}

export class QueryBuilder<R = any[]> implements PromiseLike<DbResult<R>> {
  private mode: Mode = "select";
  private selectRaw: string | null = null;
  private returning = false;
  private countExact = false;
  private headOnly = false;
  private values: Record<string, unknown> | Record<string, unknown>[] | null = null;
  private onConflict: string | undefined;
  private ignoreDuplicates = false;
  private filters: Filter[] = [];
  private orders: Order[] = [];
  private limitN: number | null = null;
  private offsetN: number | null = null;
  private singleMode: "single" | "maybe" | null = null;
  private aliasSeq = 0;

  constructor(
    private readonly who: () => Promise<Who> | Who,
    private readonly table: string,
  ) {}

  // ---- verbs ---------------------------------------------------------------

  select(columns = "*", opts: { count?: "exact" | "planned" | "estimated"; head?: boolean } = {}): this {
    if (this.mode === "select") {
      this.selectRaw = columns;
      this.countExact = !!opts.count;
      this.headOnly = !!opts.head;
    } else {
      // insert/update/upsert/delete followed by .select(): return the rows.
      this.returning = true;
      this.selectRaw = columns;
    }
    return this;
  }

  insert(values: Record<string, unknown> | Record<string, unknown>[]): this {
    this.mode = "insert";
    this.values = values;
    return this;
  }

  upsert(
    values: Record<string, unknown> | Record<string, unknown>[],
    opts: { onConflict?: string; ignoreDuplicates?: boolean } = {},
  ): this {
    this.mode = "upsert";
    this.values = values;
    this.onConflict = opts.onConflict;
    this.ignoreDuplicates = !!opts.ignoreDuplicates;
    return this;
  }

  update(values: Record<string, unknown>): this {
    this.mode = "update";
    this.values = values;
    return this;
  }

  delete(): this {
    this.mode = "delete";
    return this;
  }

  // ---- filters -------------------------------------------------------------

  private cond(col: string, op: Op, value: unknown, negate = false): this {
    this.filters.push({ kind: "cond", col, op, value, negate });
    return this;
  }
  eq(col: string, v: unknown) { return this.cond(col, "eq", v); }
  neq(col: string, v: unknown) { return this.cond(col, "neq", v); }
  gt(col: string, v: unknown) { return this.cond(col, "gt", v); }
  gte(col: string, v: unknown) { return this.cond(col, "gte", v); }
  lt(col: string, v: unknown) { return this.cond(col, "lt", v); }
  lte(col: string, v: unknown) { return this.cond(col, "lte", v); }
  like(col: string, v: string) { return this.cond(col, "like", v.replace(/\*/g, "%")); }
  ilike(col: string, v: string) { return this.cond(col, "ilike", v.replace(/\*/g, "%")); }
  is(col: string, v: null | boolean) { return this.cond(col, "is", v); }
  in(col: string, v: readonly unknown[]) { return this.cond(col, "in", [...v]); }
  contains(col: string, v: unknown) { return this.cond(col, "cs", v); }
  containedBy(col: string, v: unknown) { return this.cond(col, "cd", v); }

  not(col: string, op: string, v: unknown): this {
    if (op === "in" && typeof v === "string") {
      return this.cond(col, "in", v.replace(/^\(|\)$/g, "").split(",").map((x) => x.trim()), true);
    }
    return this.cond(col, op as Op, v, true);
  }

  or(expr: string): this {
    this.filters.push(parseOr(expr));
    return this;
  }

  match(obj: Record<string, unknown>): this {
    for (const [k, v] of Object.entries(obj)) this.eq(k, v);
    return this;
  }

  // ---- shaping -------------------------------------------------------------

  order(col: string, opts: { ascending?: boolean; nullsFirst?: boolean } = {}): this {
    this.orders.push({ col, ascending: opts.ascending ?? true, nullsFirst: opts.nullsFirst });
    return this;
  }

  limit(n: number): this {
    this.limitN = n;
    return this;
  }

  range(from: number, to: number): this {
    this.offsetN = from;
    this.limitN = to - from + 1;
    return this;
  }

  /** One row: `data` becomes that row instead of an array. */
  single(): QueryBuilder<any> {
    this.singleMode = "single";
    return this as unknown as QueryBuilder<any>;
  }

  /** At most one row: `data` becomes that row, or null. */
  maybeSingle(): QueryBuilder<any> {
    this.singleMode = "maybe";
    return this as unknown as QueryBuilder<any>;
  }

  // ---- execution -----------------------------------------------------------

  then<A = DbResult<R>, B = never>(
    onfulfilled?: ((value: DbResult<R>) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return (this.execute() as Promise<DbResult<R>>).then(onfulfilled, onrejected);
  }

  async execute(): Promise<DbResult> {
    try {
      const s = await schema();
      const who = await this.who();
      return await withRls(who, (client) => this.run(client, s));
    } catch (e) {
      return { data: null, error: toError(e), count: null, status: e instanceof GrammarError ? 400 : 500, statusText: "" };
    }
  }

  private async run(client: pg.PoolClient, s: Schema): Promise<DbResult> {
    const p = new Params();
    if (this.mode === "select") {
      const where = this.where(s, p, "_p", this.table, true);
      let count: number | null = null;
      if (this.countExact) {
        const cp = new Params();
        const cw = this.where(s, cp, "_p", this.table, true);
        const r = await client.query<{ n: string }>(
          `select count(*)::text as n from ${T(this.table)} as _p${cw}`,
          cp.values,
        );
        count = Number(r.rows[0].n);
      }
      if (this.headOnly) return { data: null, error: null, count, status: 200, statusText: "OK" };

      const list = this.selectList(s, p, "_p", this.table, parseSelect(this.selectRaw ?? "*"));
      const order = this.orderSql("_p");
      const lim = this.limitN !== null ? ` limit ${Math.max(0, Math.floor(this.limitN))}` : "";
      const off = this.offsetN !== null ? ` offset ${Math.max(0, Math.floor(this.offsetN))}` : "";
      const sql =
        `select coalesce(json_agg(_r), '[]'::json) as data from ` +
        `(select ${list} from ${T(this.table)} as _p${where}${order}${lim}${off}) _r`;
      const r = await client.query<{ data: unknown[] }>(sql, p.values);
      return this.finish(r.rows[0].data, count, 200);
    }

    // supabase-js sends JSON.stringify(values), which DROPS keys whose value is
    // undefined — so the column is not written and its default (or current
    // value, for update) stands. Writing them as NULL instead would silently
    // blank columns: `update({ published: undefined })` must be a no-op.
    const defined = (r: Record<string, unknown>) =>
      Object.fromEntries(Object.entries(r).filter(([, v]) => v !== undefined));
    const rows =
      this.mode === "update" ? null : (Array.isArray(this.values) ? this.values : [this.values ?? {}]).map(defined);
    const retItems = this.returning ? parseSelect(this.selectRaw ?? "*") : null;
    if (retItems && retItems.some((i) => i.kind === "embed" || i.kind === "count")) {
      throw new GrammarError("select dengan relasi setelah insert/update/delete tidak didukung");
    }
    const returning = retItems ? ` returning ${this.returningList(retItems)}` : "";
    let sql: string;

    if (this.mode === "insert" || this.mode === "upsert") {
      if (rows!.length === 0) return this.finish(this.returning ? [] : null, null, 201);
      const cols = [...new Set(rows!.flatMap((r) => Object.keys(r)))];
      cols.forEach((c) => q(c));
      const colList = cols.map(q).join(", ");
      let conflict = "";
      if (this.mode === "upsert") {
        const target = this.onConflict ? this.onConflict.split(",").map((c) => c.trim()) : s.pks.get(this.table) ?? [];
        if (target.length === 0) throw new GrammarError(`upsert ke ${this.table} butuh onConflict`);
        const updatable = cols.filter((c) => !target.includes(c));
        conflict =
          ` on conflict (${target.map(q).join(", ")}) ` +
          (this.ignoreDuplicates || updatable.length === 0
            ? "do nothing"
            : `do update set ${updatable.map((c) => `${q(c)} = excluded.${q(c)}`).join(", ")}`);
      }
      const json = p.add(JSON.stringify(rows));
      sql =
        `insert into ${T(this.table)} (${colList}) ` +
        `select ${colList} from json_populate_recordset(null::${T(this.table)}, ${json}::json)${conflict}${returning}`;
    } else if (this.mode === "update") {
      const values = Object.fromEntries(
        Object.entries((this.values ?? {}) as Record<string, unknown>).filter(([, v]) => v !== undefined),
      );
      const cols = Object.keys(values);
      if (cols.length === 0) throw new GrammarError("update tanpa kolom");
      const colList = cols.map(q).join(", ");
      const json = p.add(JSON.stringify(values));
      const where = this.where(s, p, "_p", this.table, false);
      sql =
        `update ${T(this.table)} as _p set (${colList}) = ` +
        `(select ${colList} from json_populate_record(null::${T(this.table)}, ${json}::json))${where}${returning}`;
    } else {
      const where = this.where(s, p, "_p", this.table, false);
      sql = `delete from ${T(this.table)} as _p${where}${returning}`;
    }

    if (!this.returning) {
      await client.query(sql, p.values);
      return this.finish(null, null, this.mode === "insert" ? 201 : 204);
    }
    const r = await client.query<{ data: unknown[] }>(
      `with _w as (${sql}) select coalesce(json_agg(_w), '[]'::json) as data from _w`,
      p.values,
    );
    return this.finish(r.rows[0].data, null, this.mode === "insert" ? 201 : 200);
  }

  private finish(data: unknown[] | null, count: number | null, status: number): DbResult {
    if (this.singleMode && Array.isArray(data)) {
      if (data.length === 1) return { data: data[0], error: null, count, status, statusText: "OK" };
      if (data.length === 0 && this.singleMode === "maybe") return { data: null, error: null, count, status, statusText: "OK" };
      return {
        data: null,
        error: {
          code: "PGRST116",
          message: "JSON object requested, multiple (or no) rows returned",
          details: `The result contains ${data.length} rows`,
          hint: null,
        },
        count,
        status: 406,
        statusText: "Not Acceptable",
      };
    }
    return { data, error: null, count, status, statusText: "OK" };
  }

  // ---- SQL pieces ----------------------------------------------------------

  private returningList(items: SelectItem[]): string {
    return items
      .map((i) => {
        if (i.kind === "star") return "*";
        if (i.kind !== "col") throw new GrammarError("returning hanya kolom");
        return this.colExpr("", i) + ` as ${q(i.alias ?? i.name)}`;
      })
      .join(", ");
  }

  private colExpr(alias: string, i: Extract<SelectItem, { kind: "col" }>): string {
    let e = alias ? `${alias}.${q(i.name)}` : q(i.name);
    for (const step of i.path ?? []) {
      const arrow = step.startsWith("->>") ? "->>" : "->";
      e = `${e}${arrow}'${step.slice(arrow.length)}'`;
    }
    if (i.cast) e = `(${e})::${i.cast.replace(/[^a-zA-Z_ 0-9]/g, "")}`;
    return e;
  }

  private selectList(s: Schema, p: Params, alias: string, table: string, items: SelectItem[]): string {
    return items
      .map((i) => {
        if (i.kind === "star") return `${alias}.*`;
        if (i.kind === "col") return `${this.colExpr(alias, i)} as ${q(i.alias ?? i.name)}`;
        if (i.kind === "count") return `count(*) as ${q(i.alias ?? "count")}`;
        return `${this.embedExpr(s, p, alias, table, i)} as ${q(i.alias ?? i.rel)}`;
      })
      .join(", ");
  }

  /** The join condition between a parent row and an embedded resource. */
  private relation(s: Schema, parent: string, e: Extract<SelectItem, { kind: "embed" }>) {
    const toMany = s.fks.filter((f) => f.from === e.rel && f.to === parent); // child points at parent
    const toOne = s.fks.filter((f) => f.from === parent && f.to === e.rel); // parent points at child
    const byHint = (f: { name: string; fromCols: string[] }) =>
      !e.hint || f.name === e.hint || (f.fromCols.length === 1 && f.fromCols[0] === e.hint);
    const one = toOne.filter(byHint);
    const many = toMany.filter(byHint);
    const found = [...one.map((f) => ({ f, many: false })), ...many.map((f) => ({ f, many: true }))];
    if (found.length === 0) throw new GrammarError(`tidak ada relasi antara ${parent} dan ${e.rel}`);
    if (found.length > 1) throw new GrammarError(`relasi ${parent} → ${e.rel} ambigu; pakai !nama_constraint`);
    return found[0];
  }

  private embedExpr(
    s: Schema,
    p: Params,
    parentAlias: string,
    parent: string,
    e: Extract<SelectItem, { kind: "embed" }>,
  ): string {
    const { f, many } = this.relation(s, parent, e);
    const ca = `_e${++this.aliasSeq}`;
    const join = f.fromCols
      .map((fc, idx) =>
        many
          ? `${ca}.${q(fc)} = ${parentAlias}.${q(f.toCols[idx])}`
          : `${ca}.${q(f.toCols[idx])} = ${parentAlias}.${q(fc)}`,
      )
      .join(" and ");
    const nested = this.embedFilters(s, p, ca, e.rel, e.alias ?? e.rel);
    const cond = [join, nested].filter(Boolean).join(" and ");

    const onlyCount = e.items.length === 1 && e.items[0].kind === "count";
    if (onlyCount) {
      const key = ((e.items[0] as { alias?: string }).alias ?? "count").replace(/'/g, "''");
      return `(select json_build_array(json_build_object('${key}', count(*))) from ${T(e.rel)} as ${ca} where ${cond})`;
    }
    const list = this.selectList(s, p, ca, e.rel, e.items);
    if (many) {
      return `coalesce((select json_agg(_x) from (select ${list} from ${T(e.rel)} as ${ca} where ${cond}) _x), '[]'::json)`;
    }
    return `(select row_to_json(_x) from (select ${list} from ${T(e.rel)} as ${ca} where ${cond} limit 1) _x)`;
  }

  /** Filters addressed to an embedded resource (`rel.col`), applied inside it. */
  private embedFilters(s: Schema, p: Params, alias: string, table: string, name: string): string {
    const mine = this.filters.filter((f) => f.kind === "cond" && f.col.startsWith(`${name}.`));
    return mine
      .map((f) => {
        const c = f as Extract<Filter, { kind: "cond" }>;
        return this.condSql(s, p, alias, table, { ...c, col: c.col.slice(name.length + 1) });
      })
      .join(" and ");
  }

  private where(s: Schema, p: Params, alias: string, table: string, withInner: boolean): string {
    const parts: string[] = [];
    for (const f of this.filters) {
      if (f.kind === "cond" && f.col.includes(".")) continue; // belongs to an embed
      parts.push(this.filterSql(s, p, alias, table, f));
    }
    if (withInner && this.selectRaw) {
      for (const item of parseSelect(this.selectRaw)) {
        if (item.kind !== "embed" || !item.inner) continue;
        const { f, many } = this.relation(s, table, item);
        const ca = `_i${++this.aliasSeq}`;
        const join = f.fromCols
          .map((fc, idx) =>
            many ? `${ca}.${q(fc)} = ${alias}.${q(f.toCols[idx])}` : `${ca}.${q(f.toCols[idx])} = ${alias}.${q(fc)}`,
          )
          .join(" and ");
        const nested = this.embedFilters(s, p, ca, item.rel, item.alias ?? item.rel);
        parts.push(`exists (select 1 from ${T(item.rel)} as ${ca} where ${[join, nested].filter(Boolean).join(" and ")})`);
      }
    }
    return parts.length ? ` where ${parts.join(" and ")}` : "";
  }

  private filterSql(s: Schema, p: Params, alias: string, table: string, f: Filter): string {
    if (f.kind === "cond") return this.condSql(s, p, alias, table, f);
    const joined = f.items.map((x) => this.filterSql(s, p, alias, table, x)).join(f.kind === "or" ? " or " : " and ");
    const group = `(${joined || (f.kind === "or" ? "false" : "true")})`;
    return f.negate ? `not ${group}` : group;
  }

  private condSql(s: Schema, p: Params, alias: string, table: string, f: Extract<Filter, { kind: "cond" }>): string {
    const col = `${alias}.${q(f.col)}`;
    const isJson = s.jsonCols.get(table)?.has(f.col) ?? false;
    const val = (v: unknown) => p.add(isJson && typeof v !== "string" ? JSON.stringify(v) : v);
    let sql: string;
    switch (f.op) {
      case "eq": sql = `${col} = ${val(f.value)}`; break;
      case "neq": sql = `${col} <> ${val(f.value)}`; break;
      case "gt": sql = `${col} > ${val(f.value)}`; break;
      case "gte": sql = `${col} >= ${val(f.value)}`; break;
      case "lt": sql = `${col} < ${val(f.value)}`; break;
      case "lte": sql = `${col} <= ${val(f.value)}`; break;
      case "like": sql = `${col} like ${val(f.value)}`; break;
      case "ilike": sql = `${col} ilike ${val(f.value)}`; break;
      case "is": {
        const v = f.value;
        const lit = v === null ? "null" : v === true ? "true" : v === false ? "false" : "unknown";
        sql = `${col} is ${lit}`;
        break;
      }
      case "in": sql = `${col} = any(${p.add(f.value)})`; break;
      case "cs": sql = `${col} @> ${val(f.value)}`; break;
      case "cd": sql = `${col} <@ ${val(f.value)}`; break;
    }
    return f.negate ? `not (${sql})` : sql;
  }

  private orderSql(alias: string): string {
    if (this.orders.length === 0) return "";
    return (
      " order by " +
      this.orders
        .map(
          (o) =>
            `${alias}.${q(o.col)} ${o.ascending ? "asc" : "desc"}` +
            (o.nullsFirst === undefined ? "" : o.nullsFirst ? " nulls first" : " nulls last"),
        )
        .join(", ")
    );
  }
}

/** `supabase.rpc(fn, args)` — a function call with named arguments. */
export async function callRpc(who: () => Promise<Who> | Who, fn: string, args: Record<string, unknown> = {}): Promise<DbResult> {
  try {
    const s = await schema();
    const w = await who();
    return await withRls(w, async (client) => {
      const p = new Params();
      const named = Object.entries(args)
        .map(([k, v]) => `${q(k)} => ${p.add(v !== null && typeof v === "object" && !Array.isArray(v) ? JSON.stringify(v) : v)}`)
        .join(", ");
      if (s.voidFns.has(fn)) {
        await client.query(`select public.${q(fn)}(${named})`, p.values);
        return { data: null, error: null, count: null, status: 204, statusText: "No Content" };
      }
      const r = await client.query<{ r: unknown }>(`select to_json(public.${q(fn)}(${named})) as r`, p.values);
      return { data: r.rows[0]?.r ?? null, error: null, count: null, status: 200, statusText: "OK" };
    });
  } catch (e) {
    return { data: null, error: toError(e), count: null, status: 500, statusText: "" };
  }
}
