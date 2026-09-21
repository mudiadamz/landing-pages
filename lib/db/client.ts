/**
 * The browser client.
 *
 * `.storage` no longer talks to Supabase: files live on the server's disk
 * (docs/plans/remove-supabase.md, fase 2), so uploads and deletes go to the
 * app's own routes, which run them as the signed-in user under the same rules
 * as server code. Only the three methods browser code uses exist.
 *
 * `.auth.getUser()` asks /api/auth/user (fase 3): the session cookie is
 * httpOnly, so the browser cannot read who it is by itself — which is the point.
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

type BrowserUser = { id: string; email: string | null };

async function getUser(): Promise<{ data: { user: BrowserUser | null }; error: null }> {
  try {
    const res = await fetch("/api/auth/user", { cache: "no-store" });
    const json = (await res.json().catch(() => ({}))) as { user?: BrowserUser | null };
    return { data: { user: res.ok ? (json.user ?? null) : null }, error: null };
  } catch {
    return { data: { user: null }, error: null };
  }
}

export function createClient() {
  return { auth: { getUser }, storage: { from: bucket } };
}
