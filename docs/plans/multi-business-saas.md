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
| **Business member** | Orang yang **mengelola** sebuah Business. | `lp_business_members(business_id, user_id, role)` — `owner \| admin \| staff` |
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
- **Payout manual dulu**: batch mingguan, ada minimum, tombol "tandai sudah
  dibayar" menulis baris `payout`. Otomatis (Duitku Disbursement / Xendit)
  belakangan.
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
> **Sisa (belum diisolasi):** related/bundle products (minor). Harus ditutup sebelum
> business ke-2 benar-benar live (Fase 4).

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
| 2 | Isolasi **katalog** per business (produk + **kategori** + related, via filter eksplisit + cache key; create set business_id) + **user & storage** (view lintas-business = Platform-only). | ✅ |
| 3 | Ledger + komisi + hold (recording) ✅ · **payout + refund + KYC (pergerakan uang) ⬜ — sengaja belum, butuh review** | 🟡 recording saja |
| 4 | Panel Platform (overview + saldo ledger) ✅ · **signup business (approval-gated) + onboarding + provisioning domain saat approve** ✅ · notifikasi email approve/reject ⬜ | ✅ signup + approval |
| 5 | Matriks peran per-business; pensiunkan `account_type`. | ⬜ |

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
