# Arsitektur & aturan

Dokumen ini menjelaskan **bentuk** sistem dan **batas-batas** yang harus dijaga —
bukan daftar fitur. Kalau Anda menambah sesuatu, cari polanya di sini dulu; kalau
tidak ada, itu tanda desainnya perlu dipikirkan, bukan tanda Anda perlu improvisasi.

Inventaris fitur dan flow per-halaman ada di `CLAUDE.md`. Detail multi-domain di
[`multi-domain.md`](multi-domain.md).

---

## 1. Bentuk sistem

Satu deployment melayani **banyak storefront**. Karena itu hampir semua hal yang
dulu "global" sekarang **milik request**, dan itu sumber dari sebagian besar aturan
di bawah.

```
request
  │
  ├─ lib/site-resolve.ts ............ IDENTITAS: host → site (tenant)
  │
  ├─ app/**/page.tsx ............... DATA: ambil semua data, lalu dispatch
  │     └─ lib/actions/*.ts ........ akses DB (Server Actions + cached reader)
  │           └─ lib/supabase/* .... server (RLS) / client / admin (service-role)
  │
  └─ lib/templates/* ............... PRESENTASI: registry + komponen per tema
```

Empat lapisan, satu arah. Presentasi tidak pernah mengambil data. Data tidak pernah
tahu tema. Identitas di-resolve sekali per request dan **dikirim ke bawah sebagai
argumen**, tidak dibaca ulang di dalam lapisan lain.

---

## 2. Batas antar lapisan

| Lapisan | Boleh | **Tidak boleh** |
|---|---|---|
| `app/**/page.tsx` | ambil data, resolve site, render komponen dispatcher | menaruh markup bertema untuk permukaan yang punya slot |
| `lib/templates/*` | merender props yang diterima | fetch sendiri; impor `templates/chrome.tsx` (siklus) |
| `lib/actions/*.ts` | mutasi + cached reader | export fungsi sinkron atau type (I5) |
| cached reader | menerima `siteId`/host sebagai argumen | membaca `headers()` / `cookies()` |
| `supabase/admin.ts` | di mana pun **dengan gate otorisasi eksplisit** | dipakai tanpa gate — RLS sudah tidak menjaga apa pun |

**Kenapa presentasi tidak fetch:** filter katalog per-domain dan cache key mudah
salah secara halus. Kalau tema boleh fetch sendiri, tema keempat bisa
mengembalikan bug "semua produk tampil di semua domain" tanpa siapa pun sadar.
Semua tema menerima **props yang identik**; tema menentukan *tampilan*, bukan
*data apa yang boleh dilihat*.

---

## 3. Invarian

Aturan yang harus tetap benar. Setiap satu punya alasan mekanis, bukan selera.

**I1 — Tidak ada fungsi ter-cache yang membaca state request.**
`unstable_cache` menolak dynamic data source (`headers()`, `cookies()`). Host
di-resolve **di luar** cache dan dikirim **sebagai argumen**.

**I2 — Setiap cache entry per-tenant di-key oleh argumen `siteId`.**
Karena `unstable_cache` menurunkan key dari argumennya, ini sekaligus yang mencegah
satu storefront menyajikan hero/popup/katalog milik storefront lain.

**I3 — Invalidasi `unstable_cache` pakai `revalidateTag(tag, profile)`.**
`updateTag` hanya mengenali fetch tags dan `cacheTag()` di dalam `'use cache'` —
**bukan** opsi `{ tags: [...] }` yang kita pakai. Pakai `updateTag` sendirian dan
perubahan tidak sampai ke publik sampai TTL habis atau ada deploy.

**I4 — Semua mutasi lewat Server Action di `lib/actions/*.ts`.**
Bukan route handler, bukan client fetch. Satu tempat untuk otorisasi + invalidasi.

**I5 — Setiap export modul `"use server"` harus fungsi yang async-callable.**
Setiap export dikompilasi jadi server action. Yang gagal build: **fungsi sinkron**
(`function cleanHost()`) dan **re-export type** (jadi action yang menunjuk simbol
tidak ada saat runtime). Yang lolos: `export const x = unstable_cache(...)` — hasilnya
fungsi yang mengembalikan promise. Helper sinkron: jangan di-export, atau pindahkan
ke modul non-`"use server"`.

**I6 — Setiap pemakaian service-role client wajib punya gate otorisasi sendiri.**
Client itu **bypass RLS**, jadi RLS tidak lagi menjadi jaring pengaman — gate-nya
harus eksplisit: `requireAdmin()`, `requireFeature()`, atau cek kepemilikan lewat
`auth.getUser()`. Dipakai di luar `app/api/**` itu wajar dan memang dilakukan
(~20 modul di `lib/actions/`), yang tidak boleh adalah dipakai **tanpa** gate.
Kalau RLS sudah cukup, pakai `supabase/server.ts` — lebih aman secara default.
Pengecualian yang di-gate pemanggilnya: `lib/signup-guard.ts` (jalan sebelum auth,
memang), `lib/epub-source.ts`, `lib/bundle.ts`.

**I7 — Konten berbayar dipotong di server.**
Bab yang ditahan **tidak pernah dikirim** ke browser (`app/api/epub-text/[slug]`).
Reader yang punya seluruh buku lalu "berhenti dengan sopan" bukan gate.

**I8 — Batas pembayaran: `callbackUrl` canonical, `returnUrl` per-request.**
Callback itu server-to-server, jadi harus satu host tetap — kalau ikut domain
pembeli, tiap domain baru otomatis jadi endpoint pembayaran. `returnUrl` justru
harus ikut domain tempat pembeli belanja.

