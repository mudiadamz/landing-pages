# MbahGPT — template chat

Port dari aplikasi mandiri `mbahgpt/` (Python stdlib + SQLite + Ionic) ke dalam
deployment ini: **frontend jadi satu template storefront**, **backend jadi route
handler + Server Actions di atas Supabase**.

Dokumen ini menjelaskan bentuk hasil port, **apa yang berubah dan kenapa**, serta
batasan yang lahir dari perpindahan itu. Aturan umum codebase tetap di
[`architecture.md`](architecture.md); yang di sini khusus fitur ini.

---

## 1. Peta berkas

```
lib/mbahgpt/                     inti, server-only (port modul Python)
  config.ts       env: model, temperature, batas, timeout   (qwen.py + .env)
  openrouter.ts   request builder + parser SSE              (qwen.py, server.py)
  memory.ts       tangkap "remember…" + peringkat relevansi (memory.py, murni)
  web-search.ts   deteksi kebutuhan search + eksekusi       (web.py)
  messages.ts     riwayat → payload OpenRouter + lampiran   (server.py)

lib/actions/chat.ts              sesi, prefs, memori (Server Actions, RLS)
app/api/mbahgpt/chat/route.ts    SATU giliran chat, streaming SSE
app/api/mbahgpt/attachment/[id]  lampiran → signed URL

lib/templates/mbahgpt/           frontend (port index.html)
  home.tsx        slot Home: chat satu layar penuh, tanpa header/footer
  chat-app.tsx    kerangka: sidebar, transkrip, komposer, scroll follow
  use-chat.ts     state semua balasan yang sedang berjalan
  transcript.tsx  gelembung pesan, panel "Berpikir", sumber, lampiran
  composer.tsx    kotak ketik + lampiran + tombol kirim/stop
  session-list.tsx  daftar sesi + menu ⋮ (ubah judul / hapus)
  prefs-dialog.tsx  4 tab: akun, tampilan & bahasa, instruksi jawaban, memori
  markdown.tsx    renderer keluaran model (tanpa HTML mentah)
  copy-button.tsx tombol salin (kode & jawaban)
  upload.ts       unggah lampiran langsung ke Storage
  chrome.tsx      header/footer tipis untuk halaman selain beranda
  category.tsx    slot Category & Categories

supabase/migrations/20260817000000_mbahgpt_chat.sql
```

Registry: kunci template **`mbahgpt`**. Set `lp_sites.template = 'mbahgpt'` untuk
domain yang mau memakainya (tanpa migration — lihat I12).

## 2. Mengaktifkan

1. Jalankan migration (`npm run db:push` atau `supabase migration up`).
2. Isi `OPENROUTER_API_KEY` di environment server. Variabel lain punya default —
   daftar lengkap + komentarnya ada di [`.env.example`](../.env.example).
3. Set `template` domainnya ke `mbahgpt` di `/panel/sites`.

Tanpa API key halaman tetap tampil dan berkata "Chat belum aktif": kunci yang
belum diisi itu keadaan deployment, bukan bug, dan pengunjung tidak bisa berbuat
apa-apa soal itu.

## 3. Alur satu pesan

```
browser                     app                          Supabase / OpenRouter
   │ upload lampiran ─────────────────────────────────▶ Storage (chat-attachments)
   │ POST /api/mbahgpt/chat {session_id, content, attachments[]}
   │                          ├─ auth + rate limit (hitung pesan 1 menit terakhir)
   │                          ├─ claim: answering_at = now()  ← kunci per sesi
   │                          ├─ heartbeat: answering_at = now() tiap 15 dtk
   │                          ├─ simpan pesan user + baris lampiran
   │                          ├─ tangkap "remember this…" → lp_chat_memories
   │                          ├─ system prompt = prefs + memori terpilih
   │ ◀── data:{status}        │
   │                          ├─ (kalau perlu) search 1 pesan terpisah ──▶ OpenRouter
   │ ◀── data:{sources,query} │
   │                          ├─ bangun ulang riwayat dari DB + lampiran
   │ ◀── SSE OpenRouter ──────┼──────────────────────────────────────────▶ OpenRouter
   │                          ├─ simpan jawaban SEBELUM stream ditutup
   │                          └─ answering_at = null
   │ reload transkrip via Server Action, refresh sidebar
```

