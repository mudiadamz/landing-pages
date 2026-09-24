# Domain milik pelanggan sendiri (bring your own domain)

Sebuah business mengarahkan `shop.mereksendiri.com` ke sini sendiri, lewat
`/panel/domains`, tanpa siapa pun mengedit berkas konfigurasi.

## Bentuknya

```
shop.mereksendiri.com ──CNAME──> edge.mbahgpt.com ──┐
                                                    ├──> VPS (Caddy)
mereksendiri.com ──────A────────> <IP edge> ────────┘      │
                                           reverse_proxy ──┘
                                                           ↓
                                               mesin ini (Next.js :3000)
```

Plus satu record kedua yang tidak membawa trafik sama sekali:

```
_adm-verify.shop.mereksendiri.com  TXT  adm-verify=<token acak>
```

**Hanya TXT yang memberi izin.** Record trafiknya diperiksa supaya panel bisa
memberi tahu pemiliknya sudah sampai mana, tapi sebuah domain tidak pernah
dilayani karena DNS-nya mengarah ke sini — mengarahkan DNS adalah hal yang bisa
dilakukan penyerang juga.

## Domain utama & subdomain — record-nya beda, keduanya diterima

| yang didaftarkan | record |
|---|---|
| `shop.mereksendiri.com` | **CNAME** → `edge.mbahgpt.com` |
| `mereksendiri.com` | **A** → IP edge (`CUSTOM_DOMAIN_IP`) |

Bukan pilihan kami: RFC 1034 mengharuskan apex sebuah zone memegang SOA dan NS,
dan CNAME tidak boleh berdampingan dengan record apa pun — jadi domain utama
tidak bisa jadi CNAME. Memberi pelanggan apex instruksi CNAME menghasilkan error
di registrar-nya tanpa penjelasan apa pun dari kita, dan itulah kenapa
`dnsInstruction()` di `lib/custom-domain.ts` yang memutuskan, sekali, bukan
masing-masing layar.

**Harga A record, disebutkan terang-terangan:** pelanggan itu terpaku ke satu IP.
Pindahkan edge dan semua domain utama patah sekaligus, sementara yang CNAME ikut
sendiri. Registrar yang punya ALIAS/ANAME atau CNAME flattening di apex mendapat
keduanya — dan itu ikut diterima, karena dari luar hasilnya resolve ke alamat
yang sama.

**Pemeriksaannya menanyakan ALAMAT, bukan jenis record.** `pointsHere()`
membandingkan hasil `resolve4()` dengan IP edge, jadi satu perbandingan mencakup
semua bentuk: CNAME ke edge, A langsung ke edge, dan apex yang di-flatten
provider. Memeriksa "apakah ada CNAME dan apakah cocok" akan melaporkan apex yang
sudah benar sebagai rusak. Lookup CNAME tetap ada sebagai cadangan untuk jendela
waktu saat record-nya sudah dibuat tapi targetnya belum menyebar.

`merek.co.id` **adalah** domain utama meski punya tiga label — `isApex()` tahu
itu lewat daftar suffix dua-tingkat, dan pemeriksaan jumlah label yang naif akan
salah mengiranya subdomain lalu mengirim pemiliknya membuat CNAME yang ditolak.

## Kenapa bukan lewat Cloudflare Tunnel saja

Tunnel tidak bisa. Kalau pelanggan meng-CNAME ke hostname kita yang di-proxy
Cloudflare, Cloudflare menerima permintaan untuk hostname yang tidak ada di zone
mana pun yang dia kenal dan menjawab **error 1014, "CNAME Cross-User Banned"** —
CNAME lintas-akun ditolak by design. Yang mencabut larangan itu hanya Cloudflare
for SaaS (berbayar per hostname). Karena itu edge-nya adalah VPS biasa dengan IP
publik, tidak di belakang proxy Cloudflare.

## Menyiapkan edge (sekali)

Langkah 1 & 4 di bawah sudah diotomatiskan:

```bash
scp scripts/setup-edge.sh ubuntu@<ip>:~/
ssh ubuntu@<ip> 'ORIGIN=origin.mbahgpt.com ACME_EMAIL=you@example.com sudo -E bash setup-edge.sh'
```

Skripnya idempoten dan mencetak laporan di akhir, termasuk apakah port 80/443
benar-benar terbuka. Yang tetap manual adalah yang memang di luar mesin itu:
security group, DNS, dan ingress tunnel. Urutan lengkapnya:

