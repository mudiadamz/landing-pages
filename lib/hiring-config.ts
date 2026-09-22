/* Hiring page copy + the skill test, editable at /panel/hiring.
 *
 * Settings, not rows, for the same reason the legal pages are: /hiring and
 * /hiring/test are surfaces the code knows by name, linked from the footer, and
 * an admin edits them rather than creating or deleting them.
 *
 * The questions live here too. Leaving them in code would have meant an admin
 * who can rewrite the job ad but not the test it links to — and the test is the
 * part that actually filters applicants, so it is the part most likely to need
 * changing.
 *
 * Kept out of the "use server" action file so plain values can be imported by
 * client and server components alike.
 */

export type HiringQuestion = {
  id: number;
  question: string;
  options: string[];
  /** Index of the correct option (0-based). */
  answer: number;
};

export type HiringContent = {
  /**
   * When false, /hiring and /hiring/test 404 and the footer link disappears.
   *
   * A storefront that is not recruiting should not be advertising a vacancy, and
   * deleting the copy to achieve that would lose it.
   */
  enabled: boolean;

  metaTitle: string;
  metaDescription: string;

  /** Hero: the pill above the title, the title, and the paragraph under it. */
  badge: string;
  title: string;
  intro: string;

  /** Small pills describing the role at a glance. */
  tags: string[];

  scopeHeading: string;
  scopeBody: string;

  requirementsHeading: string;
  requirements: string[];

  benefitsHeading: string;
  benefits: string[];

  /** The card at the bottom that sends an applicant to the test. */
  ctaHeading: string;
  /** `{count}` is replaced with the number of questions. */
  ctaBody: string;
  ctaButton: string;

  /** /hiring/test heading + the paragraph above the questions. */
  testTitle: string;
  /** `{count}` is replaced with the number of questions. */
  testIntro: string;

  questions: HiringQuestion[];
};

