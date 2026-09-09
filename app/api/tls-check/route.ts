import { NextResponse } from "next/server";
import { listSites, normalizeHost } from "@/lib/site-resolve";

/**
 * Endpoint `ask` untuk on-demand TLS milik Caddy.
 *
 * Caddy memanggil ini SEBELUM menerbitkan sertifikat untuk sebuah domain:
 * 200 = terbitkan, apa pun selain itu = tolak. Inilah yang menggantikan
 * "tambahkan domain ke project" milik Vercel — domain baru cukup diarahkan
 * DNS-nya, dan sertifikatnya terbit sendiri saat permintaan pertama datang.
 *
 * **Kenapa ini wajib ada dan tidak boleh selalu 200.** Tanpa gerbang, siapa pun
 * yang mengarahkan domainnya ke IP server ini bisa memaksa Caddy meminta
 * sertifikat untuk domain itu — dan Let's Encrypt punya rate limit per akun.
 * Beberapa ratus domain asal-asalan sudah cukup untuk membuat server ini
 * kehabisan jatah, lalu domain yang SAH gagal memperbarui sertifikatnya. Jadi
 * jawabannya diambil dari `lp_sites`: hanya domain yang memang terdaftar.
 *
 * Terbuka tanpa autentikasi karena Caddy memanggilnya sebelum ada TLS sama
 * sekali. Yang bocor cuma "apakah host ini terdaftar", dan itu sudah bisa
 * dijawab siapa pun dengan membuka domainnya.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const host = normalizeHost(new URL(req.url).searchParams.get("domain"));
  if (!host) return new NextResponse("no domain", { status: 400 });

  // listSites() sudah di-memo per request; daftarnya kecil dan ini cuma
  // dipanggil sekali per domain per penerbitan sertifikat, bukan per request.
  const known = (await listSites()).some((s) => s.host === host && s.active);

  return known
    ? new NextResponse("ok", { status: 200, headers: { "cache-control": "no-store" } })
    : new NextResponse("unknown domain", { status: 404 });
}