Browser hanya mengirim **satu pesan baru**; konteks dibangun ulang dari Postgres
tiap giliran. Karena itu reload, tab kedua, dan perangkat lain melihat percakapan
yang sama — klien tidak menyimpan riwayat sendiri.

**Kenapa simpan sebelum menutup stream.** Klien me-refresh sidebar begitu response
berakhir. Kalau penyimpanan terjadi setelahnya, sidebar membaca hitungan basi —
chat 2 pesan tampil "1 msg". Bug ini sudah pernah terjadi di versi Python; urutan
yang sama dipertahankan di sini.

## 4. Model data

Semua tabel `lp_chat_*`, semuanya punya `user_id` dan RLS owner-only. Yang berubah
dari skema SQLite lama, dan alasannya, ditulis di kepala file migration.

| Tabel | Isi |
|---|---|
| `lp_chat_sessions` | judul, model, `site_id`, **`answering_at`** (kunci jawab) |
| `lp_chat_messages` | role user/assistant, content, `reasoning`, `sources` |
| `lp_chat_prefs` | satu baris per user: `response_instructions` |
| `lp_chat_memories` | fakta yang diingat, `pinned`, unik per user (case-insensitive) |
| `lp_chat_attachments` | metadata berkas; byte-nya di bucket `chat-attachments` |

Peran `system` **tidak pernah** disimpan — selalu diturunkan dari prefs + memori +
konteks search, jadi mengubah instruksi langsung berlaku ke chat lama.

## 5. Paket pengguna

Chat ini tidak gratis untuk dijalankan, jadi apa yang boleh dipakai ditentukan
paket: **Free / Pro / Business / Enterprise**.

| | Free | Pro | Business | Enterprise |
|---|---:|---:|---:|---:|
| Pesan / 24 jam | 20 | 300 | 2.000 | ∞ |
| Pencarian web | — | ✓ | ✓ | ✓ |
| Lampiran/pesan | 1 | 6 | 6 | 12 |
| Riwayat dikirim | 20 | 40 | 80 | 160 |
| Produk (marketplace) | 1 | 20 | 100 | ∞ |

Angka di atas adalah **bawaan**, bukan hukumnya. Semuanya — termasuk saklar
pencarian web — bisa diubah per storefront di `/panel/plans`
(`lp_site_settings` key `plan_limits`), tanpa deploy. Yang tetap di
`lib/plans.ts` adalah **defaultnya**, dan itu penting: setting yang belum ada,
yang rusak formatnya, dan storefront yang belum pernah membuka layar itu semuanya
jatuh ke sana, jadi aplikasi tidak pernah kehabisan jawaban untuk "orang ini boleh
kirim berapa pesan".

Yang perlu diketahui sebelum mengubahnya:

- **Kunci paketnya tetap kode** (I12): `lp_profiles.plan` cuma menyimpan kuncinya,
  dan kunci tak dikenal dibaca sebagai `free`. Yang jadi data adalah batasnya,
  bukan daftar paketnya.
- **Batas per-situs, paket per-akun.** Pro-nya seseorang berlaku di semua
  storefront, tapi apa isi Pro ditentukan storefront yang sedang dipakai — karena
  tagihan modelnya jatuh ke pemilik domain itu.
- **Semua penegakan lewat `resolvePlanLimits()`**, tidak pernah `PLANS[x].limits`
  langsung. Pemanggil yang membaca registry mentah akan diam-diam mengabaikan apa
  yang diketik pemiliknya di panel.
- **Langit-langit deployment tetap menang.** `OPENROUTER_MAX_FILES` dan
  `OPENROUTER_MAX_HISTORY` adalah batas server terhadap dirinya sendiri; angka
  lebih besar di panel tidak melewatinya.
- **Kuota memakai jendela 24 jam berjalan**, bukan reset tengah malam — tengah
  malam itu pertanyaan zona waktu yang deployment multi-domain ini tidak punya
  jawabannya.
