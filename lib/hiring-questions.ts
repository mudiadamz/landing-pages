export type HiringQuestion = {
  id: number;
  question: string;
  options: string[];
  /** Index of the correct option (0-based) */
  answer: number;
};

export const hiringQuestions: HiringQuestion[] = [
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
];
