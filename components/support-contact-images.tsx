import Image from "next/image";

const CONTACT_IMAGES = {
  email: "/admuiux-email.png",
  phone: "/admuiux-phone.png",
  address: "/admuiux-address.png",
} as const;

const LABELS = {
  email: "Email",
  phone: "Telepon",
  address: "Alamat",
} as const;

/** Gambar kontak support tanpa link agar tidak di-crawl bot. Tampilan vertikal: label lalu gambar. */
export function SupportContactImages() {
  return (
    <div className="flex flex-col gap-6">
      {(Object.keys(CONTACT_IMAGES) as (keyof typeof CONTACT_IMAGES)[]).map((key) => (
        <div key={key} className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">{LABELS[key]}</span>
          <span className="inline-block">
            <Image
              src={CONTACT_IMAGES[key]}
              alt={`${LABELS[key]} kontak support`}
              width={280}
              height={80}
              className="h-auto w-full max-w-[280px] object-contain"
            />
          </span>
        </div>
      ))}
    </div>
  );
}