export const DEFAULT_HIRING: HiringContent = {
  // Off by default: no demo vacancy or skill-test quiz on a fresh site. The
  // /hiring link and pages stay hidden until turned on in /panel/hiring.
  enabled: false,

  metaTitle: "Hiring — Landing Page Creator",
  metaDescription:
    "Bergabung dengan ADM.UIUX sebagai Landing Page Creator. Remote, fleksibel, dan kreatif.",

  badge: "Open Position",
  title: "Landing Page Creator",
  intro:
    "Kami mencari orang kreatif yang bisa membuat landing page berkualitas tinggi secara konsisten. Posisi ini full remote.",

  tags: ["Remote", "Landing Page", "UI/UX + Code"],

  scopeHeading: "Scope pekerjaan",
  scopeBody:
    "Membuat landing page dari brief atau referensi. Output berupa file HTML/CSS/JS yang bersih, responsif, dan siap pakai. Landing page akan dipublikasikan di platform ADM.UIUX.",

  requirementsHeading: "Kualifikasi",
  requirements: [
    "Menguasai UI/UX design — paham layout, tipografi, warna, dan hierarki visual",
    "Mahir HTML, CSS, dan JavaScript — bisa slicing dari desain ke kode bersih dan responsif",
    "Familiar dengan Figma atau design tool lain (nilai lebih)",
    "Mampu membuat minimal 1 landing page per hari",
    "Teliti, mandiri, dan komunikatif",
  ],

  benefitsHeading: "Yang kamu dapat",
  benefits: [
    "Full remote — kerja dari mana saja",
    "Waktu fleksibel",
    "Portofolio dipublikasikan di platform ADM.UIUX",
    "Support dan feedback langsung dari tim",
  ],

  ctaHeading: "Tertarik? Ikuti tes skill",
  ctaBody:
    "Jawab {count} pertanyaan situasional tentang cara kerja kamu dan upload CV. Hasil langsung dikirim ke email kamu dan tim kami.",
  ctaButton: "Mulai tes",

  testTitle: "Tes Skill — Landing Page Creator",
  testIntro:
    "Jawab {count} pertanyaan situasional di bawah — kami ingin tahu cara kerja dan pola pikirmu. Tidak ada jawaban yang bisa di-Google. Hasil akan dikirim ke email kamu dan tim kami.",

  questions: [
  {
    id: 1,
    question: "Kamu dapat brief landing page jam 9 pagi dengan deadline jam 5 sore. Setelah 2 jam, kamu sadar konsepnya kurang pas. Apa yang kamu lakukan?",
    options: [
      "Lanjutkan saja yang sudah dikerjakan, daripada telat",
      "Langsung hubungi yang memberi brief, jelaskan masalahnya, dan usulkan arah baru",
      "Mulai ulang dari nol tanpa bilang siapa-siapa",
      "Tunggu sampai deadline hampir habis baru bilang ada masalah",
    ],
    answer: 1,
  },
  {
    id: 2,
    question: "Klien minta landing page dengan warna merah menyala di semua elemen, teks kecil, dan banyak animasi. Menurutmu ini buruk untuk user. Bagaimana sikapmu?",
    options: [
      "Ikuti saja maunya klien — yang penting selesai",
      "Tolak mentah-mentah karena itu jelek",
      "Buatkan sesuai permintaan, tapi siapkan juga versi alternatif yang lebih baik beserta alasannya",
      "Diam saja dan buat sesuai selera sendiri",
    ],
    answer: 2,
  },
  {
    id: 3,
    question: "Kamu sedang mengerjakan landing page dan tiba-tiba laptop mati total. Kamu belum sempat save progress 3 jam terakhir. Apa reaksimu?",
    options: [
      "Panik dan langsung lapor tidak bisa selesai hari ini",
      "Kesal, tapi langsung mulai ulang dan kerjakan lebih cepat karena sudah tahu arahnya",
      "Tunggu besok saja, hari ini sudah tidak mood",
      "Menyalahkan laptop dan minta perpanjangan deadline 2 hari",
    ],
    answer: 1,
  },
  {
    id: 4,
    question: "Dalam seminggu terakhir, kamu sudah membuat 5 landing page. Di hari ke-6, kamu merasa bosan dan ide mulai mentok. Bagaimana kamu mengatasinya?",
    options: [
      "Istirahat sejenak, lihat referensi baru (Dribbble, Awwwards, dll), lalu lanjutkan dengan perspektif segar",
      "Paksakan kerja meskipun hasilnya asal jadi",
      "Minta cuti sampai inspirasi datang sendiri",
      "Copy-paste dari landing page sebelumnya dan ubah warnanya saja",
    ],
    answer: 0,
  },
  {
    id: 5,
    question: "Tim memberikan feedback bahwa landing page buatanmu 'terlalu polos dan membosankan'. Apa yang kamu lakukan?",
    options: [
      "Tersinggung dan mempertahankan desain karena menurutmu sudah bagus",
      "Tanya lebih spesifik bagian mana yang perlu diperbaiki, lalu revisi dengan terbuka",
      "Langsung ubah total tanpa bertanya — yang penting tidak dikritik lagi",
      "Abaikan feedback karena selera orang berbeda-beda",
    ],
    answer: 1,
  },
  {
    id: 6,
    question: "Kamu kerja remote dan tidak ada yang mengawasi jadwalmu. Bagaimana cara kamu memastikan kerjaan selesai tepat waktu?",
    options: [
      "Kerjakan semua di malam terakhir sebelum deadline",
      "Buat to-do list harian dan tentukan jam kerja sendiri yang konsisten",
      "Tunggu di-follow-up dulu baru mulai",
      "Kerja kalau lagi mood, libur kalau tidak mood",
    ],
    answer: 1,
  },
  {
    id: 7,
    question: "Kamu menemukan bug layout yang cuma terlihat di Safari mobile. User biasa mungkin tidak sadar. Apa yang kamu lakukan?",
    options: [
      "Abaikan — kebanyakan orang pakai Chrome",
      "Fix sekarang, karena detail kecil menentukan kualitas keseluruhan",
      "Catat saja, nanti kalau ada yang komplain baru diperbaiki",
      "Tutup mata dan berharap tidak ada yang pakai Safari",
    ],
    answer: 1,
  },
  {
    id: 8,
    question: "Kamu diminta membuat landing page untuk produk yang tidak kamu pahami sama sekali (misal: alat berat industri). Langkah pertamamu?",
    options: [
      "Langsung desain berdasarkan feeling dan estetika saja",
      "Tolak karena bukan bidangmu",
      "Riset dulu: baca tentang produknya, lihat kompetitor, pahami audiensnya, baru mulai",
      "Tanya AI untuk buatkan semuanya",
    ],
    answer: 2,
  },
  {
    id: 9,
    question: "Saat ini kamu punya 2 project landing page bersamaan. Yang satu mudah tapi deadline besok, yang satu sulit tapi deadline 3 hari lagi. Bagaimana kamu prioritaskan?",
    options: [
      "Kerjakan yang sulit dulu karena butuh waktu lebih",
      "Selesaikan yang deadline besok dulu, lalu fokus penuh ke yang sulit",
      "Kerjakan keduanya setengah-setengah secara bergantian",
      "Minta salah satu di-cancel karena tidak bisa handle dua",
    ],
    answer: 1,
  },
  {
    id: 10,
    question: "Jujur saja: apa motivasi utamamu melamar posisi ini?",
    options: [
      "Butuh uang saja, pekerjaan apapun oke",
      "Ingin mengembangkan skill sambil dapat penghasilan — senang membuat sesuatu yang visual dan fungsional",
      "Hanya iseng coba-coba",
      "Tidak ada kerjaan lain yang terima",
    ],
    answer: 1,
  },
],
};

