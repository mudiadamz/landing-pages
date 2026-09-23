# Rencana: multi-business SaaS (Platform → Business → Customer)

> **Dokumen kerja.** Boleh berhenti kapan saja dan dilanjutkan sesi lain.
> Tiap fase berdiri sendiri: bisa di-deploy, punya cara verifikasi, dan tidak
> merusak apa pun kalau fase berikutnya tidak pernah dikerjakan.

Dibuat 2026-09-22. Status terakhir ada di tabel status di bawah — **itu
satu-satunya tempat status ditulis.** Jangan menambah catatan status di tempat
lain; salinan kedua pasti menyimpang.

Ini re-arsitektur besar: mengubah aplikasi dari **satu bisnis, banyak storefront
berbagi katalog** menjadi **banyak bisnis yang terisolasi**, dengan Platform yang
menagih pembeli lalu membagi hasil ke tiap bisnis. Baca [`docs/architecture.md`](../architecture.md)
dan [`hierarchical-users.md`](hierarchical-users.md) dulu — model lama
(Company/Agent/Customer/publisher) adalah titik berangkatnya.

---

## Cara melanjutkan (baca ini dulu)

1. Lihat tabel status. Ambil fase pertama yang belum ✅.
2. Kerjakan **satu fase saja**, verifikasi dengan cara yang ditulis di fase itu,
   commit, lalu centang tabelnya dalam commit yang sama.
3. Setiap migration baru: jalankan `pnpm db:migrate` lalu `pnpm test:db`.
4. Kalau kenyataannya berbeda dari dokumen, **perbaiki dokumen ini** di commit itu
   juga. Rencana yang salah lebih berbahaya daripada tidak ada.

---

## Istilah & bentuk data

| Istilah | Artinya | Di database (target) |
|---|---|---|
| **Platform** | Kamu, operator SaaS. Super-admin lintas bisnis, merchant of record, yang menagih & payout. | `lp_profiles.is_platform = true` |
| **Business** | Penjual. **Bisa perorangan atau perusahaan** (`business_type`). Unit isolasi: katalog, user, penjualan, billing, payout, punya storefront sendiri. | baris `lp_businesses` |
| **Storefront** | Satu domain/situs milik sebuah Business. Sebuah Business boleh punya beberapa. | `lp_sites` (kini `business_id`) |
| **Business member** | Orang yang bekerja di sebuah Business. `owner`/`admin` mengelolanya, `staff` bekerja di dalamnya. | `lp_business_members(business_id, user_id, role)` — `owner \| admin \| staff` |
| **Customer** | Pembeli. Ter-scope ke satu Business (terisolasi). | user + baris keanggotaan business-nya |

**Perbedaan dari model lama:**
- Batas isolasi pindah dari *situs* ke *business*. Katalog tidak lagi dibagi
  semua situs; tiap business punya katalognya sendiri.
- `account_type` (company/agent/customer) pensiun. "Company/Agent" lama →
  **Platform** (kamu) + **Business owner/admin**. "publisher" lama (perorangan
  yang jualan, KYC KTP) → **Business `individual`** — evolusi natural.
- Peran jadi **`(user, business) → role`** di `lp_business_members`, bukan jenis
  akun global.

---

## Model uang (Platform menagih, bagi hasil)

Platform = merchant of record: satu akun Duitku menerima semua pembayaran, lalu
saldo tiap business dikredit = harga − komisi.

- **Ledger double-entry immutable** (`lp_business_ledger`). Saldo = `SUM(amount)`,
  tidak ada kolom balance yang bisa desync. `kind ∈ sale | commission | payout |
  refund | adjustment | chargeback`.
- **Hold 14 hari**: dana masuk `pending`, jadi `available` setelah 14 hari —
  menutup jendela refund sebelum bisa di-payout. Ini yang mencegah saldo negatif.
- **Komisi flat %** per business (`lp_businesses.commission_pct`), bisa override
  per plan.
