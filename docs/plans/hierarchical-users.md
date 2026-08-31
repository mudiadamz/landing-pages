# Rencana: user berjenjang (platform → situs → anggota situs)

> **Dokumen kerja.** Boleh berhenti kapan saja dan dilanjutkan sesi lain.
> Tiap fase berdiri sendiri: bisa di-deploy, punya cara verifikasi, dan tidak
> merusak apa pun kalau fase berikutnya tidak pernah dikerjakan.

Dibuat 2026-09-01. Status terakhir ada di tabel di bawah — **itu satu-satunya
tempat status ditulis.** Jangan menambah catatan status di tempat lain; salinan
kedua pasti menyimpang.

---

## Cara melanjutkan (baca ini dulu)

1. Baca [`docs/architecture.md`](../architecture.md) — batas antar lapisan dan
   invarian yang berlaku untuk semua fase di sini.
2. Lihat tabel status. Ambil fase pertama yang belum ✅.
3. Kerjakan **satu fase saja**, verifikasi dengan cara yang ditulis di fase itu,
   commit, lalu centang tabelnya dalam commit yang sama.
4. Kalau kenyataannya berbeda dari yang ditulis di sini, **perbaiki dokumen ini**
   dalam commit itu juga. Rencana yang salah lebih berbahaya daripada tidak ada.

---

## Keputusan yang sudah diambil

| Pertanyaan | Jawaban | Alasan |
|---|---|---|
| Akun terpisah per situs? | **Tidak bisa** — satu akun global | `auth.users` punya `users_email_partial_key`: email unik untuk seluruh project Supabase. Akun benar-benar terpisah butuh project Supabase per domain. |
| Bentuk hierarkinya | Akun global + **baris keanggotaan per-situs** | Satu orang bisa admin di situs A dan pembeli di situs B, dan pembeliannya tetap menyatu di "Pembelian saya". |
| Wewenang admin situs | Konten **dan** user situsnya | Undang, ubah role dalam situs itu, keluarkan dari situs itu. Tidak bisa membuat/menghapus situs, tidak melihat situs lain, tidak bisa mengangkat orang jadi platform admin. |
| Pembeli ikut dicatat? | Ya, otomatis | Baris keanggotaan dibuat saat signup/pembelian, dan data lama di-backfill. |

## Model sasaran

```
platform admin        lp_profiles.role = 'admin'
   │                  lintas situs, satu-satunya yang boleh:
   │                  buat/hapus situs, angkat platform admin, hapus akun
   │
   ├─ situs A ──── lp_site_members(site_id, user_id, role)
   │                 role = admin | publisher | customer
   │                 admin situs: konten + anggota situs itu saja
   │
   └─ situs B ──── keanggotaan terpisah; orang yang sama boleh punya
                   role berbeda di tiap situs
```

**Izin efektif** untuk sebuah aksi di situs S =
`platform admin` **atau** `role keanggotaan di S`. Satu resolver, satu tempat
(fase 2) — bukan pengecekan yang disalin ke tiap layar.

---

## Status fase

| # | Fase | Status | Commit |
|---|---|---|---|
| 0 | Rencana ini | ✅ | — |
| 1 | Tabel `lp_site_members` + backfill + RLS | ✅ | `20260901000000_site_members.sql` |
| 2 | Resolver izin efektif (belum mengubah perilaku) | ⬜ | |
| 3 | Cakupan panel ikut keanggotaan | ⬜ | |
| 4 | `/panel/users` jadi per-situs + kelola anggota | ⬜ | |
| 5 | Keanggotaan ditulis otomatis (signup, checkout) | ⬜ | |
| 6 | Delegasi fitur per-situs | ⬜ | |
| 7 | Pembersihan: arti `lp_profiles.role` dipersempit | ⬜ | |

---

## Fase 1 — Tabel keanggotaan + backfill

**Tujuan.** Datanya ada dan benar. **Tidak ada satu pun kode yang membacanya.**

Fase paling berisiko dijadikan paling membosankan: kalau backfill-nya salah,
ketahuan sebagai baris yang salah di database, bukan sebagai admin yang tiba-tiba
terkunci di luar panel.

