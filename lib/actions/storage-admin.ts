"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/db/admin";
import { requirePlatform } from "@/lib/actions/profiles";

export type StorageFile = {
  bucket: string;
  path: string;
  name: string;
  size: number | null;
  mimetype: string | null;
  updatedAt: string | null;
  createdAt: string | null;
  /** Public URL for files in public buckets; null for private buckets. */
  publicUrl: string | null;
};

export type StorageListing = {
  files: StorageFile[];
  buckets: string[];
  truncated: boolean;
  error?: string;
};

const PAGE = 100; // list page size (same as storage-api used)
const MAX_FILES = 3000; // safety cap so a huge bucket can't hang the page
const MAX_DEPTH = 8;

type AdminClient = ReturnType<typeof createAdminClient>;

/** Recursively collect files under `prefix` (folders have id === null). */
async function walk(
  admin: AdminClient,
  bucket: string,
  prefix: string,
  depth: number,
  out: Omit<StorageFile, "publicUrl">[],
  budget: { left: number },
): Promise<void> {
  if (depth > MAX_DEPTH || budget.left <= 0) return;
  let offset = 0;
  for (;;) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, {
      limit: PAGE,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error || !data || data.length === 0) return;

    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) {
        // A folder — recurse into it.
        await walk(admin, bucket, path, depth + 1, out, budget);
        if (budget.left <= 0) return;
      } else {
        if (item.name.startsWith(".")) continue; // placeholder / hidden
        out.push({
          bucket,
          path,
          name: item.name,
          size: (item.metadata?.size as number | undefined) ?? null,
          mimetype: (item.metadata?.mimetype as string | undefined) ?? null,
          createdAt: item.created_at ?? null,
          updatedAt: item.updated_at ?? item.created_at ?? null,
        });
        if (--budget.left <= 0) return;
      }
    }
    if (data.length < PAGE) return;
    offset += PAGE;
  }
}

/**
 * Every file in every storage bucket (admin only, via the service-role client so
 * it bypasses RLS). Recurses the nested `{user}/{page}/…` folders. Capped at
 * MAX_FILES; `truncated` signals the cap was hit.
 */
export async function listAllStorageFiles(): Promise<StorageListing> {
  if (!(await requirePlatform())) return { files: [], buckets: [], truncated: false, error: "Forbidden" };

  const admin = createAdminClient();
  const { data: buckets, error } = await admin.storage.listBuckets();
  if (error) return { files: [], buckets: [], truncated: false, error: error.message };

  const budget = { left: MAX_FILES };
  const files: StorageFile[] = [];
  const bucketNames: string[] = [];

  for (const b of buckets ?? []) {
    bucketNames.push(b.name);
    const collected: Omit<StorageFile, "publicUrl">[] = [];
    await walk(admin, b.name, "", 0, collected, budget);
    for (const f of collected) {
      files.push({
        ...f,
        publicUrl: b.public ? admin.storage.from(b.name).getPublicUrl(f.path).data.publicUrl : null,
      });
    }
    if (budget.left <= 0) break;
  }

  files.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
  return { files, buckets: bucketNames, truncated: budget.left <= 0 };
}

/** Delete one file from storage (admin only). */
export async function deleteStorageFile(
  bucket: string,
  path: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await requirePlatform())) return { ok: false, error: "Forbidden" };
  if (!bucket || !path) return { ok: false, error: "Bucket/path wajib diisi" };

  const admin = createAdminClient();
  const { error } = await admin.storage.from(bucket).remove([path]);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/panel/storage");
  return { ok: true };
}