- **Pencarian web mati di Free** karena di situ biayanya: flat ~$0.007 per
  pencarian, jadi satu pengguna gratis yang mencari bisa lebih mahal dari seratus
  yang mengobrol. UI mengatakannya, tidak diam-diam menjawab dari data latih.
- **Paket hanya boleh mempersempit** langit-langit deployment
  (`OPENROUTER_MAX_FILES`, `OPENROUTER_MAX_HISTORY`), tidak pernah melebarkan.
- **Semua pembaca lewat `effectivePlan()`**, tidak pernah kolomnya langsung: baris
  Pro yang masa aktifnya lewat tetap tertulis "pro". Kedaluwarsa dibaca saat baca,
  bukan disapu cron.
- **Batas produk dicek saat BUAT saja.** Akun yang turun paket tetap memegang yang
  sudah terbit — menurunkan produk dari peredaran karena langganan habis menghukum
  pembelinya, bukan penjualnya.

Harga **per bulan** dan **per storefront**: `lp_site_settings` key `plan_prices`,
diedit di `/panel/plans`. Nol berarti belum dijual (tombol beli tidak muncul),
bukan gratis. Paketnya sendiri global per akun — yang membeli Pro di satu
storefront adalah Pro di semua, karena kebalikannya mustahil dijelaskan ke
pelanggan.

Alur beli: `/upgrade` → `POST /api/plans/create-invoice` (menulis baris `pending`
di `lp_plan_orders`, lalu invoice Duitku ber-prefix `PL_`) → callback Duitku yang
sama dengan produk, dibedakan lewat prefix itu. Perpanjangan **menambah** masa
aktif kalau paketnya sama dan masih jalan; pindah paket mulai dari sekarang.
`merchant_order_id` UNIQUE — callback yang dikirim ulang tidak menambah sebulan
lagi untuk satu pembayaran.

Admin bisa memberi paket langsung di `/panel/users`. Yang diberi tangan **tidak**
kedaluwarsa (`plan_expires_at` dikosongkan): itu keputusan, bukan penjualan sebulan.

## 6. Bahasa

Seluruh teks antarmuka ada di kamus, prefix **`chat.*`** (`lib/i18n/id.ts` +
`en.ts`). Komponen klien memakai `useT()`, komponen server `translator(locale)`,
route dan action `t(key, vars, locale)` dengan locale hasil `requestLocale()`.

Dua hal yang sengaja **tidak** ikut kamus:

- **Nama produk** ("MbahGPT") — itu merek, bukan teks yang diterjemahkan.
- **Teks prompt** di `lib/mbahgpt/*` — instruksi search, penanda isi berkas,
  petunjuk follow-up. Semua itu dibaca **model**, bukan pembaca, dan seluruhnya
  ditulis dalam bahasa Inggris supaya konsisten. Model tetap menjawab dalam bahasa
  penanya karena itu ditentukan oleh pesan penggunanya sendiri.

Pemilih bahasa duduk di **header sidebar**, bukan di footer seperti tema lain:
halaman depan tema ini tidak punya footer sama sekali (komposer yang memegang tepi
bawah layar), jadi tanpa itu pengunjung tidak punya jalan untuk mengganti bahasa.

## 7. Keputusan yang dibawa utuh dari aplikasi asli

Ini yang lahir dari pengukuran, bukan selera. Jangan "disederhanakan" tanpa
mengukur ulang.

- **Search jalan sebagai request terpisah berisi satu pesan user.** Plugin web
  OpenRouter menempelkan hasil sebagai system message di AKHIR array, dan semua
  provider yang melayani `qwen3.8-27b` menolaknya dengan *"System message must be
  at the beginning"* begitu ada riwayat atau system prompt. Artinya search selalu
  gagal untuk chat lanjutan. Efek samping yang menguntungkan: query jadi milik
  kita, jadi bisa dijangkarkan ke pesan pembuka sesi.
- **`OPENROUTER_WEB_RESULTS` bukan tuas penghematan.** Terukur: OpenRouter menagih
  **flat ~$0.007 per pencarian**, berapa pun jumlah hasilnya. Yang menentukan biaya
  adalah seberapa **sering** search jalan — itu gunanya deteksi kata kunci.