**Migration.**

```sql
create table public.lp_site_members (
  site_id    uuid not null references public.lp_sites (id) on delete cascade,
  user_id    uuid not null references auth.users (id)      on delete cascade,
  role       text not null default 'customer'
             check (role in ('admin', 'publisher', 'customer')),
  created_at timestamptz not null default now(),
  invited_by uuid references auth.users (id) on delete set null,
  primary key (site_id, user_id)
);
create index lp_site_members_user_idx on public.lp_site_members (user_id);
```

`on delete cascade` di kedua FK: keanggotaan itu relasi, bukan catatan keuangan —
beda dari `lp_purchases.user_id` yang sengaja `set null` (migration
`20260829000000`). Situs dihapus atau akun dihapus, keanggotaannya memang ikut.

**Aturan backfill.**

| Siapa | Jadi anggota | Role |
|---|---|---|
| `lp_profiles.role = 'admin'` | **semua** situs | `admin` |
| `lp_profiles.role = 'publisher'` | situs kanonik | `publisher` |
| Pembeli | tiap situs yang muncul di `lp_purchases.site_id` miliknya | `customer` |
| Pembeli dengan `site_id IS NULL` | situs kanonik | `customer` |
| **Sisanya** (daftar, belum pernah beli) | situs kanonik | `customer` |

Admin masuk ke *semua* situs supaya fase 3 tidak mengubah apa pun bagi mereka:
hari ini setiap admin bisa membuka setiap situs, dan backfill harus mengabadikan
kenyataan itu, bukan kenyataan yang kita inginkan. Pembeli dengan `site_id` NULL
jatuh ke kanonik dengan alasan yang sudah dipakai `lib/site-scope.ts`.

Baris terakhir **ditambahkan saat mengerjakan fase ini**, tidak ada di rancangan
awal: tanpa itu, akun yang mendaftar tapi belum pernah membeli tidak jadi anggota
situs mana pun dan akan hilang dari daftar user setiap situs di fase 4. Orang
yang menghilang gara-gara backfill adalah persis jenis kegagalan senyap yang
fase ini ada untuk mencegahnya.

Urutan insert menentukan hasil: semuanya `on conflict do nothing`, jadi role yang
paling berwenang harus masuk lebih dulu — admin yang juga pernah membeli harus
tetap tercatat `admin`.

**RLS.** Baca: seseorang boleh melihat baris keanggotaannya sendiri. Selain itu
service-role, dan **setiap pemakaian service-role wajib punya gate sendiri**
(invarian I5 di `docs/architecture.md`).

**Verifikasi.** Supabase lokal: `supabase migration up`, lalu hitung dari
`psql` — jumlah admin × jumlah situs harus sama dengan baris `role='admin'`;
tiap pembeli di `lp_purchases` harus punya keanggotaan di situs yang sama;
tidak ada `user_id` di `lp_site_members` yang tidak ada di `auth.users`.

**Hasil verifikasi (2026-09-01).** Di Supabase lokal, dengan fixture yang
sengaja menutup tiap aturan: admin → 3 situs `admin`; publisher → kanonik saja;
pembeli di domain non-kanonik → **hanya** domain itu; pembelian `site_id` NULL →
kanonik; akun tanpa pembelian → kanonik; admin yang juga membeli **tetap**
`admin`. RLS aktif, nol policy tulis. Jalur "belum ada situs sama sekali" diuji
di database sekali pakai berisi tabel kosong: keluar exit 0, nol baris — jadi
`db reset` di mesin baru tidak akan gagal di sini.

`supabase db reset` sendiri **tidak** dijalankan: `supabase/seed.sql` tidak
membuat baris `lp_sites` maupun user uji, jadi reset akan mengosongkan setup
lokal yang dipakai skill `run-local`.

---

## Fase 2 — Resolver izin efektif

**Tujuan.** Satu tempat yang menjawab "orang ini boleh apa di situs ini",
dipakai gate yang sudah ada. Perilaku **tidak berubah**, karena setelah backfill
setiap admin adalah anggota setiap situs.