**I9 — Route admin canonical-only lewat allowlist, bukan blocklist.**
`app/panel/layout.tsx` mendaftar route **pembeli**; sisanya canonical-only. Terbalik
berarti layar admin berikutnya otomatis terbuka di semua domain.

**I10 — Tabel app diawali `lp_`.** Satu Supabase dipakai beberapa app.

**I11 — Palet hanya mengubah 4 token mood.** Latar, teks, dan border tetap — di
situlah kontrasnya. Situs menyimpan **kunci preset**, bukan hex, karena preset sudah
diukur kontrasnya dan field hex bebas tidak.

**I12 — "Enum" yang sebenarnya kode disimpan sebagai teks bebas + validasi di kode.**
`lp_sites.template` dan `.palette` divalidasi terhadap registry, bukan CHECK
constraint: menambah tema/palet adalah perubahan kode, bukan migration, dan nilai
tak dikenal jatuh ke default alih-alih merusak halaman.

---

## 4. Pola: "saya perlu menambah…"

| Kebutuhan | Pola | Contoh |
|---|---|---|
| Tema baru | komponen + satu entry di registry | `lib/templates/linkbio/*` |
| Permukaan bertema baru | slot **opsional** + fallback + dispatcher | `Categories` di `registry.tsx` |
| Pengaturan per-domain | kolom di `lp_sites` **atau** key di `lp_site_settings` | `palette` / `hero` |
| Pengaturan global admin | `lp_site_settings` di-pin ke canonical site | `panel_palette` |
| Reader baru | reader per-request, key-kan komponen dinamis | `EpubViewer key={url \|\| slug}` |
| Integrasi eksternal | modul sendiri, opsional, degradasi ke instruksi | `lib/vercel-domains.ts` |
| Input file di panel | `FileUploadCard` — selalu | `components/file-upload-card.tsx` |

**Slot opsional itu pola inti.** Tema hanya menulis permukaan yang niche-nya
benar-benar beda; sisanya jatuh ke Marketplace. Tapi **fallback membawa chrome-nya
sendiri** — jadi tema yang identitas visualnya kuat harus mengisi setiap slot yang
bisa dinavigasi ke sana, atau pengunjung melompat dari bio card ke header
storefront penuh.

**Integrasi eksternal harus opsional.** Tanpa `VERCEL_API_TOKEN`, panel jatuh ke
instruksi tertulis dan tidak ada yang rusak. Pola yang sama untuk apa pun yang
butuh kredensial pihak ketiga.

---

## 5. Jebakan struktural

Bukan anekdot — mekanisme yang akan menjebak orang berikutnya.

| Jebakan | Mekanisme | Yang benar |
|---|---|---|
| `headers()` di dalam cache | `unstable_cache` menolak dynamic source, lalu `catch` mengubahnya jadi default | resolve di luar, kirim sebagai argumen (I1) |
| Cache menyimpan kegagalan | `null` dari `catch` **ikut ter-cache** selama window | **throw** saat error (tidak di-cache), `null` hanya untuk "benar-benar tidak ada" |
| `updateTag` tidak menginvalidasi | sumber tag-nya beda (I3) | `revalidateTag(tag, "max")` + TTL pendek sebagai jaring |
| `inherit` untuk line-height | menyalin nilai **terkomputasi** (px), bukan rasio | rasio unitless, supaya ikut skala saat font diperbesar |
| `<style>` di `<head>` kalah | Next hoist stylesheet dengan `data-precedence` | taruh di `<body>` (lihat `app/layout.tsx`) |
| Siklus impor dispatcher | `chrome → registry → template → chrome` | tema impor chrome-nya **langsung** |
| Komponen dinamis tidak mount | `ssr:false` + `key=""` → tidak pernah mount | key selalu punya nilai: `key={url \|\| slug}` |
| Path lama di analitik | `page_type` diturunkan dari path tersimpan | classifier menerima prefix **lama dan baru** |

---

## 6. Disiplin verifikasi

Sesi kerja di codebase ini berulang kali menghasilkan "sudah beres" yang salah
karena **alat ukurnya** yang bohong, bukan kodenya. Aturannya:

- **Cek dari yang disajikan server**, bukan dari screenshot. `curl` HTML/CSS/header.
- **Screenshot dan `getComputedStyle` tidak bisa dipercaya** kalau browser memaksa
  dark mode. Tanda: `--background` mendeklarasikan nilai kita tapi warna yang
  dirender bukan milik kita, dan `colorScheme` = `dark` tanpa class `.dark`.
- **Cek `document.visibilityState`.** Tab latar belakang menunda mount React —
  "komponen tidak muncul" sering berarti tabnya tersembunyi.
- **Kelas Tailwind arbitrary di-escape di CSS** (`.text-\[var\(--primary\)\]`).
  Grep tanpa escaping akan bilang utilitasnya tidak ada padahal ada.
- **Cek exit code build**, bukan grep "Compiled successfully" — type error muncul
  setelah tahap compile.
- **Angka diambil dari DB**, bukan dari hitungan link di HTML (testimoni & related
  products juga menghasilkan link produk).

---

## 7. Konvensi

- Bahasa UI **Indonesia** (`<html lang="id">`, locale `id_ID`).
- Caching: `unstable_cache` + invalidasi per tag (lihat I2, I3).
- Commit pakai email `mudi.adamz@gmail.com` — kalau tidak, deploy Vercel gagal.
- **Jangan `git push`**: diblokir di settings; Adam yang push.
- Env var: sumber tunggalnya [`.env.example`](../.env.example). Jangan menyalin
  daftarnya ke dokumen lain — salinan itu pasti akan menyimpang.
