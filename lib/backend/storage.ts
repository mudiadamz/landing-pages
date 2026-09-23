import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { createReadStream } from "node:fs";
import { link, mkdir, readdir, rename, rm, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { withRls, type Who } from "./rls";

/**
 * File storage on the server's own disk, with supabase-js's storage API shape.
 *
 * Replaces Supabase Storage (docs/plans/remove-supabase.md, fase 2). The call
 * sites keep `storage.from(bucket).upload/download/remove/list/
 * createSignedUrl/getPublicUrl`; this answers them from STORAGE_ROOT.
 *
 * What moved here from the database: the storage.objects policies. Supabase
 * enforced them in Postgres; a file on disk has no RLS, so `allowed()` below is
 * those policies written out — including the seller-only uploads of
 * 20260919070000 — and tests/db/storage-own.test.ts holds every assertion the
 * old storage tests held.
 */

export type BucketConfig = { public: boolean; fileSizeLimit: number; allowedMimeTypes: string[] | null };

/** Was storage.buckets. tests/db/storage-own.test.ts compares it to the live table while that still exists. */
export const BUCKETS: Record<string, BucketConfig> = {
  "landing-assets": { public: true, fileSizeLimit: 52428800, allowedMimeTypes: null },
  "landing-downloads": {
    public: false,
    fileSizeLimit: 52428800,
    allowedMimeTypes: ["application/zip", "application/x-zip-compressed", "application/pdf", "application/epub+zip"],
  },
  "chat-attachments": {
    public: false,
    fileSizeLimit: 8388608,
    allowedMimeTypes: [
      "image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf", "text/plain", "text/markdown",
      "text/csv", "text/html", "text/xml", "text/css", "text/javascript", "text/x-python", "application/json",
      "application/xml", "application/javascript", "application/octet-stream",
    ],
  },
  "hiring-cv": { public: false, fileSizeLimit: 5242880, allowedMimeTypes: ["application/pdf"] },
};

export type StorageError = { name: "StorageApiError"; message: string; statusCode: string; error: string };

const fail = (statusCode: number, error: string, message: string): StorageError => ({
  name: "StorageApiError",
  message,
  statusCode: String(statusCode),
  error,
});

const DENIED = () => fail(403, "Unauthorized", "new row violates row-level security policy");
const NOT_FOUND = () => fail(404, "not_found", "Object not found");

// ---------------------------------------------------------------------------
// Where files live
// ---------------------------------------------------------------------------

export function storageRoot(): string {
  return path.resolve(process.env.STORAGE_ROOT || path.join(process.cwd(), ".storage"));
}

/**
 * Validate an object name and resolve it inside its bucket. Anything that
 * could climb out of the bucket directory — `..`, absolute paths, backslashes,
 * NUL — is refused outright rather than normalised, so no name means two things.
 */
export function objectPath(bucket: string, name: string): string {
  if (!BUCKETS[bucket]) throw fail(404, "not_found", "Bucket not found");
  const segments = name.split("/");
  if (
    !name ||
    name.startsWith("/") ||
    name.includes("\\") ||
    name.includes("\0") ||
    segments.some((s) => s === "" || s === "." || s === "..")
  ) {
    throw fail(400, "InvalidKey", `Invalid key: ${name}`);
  }
  const base = path.join(storageRoot(), bucket);
  const full = path.join(base, ...segments);
  if (!full.startsWith(base + path.sep)) throw fail(400, "InvalidKey", `Invalid key: ${name}`);
  return full;
}

const MIME: Record<string, string> = {
  html: "text/html; charset=utf-8", htm: "text/html; charset=utf-8", css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8", mjs: "text/javascript; charset=utf-8", json: "application/json",
  xml: "application/xml", txt: "text/plain; charset=utf-8", md: "text/markdown; charset=utf-8",
  csv: "text/csv; charset=utf-8", py: "text/x-python; charset=utf-8", svg: "image/svg+xml",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp",
  avif: "image/avif", ico: "image/x-icon", pdf: "application/pdf", epub: "application/epub+zip",
  zip: "application/zip", mp4: "video/mp4", webm: "video/webm", mp3: "audio/mpeg", woff: "font/woff",
  woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf",
};

export function mimeOf(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return MIME[ext] ?? "application/octet-stream";
}

// ---------------------------------------------------------------------------
// Who may do what — the storage.objects policies, written out
// ---------------------------------------------------------------------------

type Action = "read" | "insert" | "update" | "delete" | "list";

async function canSell(who: Who): Promise<boolean> {
  return withRls(who, async (c) => (await c.query<{ ok: boolean }>("select public.lp_can_sell() as ok")).rows[0].ok);
}

export async function allowed(who: Who, action: Action, bucket: string, name: string): Promise<boolean> {
  if (who === "service_role") return true;
  const owner = typeof who === "object" && name.split("/")[0] === who.uid;

  switch (bucket) {
    case "landing-assets":
      if (action === "read" || action === "list") return true; // "Public can view assets"
      if (!owner) return false;
      if (action === "delete") return true;
      return canSell(who); // insert/update: sellers only (20260919070000)
    case "landing-downloads":
      // No read policy at all — not even for the owner. The only way out is a
      // signed URL minted by the server after a purchase check.
      if (!owner) return false;
      if (action === "insert") return canSell(who);
      return action === "delete";
    case "chat-attachments":
      return owner && action !== "update";
    default:
      // hiring-cv: service role only.
      return false;
  }
}

// ---------------------------------------------------------------------------
// Signed URLs
// ---------------------------------------------------------------------------

function signingSecret(): string {
  const s = process.env.STORAGE_SIGNING_SECRET;
  if (!s || s.length < 32) throw new Error("STORAGE_SIGNING_SECRET belum diset (minimal 32 karakter).");
  return s;
}

function signature(bucket: string, name: string, exp: number): string {
  return createHmac("sha256", signingSecret()).update(`${bucket}/${name}:${exp}`).digest("base64url");
}

/** `exp.signature` — both halves are needed, and the signature covers the path. */
export function signToken(bucket: string, name: string, expiresInSeconds: number): string {
  const exp = Math.floor(Date.now() / 1000) + Math.max(1, Math.floor(expiresInSeconds));
  return `${exp}.${signature(bucket, name, exp)}`;
}

export function verifyToken(bucket: string, name: string, token: string | null): boolean {
  if (!token) return false;
  const dot = token.indexOf(".");
  const exp = Number(token.slice(0, dot));
  if (dot < 1 || !Number.isInteger(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const given = Buffer.from(token.slice(dot + 1));
  const want = Buffer.from(signature(bucket, name, exp));
  return given.length === want.length && timingSafeEqual(given, want);
}

function origin(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
}

const encodeName = (name: string) => name.split("/").map(encodeURIComponent).join("/");

export function publicUrl(bucket: string, name: string): string {
  return `${origin()}/storage/v1/object/public/${bucket}/${encodeName(name)}`;
}

// ---------------------------------------------------------------------------
// Bytes in
// ---------------------------------------------------------------------------

type Body = Blob | ArrayBuffer | ArrayBufferView | string;

async function toBuffer(body: Body): Promise<Buffer> {
  if (typeof body === "string") return Buffer.from(body);
  if (body instanceof ArrayBuffer) return Buffer.from(body);
  if (ArrayBuffer.isView(body)) return Buffer.from(body.buffer, body.byteOffset, body.byteLength);
  return Buffer.from(await (body as Blob).arrayBuffer());
}

function contentTypeOf(body: Body, declared?: string): string {
  if (declared) return declared;
  if (typeof body === "object" && "type" in body && (body as Blob).type) return (body as Blob).type;
  return "application/octet-stream";
}

/**
 * Write atomically: a temp file outside the bucket, then link (no overwrite)
 * or rename (upsert) into place. A reader never sees half a file, and two
 * concurrent non-upsert writes to one name cannot both "win".
 */
async function place(full: string, bytes: Buffer, upsert: boolean): Promise<void> {
  const tmpDir = path.join(storageRoot(), ".tmp");
  await mkdir(tmpDir, { recursive: true });
  await mkdir(path.dirname(full), { recursive: true });
  const tmp = path.join(tmpDir, randomUUID());
  await writeFile(tmp, bytes);
  try {
    if (upsert) {
      await rename(tmp, full);
    } else {
      await link(tmp, full);
      await unlink(tmp);
    }
  } catch (e) {
    await unlink(tmp).catch(() => undefined);
    if ((e as NodeJS.ErrnoException).code === "EEXIST") throw fail(409, "Duplicate", "The resource already exists");
    throw e;
  }
}

// ---------------------------------------------------------------------------
// The client
// ---------------------------------------------------------------------------

type Result<T> = { data: T; error: null } | { data: null; error: StorageError };
const ok = <T>(data: T): Result<T> => ({ data, error: null });
const err = <T>(e: unknown): Result<T> => {
  if (e && typeof e === "object" && (e as StorageError).name === "StorageApiError") return { data: null, error: e as StorageError };
  return { data: null, error: fail(500, "internal", e instanceof Error ? e.message : String(e)) };
};

export type FileObject = {
  name: string;
  id: string | null;
  created_at: string | null;
  updated_at: string | null;
  last_accessed_at: string | null;
  metadata: { size: number; mimetype: string; lastModified: string; contentLength: number } | null;
};

export type ListOptions = {
  limit?: number;
  offset?: number;
  sortBy?: { column?: string; order?: string };
  search?: string;
};

class BucketApi {
  constructor(
    private readonly who: () => Promise<Who> | Who,
    private readonly bucket: string,
  ) {}

  async upload(
    name: string,
    body: Body,
    opts: { contentType?: string; upsert?: boolean; cacheControl?: string } = {},
  ): Promise<Result<{ path: string; id: string; fullPath: string }>> {
    try {
      const config = BUCKETS[this.bucket];
      const full = objectPath(this.bucket, name);
      const who = await this.who();
      const upsert = !!opts.upsert;
      if (!(await allowed(who, "insert", this.bucket, name))) throw DENIED();
      if (upsert && !(await allowed(who, "update", this.bucket, name))) throw DENIED();

      const type = contentTypeOf(body, opts.contentType).split(";")[0].trim();
      if (config.allowedMimeTypes && !config.allowedMimeTypes.includes(type)) {
        throw fail(415, "invalid_mime_type", `mime type ${type} is not supported`);
      }
      const bytes = await toBuffer(body);
      if (bytes.length > config.fileSizeLimit) {
        throw fail(413, "Payload too large", "The object exceeded the maximum allowed size");
      }
      await place(full, bytes, upsert);
      return ok({ path: name, id: createHash("sha1").update(`${this.bucket}/${name}`).digest("hex"), fullPath: `${this.bucket}/${name}` });
    } catch (e) {
      return err(e);
    }
  }

  async download(name: string): Promise<Result<Blob>> {
    try {
      const full = objectPath(this.bucket, name);
      if (!(await allowed(await this.who(), "read", this.bucket, name))) throw NOT_FOUND();
      const { readFile } = await import("node:fs/promises");
      const bytes = await readFile(full).catch(() => {
        throw NOT_FOUND();
      });
      return ok(new Blob([new Uint8Array(bytes)], { type: mimeOf(name) }));
    } catch (e) {
      return err(e);
    }
  }

  /** Removes what the caller may remove; the rest is silently skipped, as an RLS-filtered DELETE was. */
  async remove(names: string[]): Promise<Result<FileObject[]>> {
    try {
      const who = await this.who();
      const removed: FileObject[] = [];
      for (const name of names) {
        const full = objectPath(this.bucket, name);
        if (!(await allowed(who, "delete", this.bucket, name))) continue;
        const info = await stat(full).catch(() => null);
        if (!info?.isFile()) continue;
        await rm(full);
        removed.push(fileObject(this.bucket, name, info));
      }
      return ok(removed);
    } catch (e) {
      return err(e);
    }
  }

  async list(prefix = "", opts: ListOptions = {}): Promise<Result<FileObject[]>> {
    try {
      const dirName = prefix.replace(/\/+$/, "");
      if (!(await allowed(await this.who(), "list", this.bucket, dirName ? `${dirName}/x` : "x"))) return ok([]);
      const dir = dirName ? objectPath(this.bucket, dirName) : path.join(storageRoot(), this.bucket);
      const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
      const search = (opts.search ?? "").toLowerCase();
      const items: FileObject[] = [];
      for (const ent of entries) {
        if (search && !ent.name.toLowerCase().startsWith(search)) continue;
        if (ent.isDirectory()) {
          items.push({ name: ent.name, id: null, created_at: null, updated_at: null, last_accessed_at: null, metadata: null });
        } else if (ent.isFile()) {
          const rel = dirName ? `${dirName}/${ent.name}` : ent.name;
          items.push(fileObject(this.bucket, rel, await stat(path.join(dir, ent.name)), ent.name));
        }
      }
      const col = opts.sortBy?.column ?? "name";
      const desc = (opts.sortBy?.order ?? "asc").toLowerCase() === "desc";
      items.sort((a, b) => {
        const av = (col === "name" ? a.name : (a as Record<string, unknown>)[col] as string) ?? "";
        const bv = (col === "name" ? b.name : (b as Record<string, unknown>)[col] as string) ?? "";
        return (av < bv ? -1 : av > bv ? 1 : 0) * (desc ? -1 : 1);
      });
      const offset = opts.offset ?? 0;
      return ok(items.slice(offset, offset + (opts.limit ?? 100)));
    } catch (e) {
      return err(e);
    }
  }

  /**
   * `download`: serve as an attachment instead of inline — `true` for the
   * object's own name, or a filename. Like Supabase's, it is a plain query
   * parameter outside the signature: it can only change how the one signed
   * object is presented, and the route sanitises it before it reaches a header.
   */
  async createSignedUrl(
    name: string,
    expiresIn: number,
    opts: { download?: string | boolean } = {},
  ): Promise<Result<{ signedUrl: string }>> {
    try {
      const full = objectPath(this.bucket, name);
      if (!(await allowed(await this.who(), "read", this.bucket, name))) throw NOT_FOUND();
      if (!(await stat(full).catch(() => null))?.isFile()) throw NOT_FOUND();
      const token = signToken(this.bucket, name, expiresIn);
      const download =
        opts.download === true
          ? `&download=${encodeURIComponent(name.split("/").pop()!)}`
          : typeof opts.download === "string" && opts.download
            ? `&download=${encodeURIComponent(opts.download)}`
            : "";
      return ok({
        signedUrl: `${origin()}/storage/v1/object/sign/${this.bucket}/${encodeName(name)}?token=${encodeURIComponent(token)}${download}`,
      });
    } catch (e) {
      return err(e);
    }
  }

  getPublicUrl(name: string): { data: { publicUrl: string } } {
    return { data: { publicUrl: publicUrl(this.bucket, name) } };
  }
}

function fileObject(bucket: string, name: string, info: { size: number; mtime: Date; birthtime: Date }, leaf?: string): FileObject {
  const mimetype = mimeOf(name).split(";")[0];
  return {
    name: leaf ?? name.split("/").pop()!,
    id: createHash("sha1").update(`${bucket}/${name}`).digest("hex"),
    created_at: info.birthtime.toISOString(),
    updated_at: info.mtime.toISOString(),
    last_accessed_at: info.mtime.toISOString(),
    metadata: { size: info.size, mimetype, lastModified: info.mtime.toISOString(), contentLength: info.size },
  };
}

export type StorageClient = {
  from(bucket: string): BucketApi;
  listBuckets(): Promise<Result<{ id: string; name: string; public: boolean; file_size_limit: number; allowed_mime_types: string[] | null }[]>>;
};

export function storageClient(who: () => Promise<Who> | Who): StorageClient {
  return {
    from: (bucket: string) => new BucketApi(who, bucket),
    async listBuckets() {
      if ((await who()) !== "service_role") return ok([]);
      return ok(
        Object.entries(BUCKETS).map(([id, b]) => ({
          id,
          name: id,
          public: b.public,
          file_size_limit: b.fileSizeLimit,
          allowed_mime_types: b.allowedMimeTypes,
        })),
      );
    },
  };
}

// ---------------------------------------------------------------------------
// Serving (used by the /storage/v1/object/{public,sign}/… routes)
// ---------------------------------------------------------------------------

/** Documents that could run script if opened directly. */
const ACTIVE = /^(text\/html|image\/svg\+xml|application\/xhtml\+xml|text\/xml|application\/xml)/;

/**
 * Stream a stored file as an HTTP response, with single-range support (PDF
 * previews and the EPUB reader ask for byte ranges).
 *
 * Every response is `nosniff`, and anything that could execute when opened
 * directly (HTML, SVG, XML) is served under `Content-Security-Policy: sandbox`.
 * Supabase served these from its own domain; here they come from the app's,
 * where a seller-uploaded page would otherwise run with the visitor's cookies.
 */
export async function serveFile(
  request: Request,
  bucket: string,
  name: string,
  cacheControl: string,
  downloadAs?: string | null,
): Promise<Response> {
  let full: string;
  try {
    full = objectPath(bucket, name);
  } catch {
    return new Response("Invalid key", { status: 400 });
  }
  const info = await stat(full).catch(() => null);
  if (!info?.isFile()) return new Response("Object not found", { status: 404 });

  const type = mimeOf(name);
  const headers = new Headers({
    "Content-Type": type,
    "Accept-Ranges": "bytes",
    "Cache-Control": cacheControl,
    "Last-Modified": info.mtime.toUTCString(),
    "X-Content-Type-Options": "nosniff",
    "Access-Control-Allow-Origin": "*",
  });
  if (ACTIVE.test(type)) headers.set("Content-Security-Policy", "sandbox");
  if (downloadAs) {
    // Quotes, backslashes and control characters out: this is a header value,
    // and a newline in it is a header-injection attempt.
    const safe = downloadAs.replace(/[^\w.\- ]/g, "_").slice(0, 150) || "download";
    headers.set("Content-Disposition", `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(safe)}`);
  }

  let start = 0;
  let end = info.size - 1;
  let status = 200;
  const range = request.headers.get("range");
  if (range && info.size > 0) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (m && (m[1] || m[2])) {
      if (m[1]) {
        start = Number(m[1]);
        end = m[2] ? Math.min(Number(m[2]), info.size - 1) : info.size - 1;
      } else {
        start = Math.max(0, info.size - Number(m[2]));
      }
      if (start > end || start >= info.size) {
        return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${info.size}` } });
      }
      status = 206;
      headers.set("Content-Range", `bytes ${start}-${end}/${info.size}`);
    }
  }
  headers.set("Content-Length", String(info.size === 0 ? 0 : end - start + 1));
  if (request.method === "HEAD" || info.size === 0) return new Response(null, { status, headers });

  const { Readable } = await import("node:stream");
  const stream = Readable.toWeb(createReadStream(full, { start, end })) as ReadableStream<Uint8Array>;
  return new Response(stream, { status, headers });
}
