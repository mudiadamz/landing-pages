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

## Istilah & bentuk data

| Istilah | Artinya | Di database |
|---|---|---|
| **Company** | Pemilik platform. Lintas situs; satu-satunya yang boleh buat/hapus situs, mengubah jenis akun, dan menghapus akun. | `lp_profiles.account_type = 'company'` |
| **Agent** | Menjalankan sebuah storefront: konten, setelan, dan customer-nya — situs itu saja. | `account_type = 'agent'` **dan** baris di `lp_site_agents` |
| **Customer** | Pembeli. | `account_type = 'customer'` + baris di `lp_site_members` |
| **publisher** | **Bukan jenis akun** — seorang Customer yang boleh menjual **di satu situs**. | `lp_site_members.is_publisher = true` |

Tiga hal yang membuat bentuk ini beda dari model sebelumnya:

1. **Publisher jadi flag, bukan role.** Orang yang sama bisa publisher di situs A
   dan pembeli biasa di situs B. Sebelumnya "publisher" tersimpan di dua tempat
   (`role` dan `publisher_status`) yang bisa berbeda isi.
2. **Berkas KYC ikut per-situs.** Konsekuensinya disengaja: tiap storefront
   memverifikasi penjualnya sendiri, dan foto KTP orang yang sama tersimpan
   sekali per situs tempat dia mengajukan.
3. **Agent punya tabel sendiri.** `lp_site_members` sejak model ini hanya berisi
   customer. Agent di `lp_site_agents`, supaya satu situs tetap bisa punya lebih
   dari satu Agent.

Jenis akun `'admin'`/`'publisher'` lama masih **dibaca** oleh
`normalizeAccountType` (jadi Company / Customer), tapi kolomnya sudah tidak ada
lagi di database sesudah migration `20260903010000`.

## Keputusan yang sudah diambil

| Pertanyaan | Jawaban | Alasan |
|---|---|---|
| Akun terpisah per situs? | **Tidak bisa** — satu akun global | `auth.users` punya `users_email_partial_key`: email unik untuk seluruh project Supabase. Akun benar-benar terpisah butuh project Supabase per domain. |
| Bentuk hierarkinya | Akun global + **baris keanggotaan per-situs** | Satu orang bisa Agent di situs A dan Customer di situs B, dan pembeliannya tetap menyatu di "Pembelian saya". |
| Wewenang Agent | Konten **dan** Customer situsnya | Undang, ubah role dalam situs itu, keluarkan dari situs itu. Tidak bisa membuat/menghapus situs, tidak melihat situs lain, tidak bisa mengangkat orang jadi Company. |
| Customer ikut dicatat? | Ya, otomatis | Baris keanggotaan dibuat saat signup/pembelian, dan data lama di-backfill. |

## Model sasaran

```
COMPANY               lp_profiles.role = 'admin'
   │                  lintas situs, satu-satunya yang boleh:
   │                  buat/hapus situs, angkat Company, hapus akun
   │
   ├─ situs A ──── lp_site_members(site_id, user_id, role)
   │                 AGENT     = role 'admin'  (pengelola situs itu)
   │                 publisher = role 'publisher' (boleh menjual)
   │                 CUSTOMER  = role 'customer'  (pembeli)
   │
   └─ situs B ──── keanggotaan terpisah; orang yang sama boleh jadi Agent
                   di satu situs dan Customer di situs lain
```

**Izin efektif** untuk sebuah aksi di situs S =
`Company` **atau** `role keanggotaan di S`. Satu resolver, satu tempat
(fase 2) — bukan pengecekan yang disalin ke tiap layar.

---

## Status fase

| # | Fase | Status | Commit |
|---|---|---|---|
| 0 | Rencana ini | ✅ | — |
| 1 | Tabel `lp_site_members` + backfill + RLS | ✅ | `20260901000000_site_members.sql` |
| 2 | Resolver izin efektif (belum mengubah perilaku) | ✅ | `lib/site-membership.ts` |
| 3 | Cakupan panel ikut keanggotaan | ✅ | `editingSite()` + gate per-situs |
| 4 | `/panel/users` jadi per-situs + kelola anggota | ✅ | `api/admin/users` + `users-table` |
| 5 | Keanggotaan ditulis otomatis (signup, checkout) | ✅ | `ensureSiteMembership()` |
| 6 | Delegasi fitur per-situs | ✅ | `readRolePermissions(siteId, canonicalId)` |
| 7 | Pembersihan: arti `lp_profiles.role` dipersempit | ✅ | `20260901010000_role_meaning.sql` |

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
| Customer | tiap situs yang muncul di `lp_purchases.site_id` miliknya | `customer` |
| Customer dengan `site_id IS NULL` | situs kanonik | `customer` |
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
  keanggotaan. `requireAdmin()` **tetap** berarti Company — jangan
  dilonggarkan, itu gate untuk aksi yang tidak boleh didelegasikan
  (buat/hapus situs, `/panel/roles`, hapus akun).
