# CLAUDE.md — `app/panel/`

Catatan khusus area panel (admin & customer). Dipindah dari `CLAUDE.md` root supaya
hanya kebaca saat benar-benar kerja di dalam folder ini.

## Flow: buat & edit landing page (admin)

1. **Buat**: `/panel/landing-pages/new` (`createLandingPage`) atau upload file `.html` via `/panel/upload`.
2. **Pengaturan halaman** (`page-settings-form.tsx`): edit **title** + **sumber preview** (`updateLandingPageSettings`):
   - `html` (default) — render konten editor di iframe `/lp/[slug]`.
   - `pdf` — upload PDF (`uploadPreviewPdf` → bucket `landing-assets/{user}/{page}/preview/`), di-embed di `/lp/[slug]`.
   - `link` — embed URL eksternal di `/lp/[slug]`.
   Kolom DB: `preview_type ('html'|'pdf'|'link')`, `preview_url`.
3. **Editor** (`editor.tsx`): Monaco tab HTML/CSS/JS, simpan **manual** (tombol Save / `Cmd/Ctrl+S`) → `updateLandingPageHtml()`. Tidak ada autosave maupun history/restore (fitur version dihapus Jun 2026).
   - `lib/editor-utils.ts`: `parseHtmlContent()` pisah `<style>`/`<script>`; `mergeHtmlContent()` gabung lagi sebelum simpan ke `html_content`.
4. **Assets** (`asset-upload.tsx`):
   - Gambar/video → Storage `landing-assets/{userId}/{pageId}/{ts}-{file}`, dapat public URL.
   - **ZIP site** → `uploadSiteZip()`: unzip (fflate), upload semua file ke `.../site/...`, inject `<base href>` ke direktori storage, cari `index.html` terdangkal, update `html_content`.
5. **Pricing** (`pricing-form.tsx`): `price`, `price_discount`, `is_free`, `thumbnail_url`, `category_id` (hierarki parent→child), `long_description`, plus upload ZIP download (file yang diterima customer).