**Perubahan.**

- `lib/site-membership.ts` (baru): `siteMembership(userId, siteId)`,
  `effectiveRole(profile, membership)`.
- `lib/actions/profiles.ts`: `requireSiteAdmin(siteId)` baru;
  `canSellProducts()` menerima situs; `requireFeature()` memperhitungkan
  keanggotaan. `requireAdmin()` **tetap** berarti platform admin — jangan
  dilonggarkan, itu gate untuk aksi yang tidak boleh didelegasikan
  (buat/hapus situs, `/panel/roles`, hapus akun).
- Cached reader menerima `siteId` sebagai argumen, tidak pernah membaca
  `headers()`/`cookies()` sendiri (invarian I1).

**Verifikasi.** Unit test untuk `effectiveRole` (murni: platform admin menang,
non-anggota tidak dapat apa-apa, role situs dipakai apa adanya). Lalu `curl`
dengan sesi admin ke beberapa layar panel — semuanya harus sama seperti sebelum
fase ini.

**Selesai bila.** Semua gate lewat resolver, dan tidak ada perbedaan yang
terlihat di panel.

---

## Fase 3 — Cakupan panel ikut keanggotaan

**Tujuan.** Switcher situs hanya menampilkan situs yang boleh Anda buka, dan
`editingSite()` menolak situs yang bukan milik Anda.

**Perubahan.** `listSites()` sekarang mengembalikan semua situs ke siapa pun yang
memanggilnya. Pisahkan dua pemakaian:

- daftar untuk **switcher panel** → hanya situs yang jadi keanggotaan (platform
  admin: semua);
- daftar untuk **resolusi tenant** (`site-resolve`) → tetap semua, itu tentang
  host, bukan tentang orang.

`editingSite()` harus memvalidasi cookie `PANEL_SITE_COOKIE` terhadap daftar yang
boleh — cookie itu dikirim browser, jadi tanpa validasi ia jadi pintu masuk ke
situs orang lain hanya dengan mengganti satu nilai.

**Verifikasi.** Buat user uji dengan keanggotaan hanya di situs B, lalu `curl`
`/panel/...` dengan cookie scope diarahkan ke situs A. Harus jatuh ke situs B,
bukan menampilkan data situs A.

**Risiko.** Ini fase pertama yang bisa mengunci orang. Backfill fase 1 adalah
pengamannya; kalau ragu, jalankan hitungan verifikasi fase 1 lagi sebelum
deploy.

---

## Fase 4 — `/panel/users` jadi per-situs

**Tujuan.** Admin situs melihat dan mengelola anggota situsnya.

**Perubahan.**

- `GET /api/admin/users` difilter keanggotaan situs yang sedang dilihat;
  platform admin punya pilihan "semua situs".
- Tambah/undang anggota (berdasarkan email akun yang sudah ada), ubah role dalam
  situs, keluarkan dari situs.
- **Batas yang tidak boleh kabur:** "keluarkan dari situs" ≠ "hapus akun".
  Hapus akun tetap platform admin saja, dengan penjaga yang sudah ada (tidak
  bisa diri sendiri, tidak bisa admin, tolak kalau masih punya produk) —
  lihat `DELETE /api/admin/users`.
- Admin situs tidak boleh memberi role yang lebih tinggi dari miliknya, dan
  tidak boleh menyentuh `lp_profiles.role`.

**Verifikasi.** Lewat HTTP dengan tiga sesi: platform admin, admin situs A, dan
anggota biasa. Yang harus ditolak: admin situs A mengelola anggota situs B,
menaikkan seseorang jadi platform admin, dan menghapus akun.

---

## Fase 5 — Keanggotaan ditulis otomatis

**Tujuan.** Backfill berhenti jadi satu-satunya sumber.

**Perubahan.** Buat/naikkan baris keanggotaan di: signup (situs tempat mendaftar
— host request, bukan kanonik), callback Duitku saat pembelian tercatat, dan
`addPurchaseAction` untuk produk gratis. Idempoten (`on conflict do nothing`),
karena callback Duitku memang dikirim ulang.

