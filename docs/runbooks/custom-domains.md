# Domain milik pelanggan sendiri (bring your own domain)

Sebuah business mengarahkan `shop.mereksendiri.com` ke sini sendiri, lewat
`/panel/domains`, tanpa siapa pun mengedit berkas konfigurasi.

## Bentuknya

```
shop.mereksendiri.com ──CNAME──> edge.mbahgpt.com ──A──> VPS (Caddy)
                                                          │
                                        reverse_proxy ────┘
                                                          ↓
                                              mesin ini (Next.js :3000)
```

Plus satu record kedua yang tidak membawa trafik sama sekali:

```
_adm-verify.shop.mereksendiri.com  TXT  adm-verify=<token acak>
```

**Hanya TXT yang memberi izin.** CNAME diperiksa supaya panel bisa memberi tahu
pemiliknya sudah sampai mana, tapi sebuah domain tidak pernah dilayani karena
DNS-nya mengarah ke sini — mengarahkan DNS adalah hal yang bisa dilakukan
penyerang juga.

## Kenapa subdomain saja, bukan domain utama

CNAME tidak boleh dipasang di apex (RFC 1034: apex wajib memegang SOA/NS). Jadi
pelanggan apex butuh A record, dan itu memaku mereka ke sebuah IP yang tidak bisa
kita ganti lagi tanpa mematikan semuanya sekaligus. Jalan keluarnya (ALIAS/ANAME/
CNAME flattening) ada di mungkin sepertiga registrar, dan yang tidak punya
menghasilkan tiket support yang berakhir dengan "registrar Anda tidak bisa".

`lib/custom-domain.ts` menolak apex, **termasuk** yang berlabel tiga seperti
`merek.co.id` — itu apex meski punya tiga label, dan pemeriksaan jumlah-label
yang naif akan meloloskannya.

## Kenapa bukan lewat Cloudflare Tunnel saja

Tunnel tidak bisa. Kalau pelanggan meng-CNAME ke hostname kita yang di-proxy
Cloudflare, Cloudflare menerima permintaan untuk hostname yang tidak ada di zone
mana pun yang dia kenal dan menjawab **error 1014, "CNAME Cross-User Banned"** —
CNAME lintas-akun ditolak by design. Yang mencabut larangan itu hanya Cloudflare
for SaaS (berbayar per hostname). Karena itu edge-nya adalah VPS biasa dengan IP
publik, tidak di belakang proxy Cloudflare.

## Menyiapkan edge (sekali)

1. **VPS mana pun dengan IP publik**, port 80 & 443 terbuka.
2. Arahkan `edge.mbahgpt.com` **A** ke IP itu. Di Cloudflare: **grey cloud**
   (DNS only). Kalau di-proxy, Cloudflare yang menerima TLS-nya dan seluruh
   mekanisme di bawah tidak pernah jalan.
3. Salin `Caddyfile` dari repo ini ke VPS. Yang perlu diganti hanya alamat
   backend-nya: `reverse_proxy app:3000` → alamat mesin ini. Paling aman lewat
   tunnel/WireGuard, bukan port 3000 yang terbuka ke internet.
4. Set `ACME_EMAIL`, jalankan Caddy.
5. Di mesin ini: `CUSTOM_DOMAIN_TARGET=edge.mbahgpt.com` (defaultnya memang itu).

`Caddyfile` yang sudah ada di repo **tidak perlu diubah selain backend-nya**. Ia
sudah memakai `on_demand_tls` dengan `ask http://…/api/tls-check`, dan itulah
yang membuat "daftarkan domain, arahkan DNS, selesai" bekerja tanpa restart.

### `ask` itu wajib, dan sekarang lebih ketat

`/api/tls-check` menjawab 200 hanya untuk host yang **terdaftar, aktif, DAN
`verified_at` terisi**. Syarat ketiga ditambahkan bersama pendaftaran
self-service: rate limit Let's Encrypt dihitung **per akun**, jadi tanpa itu satu
orang yang mendaftarkan beberapa ratus domain asal-asalan bisa menghabiskan jatah
sertifikat seluruh server — dan yang gagal memperbarui adalah domain yang sah.

## Alur dari sisi pelanggan

1. Owner business buka **/panel/domains**, ketik `shop.mereksendiri.com`.
   Barisnya dibuat `active = false`, `verified_at = null` — terdaftar, inert.
2. Panel menampilkan dua record, lengkap dengan tombol salin.
3. Dia pasang keduanya di registrar-nya.
4. Tekan **Cek sekarang**. Panel melaporkan kedua record **terpisah**, karena
   keduanya gagal karena sebab berbeda dan punya perbaikan berbeda.
5. TXT cocok → `verified_at` terisi dan `active` dinyalakan **sekali**.
   Sesudah itu `active` tidak pernah disentuh lagi oleh pemeriksaan: tombol itu
   ditekan pemilik domain, dan ia tidak boleh membatalkan keputusan admin yang
   mematikan sebuah storefront.
6. Permintaan pertama ke `shop.mereksendiri.com` memicu Caddy meminta
   sertifikat; `/api/tls-check` menjawab 200; situsnya hidup.

**Verifikasi adalah kait satu arah.** Sekali terbukti, pemeriksaan berikutnya
yang gagal — DNS provider sedang buruk, resolver timeout — tidak mencabutnya.
Mencabut domain adalah tindakan sengaja, bukan sesuatu yang dilakukan NXDOMAIN
sesaat atas nama kita.

## Batas yang disengaja

- **Hanya owner business** yang boleh menambah domain (bukan staff).
  `lp_sites.host` unik secara global, jadi kesalahan di sini tidak bisa
  dibatalkan oleh orang yang melakukannya.
- **Tidak ada batas jumlah domain per business** — belum ada di `lib/plans.ts`.
  Kalau ini dibuka untuk publik, itu hal pertama yang perlu ditambahkan.
- **Tidak ada pemeriksaan berkala.** Status hanya diperbarui saat tombol
  ditekan. Cukup untuk onboarding; kalau nanti perlu tahu domain yang mati,
  itu cron tersendiri.
- **Tidak ada `www` otomatis.** `shop.merek.com` dan `www.shop.merek.com` adalah
  dua baris.
