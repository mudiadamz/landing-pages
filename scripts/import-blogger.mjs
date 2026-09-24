#!/usr/bin/env node
/**
 * Import a Blogger export into a storefront running the `blog` template.
 *
 *   node scripts/import-blogger.mjs blog.db --site techgalery.com --create-site
 *   node scripts/import-blogger.mjs blog.db --site techgalery.com --media takeout.zip
 *   node scripts/import-blogger.mjs blog.db --site techgalery.com --dry-run
 *
 * The input is the SQLite database produced by `blogger_to_sqlite.py`, not the
 * Takeout archive itself — that tool already did the hard part (two different
 * export formats, spam, albums, the `(n)` suffix Takeout permutes) and the
 * result is a schema this can read in one pass.
 *
 * Reads SQLite through `node:sqlite`, which ships with Node 22 — no dependency
 * is added for a script that runs a handful of times.
 *
 * IDEMPOTENT. Every row is matched on its Blogger id (`source_id`), so running
 * it twice updates instead of duplicating, and re-running after fixing one post
 * in Blogger costs nothing. That is also why it is safe against the production
 * database this repo points at.
 *
 * WHAT IT DOES NOT DO: it never deletes. A post removed in Blogger stays here
 * until someone says otherwise — an importer that prunes is an importer that
 * can empty a blog because a flag was mistyped.
 */

import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import path from "node:path";
import pg from "pg";

/* -------------------------------------------------------------------------- */
/*  Arguments                                                                   */
/* -------------------------------------------------------------------------- */

const argv = process.argv.slice(2);
const positional = argv.filter((a) => !a.startsWith("--"));
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? null : argv[i + 1] ?? "";
};
const has = (name) => argv.includes(`--${name}`);

const DB_FILE = positional[0];
const SITE_HOST = flag("site");
const MEDIA = flag("media");
const DRY_RUN = has("dry-run");
const CREATE_SITE = has("create-site");

if (!DB_FILE || !SITE_HOST) {
  console.error(
    "usage: node scripts/import-blogger.mjs <blog.db> --site <host> [--create-site] [--media <zip|dir>] [--dry-run]",
  );
  process.exit(2);
}
if (!existsSync(DB_FILE)) {
  console.error(`tidak ada file: ${DB_FILE}`);
  process.exit(2);
}

const log = (...a) => console.log(...a);
const warn = (...a) => console.warn("  !", ...a);

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                     */
/* -------------------------------------------------------------------------- */

