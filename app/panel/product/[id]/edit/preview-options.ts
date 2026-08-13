import type { PreviewType } from "@/lib/actions/landing-pages";

/**
 * The six things "preview" can mean, and the one-line explanation each needs.
 *
 * Data, not UI: the radio row that renders these belongs to the preview tab,
 * but the list itself is the product's vocabulary and is worth reading in one
 * place without a component around it.
 */
export const PREVIEW_OPTIONS: { value: PreviewType; label: string; hint: string }[] = [
  { value: "html", label: "HTML", hint: "Pakai konten HTML/CSS/JS dari editor di bawah." },
  { value: "pdf", label: "PDF", hint: "Upload file PDF untuk di-embed di halaman preview." },
  { value: "epub", label: "EPUB", hint: "Upload file EPUB — pembaca bisa ganti tema terang/gelap langsung di reader." },
  { value: "link", label: "Link", hint: "Embed URL eksternal di halaman preview." },
  {
    value: "deliverable",
    label: "Sama dgn deliverable",
    hint: "Preview memakai file pembeli (PDF/EPUB) yang sama — tak perlu upload lagi. Seluruh isi bisa dibaca gratis di preview.",
  },
  {
    value: "excerpt",
    label: "Sebagian deliverable",
    hint: "Satu file saja: preview menampilkan sebagian awal EPUB pembeli. Tidak ada file preview terpisah yang harus ikut diedit.",
  },
];
