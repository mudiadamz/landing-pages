import { createBrowserClient } from "@supabase/ssr";

/**
 * The browser client.
 *
 * `.storage` no longer talks to Supabase: files live on the server's disk
 * (docs/plans/remove-supabase.md, fase 2), so uploads and deletes go to the
 * app's own routes, which run them as the signed-in user under the same rules
 * as server code. Only the three methods browser code uses exist. `.auth` is
 * still Supabase's until fase 3.
 */

type StorageError = { message: string; statusCode?: string };
type Result<T> = { data: T; error: null } | { data: null; error: StorageError };

const encodeName = (name: string) => name.split("/").map(encodeURIComponent).join("/");

function bucket(name: string) {
  return {
    async upload(
      path: string,
      file: Blob,
      opts: { contentType?: string; upsert?: boolean } = {},
    ): Promise<Result<{ path: string }>> {
      try {
        const res = await fetch(`/api/storage/object/${name}/${encodeName(path)}`, {
          method: "PUT",
          body: file,
          headers: {
            "content-type": opts.contentType || file.type || "application/octet-stream",
            "x-upsert": opts.upsert ? "true" : "false",
          },
        });
        const json = (await res.json().catch(() => ({}))) as { data?: { path: string }; error?: StorageError };
        if (!res.ok || json.error) return { data: null, error: json.error ?? { message: `HTTP ${res.status}` } };
        return { data: json.data ?? { path }, error: null };
      } catch (e) {
        return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
      }
    },

    async remove(paths: string[]): Promise<Result<unknown[]>> {
      try {
        const res = await fetch("/api/storage/remove", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ bucket: name, paths }),
        });
        const json = (await res.json().catch(() => ({}))) as { data?: unknown[]; error?: StorageError };
        if (!res.ok || json.error) return { data: null, error: json.error ?? { message: `HTTP ${res.status}` } };
        return { data: json.data ?? [], error: null };
      } catch (e) {
        return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
      }
    },

    getPublicUrl(path: string): { data: { publicUrl: string } } {
      const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
      return { data: { publicUrl: `${origin}/storage/v1/object/public/${name}/${encodeName(path)}` } };
    },
  };
}

export function createClient() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  return { auth: supabase.auth, storage: { from: bucket } };
}
