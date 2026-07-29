#!/usr/bin/env node
/**
 * migrate-storage — copy Storage buckets and objects between two Supabase projects.
 *
 *   OLD_SUPABASE_URL=… OLD_SERVICE_KEY=… \
 *   NEW_SUPABASE_URL=… NEW_SERVICE_KEY=… \
 *   node scripts/migrate-storage.mjs [--apply] [--bucket <name>]
 *
 * `pg_dump` carries the storage.objects METADATA rows but not the bytes — the
 * files live in S3, not Postgres — so a restored project has a full file listing
 * pointing at nothing. This walks the source buckets and re-uploads the actual
 * objects.
 *
 * Dry-run by default: prints what it would copy and stops. Pass --apply to write.
 *
 * Idempotent by design. It skips any object already present at the same path
 * with the same byte length, so it is safe to run twice: once days ahead to move
 * the bulk, then again during the cutover window to sync only what changed.
 */
import { createClient } from "@supabase/supabase-js";

const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
// indexOf returns -1 when absent, and argv[-1 + 1] is argv[0] — which would
// silently adopt the first flag as a bucket filter and copy nothing.
const bucketFlag = argv.indexOf("--bucket");
const onlyBucket = bucketFlag >= 0 ? (argv[bucketFlag + 1] ?? null) : null;

const need = (n) => {
  const v = process.env[n];
  if (!v) {
    console.error(`Missing env ${n}`);
    process.exit(1);
  }
  return v;
};

const src = createClient(need("OLD_SUPABASE_URL"), need("OLD_SERVICE_KEY"));
const dst = createClient(need("NEW_SUPABASE_URL"), need("NEW_SERVICE_KEY"));

const mb = (b) => (b / 1048576).toFixed(1) + " MB";

/** Recursive listing — Storage's list() only returns one level at a time. */
async function walk(client, bucket, prefix = "") {
  const out = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await client.storage
      .from(bucket)
      .list(prefix, { limit: 1000, offset });
    if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
    if (!data?.length) break;
    for (const e of data) {
      const path = prefix ? `${prefix}/${e.name}` : e.name;
      // A folder is synthesised by the API and carries a null id.
      if (e.id === null) out.push(...(await walk(client, bucket, path)));
      else out.push({ path, size: e.metadata?.size ?? 0, type: e.metadata?.mimetype });
    }
    if (data.length < 1000) break;
    offset += 1000;
  }
  return out;
}

async function main() {
  const { data: buckets, error } = await src.storage.listBuckets();
  if (error) throw new Error(`listBuckets: ${error.message}`);

  const { data: existing } = await dst.storage.listBuckets();
  const have = new Set((existing ?? []).map((b) => b.name));

  let copied = 0;
  let skipped = 0;
  let bytes = 0;

  for (const b of buckets) {
    if (onlyBucket && b.name !== onlyBucket) continue;

    // Bucket settings are NOT part of a database dump either — public flag, size
    // limit and MIME allowlist have to be recreated or uploads start failing in
    // ways that only show up in production.
    if (!have.has(b.name)) {
      console.log(`bucket ${b.name}: CREATE (public=${b.public})`);
      if (apply) {
        const { error: ce } = await dst.storage.createBucket(b.name, {
          public: b.public,
          fileSizeLimit: b.file_size_limit ?? undefined,
          allowedMimeTypes: b.allowed_mime_types ?? undefined,
        });
        if (ce) throw new Error(`createBucket ${b.name}: ${ce.message}`);
      }
    } else {
      console.log(`bucket ${b.name}: exists`);
    }

    const objects = await walk(src, b.name);
    const target = have.has(b.name) ? await walk(dst, b.name) : [];
    const targetBySize = new Map(target.map((o) => [o.path, o.size]));

    for (const o of objects) {
      if (targetBySize.get(o.path) === o.size) {
        skipped++;
        continue;
      }
      console.log(`  ${apply ? "copy" : "would copy"} ${b.name}/${o.path} (${mb(o.size)})`);
      bytes += o.size;
      copied++;
      if (!apply) continue;

      const { data: blob, error: de } = await src.storage.from(b.name).download(o.path);
      if (de) throw new Error(`download ${b.name}/${o.path}: ${de.message}`);
      const buf = Buffer.from(await blob.arrayBuffer());
      const { error: ue } = await dst.storage.from(b.name).upload(o.path, buf, {
        contentType: o.type || blob.type || "application/octet-stream",
        upsert: true,
      });
      if (ue) throw new Error(`upload ${b.name}/${o.path}: ${ue.message}`);
    }
  }

  console.log(
    `\n${apply ? "Copied" : "Would copy"} ${copied} object(s), ${mb(bytes)}; ${skipped} already present.`,
  );
  if (!apply) console.log("Dry run — re-run with --apply to write.");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
