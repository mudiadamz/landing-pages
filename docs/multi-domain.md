# Multi-domain (beberapa storefront, satu sistem)

Satu deployment Vercel melayani banyak domain. Tiap domain punya nama, tagline,
deskripsi SEO, tracking, hero, popup, custom JS sendiri — tapi **katalog produknya
satu**. Domain memilih *kategori*, bukan produk, jadi tidak ada produk yang
diduplikasi dan satu produk bisa tampil di beberapa storefront.

Dikelola di **`/panel/sites`** (menu Situs → Domain). Panduan langkah Vercel &
Supabase dengan nilai yang sudah terisi ada di tiap baris domain di panel itu —
dokumen ini versi lengkapnya.

## Konsep

| | |
|---|---|
| **Tabel** | `lp_sites` — `host`, `name`, `tagline`, `description`, `category_ids`, `is_canonical`, `active` |
| **Domain utama** | `is_canonical = true`. Satu-satunya. Memegang `/panel`, callback Duitku, dan jadi fallback untuk host yang tidak dikenal (preview deployment, `*.vercel.app`, domain yang diarahkan sebelum didaftarkan). |
| **Niche** | `category_ids` berisi kategori **induk**; sub-kategorinya ikut otomatis. **Kosong = seluruh katalog** — itu yang dipakai domain utama, bukan berarti "tidak tampilkan apa-apa". |
| **Pengaturan** | `lp_site_settings` di-key `(site_id, key)`. Per-domain: `hero`, `site_content`, `tracking`, `promo_popup`, `custom_js`. Global (pinned ke domain utama): `panel_palette`, `role_permissions`. |
| **Nonaktif** | `active = false` → domain itu menampilkan situs utama, bukan halaman error. |

## Menambah domain

Tiga tempat. Melewatkan satu menghasilkan gejala yang terlihat seperti bug.

### 1. Panel — `/panel/sites` → **Tambah domain**

- **Domain** — hostname saja: `resepku.com`. Tanpa `https://`, tanpa garis miring.
  Boleh subdomain. Form membersihkan input yang salah bentuk, tapi nilai yang
  tersimpan harus sama persis dengan header `Host`, kalau tidak domain itu akan
  selamanya menampilkan situs utama — dan itu membingungkan untuk dilacak.
- **Nama situs** — dipakai di judul tab, `og:site_name`, dan JSON-LD.
- **Tagline** — headline pendek; masuk ke judul: `Nama — tagline`.
- **Deskripsi (SEO)** — snippet Google, 120–160 karakter. Beda pekerjaan dari
  tagline; jangan disamakan.
- **Niche** — centang kategori induk. Kosong = seluruh katalog.

### 2. Vercel — supaya domainnya sampai ke aplikasi

Project **`landing_pages`** → Settings → Domains → **Add**.

- **Subdomain `admuiux.com`** (mis. `resep.admuiux.com`) — DNS-nya sudah di Vercel,
  jadi langsung jalan. Tidak perlu beli domain, SSL otomatis.
- **Domain terpisah** — Vercel menampilkan record DNS yang harus dipasang di
  registrar (nameserver atau A/CNAME). **Ikuti yang Vercel tampilkan**, jangan
  nilai dari catatan lama — nilainya bisa berubah. SSL otomatis setelah verifikasi.

Batas domain per project: Hobby 50, Pro *soft limit* 100.000. Tidak akan kena.

### 3. Supabase — supaya bisa login di domain itu

Authentication → URL Configuration → **Redirect URLs** → Add URL:

```
https://<domain-baru>/auth/callback
```

Untuk semua subdomain sekaligus, satu wildcard cukup. Pemisahnya `.` dan `/`, jadi
`*` hanya cocok satu level:

```
https://*.admuiux.com/auth/callback
```

Tanpa langkah ini, tombol "Masuk dengan Google" di domain baru gagal dengan error
redirect.

### 4. Google Cloud Console — **biasanya tidak perlu diubah**