- **Payout**: dua jalur, satu set penjaga (`checkPayout`) dan satu riwayat
  (`lp_business_payouts`). "Catat manual" membukukan transfer yang sudah dilakukan
  manusia; "Kirim via Duitku" benar-benar mentransfer (Duitku Disbursement
  Transfer Online, `lib/disbursement.ts`). Ledger **didebit lebih dulu** di kedua
  jalur — debit itu yang mencegah dua request membelanjakan saldo yang sama.
- **Refund/saldo negatif**: hold menutup mayoritas; sisanya blokir payout +
  potong dari payout berikutnya.
- Callback Duitku ditulis ulang: idempoten per `(business, order)`, menulis
  **ledger + purchase**. Rekonsiliasi: uang di Duitku = Σ saldo business + Σ
  komisi platform.

**Dipakai ulang:** Duitku (1 merchant), sistem invoice, publisher-KYC → KYC
business/payout, multi-domain + Caddy on-demand TLS + `/api/tls-check`.

---

## Isolasi & RLS

- `business_id` di **semua** tabel data + policy `business_id = current_business()`.
- `current_business()` = perluasan resolver domain yang ada: `host → lp_sites →
  business_id`. Panel: dari keanggotaan business user + scope cookie.
- `is_platform` = bypass (kamu). Satu policy kelewat = kebocoran antar business,
  jadi permukaan RLS diuji (`tests/db/rls-*`).
- Migrasi aman: **backfill 1 business default dulu** (semua data existing masuk ke
  sana), `business_id` nullable → isi → baru nyalakan RLS `NOT NULL`.

> **Catatan Fase 2 (2026-09-22, dari percobaan yang di-revert).** Pendekatan
> "konteks ambient" — set `app.business_id` sebagai GUC per-request (Fase 1) lalu
> RLS restrictive `business_id = current_business()` — **tidak cukup**, karena
> katalog dibaca lewat `unstable_cache` (jalan di luar konteks request) dan lewat
> `Promise.all([currentSite(), getHomepageListing()])` (query jalan SEBELUM
> resolver sempat menyetel konteks). Akibatnya `current_business()` NULL saat
> pembacaan → policy restrictive menyembunyikan **seluruh** katalog. RLS-nya
> benar (tes isolasi hijau), tapi konteksnya tidak sampai ke jalur baca nyata.
>
> **Desain ulang yang direkomendasikan:** jangan andalkan GUC untuk *baca*.
> Teruskan `businessId` secara **eksplisit** sebagai argumen fungsi baca katalog
> (jadi bagian **cache key** `unstable_cache` + filter `.eq("business_id", …)`),
> di-resolve dari `currentSite()` sebelum dipanggil.
>
> **DITERAPKAN (2026-09-22, terverifikasi dengan 2 business nyata):**
> - `queryListing`/`getCachedListing`/`getHomepageListing`, `getCachedHomepagePages`,
>   `getLandingPageBySlug`, `getLandingPageForCheckout` semua menerima/menyaring
>   `site.business_id` (null = fallback: tanpa filter, jadi deployment 1-business
>   tak berubah). Sitemap ikut ter-scope lewat `getLandingPagesForHomepage`.
> - `createLandingPage` menyetel `business_id = (await editingSite()).business_id`
>   secara eksplisit (bukan default `current_business()`, karena server action
>   mungkin belum me-resolve situs).
> - Tulis lintas-business sudah dicegah policy "Owners …" yang berbasis `user_id`
>   (satu user hanya memiliki produk di business-nya). Jadi TIDAK menambah RLS
>   restrictive baca (yang tadi merusak cache) — isolasi baca di lapisan aplikasi.
>
> **User & storage (DITERAPKAN 2026-09-22):** view "semua user lintas-business"
> (`/api/admin/users?scope=all`) dan file manager Storage (`/panel/storage`,
> `listAllStorageFiles`/`deleteStorageFile`) kini di-gate `requirePlatform` — bukan
> `requireAdmin` — karena keduanya menembus batas business. Isolasi customer biasa
> sudah lewat keanggotaan situs (`site_id → business`); TIDAK ditambah filter
> `profile.business_id` karena customer boleh jadi anggota beberapa business.
>
> **Referensi antar-produk (DITERAPKAN 2026-09-23):** sebuah produk bisa menunjuk
> produk lain — `related_product_ids`, `next_product_id`, `bundle_product_ids` —
> dan id itu **disimpan**, tidak difilter. Yang berbahaya `bundle_product_ids`:
> `grantBundleItems` mengubah tiap id jadi baris `lp_purchases` sungguhan, jadi
> bundle yang memuat produk business lain = membagikan produk itu gratis.
> - **Tulis:** `updateLandingPagePricing` melewatkan ketiga field lewat
>   `scopeProductRefs` — id di luar business produk yang diedit dibuang sebelum
>   disimpan. Picker di panel bukan kontrol; request yang dirakit tangan tetap
>   lewat situ.
> - **Baca:** `getBundleItemIds` menyaring lagi terhadap business si bundle, supaya
>   baris lama (ditulis sebelum penyaring tulis ada) tidak jadi kepemilikan gratis.
>   `getBundleContaining` & `getNextInSeries` ikut di-scope `site.business_id`
>   seperti `getProductsByIds`.
> - `business_id` null tetap berarti "tanpa filter" (deployment 1-business).
> - Diuji di `tests/db/business-isolation.test.ts` (lapisan aplikasi, bukan RLS —
>   Fase 2 sudah memutuskan policy baca restrictive merusak cache).

