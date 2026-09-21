# Image produksi untuk Next 16 (standalone) + pnpm.
#
# Tiga tahap: deps → builder → runner. Yang sampai ke image akhir hanyalah jejak
# standalone, aset statis, dan public/ — bukan node_modules lengkap dan bukan
# source-nya.

# ---------------------------------------------------------------------------
# deps — install sekali, di-cache selama lockfile tidak berubah
# ---------------------------------------------------------------------------
FROM node:22-slim AS deps
WORKDIR /app

# Debian slim, bukan Alpine. sharp dan binding native lain punya prebuilt glibc
# yang tinggal pakai; di musl mereka sering jatuh ke kompilasi dari sumber, dan
# itu memindahkan kegagalan ke tempat yang jauh lebih sulit dibaca.
RUN corepack enable

# Hanya berkas yang menentukan dependency. Menyalin seluruh repo di sini akan
# membatalkan cache layer install setiap kali satu baris kode berubah.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY scripts/only-pnpm.mjs ./scripts/only-pnpm.mjs

# --frozen-lockfile: build gagal kalau lockfile tidak cocok dengan package.json,
# alih-alih diam-diam me-resolve ulang dan menghasilkan image yang isinya beda
# dari yang diuji di mesin lokal.
#
# Tanpa cache mount BuildKit: mesin build di sini memakai builder klasik, dan
# Dockerfile yang hanya jalan dengan BuildKit tidak bisa diverifikasi di tempat
# ia ditulis.
RUN pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# builder
# ---------------------------------------------------------------------------
FROM node:22-slim AS builder
WORKDIR /app
RUN corepack enable

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* dibaca saat BUILD, bukan saat run.
#
# Next menyulih nilainya ke dalam bundle klien, jadi image yang sudah jadi
# membawa nilai yang dipakai saat membangunnya. Mengubahnya lewat
# `docker run -e` TIDAK berpengaruh pada apa pun yang berjalan di browser.
# Karena itu semuanya build arg, dan image untuk staging harus DIBANGUN ULANG —
# bukan dijalankan ulang dengan env yang berbeda. Tidak satu pun rahasia.
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_GTM_ID=""
ARG NEXT_PUBLIC_TAWK_PROPERTY_ID=""
ARG NEXT_PUBLIC_TAWK_WIDGET_ID=""
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY=""

ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_GTM_ID=$NEXT_PUBLIC_GTM_ID \
    NEXT_PUBLIC_TAWK_PROPERTY_ID=$NEXT_PUBLIC_TAWK_PROPERTY_ID \
    NEXT_PUBLIC_TAWK_WIDGET_ID=$NEXT_PUBLIC_TAWK_WIDGET_ID \
    NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY \
    NEXT_TELEMETRY_DISABLED=1

RUN pnpm build

# ---------------------------------------------------------------------------
# runner
# ---------------------------------------------------------------------------
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Bukan root. Kalau ada yang lolos sampai eksekusi kode di dalam container,
# batas berikutnya jangan "sudah root sejak awal".
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs nextjs

# Jejak standalone sudah membawa node_modules yang benar-benar dipakai server.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Dua ini TIDAK ikut tertelusur dan harus disalin sendiri. Kalau lupa: situsnya
# hidup, tapi tanpa CSS dan tanpa satu pun gambar.
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# Runner migration untuk service `migrate` di docker-compose.yml, dan alat
# cutover/latihan restore (docs/runbooks/cutover-supabase.md) yang dijalankan
# lewat `docker compose run app node scripts/…` — di dalam jaringan compose dan
# langsung ke volume /srv/storage. Hanya butuh `pg`, yang sudah ada di jejak
# standalone karena lib/backend memakainya.
COPY --from=builder --chown=nextjs:nodejs /app/scripts/migrate.mjs /app/scripts/storage-migrate.mjs /app/scripts/restore-verify.mjs ./scripts/
COPY --from=builder --chown=nextjs:nodejs /app/db/migrations ./db/migrations

# File unggahan (lib/backend/storage.ts). Direktori dibuat di sini dengan
# pemilik nextjs supaya volume bernama yang di-mount ke sini mewarisi pemiliknya;
# kalau tidak, volume baru milik root dan setiap unggahan gagal EACCES.
ENV STORAGE_ROOT=/srv/storage
RUN mkdir -p /srv/storage && chown nextjs:nodejs /srv/storage

USER nextjs
EXPOSE 3000

# Health check menunjuk /api/health, bukan "/" — halaman depan merender
# storefront lengkap beserta query-nya, dan itu mengukur database, bukan proses.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