**Verifikasi.** Beli produk di situs non-kanonik pada Supabase lokal, lalu
periksa satu baris keanggotaan muncul dengan `site_id` yang benar; kirim ulang
callback yang sama dan pastikan tetap satu baris.

---

## Fase 6 — Delegasi fitur per-situs

**Tujuan.** `role_permissions` (`lib/role-permissions.ts`) sekarang **sengaja**
tidak di-scope per-situs: panel hanya dilayani domain kanonik, jadi kuncinya
tepat satu baris. Dengan admin situs, itu tidak lagi cukup — tiap situs perlu
peta role→fitur sendiri.

**Perubahan.** Pindahkan kunci `role_permissions` ke per-`site_id`, dengan baris
kanonik sebagai default saat situs belum punya sendiri. Perbarui komentar di
`lib/actions/profiles.ts` yang menjelaskan kenapa dulu tidak di-scope — komentar
itu akan jadi salah, dan komentar yang salah lebih buruk daripada tidak ada.

**Boleh dilewati.** Kalau semua situs memakai peta yang sama, fase ini tidak
membeli apa pun. Kerjakan saat ada situs pertama yang butuh beda.

---

## Fase 7 — Pembersihan

- `lp_profiles.role` dipersempit artinya jadi **platform saja**: `admin` = platform
  admin, sisanya akun biasa. Role per-situs hidup di `lp_site_members`.
- `publisher_status` + KYC: putuskan apakah publisher itu status platform (satu
  kali verifikasi identitas, berlaku di semua situs — kemungkinan besar ya, karena
  KTP dan rekening bank itu milik orang, bukan milik situs) atau per-situs.
- Perbarui `CLAUDE.md` bagian **Auth & roles** dan `docs/multi-domain.md`.

---

## Keputusan yang masih terbuka

**Produk tidak punya pemilik situs.** `lp_landing_pages` **tidak punya kolom
`site_id`** — katalog tiap storefront cuma irisan dari `lp_sites.category_ids`.
Jadi "admin situs mengelola produk situsnya" belum punya arti yang tegas: produk
yang dia buat bisa muncul di domain lain kalau kategorinya beririsan.

Tiga pilihan, semuanya butuh keputusan Anda sebelum fase 4 menyentuh produk:

1. **Tambah `lp_landing_pages.site_id`** (pemilik), katalog tetap ditentukan
   kategori. Paling jelas, dan backfill-nya bisa dari kategori yang ada.
2. **Biarkan bersama**, admin situs hanya boleh menyunting produk yang masuk
   irisan kategorinya. Tidak ada migration, tapi aturannya kabur di tepi.
3. **Tunda** — fase 4 hanya mengurus anggota, produk tetap platform admin.

Rekomendasi: **3 sekarang, 1 nanti** sebagai fasenya sendiri. Menggabungkan
kepemilikan produk ke dalam fase user akan membuat satu fase yang tidak bisa
diverifikasi sekaligus.

---

## Invarian yang berlaku di semua fase

Semua dari [`docs/architecture.md`](../architecture.md); yang paling gampang
dilanggar di pekerjaan ini:

1. Fungsi ter-cache tidak boleh membaca `headers()`/`cookies()` — `siteId`
   dikirim sebagai argumen, dan itu juga yang jadi cache key per-tenant.
2. Service-role bypass RLS; tiap pemakaian wajib punya gate otorisasi sendiri.
3. Filter yang hilang menampilkan **lebih** banyak data daripada seharusnya —
   yang terlihat seperti berhasil. Setiap layar per-situs harus diuji dengan
   sesi yang **tidak** berhak, bukan hanya dengan sesi admin.
4. Panel hanya dilayani domain kanonik. Admin situs pun login di sana; sesi
   Supabase tidak lintas domain.
5. Verifikasi dari sisi server (`psql`, `curl` dengan sesi buatan sendiri —
   resep di skill `run-local`), bukan dari layar.