---

## Skema target (ringkas)

```
lp_businesses(id, name, slug, business_type 'individual'|'company', status,
              plan, commission_pct, kyc_status, payout_bank_name,
              payout_bank_account, payout_bank_holder, created_at, updated_at)

lp_business_members(business_id, user_id, role 'owner'|'admin'|'staff',
                    created_at)   PK (business_id, user_id)

lp_business_ledger(id, business_id, kind, amount_cents, status 'pending'|'available',
                   order_ref, available_at, created_at)

+ business_id (uuid) di: lp_sites, lp_profiles, lp_landing_pages,
  lp_landing_page_categories, lp_purchases, lp_plan_orders, lp_site_settings, …
+ is_platform (boolean) di: lp_profiles
+ RLS di semua tabel: using (business_id = current_business() OR is_platform())
```

---

## Status fase

| Fase | Isi | Status |
|---|---|---|
| 0 | Tabel `lp_businesses` / `lp_business_members` / `lp_business_ledger`; `business_id` nullable + `is_platform`; backfill 1 business default. **Nol perubahan perilaku.** | ✅ |
| 1 | `current_business()` + scope panel & resolver ke business; `is_platform` untuk owner platform. | ✅ |
| 2 | Isolasi **katalog** per business (produk + **kategori** + related, via filter eksplisit + cache key; create set business_id) + **user & storage** (view lintas-business = Platform-only) + **referensi antar-produk** (related/next/bundle, tulis & baca). | ✅ |
| 3 | Ledger + komisi + hold ✅ · KYC (ajukan/approve) + payout (catat, min + KYC-gated) + refund (catat) ✅ · **integrasi disbursement (Duitku Transfer Online, `lp_business_payouts`, mati kalau env kosong)** ✅ | ✅ |
| 4 | Panel Platform (overview + saldo ledger) ✅ · signup business (approval-gated) + onboarding + provisioning domain saat approve ✅ · **notifikasi email approve/reject** ✅ | ✅ |
| 5 | Matriks peran per-business (`lp_businesses.role_permissions`, kolom Admin/Staff di `/panel/roles`); **`lp_profiles.account_type` dihapus** — kedudukan = `is_platform` + `lp_business_members.role`. | ✅ |

---

## Fase 5 — peran per-business, `account_type` pensiun (2026-09-23)

**Kenapa kolomnya harus pergi.** `account_type` satu nilai global yang menjawab
pertanyaan yang tidak pernah global: "boleh apa dia DI SINI". Selama satu business
itu tidak kelihatan salah. Dengan business kedua, setiap "Agent" otomatis jadi
Agent di semua business sekaligus — itu bukan model izin, itu ketiadaan model izin.

**Penggantinya, di tempat yang benar:**

