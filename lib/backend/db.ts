import { callRpc, type DbResult, QueryBuilder } from "./query";
import type { Who } from "./rls";

/**
 * The database half of what `createClient()` returns: `.from()` and `.rpc()`.
 *
 * `who` is resolved lazily, at the moment a query runs, so a client created at
 * the top of a server action does not pay for an identity lookup it may never
 * use — and so a signed-in user is looked up once and reused (callers memoise).
 */
export type DbClient = {
  from(table: string): QueryBuilder<any[]>;
  rpc(fn: string, args?: Record<string, unknown>): Promise<DbResult>;
};

export function dbClient(who: () => Promise<Who> | Who): DbClient {
  return {
    from: (table: string) => new QueryBuilder<any[]>(who, table),
    rpc: (fn: string, args?: Record<string, unknown>) => callRpc(who, fn, args),
  };
}

export type { DbResult, DbError } from "./query";
export type { Who } from "./rls";
