#!/usr/bin/env bash
# Set up the TLS edge for customer domains, ON THE EDGE VPS.
#
#   scp scripts/setup-edge.sh Caddyfile ubuntu@<ip>:~/
#   ssh ubuntu@<ip> 'ORIGIN=origin.mbahgpt.com ACME_EMAIL=you@example.com sudo -E bash setup-edge.sh'
#
# What this box does, and all it does: terminate TLS for domains that customers
# point at it, and forward the request to the app with the ORIGINAL host intact.
# It renders nothing and stores nothing. Detail & rationale:
# docs/runbooks/custom-domains.md.
#
# Idempotent. Re-running updates the config and reloads; it does not reinstall
# Caddy or reissue certificates.
set -euo pipefail

ORIGIN="${ORIGIN:-origin.mbahgpt.com}"
ACME_EMAIL="${ACME_EMAIL:-}"

if [ -z "$ACME_EMAIL" ]; then
  echo "!! ACME_EMAIL wajib diisi — Let's Encrypt memakainya untuk peringatan kedaluwarsa." >&2
  exit 2
fi
if [ "$(id -u)" -ne 0 ]; then
  echo "!! jalankan dengan sudo -E (perlu -E supaya ORIGIN/ACME_EMAIL ikut terbawa)." >&2
  exit 2
fi

echo "==> origin : $ORIGIN"
echo "==> acme   : $ACME_EMAIL"

# 1. Caddy ------------------------------------------------------------------
if ! command -v caddy >/dev/null 2>&1; then
  echo "==> memasang Caddy"
  apt-get update -qq
  apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl gnupg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  apt-get install -y -qq caddy
else
  echo "==> Caddy sudah ada: $(caddy version | head -1)"
fi

# 2. Config -----------------------------------------------------------------
#
# Ditulis di sini, bukan menyalin Caddyfile repo apa adanya: berkas itu masih
# menunjuk `app:3000` (nama service Docker dari jalur deploy lama) dan tidak tahu
# apa-apa tentang origin. Yang dipertahankan persis adalah bagian yang penting —
# on_demand_tls dengan `ask`, dan kedua header X-Forwarded-*.
install -d -m 0755 /etc/caddy
cat > /etc/caddy/Caddyfile <<CADDY
# Dihasilkan scripts/setup-edge.sh — jangan diedit langsung, edit skripnya.
{
	email ${ACME_EMAIL}

	# Sertifikat diterbitkan saat permintaan PERTAMA untuk sebuah domain datang,
	# bukan saat Caddy start. Itu yang membuat "daftarkan domain di panel,
	# arahkan DNS, selesai" bekerja tanpa menyentuh berkas ini lagi.
	#
	# \`ask\` WAJIB. Tanpa itu siapa pun yang mengarahkan domainnya ke IP ini bisa
	# memaksa penerbitan sertifikat, dan rate limit Let's Encrypt dihitung PER
	# AKUN — beberapa ratus domain asal-asalan cukup untuk membuat domain yang
	# sah gagal memperbarui. Endpoint-nya hanya menjawab 200 untuk host yang
	# terdaftar, aktif, DAN terbukti dimiliki (lp_sites.verified_at).
	on_demand_tls {
		ask https://${ORIGIN}/api/tls-check
	}
}

# Satu blok untuk SEMUA host: \`https://\` tanpa nama domain berarti "host apa
# pun", dan on_demand di bawah yang memutuskan mana yang benar-benar dilayani.
https:// {
	tls {
		on_demand
	}

	encode zstd gzip

	# Stamps every response this edge serves.
	#
	# It is how the app answers "is this domain being served BY US yet", which a
	# certificate check alone cannot: a domain still pointed at its old host
	# presents a perfectly valid certificate from whoever runs that host. Without
	# this header the readiness check reports success for a domain we have never
	# served (lib/cert-check.ts).
	header X-Adm-Edge "1"

	reverse_proxy https://${ORIGIN} {
		# DUA header, dan menukarnya adalah kegagalan yang paling mudah terjadi:
		#
		#   Host             harus origin, supaya Cloudflare bisa merutekannya;
		#   X-Forwarded-Host harus domain pelanggan, karena ITU yang dibaca
		#                    lib/site-resolve.ts untuk memilih storefront.
		#
		# Tertukar = semua domain pelanggan menyajikan situs kanonik.
		header_up Host ${ORIGIN}
		header_up X-Forwarded-Host {host}
		header_up X-Forwarded-Proto {scheme}
	}
}

# http diarahkan ke https, kecuali tantangan ACME yang memang harus dijawab di
# port 80 — Caddy menangani pengecualian itu sendiri.
http:// {
	redir https://{host}{uri} permanent
}
CADDY

caddy fmt --overwrite /etc/caddy/Caddyfile >/dev/null 2>&1 || true
echo "==> memeriksa config"
caddy validate --config /etc/caddy/Caddyfile

# 3. Service ----------------------------------------------------------------
systemctl enable caddy >/dev/null 2>&1 || true
if systemctl is-active --quiet caddy; then
  echo "==> reload"
  systemctl reload caddy
else
  echo "==> start"
  systemctl start caddy
fi

# 4. Laporan ----------------------------------------------------------------
echo
echo "==> caddy: $(systemctl is-active caddy)"
echo "==> mendengarkan:"
ss -tlnp 2>/dev/null | grep -E ':80|:443' || echo "   (tidak ada — periksa security group / firewall)"
echo
echo "==> gerbang sertifikat, lewat origin:"
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "https://${ORIGIN}/api/tls-check?domain=nope.invalid" || echo "---")
echo "   domain asing  -> ${code}  (harus 404)"
echo
echo "Selanjutnya, di luar mesin ini:"
echo "  1. buka port 80 & 443 di security group VPS"
echo "  2. A record edge-nya -> IP mesin ini, DNS only (bukan proxied)"
echo "  3. CUSTOM_DOMAIN_TARGET di aplikasi menunjuk hostname itu"