- **Tiga jalur lampiran**: gambar sebagai `image_url`, PDF lewat plugin
  `file-parser` (terukur tanpa biaya tambahan), teks disisipkan langsung.
  Lampiran ikut dikirim ulang tiap giliran — itu sebabnya pertanyaan lanjutan soal
  gambar tetap terjawab, dan sebabnya chat panjang berisi gambar jadi mahal.
- **Riwayat dipotong dari TENGAH**, pesan pembuka selalu dipertahankan: pesan itu
  yang menjangkarkan follow-up pendek seperti "final ucl".
- **Jangkar query sekarang BERGERBANG** — ini satu-satunya tempat yang sengaja
  menyimpang dari aplikasi asli. Versi lama menempelkan pesan pembuka ke setiap
  pesan pendek (≤6 kata), dan itu langsung terlihat salah begitu dijalankan
  sungguhan (18 Agu 2026): sesi yang dibuka dengan "apa itu row level security di
  Postgres?" lalu ditanya "siapa juara Liga Champions terbaru?" mencari kedua
  kalimat sekaligus dan dijawab dokumentasi PostgreSQL. Sekarang penempelan hanya
  terjadi kalau pesan barunya memang bergantung pada giliran sebelumnya: berbagi
  kata topik, memakai rujukan balik ("gol**nya**", "itu"), atau tidak menyebut
  subjek apa pun ("versi terbaru?"). Kata sapaan dan basa-basi pertanyaan tidak
  pernah ikut terbawa. Sisa lubangnya jujur: pengetikan huruf kecil semua
  ("siapa juara liga champions terbaru?") terbaca seperti tanpa subjek dan tetap
  ditempel — sama seperti perilaku lama, bukan kemunduran baru. Aturannya
  dikunci di `tests/mbahgpt-web-search.test.ts`.
- **Model & temperature dari environment**, tidak dari UI, dan nilai dari klien
  diabaikan.
- **Renderer tidak pernah menerima HTML mentah.** Di versi lama itu aturan "jangan
  `innerHTML`"; di sini React yang menjaminnya, dan tidak ada
  `dangerouslySetInnerHTML` di jalur keluaran model. Aturan `_underscore_` bukan
  italic, daftar TLD terkurasi, dan `@handle` butuh konteks platform — semuanya
  ikut, karena semuanya lahir dari kasus nyata di percakapan teknis.
- **Auto-scroll hanya kalau pembaca sedang di dasar** (toleransi 60 px), dan pil
  "↓ Terbaru" memakai penetapan `scrollTop` langsung — `behavior:"smooth"` diam-diam
  tidak bekerja di sebagian konteks browser dan itu menyembunyikan tombolnya tanpa
  memindahkan tampilan.
- **Panel "Berpikir" tertutup dengan penghitung detik.** Model thinking pernah
  terukur diam 95 detik; diam tanpa kabar terasa seperti hang, tapi menampilkan
  seluruh isi pikirannya mengganggu.

## 8. Yang berubah karena pindah platform

| Versi Python | Di sini | Alasan |
|---|---|---|
| SQLite lokal, satu pengguna | Postgres + RLS per user | satu deployment melayani banyak pengunjung |
| Lampiran BLOB di `chats.db` | Supabase Storage (bucket privat) | baris Postgres direplikasi & di-backup; unggahan lewat browser langsung karena body function dibatasi ~4.5 MB |
| Lock sesi di memori proses | kolom `answering_at` + heartbeat 15 dtk, basi setelah 4 ketukan | request berikutnya bisa mendarat di instance lain; lock yang mati harus melepas dirinya sendiri, dan satu-satunya bukti "masih hidup" yang bisa dibaca request lain adalah stempel yang terus bergerak |
| Rate limit per IP di memori | hitung pesan user 1 menit terakhir di Postgres | instance ephemeral, dan banyak orang berbagi IP di belakang NAT |
| CSRF/Host pinning, token UI, CSP nonce sendiri | auth Supabase + cookie SameSite + header aplikasi | ancamannya beda: ini bukan lagi port di `127.0.0.1` |
| `prefs (key, value)` | satu baris per user, kolom bernama | migration di sini normal; key salah ketik = no-op senyap |

