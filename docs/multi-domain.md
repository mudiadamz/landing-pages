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
| **Template** | `lp_sites.template` — frontend halaman depan. Teks bebas divalidasi terhadap `lib/templates/registry.tsx`, **bukan** enum DB, jadi menambah template tidak butuh migration; key tak dikenal jatuh ke `default`. Lihat README → "Template tampilan". |
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

**Bisa otomatis.** Kalau `VERCEL_API_TOKEN` diset, panel menambahkan domain ke
project sendiri lewat REST API Vercel (`POST /v10/projects/{id}/domains`) begitu
domain dibuat. Kartu domain di `/panel/sites` menampilkan statusnya —
*Aktif di Vercel* / *Menunggu DNS* / *Belum di Vercel* — plus tombol
**Tambah ke Vercel** dan **Cek verifikasi**, dan record DNS yang diminta Vercel
kalau domainnya butuh diverifikasi.

Env yang dibutuhkan (lihat `.env.example`):

```
VERCEL_API_TOKEN=      # Vercel → Account Settings → Tokens
VERCEL_PROJECT_ID=     # dari .vercel/project.json (projectId)
VERCEL_TEAM_ID=        # dari .vercel/project.json (orgId)
```

> **Token Vercel itu luas.** Scope-nya per akun/team, bukan per endpoint — tidak
> ada token "domains saja", jadi token ini bisa melakukan apa pun yang team bisa
> (termasuk menghapus project). Simpan sebagai env server (**jangan** pakai
> prefix `NEXT_PUBLIC_`), batasi ke team, dan beri masa kedaluwarsa. Semua
> pemakaiannya ada di `lib/vercel-domains.ts` dan setiap pemanggil lewat
> `requireAdmin()`.

Tanpa token, langkahnya manual dan panduan di panel tetap menampilkan nilai yang
perlu dipasang. **Menghapus domain di panel tidak melepasnya dari Vercel** —
disengaja, supaya tidak mematikan domain hidup hanya karena mau di-repoint.

Kalau manual: Project **`landing_pages`** → Settings → Domains → **Add**.

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

**`/panel` itu area campuran, bukan area admin.** Pembeli membaca "Pembelian
saya", invoice, dan favorit di situ. Karena sesi tidak lintas domain, sesi pembeli
cuma ada di domain tempat dia beli — jadi **route pembeli harus jalan di semua
domain**, kalau tidak pembeli terjebak: pembeliannya tidak bisa dibuka di
storefront yang dia pakai, dan di domain utama dia belum login.

Yang canonical-only hanya layar **admin**, supaya admin tidak login ulang di tiap
storefront. Dijaga di `app/panel/layout.tsx` dengan **allowlist** route pembeli
(`CUSTOMER_PANEL_PATHS`) — bukan blocklist route admin, supaya layar admin baru
otomatis ikut terkunci. Route admin yang dibuka dari domain niche di-redirect ke
**path yang sama di domain utama**, tempat sesinya sudah ada.

Layout tidak menerima pathname, jadi middleware (`lib/supabase/proxy.ts`)
meneruskannya lewat header `x-pathname`.

**Pembayaran tidak butuh setelan per domain.** `callbackUrl` Duitku selalu ke
domain utama (server-to-server, jadi harus satu host tetap — kalau ikut domain
pembeli, tiap domain baru otomatis jadi endpoint pembayaran). `returnUrl` ikut
domain tempat pembeli belanja.

**Menghapus domain menghapus pengaturannya** (cascade: hero, popup, tracking,
custom JS). Produk tidak terpengaruh — produk milik kategori, bukan milik domain.
Domain utama tidak bisa dihapus.

**Cache 60 detik, dan jebakan invalidasinya.** `lp_sites` dibaca lewat
`unstable_cache` dengan `revalidate: 60`.

Awalnya 300 detik dengan invalidasi lewat `updateTag("sites")` saja — dan itu
**tidak bekerja**: `updateTag` hanya mengenali fetch tags dan `cacheTag()` di dalam
`'use cache'`, bukan opsi `{ tags: [...] }` pada `unstable_cache`. Terukur:
setelah simpan di panel, baris database **dan** panel menampilkan nilai baru
sementara halaman publik tetap menyajikan yang lama sampai ada deploy baru.

Sekarang `bustSiteCaches()` memanggil `revalidateTag(tag, "max")` (profil wajib di
Next 16.1.6) **dan** `updateTag(tag)`, dan TTL diturunkan ke 60 detik sebagai jaring
pengaman. Perubahan langsung di database (tanpa invalidasi apa pun) terlihat dalam
~20 detik.

> Call site `updateTag` lain — `categories`, `hero`, `site_content`, `tracking`,
> `promo_popup`, `homepage-pages` — kemungkinan lag dengan cara yang sama. Belum
> diverifikasi satu per satu.

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
