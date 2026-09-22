/* Custom JS storage shape + (de)serialisation. Pure, so both the server action
 * and the client panel can import it.
 *
 * Stored in lp_site_settings.value under key "custom_js". Historically that value
 * was the raw script string; to add version history without a schema change we
 * now store a marker-guarded JSON object once there IS history. A legacy plain
 * string, or a script that merely happens to start with "{", still parses back
 * to { script, history: [] } — only an object carrying the marker is treated as
 * a record, which real JavaScript never is. */

export type CustomJsVersion = { script: string; at: string };
export type CustomJsRecord = { script: string; history: CustomJsVersion[] };

const MARKER = "__lpcjs";
export const MAX_CUSTOM_JS_HISTORY = 10;

export function parseCustomJs(value: string | null | undefined): CustomJsRecord {
  const raw = (value ?? "").trim();
  if (!raw) return { script: "", history: [] };
  if (raw.startsWith("{")) {
    try {
      const o = JSON.parse(raw) as Record<string, unknown>;
      if (o && typeof o === "object" && o[MARKER] === 1 && typeof o.script === "string") {
        const history: CustomJsVersion[] = Array.isArray(o.history)
          ? (o.history as unknown[])
              .filter((h): h is { script: unknown; at?: unknown } => !!h && typeof h === "object")
              .filter((h) => typeof h.script === "string")
              .map((h) => ({ script: String(h.script), at: String(h.at ?? "") }))
              .slice(0, MAX_CUSTOM_JS_HISTORY)
          : [];
        return { script: o.script, history };
      }
    } catch {
      /* not our JSON — a legacy plain script that starts with "{" */
    }
  }
  return { script: raw, history: [] };
}

export function serializeCustomJs(record: CustomJsRecord): string {
  // No history → keep the simple legacy shape (plain string), so nothing changes
  // for a site that has never edited twice.
  if (record.history.length === 0) return record.script.trim();
  return JSON.stringify({
    [MARKER]: 1,
    script: record.script.trim(),
    history: record.history.slice(0, MAX_CUSTOM_JS_HISTORY),
  });
}

/**
 * Fold a new script into a record, pushing the previous (non-empty, changed)
 * script onto the front of history. Consecutive duplicates are not recorded.
 */
export function withNewCustomJs(prev: CustomJsRecord, nextScript: string): CustomJsRecord {
  const next = nextScript.trim();
  let history = prev.history;
  if (prev.script && prev.script !== next && history[0]?.script !== prev.script) {
    history = [{ script: prev.script, at: new Date().toISOString() }, ...history].slice(
      0,
      MAX_CUSTOM_JS_HISTORY,
    );
  }
  return { script: next, history };
}