## 9. Batasan yang diketahui

1. **Tidak ada resume stream.** `server.py` memproduksi jawaban di thread pekerja
   yang menulis ke buffer memori, jadi halaman bisa reload di tengah jawaban lalu
   menyambung lewat `GET /api/stream/<id>`. Tidak ada proses panjang di sini untuk
   memegang buffer itu. Gantinya: **jawaban parsial ikut disimpan** saat pembaca
   putus, jadi yang sudah diproduksi ada di transkrip setelah reload — yang hilang
   hanya kelanjutan tokennya. Kalau ini jadi masalah nyata, jalan keluarnya adalah
   menulis potongan ke tabel dari worker terpisah, bukan menghidupkan lagi buffer.

   Yang **tidak** boleh terjadi dan dulu terjadi: reload meninggalkan `answering_at`
   terisi, lalu sesi itu menolak setiap pesan berikutnya dengan "sedang menjawab"
   selama 2,5 menit — dan reload lagi tidak menolong, karena kuncinya baris Postgres,
   bukan sesuatu yang dipegang tab. Sekarang giliran yang hidup men-stempel ulang
   kuncinya sendiri, jadi kunci yang ditinggal mati lepas empat ketukan kemudian; dan
   selama kunci itu masih ada, komposer ditutup dengan alasannya (`chat.answeringElsewhere`)
   lalu menunggu sambil polling, bukan mengundang pesan yang pasti ditolak 409.
2. **Eksekusi skrip (`tools.py`) dihapus.** Butuh `subprocess` + rlimit + direktori
   kerja yang bisa ditulis; runtime serverless tidak punya satupun. Fitur ini juga
   opt-in dan mati secara default di aplikasi asli.
3. **Prompt injection lewat hasil search** masuk ke system prompt. Tidak ada
   perbaikan tuntas; risikonya lebih kecil di sini karena model tidak bisa
   menjalankan apa pun (batasan 2).
4. **Pemeringkatan memori leksikal, bukan semantik.** "shell" tidak akan menemukan
   "zsh". Itu gunanya pin.
5. **Batas total lampiran per pesan tidak sepenuhnya dipaksakan.** Yang benar-benar
   ditegakkan adalah `file_size_limit` bucket (8 MB per berkas) dan jumlah berkas;
   `size` yang dikirim browser hanya dipakai untuk UI dan total berjalan.
6. **`maxDuration` route dibatasi paket hosting.** Jawaban yang melewati batas itu
   terpotong — dan bagian yang sudah masuk tetap tersimpan.
7. **Lampiran diunduh ulang dari Storage tiap giliran** untuk dibentuk jadi data
   URI. Ini menjaga perilaku asli (follow-up soal gambar tetap terjawab) dengan
   ongkos latensi pada chat panjang berlampiran banyak.

## 10. Menguji perubahan

Belum ada test runner di repo ini. Yang dipakai saat port:

```bash
npx tsc --noEmit -p tsconfig.json        # tipe
npx eslint lib/mbahgpt lib/templates/mbahgpt lib/actions/chat.ts app/api/mbahgpt
npx vitest run tests/mbahgpt-web-search.test.ts           # aturan query pencarian
npx vitest run tests/i18n.test.ts tests/i18n-en.test.ts   # kamus: key mati, duplikat
npm run i18n:scan                        # string yang masih hardcode
npm run build; echo $?                   # cek EXIT CODE, bukan teks "Compiled"
curl -s -X POST localhost:3000/api/mbahgpt/chat -d '{"content":"halo"}' \
  -H 'Content-Type: application/json'    # tanpa sesi → 401
```

Untuk perubahan UI: jalankan `npm run dev`, set satu domain lokal ke template
`mbahgpt`, dan periksa juga di lebar ponsel (±414 px) — sidebar berubah jadi drawer
di bawah breakpoint `md`.
