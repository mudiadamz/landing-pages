#!/bin/sh
# Backup database + file unggahan dari server produksi.
#
#   scripts/backup.sh [folder-tujuan]        # default /srv/backups
#
# Dijalankan dari folder repo di server (tempat docker-compose.yml), idealnya
# dari cron:
#
#   15 3 * * *  cd /srv/landing_pages && scripts/backup.sh >> /var/log/lp-backup.log 2>&1
#
# Menghasilkan dua berkas bertanggal:
#   db-<waktu>.dump        pg_dump format custom (pg_restore), skema + data
#   storage-<waktu>.tgz    isi /srv/storage (semua file unggahan)
#
# Backup di disk yang sama dengan database hanya melindungi dari kesalahan,
# bukan dari hilangnya server. Isi RCLONE_REMOTE (mis. "b2:lp-backup") dan
# pasang rclone di host untuk menyalinnya keluar. Backup yang belum pernah
# di-restore belum terbukti ada: scripts/restore-drill.mjs.
set -eu

DEST="${1:-/srv/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$DEST"

# Ke berkas sementara dulu, baru di-rename: backup yang gagal di tengah tidak
# boleh terlihat seperti backup yang berhasil.
docker compose exec -T db pg_dump -U postgres -d lp -Fc > "$DEST/db-$TS.dump.part"
mv "$DEST/db-$TS.dump.part" "$DEST/db-$TS.dump"

docker compose exec -T app tar -C /srv/storage -czf - . > "$DEST/storage-$TS.tgz.part"
mv "$DEST/storage-$TS.tgz.part" "$DEST/storage-$TS.tgz"

echo "$(date -u +%FT%TZ) backup: $(du -h "$DEST/db-$TS.dump" | cut -f1) db, $(du -h "$DEST/storage-$TS.tgz" | cut -f1) storage"

find "$DEST" -name 'db-*.dump' -mtime +"$KEEP_DAYS" -delete
find "$DEST" -name 'storage-*.tgz' -mtime +"$KEEP_DAYS" -delete

if [ -n "${RCLONE_REMOTE:-}" ]; then
  rclone copy "$DEST" "$RCLONE_REMOTE" --include "db-$TS.dump" --include "storage-$TS.tgz"
  echo "$(date -u +%FT%TZ) disalin ke $RCLONE_REMOTE"
fi