/** Merge a stored value onto the defaults so a missing field never blanks the page. */
export function normalizeHiring(raw: unknown): HiringContent {
  if (!raw || typeof raw !== "object") return DEFAULT_HIRING;
  const v = raw as Partial<HiringContent>;

  const str = (a: unknown, fallback: string) =>
    typeof a === "string" && a.trim() ? a : fallback;

  const strArr = (a: unknown, fallback: string[]) =>
    Array.isArray(a) ? a.map((x) => String(x ?? "")).filter((x) => x.trim()) : fallback;

  /**
   * A question with no text or fewer than two options is not answerable, so it is
   * dropped rather than rendered as an empty radio group. `answer` is clamped
   * into range: it indexes `options` when the test is graded, and an out-of-range
   * value would mark every applicant wrong on that question forever.
   */
  const questions: HiringQuestion[] = Array.isArray(v.questions)
    ? v.questions
        .map((q, i) => {
          const options = Array.isArray(q?.options)
            ? q.options.map((o) => String(o ?? "")).filter((o) => o.trim())
            : [];
          const answer = Number(q?.answer);
          return {
            id: Number.isFinite(Number(q?.id)) ? Number(q?.id) : i + 1,
            question: String(q?.question ?? "").trim(),
            options,
            answer: Number.isFinite(answer) ? Math.min(Math.max(0, answer), Math.max(0, options.length - 1)) : 0,
          };
        })
        .filter((q) => q.question && q.options.length >= 2)
    : [];

  return {
    enabled: typeof v.enabled === "boolean" ? v.enabled : DEFAULT_HIRING.enabled,
    metaTitle: str(v.metaTitle, DEFAULT_HIRING.metaTitle),
    metaDescription: str(v.metaDescription, DEFAULT_HIRING.metaDescription),
    badge: str(v.badge, DEFAULT_HIRING.badge),
    title: str(v.title, DEFAULT_HIRING.title),
    intro: str(v.intro, DEFAULT_HIRING.intro),
    tags: strArr(v.tags, DEFAULT_HIRING.tags),
    scopeHeading: str(v.scopeHeading, DEFAULT_HIRING.scopeHeading),
    scopeBody: str(v.scopeBody, DEFAULT_HIRING.scopeBody),
    requirementsHeading: str(v.requirementsHeading, DEFAULT_HIRING.requirementsHeading),
    requirements: strArr(v.requirements, DEFAULT_HIRING.requirements),
    benefitsHeading: str(v.benefitsHeading, DEFAULT_HIRING.benefitsHeading),
    benefits: strArr(v.benefits, DEFAULT_HIRING.benefits),
    ctaHeading: str(v.ctaHeading, DEFAULT_HIRING.ctaHeading),
    ctaBody: str(v.ctaBody, DEFAULT_HIRING.ctaBody),
    ctaButton: str(v.ctaButton, DEFAULT_HIRING.ctaButton),
    testTitle: str(v.testTitle, DEFAULT_HIRING.testTitle),
    testIntro: str(v.testIntro, DEFAULT_HIRING.testIntro),
    // Not `|| DEFAULT`: an admin who deletes every question means the test has
    // none, and silently restoring the shipped ten would be a surprise.
    questions: Array.isArray(v.questions) ? questions : DEFAULT_HIRING.questions,
  };
}
