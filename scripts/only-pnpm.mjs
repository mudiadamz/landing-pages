/**
 * Repo ini memakai pnpm. Skrip ini menghentikan `npm install` / `yarn` sebelum
 * sempat merusak apa pun.
 *
 * Bukan soal selera manajer paket. Pin keamanan repo ini ada di
 * `pnpm-workspace.yaml`, dan npm tidak membacanya — waktu repo pindah ke pnpm,
 * persis itu yang terjadi: pin `epubjs > @xmldom/xmldom@^0.9.10` hilang dan
 * 0.7.13 (versi ber-CVE) masuk kembali tanpa satu pun pesan error.
 *
 * npm juga akan memasang node_modules yang di-hoist, yang menyembunyikan
 * dependency yang tidak pernah dideklarasikan — begitulah `pdfjs-dist` sempat
 * dipakai bertahun-tahun tanpa ada di package.json.
 *
 * Jadi konfigurasinya hanya ada satu salinan, dan jalur yang salah gagal keras
 * di sini alih-alih berhasil setengah-setengah.
 */
const agent = process.env.npm_config_user_agent ?? "";

if (!agent.startsWith("pnpm/")) {
  const used = agent.split("/")[0] || "manajer paket lain";
  console.error(
    `\n  Repo ini memakai pnpm, bukan ${used}.\n\n` +
      `    pnpm install\n\n` +
      `  Alasannya: pin keamanan ada di pnpm-workspace.yaml, dan npm maupun yarn\n` +
      `  tidak membacanya. Lihat scripts/only-pnpm.mjs.\n`,
  );
  process.exit(1);
}
