/**
 * Read every row of a query, not the first thousand.
 *
 * PostgREST enforces a server-side `max_rows` (1000 on this project) that
 * silently overrides whatever `.limit()` the client asked for. A query written
 * as `.limit(20000)` therefore returns 1000 rows and reports no error — which is
 * the worst possible failure for analytics, because every derived number keeps
 * computing happily against a truncated sample. The Analytics page sat at
 * exactly 1000 sessions while the table held 1074, and nothing said so.
 *
 * This pages with `.range()` until a short page arrives, so it works regardless
 * of what `max_rows` is set to, and reports honestly when it stops at the cap.
 *
 * Callers MUST order by something unique (or add a unique tiebreaker). Paging
 * over an unstable sort duplicates some rows and drops others.
 */

/** PostgREST's per-request ceiling. Pages are requested at this size. */
export const PAGE_SIZE = 1000;

export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  cap: number,
): Promise<{ rows: T[]; capped: boolean }> {
  const rows: T[] = [];

  while (rows.length < cap) {
    const from = rows.length;
    const to = Math.min(from + PAGE_SIZE, cap) - 1;
    const { data, error } = await page(from, to);

    if (error) {
      console.error("fetchAllRows page error:", error);
      // Partial data beats none, but say it was cut short.
      return { rows, capped: true };
    }
    if (!data || data.length === 0) break;

    rows.push(...data);
    // A short page means there is nothing after it.
    if (data.length < to - from + 1) break;
  }

  return { rows, capped: rows.length >= cap };
}