| Lama | Baru |
|---|---|
| `account_type = 'company'` | `lp_profiles.is_platform` |
| `account_type = 'agent'` | `lp_business_members.role ∈ owner\|admin`, **per business** |
| `account_type = 'customer'` | tidak dua-duanya |

`lp_site_agents` **tetap ada**: itu delegasi per-situs DI DALAM sebuah business,
bukan jenis akun. `is_publisher` juga tetap, dan publisher tetap bukan jenis akun.

**Urutan migration (`20260923010000`) adalah isinya.** Backfill dulu — sampai
model baru memberi jawaban yang sama untuk semua orang yang sudah ada — baru
fungsi, baru policy, baru `drop column`. Membalik urutannya berarti ada jendela
waktu di mana semua orang jadi customer.
- Agent → `admin` di business pemilik situs yang **benar-benar dia kelola**
  (lewat `lp_site_agents`). Pasangan itulah yang dulu tidak bisa diungkapkan.
  Agent yang tidak mengelola situs mana pun jatuh ke business tertua (tempat
  backfill Fase 0 menaruh semua data lama), bukan hilang.

**Satu titik kompatibilitas, bukan sebelas.** `lp_get_my_profile_role()` tetap
bernama itu dan tetap mengembalikan `company | agent | customer` — sebelas policy
memanggilnya — tapi nilainya sekarang **diturunkan**, bukan dibaca. Menulis ulang
sebelas policy dalam satu migration adalah sebelas kesempatan menyalahkan aturan
RLS; kolomnya bisa pergi hari ini, kata-katanya bisa diperbaiki nanti, terpisah.
Catatan: `staff` → `'customer'` di fungsi itu, sengaja — kalau tidak, sebelas
policy diam-diam memberi staff hak kelola yang tidak pernah diputuskan siapa pun.

**Dua policy yang membaca kolomnya langsung ditulis ulang.**
`"Admin can read customer profiles"` → `"Platform reads non-platform profiles"`:
sedikit lebih luas dan memang benar — daftar user Platform selalu memuat pengelola
business (sudah begitu lewat service role), sementara akun Platform lain tetap di
balik satu langkah sengaja.

**Matriks peran per-business.** `lp_businesses.role_permissions` (jsonb):
`{admin: [...], staff: [...]}`. Owner **tidak ada** di matriksnya — owner yang bisa
dikunci dari business-nya sendiri itu tiket support, bukan fitur. Default (belum
pernah diatur) = admin semuanya, staff kosong: tiap Agent lama jadi business admin
lewat backfill, jadi default yang lebih ketat berarti mengambil menu dari orang
yang kemarin punya, tanpa ada yang memutuskan itu. `/panel/roles` jadi enam kolom
(Platform · Owner · Admin · Staff · Publisher · Customer) yang menyimpan ke **dua**
tempat: Admin/Staff ke business, Publisher/Customer ke situs.

**`requireFeature` jadi GABUNGAN**, bukan yang-pertama-cocok. Seseorang bisa punya
beberapa jalan masuk sekaligus (owner sebuah business yang juga publisher di
storefront lain); mengambil yang pertama cocok berarti *menambah* peran bisa
*mengurangi* izin, yang tidak akan pernah ditebak siapa pun.

**Verifikasi:** `pnpm test` (`tests/site-membership.test.ts` — termasuk "peran
business tidak ikut ke storefront business lain"; `tests/role-permissions.test.ts`
— default & "daftar kosong tersimpan menang atas default"), `pnpm test:db`
(`tests/db/rls-profiles.test.ts` — peta turunan `lp_get_my_profile_role()` dan
bukti kolomnya sudah tidak ada). Snapshot `rls-surface` diperbarui dengan sadar.

---

## Fase 4 — notifikasi keputusan (2026-09-23)

`approveBusiness`/`rejectBusiness` mengirim email lewat Resend
(`sendBusinessDecisionEmail`), **sesudah** status ditulis dan **tanpa** membuat
keputusannya gagal kalau Resend sedang mati: keputusan itu produknya, email cuma
kesopanan, dan approve yang melempar akan meninggalkan business aktif sementara
Platform mengira gagal. Tanpa `RESEND_API_KEY` fungsinya diam.