/** Matches lib/slug.ts — a label's slug has to resolve the same way both sides. */
function slugFromTitle(title) {
  return String(title ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * The address, taken from the export rather than rebuilt.
 *
 * Blogger froze a post's path at first publication and truncated the slug with
 * rules it never documented. Recomputing would move some of these 410 posts to
 * addresses that never existed, which is the one thing this whole feature is
 * meant to prevent. The fallback only runs for a row with no path at all.
 */
function pathOf(row) {
  const stored = (row.path ?? "").trim();
  if (stored.startsWith("/")) return stored;
  const slug = slugFromTitle(row.slug || row.title);
  if (row.kind === "page") return `/p/${slug}.html`;
  const d = new Date(row.published ?? Date.now());
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `/${y}/${m}/${slug}.html`;
}

/**
 * Every Blogger URL that points at the SAME image as `srcUrl`.
 *
 * Blogger serves one upload at many sizes and puts the size in the path:
 *
 *   .../AVvXsEg…/s640/01-goto-namecheap.PNG     ← the <img src>
 *   .../AVvXsEg…/s1600/01-goto-namecheap.PNG    ← the <a href> wrapping it
 *
 * `post_images` only captured the `<img src>`, so replacing that string alone
 * rewrote the picture and left the click-through pointing back at Google — 405
 * of 416 posts still referenced googleusercontent after the first pass. The
 * opaque token and the filename are the stable parts; the size segment is not,
 * so it is the one thing this pattern lets vary.
 *
 * Returns null for a URL that is not shaped like that, and the caller falls
 * back to a plain string replace.
 */
function sameImagePattern(srcUrl) {
  const m = srcUrl.match(/^(.*)\/(s\d+(?:-[a-z]+)?|w\d+-h\d+(?:-[a-z]+)?)\/([^/?#]+)$/);
  if (!m) return null;
  const esc = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`${esc(m[1])}/[^/"'\\s>]+/${esc(m[3])}`, "g");
}

function isoOr(value, fallback = new Date().toISOString()) {
  if (!value) return fallback;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d.toISOString();
}

/* -------------------------------------------------------------------------- */
/*  Media: album files → this server's public storage                           */
/* -------------------------------------------------------------------------- */

const PUBLIC_BUCKET = "landing-assets";

function storageRoot() {
  return path.resolve(process.env.STORAGE_ROOT || path.join(process.cwd(), ".storage"));
}

/**
 * Read a Takeout zip without unpacking it, and without a dependency.
 *
 * `unzip` is not installed on this host, and a 156 MB archive holding 780 files
 * we copy anyway is not worth writing to disk twice. So: parse the central
 * directory, keep an index of offsets, and inflate only the entries actually
 * referenced by a post. `zlib.inflateRawSync` is exactly the codec a zip stores
 * (method 8 = raw deflate); method 0 is stored-uncompressed and copied out.
 *
 * Deliberately not a general zip implementation: no zip64, no encryption, no
 * multi-disk. It reads Google's own export, and it throws rather than guesses
 * if it meets something else.
 */
function openZip(zipPath) {
  const buf = readFileSync(zipPath);

  // End of central directory: scanned backwards from the tail, because the
  // trailing comment field means it is not at a fixed offset.
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 22 - 65_535; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new Error(`bukan file zip yang bisa dibaca: ${zipPath}`);

  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries = [];
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("central directory rusak");
    const method = buf.readUInt16LE(p + 10);
    const compressedSize = buf.readUInt32LE(p + 20);
    const size = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    entries.push({ name, method, compressedSize, size, localOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }

  const read = (entry) => {
    // The local header repeats the name/extra lengths and they can differ from
    // the central directory's, so the data offset has to come from this one.
    const lh = entry.localOffset;
    if (buf.readUInt32LE(lh) !== 0x04034b50) throw new Error(`local header rusak: ${entry.name}`);
    const nameLen = buf.readUInt16LE(lh + 26);
    const extraLen = buf.readUInt16LE(lh + 28);
    const start = lh + 30 + nameLen + extraLen;
    const raw = buf.subarray(start, start + entry.compressedSize);
    if (entry.method === 0) return raw;
    if (entry.method === 8) return inflateRawSync(raw);
    throw new Error(`metode kompresi ${entry.method} tidak didukung (${entry.name})`);
  };

  return { entries, read };
}

/** Takeout writes "Widya &amp;_ Adam" as a directory; the export stores it decoded. */
function unescapeName(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * Index the album files, from either an unpacked directory or a Takeout zip.
 *
 * Two indexes, because Takeout is not reliable about names: `(album, filename)`
 * is the exact match, and `size` is the fallback for the case the export tool
 * already documents — Takeout permutes the `(n)` suffix between an image and
 * its metadata sidecar when several uploads share a filename.
 */
function indexMedia(source) {
  const byKey = new Map();
  const bySize = new Map();
  const add = (album, filename, size, read) => {
    if (filename.endsWith(".json")) return;
    const item = { read, size };
    byKey.set(`${unescapeName(album)}/${filename}`, item);
    bySize.set(size, [...(bySize.get(size) ?? []), item]);
  };

  if (statSync(source).isFile()) {
    const zip = openZip(source);
    for (const entry of zip.entries) {
      if (entry.name.endsWith("/")) continue;
      if (!entry.name.includes("/Albums/")) continue;
      const parts = entry.name.split("/");
      add(parts[parts.length - 2], parts[parts.length - 1], entry.size, () => zip.read(entry));
    }
  } else {
    const walk = (dir) => {
      for (const name of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, name.name);
        if (name.isDirectory()) {
          walk(full);
          continue;
        }
        add(path.basename(path.dirname(full)), name.name, statSync(full).size, () =>
          readFileSync(full),
        );
      }
    };
    walk(source);
  }

  return { byKey, bySize, count: byKey.size };
}

/**
 * Copy one album file into public storage and return the URL it now answers on.
 *
 * The object name is the source URL's hash plus the original filename: the hash
 * keeps two identically-named uploads apart (this archive has three
 * `youcam-makeup-try-on.jpg`), and keeping the real filename on the end means a
 * human looking at the directory can still tell what a file is.
 */
function publishImage(item, srcUrl, siteId, filename) {
  const safe = filename.replace(/[^A-Za-z0-9._-]+/g, "-");
  const digest = createHash("sha1").update(srcUrl).digest("hex").slice(0, 10);
  const objectName = `blog/${siteId}/${digest}-${safe}`;
  const dest = path.join(storageRoot(), PUBLIC_BUCKET, objectName);
  if (!DRY_RUN) {
    mkdirSync(path.dirname(dest), { recursive: true });
    if (!existsSync(dest)) writeFileSync(dest, item.read());
  }
  return `/storage/v1/object/public/${PUBLIC_BUCKET}/${objectName}`;
}

/* -------------------------------------------------------------------------- */
/*  Main                                                                        */
/* -------------------------------------------------------------------------- */

async function main() {
  const sqlite = new DatabaseSync(DB_FILE, { readOnly: true });
  const connectionString =
    process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL || "";
  if (!connectionString) {
    console.error("DATABASE_URL / MIGRATE_DATABASE_URL belum diset.");
    process.exit(2);
  }
  const db = new pg.Client({ connectionString });
  await db.connect();

  const blogRow = sqlite.prepare("select * from blog limit 1").get() ?? {};
  log(`sumber : ${blogRow.title ?? "(tanpa judul)"} — ${blogRow.url ?? "?"}`);
  log(`tujuan : ${SITE_HOST}${DRY_RUN ? "  [DRY RUN — tidak ada yang ditulis]" : ""}`);

  /* -- 1. The site row ---------------------------------------------------- */

  let { rows: siteRows } = await db.query("select id, name, template from lp_sites where host = $1", [
    SITE_HOST,
  ]);
  if (siteRows.length === 0) {
    if (!CREATE_SITE) {
      console.error(
        `situs ${SITE_HOST} tidak ada. Tambahkan --create-site untuk membuatnya, atau pakai host yang sudah terdaftar.`,
      );
      process.exit(1);
    }
    // The oldest business, which is where the Fase 0 backfill put everything
    // that existed before businesses did. Named explicitly in the log so a
    // multi-business deployment can see which one it landed in.
    const { rows: biz } = await db.query(
      "select id, name from lp_businesses order by created_at asc limit 1",
    );
    const businessId = biz[0]?.id ?? null;
    log(`  membuat situs baru di business: ${biz[0]?.name ?? "(tidak ada)"}`);
    if (!DRY_RUN) {
      const { rows } = await db.query(
        `insert into lp_sites (host, name, description, template, locale, business_id, active, is_canonical)
         values ($1, $2, $3, 'blog', 'en', $4, true, false)
         returning id, name, template`,
        [
          SITE_HOST,
          blogRow.title ?? SITE_HOST,
          (blogRow.subtitle ?? "").replace(/&amp;/g, "&") || null,
          businessId,
        ],
      );
      siteRows = rows;
    } else {
      siteRows = [{ id: "00000000-0000-0000-0000-000000000000", name: SITE_HOST, template: "blog" }];
    }
  } else if (siteRows[0].template !== "blog") {
    warn(
      `situs ini memakai template "${siteRows[0].template}", bukan "blog". Impor tetap jalan, tapi tulisannya tidak akan tampil sampai template-nya diganti.`,
    );
  }
  const siteId = siteRows[0].id;
  log(`  site_id: ${siteId}`);

  /* -- 2. Media ----------------------------------------------------------- */

  let media = null;
  const localUrlBySrc = new Map();
  if (MEDIA) {
    if (!existsSync(MEDIA)) {
      console.error(`--media tidak ditemukan: ${MEDIA}`);
      process.exit(2);
    }
    log(`media  : mengindeks ${MEDIA}`);
    media = indexMedia(MEDIA);
    log(`  ${media.count} berkas album terindeks`);

    const links = sqlite
      .prepare(
        `select pi.post_id, pi.src_url, i.album, i.media_path, i.size_bytes
           from post_images pi join images i on i.id = pi.image_id
          where pi.src_url is not null`,
      )
      .all();

    let copied = 0;
    let bySize = 0;
    let missing = 0;
    for (const link of links) {
      const base = path.basename(link.media_path ?? "");
      let file = media.byKey.get(`${link.album}/${base}`);
      if (!file) {
        // Exactly the mismatch blogger_to_sqlite documents: same bytes, a
        // different `(n)`. Only trusted when the size is unambiguous.
        const candidates = media.bySize.get(link.size_bytes) ?? [];
        if (candidates.length === 1) {
          file = candidates[0];
          bySize += 1;
        }
      }
      if (!file) {
        missing += 1;
        continue;
      }
      if (!localUrlBySrc.has(link.src_url)) {
        localUrlBySrc.set(link.src_url, publishImage(file, link.src_url, siteId, base));
        copied += 1;
      }
    }
    log(`  ${copied} gambar disalin ke storage (${bySize} cocok lewat ukuran), ${missing} tidak ketemu`);
  }

  /* -- 3. Labels ---------------------------------------------------------- */

  const labels = sqlite.prepare("select id, name from labels").all();
  const labelIdByName = new Map();
  for (const label of labels) {
    const name = String(label.name ?? "").trim();
    if (!name) continue;
    const slug = slugFromTitle(name) || createHash("sha1").update(name).digest("hex").slice(0, 8);
    if (DRY_RUN) {
      labelIdByName.set(name, "dry");
      continue;
    }
    const { rows } = await db.query(
      `insert into lp_blog_labels (site_id, name, slug) values ($1, $2, $3)
       on conflict (site_id, slug) do update set name = excluded.name
       returning id`,
      [siteId, name, slug],
    );
    labelIdByName.set(name, rows[0].id);
  }
  log(`label  : ${labelIdByName.size}`);

  /* -- 4. Posts & pages --------------------------------------------------- */

  const posts = sqlite
    .prepare(
      `select id, kind, title, content, content_text, status, is_draft, published, updated,
              author_name, path, url, slug, meta_description, word_count
         from posts order by published asc`,
    )
    .all();

  const postIdBySource = new Map();
  let inserted = 0;
  let rewritten = 0;
  const seenPaths = new Set();

  for (const row of posts) {
    const canonical = pathOf(row);
    // Two posts on one address cannot both be served, and the unique index
    // would refuse the second anyway — say which one rather than let the
    // constraint speak for us.
    if (seenPaths.has(canonical)) {
      warn(`path ganda, dilewati: ${canonical} (${row.title})`);
      continue;
    }
    seenPaths.add(canonical);

    let content = row.content ?? "";
    let thumbnail = null;
    if (localUrlBySrc.size > 0) {
      const before = content;
      for (const [src, local] of localUrlBySrc) {
        const pattern = sameImagePattern(src);
        const next = pattern ? content.replace(pattern, local) : content.split(src).join(local);
        if (next !== content) {
          content = next;
          thumbnail ??= local;
        }
      }
      if (content !== before) rewritten += 1;
    }

    const record = {
      site_id: siteId,
      kind: row.kind === "page" ? "page" : "post",
      title: row.title ?? "(tanpa judul)",
      slug: row.slug ?? slugFromTitle(row.title),
      path: canonical,
      content,
      content_text: row.content_text ?? "",
      meta_description: row.meta_description || null,
      author_name: row.author_name || null,
      // A Blogger draft is not published here either. `status` and `is_draft`
      // disagree in some exports; either one saying draft is enough.
      published: !(row.is_draft === 1 || row.status === "DRAFT"),
      published_at: isoOr(row.published),
      updated_at: isoOr(row.updated, isoOr(row.published)),
      thumbnail_url: thumbnail,
      word_count: Number(row.word_count ?? 0) || 0,
      source_id: row.id,
      source_url: row.url || null,
    };

    if (DRY_RUN) {
      postIdBySource.set(row.id, "dry");
      inserted += 1;
      continue;
    }

    const { rows: out } = await db.query(
      `insert into lp_blog_posts
         (site_id, kind, title, slug, path, content, content_text, meta_description, author_name,
          published, published_at, updated_at, thumbnail_url, word_count, source_id, source_url)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       on conflict (site_id, source_id) do update set
         kind = excluded.kind, title = excluded.title, slug = excluded.slug, path = excluded.path,
         content = excluded.content, content_text = excluded.content_text,
         meta_description = excluded.meta_description, author_name = excluded.author_name,
         published = excluded.published, published_at = excluded.published_at,
         updated_at = excluded.updated_at, thumbnail_url = excluded.thumbnail_url,
         word_count = excluded.word_count, source_url = excluded.source_url
       returning id`,
      [
        record.site_id, record.kind, record.title, record.slug, record.path, record.content,
        record.content_text, record.meta_description, record.author_name, record.published,
        record.published_at, record.updated_at, record.thumbnail_url, record.word_count,
        record.source_id, record.source_url,
      ],
    );
    postIdBySource.set(row.id, out[0].id);
    inserted += 1;
  }
  log(`tulisan: ${inserted}${localUrlBySrc.size ? ` (${rewritten} HTML-nya ditulis ulang ke gambar lokal)` : ""}`);

  /* -- 5. Post ↔ label ---------------------------------------------------- */

  const postLabels = sqlite
    .prepare(
      `select pl.post_id, l.name from post_labels pl join labels l on l.id = pl.label_id`,
    )
    .all();
  let linked = 0;
  for (const link of postLabels) {
    const postId = postIdBySource.get(link.post_id);
    const labelId = labelIdByName.get(String(link.name ?? "").trim());
    if (!postId || !labelId || DRY_RUN) continue;
    await db.query(
      `insert into lp_blog_post_labels (post_id, label_id) values ($1, $2)
       on conflict do nothing`,
      [postId, labelId],
    );
    linked += 1;
  }
  log(`kaitan : ${linked} tulisan↔label`);

  /* -- 6. Comments -------------------------------------------------------- */

  const comments = sqlite
    .prepare(
      `select id, post_id, parent_comment_id, status, is_spam, content, published, author_name, author_uri
         from comments order by published asc`,
    )
    .all();

  const commentIdBySource = new Map();
  let importedComments = 0;
  const byStatus = { live: 0, spam: 0, pending: 0 };

  // Two passes: a reply's parent may appear after it in publication order, and
  // the parent's new uuid has to exist before the child can point at it.
  for (const pass of [1, 2]) {
    for (const row of comments) {
      const postId = postIdBySource.get(row.post_id);
      if (!postId) continue;
      const status =
        row.is_spam === 1 || row.status === "SPAM_COMMENT"
          ? "spam"
          : row.status === "PENDING_MODERATION"
            ? "pending"
            : "live";
      if (pass === 1) byStatus[status] += 1;

      const parentId = row.parent_comment_id
        ? commentIdBySource.get(row.parent_comment_id) ?? null
        : null;
      // Second pass only rewrites a parent that was unknown the first time.
      if (pass === 2 && !parentId) continue;
      if (DRY_RUN) {
        commentIdBySource.set(row.id, "dry");
        if (pass === 1) importedComments += 1;
        continue;
      }

      const { rows: out } = await db.query(
        `insert into lp_blog_comments
           (site_id, post_id, parent_id, author_name, author_url, content, published_at, status, source_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         on conflict (site_id, source_id) do update set
           parent_id = excluded.parent_id, author_name = excluded.author_name,
           author_url = excluded.author_url, content = excluded.content,
           published_at = excluded.published_at, status = excluded.status
         returning id`,
        [
          siteId, postId, parentId, row.author_name || null, row.author_uri || null,
          row.content ?? "", isoOr(row.published), status, row.id,
        ],
      );
      commentIdBySource.set(row.id, out[0].id);
      if (pass === 1) importedComments += 1;
    }
  }
  log(
    `komentar: ${importedComments} (live ${byStatus.live}, spam ${byStatus.spam}, menunggu ${byStatus.pending})`,
  );
  if (byStatus.live === 0 && importedComments > 0) {
    warn(
      "tidak ada komentar berstatus LIVE — halaman tulisan tidak akan menampilkan bagian komentar sama sekali.",
    );
  }

  await db.end();
  sqlite.close();

  log("");
  log(DRY_RUN ? "selesai (dry run, tidak ada yang ditulis)." : "selesai.");
  if (!DRY_RUN) {
    log(`  cek: https://${SITE_HOST}/  dan  https://${SITE_HOST}/sitemap.xml`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
