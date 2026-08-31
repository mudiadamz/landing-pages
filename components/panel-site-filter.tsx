import { editingSite, listMemberSites } from "@/lib/site-resolve";
import { PanelSiteSwitcher } from "@/components/panel-site-switcher";
import { translator } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";

/**
 * "Data situs mana yang sedang dilihat" — dan cara menggantinya, di halamannya.
 *
 * Menggantikan switcher di sidebar. Dua alasan kontrol ini pindah ke sini:
 *
 *   1. Sidebar bisa diciutkan jadi rail 64px, dan sebuah select berisi hostname
 *      tidak punya versi 64px yang jujur — jadi kontrolnya hilang persis saat
 *      layarnya paling lebar.
 *   2. Filter ada gunanya di sebelah data yang difilter. Di sidebar ia jauh dari
 *      angka yang berubah karenanya, dan halaman-halaman yang TIDAK terpengaruh
 *      tetap memajangnya.
 *
 * **Tidak merender apa pun kalau cuma ada satu pilihan.** Di situlah aturan
 * "manajer situs tidak perlu filter" tinggal — bukan sebagai pengecekan role,
 * tapi sebagai kenyataan: dia cuma anggota satu situs, jadi tidak ada yang bisa
 * dipilih. Manajer yang memang memegang dua situs tetap dapat filternya, dan itu
 * benar. Satu aturan, tanpa daftar peran yang harus dijaga tetap sinkron.
 *
 * Mengambil datanya sendiri: halaman yang memakainya cuma menaruh <PanelSiteFilter />
 * tanpa prop, jadi tidak ada layar yang salah mengirim daftar situs orang lain.
 */
export async function PanelSiteFilter() {
  const [sites, current] = await Promise.all([listMemberSites(), editingSite()]);
  if (sites.length < 2) return null;

  const t = translator(await requestLocale());

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2">
      <span className="text-xs text-[var(--muted)]">{t("scope.managing")}</span>
      <PanelSiteSwitcher
        sites={sites.map((s) => ({
          id: s.id,
          host: s.host,
          name: s.name,
          is_canonical: s.is_canonical,
        }))}
        currentId={current.id}
        inline
      />
      <span className="font-mono text-xs text-[var(--muted)]">{current.host}</span>
    </div>
  );
}