Alamat: `contact_email` yang diisi pemohon, cadangan `lp_profiles.email` si
`applied_by`. Email approve hanya menyebut domain yang **benar-benar** ter-provision
(host yang sudah dipakai orang lain tidak dijanjikan). Email reject **tidak
menyebut alasan** — alasannya memang tidak ada di data, jadi mengarangnya berarti
sistem mengaku tahu hal yang tidak dia tahu; diarahkan ke balasan email.

Nama business di-escape sebelum masuk HTML (`tests/business-decision-email.test.ts`).

---

## Fase 3 — disbursement (2026-09-23)

**Provider: Duitku**, bukan Xendit — merchant, kredensial, dan kebiasaan tanda
tangan Duitku sudah ada di sini; gateway kedua berarti hubungan bisnis kedua
untuk masalah yang sama.

**Mati secara default.** `DUITKU_DISBURSE_USER_ID/EMAIL/SECRET` kosong →
`disbursementConfig()` null → layar Platform cuma menampilkan "Catat manual",
persis seperti sebelum ini ada. Sandbox juga default; produksi harus diminta
(`DUITKU_DISBURSE_SANDBOX=false`).

**Aturan yang menentukan bentuk `lib/disbursement.ts`:** sesudah request
*transfer* dikirim, **"tidak tahu" bukan "gagal"**. Timeout, jawaban tak terbaca,
dan kode tunggu Duitku (`68`, `80`, `TO`) semuanya → `pending`, dan `pending`
**tidak pernah** mengembalikan saldo. Hanya penolakan eksplisit → `failed`, dan
di situ baris `adjustment` mengkredit balik. Kegagalan *inquiry* aman dianggap
gagal: belum ada uang yang bergerak.

**Kode bank, bukan nama bank.** `lp_businesses.payout_bank_code` (BI sandi,
`lib/bank-codes.ts`) dipilih dari daftar di `/panel/business`. Menebak "bca" →
"014" berarti salah kirim ke orang sungguhan; bank di luar daftar tetap boleh —
payout-nya manual.

**Idempotensi** ada di `lp_business_payouts.ledger_ref` (UNIQUE): satu payout per
baris debit ledger, jadi request yang diulang tidak bisa jadi transfer kedua.

**Verifikasi:** `pnpm test` (`tests/disbursement.test.ts` — matriks
sent/pending/failed), `pnpm test:db` (`tests/db/ledger.test.ts` — UNIQUE,
CHECK, cascade). Sebelum menyalakan produksi: satu transfer sandbox sungguhan,
karena tes memakai fetch tiruan dan tidak membuktikan tanda tangannya diterima
Duitku.

---

## Fase 0 — fondasi (tanpa perubahan perilaku)

**Tujuan:** menaruh tulang punggung multi-business tanpa mengubah apa pun yang
dilihat pengguna. Semua data existing menjadi milik **satu business default**.

**Perubahan:**
1. Migration baru (`db/migrations/<ts>_business_foundation.sql`):
   - Buat `lp_businesses`, `lp_business_members`, `lp_business_ledger` (RLS nyala,
     policy `to app` + grant ke role `app`, seperti tabel `lp_` lain).
   - Tambah kolom **nullable** `business_id uuid` ke tabel data utama, dan
     `is_platform boolean default false` ke `lp_profiles`.
   - Backfill: buat satu business default (dari situs kanonik), set `business_id`
     semua baris existing ke sana, dan tandai akun Platform `is_platform = true`.
2. Belum ada kode aplikasi yang membaca kolom baru → perilaku identik.

**Verifikasi:**
- `pnpm db:migrate` sukses; `pnpm test:db` hijau (termasuk snapshot RLS-surface
  yang diperbarui sadar untuk tabel baru).
- Query: setiap baris di tabel yang diberi `business_id` sudah terisi (tidak ada
  NULL) setelah backfill; satu baris `lp_businesses`; akun admin `is_platform`.
- Situs publik + panel tetap 200 dan tampak sama.

> Fase berikutnya (1+) mulai membaca `business_id`. Sampai itu terjadi, kolom ini
> hanya data yang menunggu.