1. **VPS mana pun dengan IP publik**, port 80 & 443 terbuka **di security
   group**, bukan cuma di dalam mesin. AWS menutup keduanya secara bawaan, dan
   gejalanya membingungkan: SSH jalan, Caddy jalan, tapi tidak ada yang bisa
   menjangkaunya dan penerbitan sertifikat gagal tanpa pesan yang jelas.
2. Arahkan `edge.mbahgpt.com` **A** ke IP itu. Di Cloudflare: **grey cloud**
   (DNS only). Kalau di-proxy, Cloudflare yang menerima TLS-nya dan seluruh
   mekanisme di bawah tidak pernah jalan.
3. Beri VPS jalan masuk ke mesin ini. Termurah, karena tunnelnya sudah ada:
   tambah satu hostname di `/etc/cloudflared/config.yml` (di ATAS catch-all),
   lalu `cloudflared tunnel route dns <tunnel-id> origin.mbahgpt.com`:

   ```yaml
     - hostname: origin.mbahgpt.com
       service: http://localhost:3000
   ```

   Konsekuensi yang harus disadari: `origin.mbahgpt.com` jadi bisa diakses
   publik dan menyajikan situs kanonik. Bukan kebocoran data — aplikasi yang
   sama — tapi itu alamat kedua untuk toko sendiri. Alternatifnya WireGuard
   atau Tailscale antara kedua mesin (tanpa origin publik), atau Cloudflare
   Access di hostname itu dengan service token yang dibawa Caddy.
4. Jalankan `scripts/setup-edge.sh` (lihat atas). Ia memasang Caddy, menulis
   `/etc/caddy/Caddyfile`, memvalidasinya, dan menyalakan service-nya.
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
6. Sertifikatnya diterbitkan **sekarang, bukan saat pengunjung datang**.
   Tekan **Terbitkan sertifikat**, atau biarkan sapuan cron yang melakukannya.

## Penerbitan sertifikat: siapa yang memicunya

On-demand TLS menerbitkan sertifikat pada handshake HTTPS **pertama** untuk
sebuah host. Itu yang membuat seluruh mekanisme ini bekerja tanpa mengedit
konfigurasi — tapi kalau dibiarkan apa adanya, yang membayar harganya adalah
pengunjung pertama: permintaannya menggantung 10–30 detik, dan kalau gagal dia
yang melihat errornya, bukan pemilik toko.

Jadi handshake pertama itu **kita** yang melakukan:

- **Tombol** di `/panel/domains` (`warmCustomDomain`) — untuk pemilik yang
  sedang menunggu di depan layar.
- **Cron** `scripts/warm-domains.mjs` — untuk yang memasang record lalu tidur.
  Setiap 15 menit: `0,15,30,45 * * * *`.
- Pemeriksaan DNS juga memicunya sendiri begitu TXT dan CNAME dua-duanya hijau.

**Yang menentukan "siap" adalah header, bukan sertifikat.** Versi pertama
pemeriksa ini cuma menanyakan "apakah ada sertifikat sah untuk host ini", dan
melaporkan `techgalery.com` SIAP padahal DNS-nya masih ke Blogger — Google
menyajikan sertifikat yang sempurna sah untuk domain itu, begitu juga Cloudflare
untuk `mbahgpt.com`. Sertifikat yang sah membuktikan ada yang melayani domain
itu, bukan bahwa KITA yang melayaninya. Karena itu edge menstempel setiap
responsnya dengan `X-Adm-Edge`, dan itulah satu-satunya hal yang benar-benar
menjawab pertanyaannya.

Statusnya ada empat, dan `elsewhere` bukan kegagalan — itu keadaan normal domain
yang sudah terverifikasi tapi DNS-nya belum dipindahkan:

| status | artinya |
|---|---|
| `ready` | edge kita yang menjawab, HTTPS jalan |
| `issuing` | handshake timeout — biasanya Caddy sedang bicara dengan Let's Encrypt |
| `elsewhere` | HTTPS jalan, tapi yang menjawab bukan kita |
| `failed` | tidak bisa terhubung; alasannya disimpan di `cert_error` |

**Backoff 5 menit per domain.** Let's Encrypt membatasi 5 validasi GAGAL per
hostname per jam. Tombol yang bisa ditekan berkali-kali tanpa jeda adalah cara
tercepat mengunci diri sendiri dari domain sendiri selama sejam — dan itu akan
terlihat seperti bug kita, bukan seperti ketidaksabaran penekannya.

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
