# CLAUDE.md — `app/panel/`

Catatan khusus area panel (admin & customer). Dipindah dari `CLAUDE.md` root supaya
hanya kebaca saat benar-benar kerja di dalam folder ini.

## Flow: buat & edit landing page (admin)

1. **Buat**: `/panel/product/new` (`createLandingPage`, dibuat `published: false` = draft) atau upload file `.html` via `/panel/upload`.
2. **Form produk** (`product-edit-form.tsx` — satu form, tab: Detail / Thumbnail / Preview / Harga / Jadwal / Pengiriman / Terkait). Tab **Preview** memilih sumber preview (`updateLandingPageSettings`):
   - `html` (default) — render konten editor di iframe `/preview/[slug]`.
   - `pdf` — upload PDF (`uploadPreviewPdf` → bucket `landing-assets/{user}/{page}/preview/`), di-embed di `/preview/[slug]`.
   - `link` — embed URL eksternal di `/preview/[slug]`.
   - `epub` — upload EPUB, dibaca di reader inline.
   - `deliverable` — preview memakai file pembeli (PDF/EPUB) apa adanya, utuh.
   - `excerpt` — **satu file**: preview menampilkan sebagian awal EPUB pembeli.
     Potongan diterapkan **di server** (`app/api/epub-text/[slug]`), jadi bab yang
     ditahan tidak pernah dikirim ke browser. Persen di `preview_cut_percent`.
   Kolom DB: `preview_type ('html'|'pdf'|'link'|'epub'|'deliverable'|'excerpt')`,
   `preview_url`, `preview_url_dark`, `preview_cut_percent`, `preview_purged_at`.
3. **Editor** (`editor.tsx`): Monaco tab HTML/CSS/JS, simpan **manual** (tombol Save / `Cmd/Ctrl+S`) → `updateLandingPageHtml()`. Tidak ada autosave maupun history/restore (fitur version dihapus Jun 2026).
   - `lib/editor-utils.ts`: `parseHtmlContent()` pisah `<style>`/`<script>`; `mergeHtmlContent()` gabung lagi sebelum simpan ke `html_content`.
4. **Assets** (`asset-upload.tsx`):
   - Gambar/video → Storage `landing-assets/{userId}/{pageId}/{ts}-{file}`, dapat public URL.
   - **ZIP site** → `uploadSiteZip()`: unzip (fflate), upload semua file ke `.../site/...`, inject `<base href>` ke direktori storage, cari `index.html` terdangkal, update `html_content`.
5. **Harga & pengiriman** (tab di `product-edit-form.tsx`): `price`, `price_discount`,
   `is_free`, thumbnail (utama wajib + landscape + 2 gambar tambahan), `category_id`
   (hierarki parent→child), `long_description`, jadwal rilis (`available_at`), dan
   file pembeli — ZIP **atau** PDF **atau** EPUB (satu tipe saja).
   - **Tab Pengiriman dimulai dari `product_type`** (`digital`/`physical`/`service`,
     Fase 6). Slot upload file hanya muncul untuk `digital`; `physical` menampilkan
     SKU/stok/satuan, `service` menampilkan durasi + cara layanan diberikan, dan
     keduanya menampilkan `fulfillment_note`. Field jenis lama **tidak dihapus**
     saat jenisnya diganti — `product_type` yang menentukan apa yang dibaca, jadi
     penjual yang salah pilih lalu kembali tidak kehilangan isiannya.
6. **Publish**: produk baru punya tombol **Simpan draft** + **Publish**; setelah
   pernah publish, jadi satu tombol Simpan perubahan. `featured` (pin) sudah tidak
   ada di form ini — diatur dari daftar produk.
