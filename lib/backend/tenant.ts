import { cache } from "react";

/**
 * The current request's business context, threaded to the database layer.
 *
 * Multi-business isolation (docs/plans/multi-business-saas.md) needs every query
 * to run "as" a business, but the business is resolved high up (host → lp_sites →
 * business_id) while the queries run deep in lib/backend. Rather than pass it
 * through every call, it lives in a per-request holder: React's `cache()` returns
 * the SAME object for the whole request in the App Router, so the resolver writes
 * to it and withRls reads from it.
 *
 * Outside a request (scripts, the migrate runner) `cache()` has no store; the
 * try/catch degrades to "no business, not platform", which is correct — those
 * paths use the owner/service connection, not withRls.
 */
export type BusinessContext = { businessId: string | null; isPlatform: boolean };

const holder = cache((): BusinessContext => ({ businessId: null, isPlatform: false }));

export function setBusinessContext(patch: Partial<BusinessContext>): void {
  try {
    Object.assign(holder(), patch);
  } catch {
    /* not in a request — no-op */
  }
}

export function businessContext(): BusinessContext {
  try {
    return holder();
  } catch {
    return { businessId: null, isPlatform: false };
  }
}