Login Google lewat Supabase memakai callback **milik Supabase**, bukan domain kita.
Jadi *Authorized redirect URIs* di Google tetap satu nilai untuk semua domain:

```
https://uxizlsoggphacyvtshub.supabase.co/auth/v1/callback
```

Sudah terpasang sejak awal, jadi **domain baru tidak menambah pekerjaan di sini**.
Tambahkan `https://<domain>` ke *Authorized JavaScript origins* hanya kalau nanti
memakai Google One Tap — sekarang tidak dipakai.

### 5. Cek

- Homepage tampil dengan produk niche yang dipilih.
- `/panel` memantul ke homepage (panel hanya di domain utama).
- Masuk dengan Google berhasil **dan tetap di domain itu**.

## Yang perlu diketahui

**Login tidak lintas domain, dan itu disengaja.** Cookie sesi Supabase terikat per
domain. Pengunjung login sendiri di tiap domain. Karena akunnya tetap satu
`auth.users` (email yang sama), pembelian dari beberapa domain tetap muncul
bersama di "Pembelian saya".

**Panel hanya di domain utama.** Dijaga di `app/panel/layout.tsx`; domain niche
memantul ke homepage-nya. Alasannya sama seperti di atas — kalau panel ada di tiap
domain, admin harus login ulang di masing-masing.

**Pembayaran tidak butuh setelan per domain.** `callbackUrl` Duitku selalu ke
domain utama (server-to-server, jadi harus satu host tetap — kalau ikut domain
pembeli, tiap domain baru otomatis jadi endpoint pembayaran). `returnUrl` ikut
domain tempat pembeli belanja.

**Menghapus domain menghapus pengaturannya** (cascade: hero, popup, tracking,
custom JS). Produk tidak terpengaruh — produk milik kategori, bukan milik domain.
Domain utama tidak bisa dihapus.

**Cache 5 menit.** `lp_sites` dibaca lewat `unstable_cache` dengan
`revalidate: 300`. Perubahan lewat panel langsung berlaku (tag `sites` dibuang);
perubahan langsung di database baru terlihat setelah window itu habis.

## Catatan implementasi

Kalau menambah pengaturan per-domain baru, ikuti pola yang ada — ada satu jebakan
yang bikin semuanya rusak secara halus:

> **`unstable_cache` tidak bisa membaca `headers()`.** Sama seperti `cookies()`,
> dia menolak dynamic data source. Jadi host di-resolve **di luar** cache lalu
> `siteId` dikirim **sebagai argumen** — dan argumen itulah yang membuat cache
> key beda per domain. Kalau `siteId` dicari di dalam fungsi yang di-cache, satu
> storefront akan menyajikan hero dan daftar produk milik storefront lain dari
> entry cache yang sama.

Pola pembacanya (`lib/actions/site-settings.ts`):

```ts
const readHero = unstable_cache(
  async (siteId: string) => { /* .eq("site_id", siteId) */ },
  ["hero-config"],
  { revalidate: 120, tags: ["hero-config"] },
);
export async function getHero(siteId?: string) {
  return readHero(siteId ?? (await currentSiteId()));
}
```

Penulisnya wajib `onConflict: "site_id,key"` — primary key-nya komposit, jadi
`onConflict: "key"` akan gagal.

Resolver ada di `lib/site-resolve.ts`: `currentSite()`, `currentSiteId()`,
`currentOrigin()`, `canonicalOrigin()`, `isCanonicalRequest()`, dan
`editingSite(param)` untuk layar panel (dari `?site=<id>`, divalidasi ke tabel).

Pembacaan `lp_sites` **melempar** error database dan hanya mengembalikan `null`
untuk host yang benar-benar tidak ada. Itu disengaja: `unstable_cache` menyimpan
nilai yang dikembalikan, jadi `null` hasil error yang ditelan akan mengunci
"domain tidak dikenal" selama 5 menit penuh. Exception tidak di-cache.