- Cached reader menerima `siteId` sebagai argumen, tidak pernah membaca
  `headers()`/`cookies()` sendiri (invarian I1).

**Verifikasi.** Unit test untuk `effectiveRole` (murni: Company menang,
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

**Hasil (2026-09-01).** Penjagaannya ternyata **tiga lapis**, bukan satu:
`editingSite()` (cookie), gate halaman (`requireAdmin()` → `requireSiteAdmin()`
di 8 layar per-situs), dan gate action yang menerima `siteId` dari klien
(7 fungsi di `site-settings.ts`). Melewatkan lapis mana pun membuat dua lapis
lain jadi hiasan.

Diuji dengan dua sesi dan cookie `panel_site` yang **sama** menunjuk situs
kanonik: Agent (anggota `localhost` saja) mendapat `GTM-LOCALHOST`,
Company mendapat `GTM-KANONIK`. Nilai berbeda per situs sengaja dipasang
supaya hasilnya tidak bisa dibaca dua arti.

---

## Fase 4 — `/panel/users` jadi per-situs

**Tujuan.** Agent melihat dan mengelola anggota situsnya.

**Perubahan.**

- `GET /api/admin/users` difilter keanggotaan situs yang sedang dilihat;
  Company punya pilihan "semua situs".
- Tambah/undang anggota (berdasarkan email akun yang sudah ada), ubah role dalam
  situs, keluarkan dari situs.
- **Batas yang tidak boleh kabur:** "keluarkan dari situs" ≠ "hapus akun".
  Hapus akun tetap Company saja, dengan penjaga yang sudah ada (tidak
  bisa diri sendiri, tidak bisa admin, tolak kalau masih punya produk) —
  lihat `DELETE /api/admin/users`.
- Agent tidak boleh memberi role yang lebih tinggi dari miliknya, dan
  tidak boleh menyentuh `lp_profiles.role`.

**Verifikasi (2026-09-01).** Lewat HTTP dengan sesi Company dan sesi
Agent (anggota `localhost` saja, role platform-nya cuma `customer` —
jadi seluruh kewenangannya benar-benar datang dari keanggotaan).

Boleh: menaikkan anggota jadi publisher di situsnya (200), mengundang akun
terdaftar (200). Ditolak: ubah role platform (403), ban akun (403), ubah role
situs milik Company (403), ubah role situs diri sendiri (400),
hapus akun (403), keluarkan Company dari situs (403), undang email yang
belum punya akun (404).

Daftar user-nya diuji dengan satu akun yang sengaja **bukan** anggota situs itu,
karena tanpa itu jumlahnya kebetulan sama dan hasilnya bisa dibaca dua arti:
Agent melihat 3 (anggota `localhost`) bahkan saat meminta `?scope=all`,
Company melihat 4.

Dan yang paling penting dibedakan: sesudah "keluarkan dari situs", akunnya
**masih ada**, keanggotaannya di situs lain **tetap**, hanya baris situs ini
yang hilang.

---

## Fase 5 — Keanggotaan ditulis otomatis

**Tujuan.** Backfill berhenti jadi satu-satunya sumber.

**Perubahan.** Buat/naikkan baris keanggotaan di: signup (situs tempat mendaftar
— host request, bukan kanonik), callback Duitku saat pembelian tercatat, dan
`addPurchaseAction` untuk produk gratis. Idempoten (`on conflict do nothing`),
karena callback Duitku memang dikirim ulang.

**Hasil (2026-09-01).** Empat titik tulis terpasang: signup form, callback
Google OAuth, callback Duitku, dan pengambilan produk gratis. Semuanya
best-effort — keanggotaan yang gagal tercatat adalah satu baris yang hilang,
sementara melempar error di situ berarti signup gagal atau callback pembayaran
tidak dibalas 200.

`ensureSiteMembership` memakai `ignoreDuplicates`, bukan upsert yang menimpa:
pembelian kedua oleh Agent tidak boleh menjadikannya pembeli biasa. Sifat
itu diuji di database — sesudah dua kali "pembelian", role-nya tetap `admin` dan
barisnya tetap satu.

**Belum diverifikasi ujung-ke-ujung**: signup dan checkout sungguhan tidak
dijalankan di sesi ini (server action tidak bisa di-`curl` tanpa id action, dan
callback Duitku butuh signature). Yang terbukti: sifat penulisnya, dan keempat
titik panggilnya ada.

---

## Fase 6 — Delegasi fitur per-situs

**Tujuan.** `role_permissions` (`lib/role-permissions.ts`) sekarang **sengaja**
tidak di-scope per-situs: panel hanya dilayani domain kanonik, jadi kuncinya
tepat satu baris. Dengan Agent, itu tidak lagi cukup — tiap situs perlu
peta role→fitur sendiri.

**Perubahan.** Pindahkan kunci `role_permissions` ke per-`site_id`, dengan baris
kanonik sebagai default saat situs belum punya sendiri. Perbarui komentar di
`lib/actions/profiles.ts` yang menjelaskan kenapa dulu tidak di-scope — komentar
itu akan jadi salah, dan komentar yang salah lebih buruk daripada tidak ada.

**Hasil (2026-09-01).** Peta dibaca per-`site_id` dengan baris kanonik sebagai
cadangan, jadi situs yang belum pernah mengaturnya tidak kehilangan delegasinya
hanya karena barisnya belum dibuat. `/panel/roles` pindah dari `requireAdmin()`
ke `requireSiteAdmin()` — Agent mengatur delegasi di situsnya sendiri.

Diuji dengan seorang anggota biasa (bukan Agent — Agent lolos lewat
jalur lain dan tidak membuktikan apa pun soal peta ini):

| Keadaan | Hasil |
|---|---|
| `localhost` punya baris sendiri, `customer: []` | ditolak |
| baris `localhost` dihapus, kanonik memberi `inbox` | inbox tersaji |

Catatan alat ukur: `%{http_code}` **200 pada permintaan yang ditolak** — Next
menyelesaikan `redirect()` di server dan mengirim isi halaman tujuan. Yang
menentukan adalah BADAN responsnya (dashboard vs inbox), bukan status kodenya.

---

## Fase 7 — Pembersihan

**Selesai (2026-09-01).**

- Arti `lp_profiles.role` dipersempit jadi **platform saja**. Tidak ada perubahan
  bentuk — nilainya tetap sama; yang berubah janjinya. Ditulis sebagai
  `comment on column` (migration `20260901010000`) supaya ada di tempat orang
  berikutnya membacanya: databasenya sendiri, bukan hanya dokumen.
- `publisher_status` + KYC diputuskan **tingkat platform**: KTP, selfie, dan
  rekening bank itu milik orangnya, bukan milik satu storefront. Sekali disetujui,
  berlaku di mana pun dia jadi anggota.
- `CLAUDE.md` (**Auth & roles**) dan `docs/multi-domain.md` diperbarui.

---

## Sesudah fase 7: switcher jadi filter per-halaman (2026-09-01)

Switcher situs **dikeluarkan dari sidebar** dan jadi `<PanelSiteFilter />` di
halaman-halaman per-situs. Dua alasan:

1. Sidebar kini bisa diciutkan jadi rail 64px, dan select berisi hostname tidak
   punya versi 64px yang jujur — kontrolnya hilang persis saat layarnya paling
   lebar.
2. Filter ada gunanya di sebelah data yang difilter; di sidebar ia jauh dari
   angka yang berubah karenanya, dan halaman yang tidak terpengaruh pun ikut
   memajangnya.

**"Agent tidak perlu filter" tidak ditulis sebagai pengecekan role.**
Filternya tidak merender apa pun kalau cuma ada satu pilihan — dan manajer satu
situs memang cuma punya satu. Manajer yang memegang dua situs tetap dapat
filternya, dan itu benar. Satu aturan, tanpa daftar peran yang harus dijaga
sinkron.

Dua lubang lama ketahuan gara-gara ini: `/panel/plans` dan `/panel/links`
membaca **dan menulis** dengan `currentSiteId()` (host request), bukan cakupan
panel — jadi apa pun pilihan filternya, keduanya menyentuh situs kanonik.
Sekarang keduanya menerima `site.id` sampai ke form-nya. Filter yang tidak
memfilter apa-apa lebih buruk daripada tidak ada filter.

`/panel/products` **sengaja tidak** dapat filter: produk belum punya `site_id`
(lihat keputusan terbuka di bawah), jadi di situ filter akan berbohong.

---

## Keputusan yang masih terbuka

**Produk tidak punya pemilik situs.** `lp_landing_pages` **tidak punya kolom
`site_id`** — katalog tiap storefront cuma irisan dari `lp_sites.category_ids`.
Jadi "Agent mengelola produk situsnya" belum punya arti yang tegas: produk
yang dia buat bisa muncul di domain lain kalau kategorinya beririsan.

Tiga pilihan, semuanya butuh keputusan Anda sebelum fase 4 menyentuh produk:

1. **Tambah `lp_landing_pages.site_id`** (pemilik), katalog tetap ditentukan
   kategori. Paling jelas, dan backfill-nya bisa dari kategori yang ada.
2. **Biarkan bersama**, Agent hanya boleh menyunting produk yang masuk
   irisan kategorinya. Tidak ada migration, tapi aturannya kabur di tepi.
3. **Tunda** — fase 4 hanya mengurus anggota, produk tetap Company.

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
4. Panel hanya dilayani domain kanonik. Agent pun login di sana; sesi
   Supabase tidak lintas domain.
5. Verifikasi dari sisi server (`psql`, `curl` dengan sesi buatan sendiri —
   resep di skill `run-local`), bukan dari layar.
