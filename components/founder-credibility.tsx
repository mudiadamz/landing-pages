import Image from "next/image";
import Link from "next/link";

type Props = {
  /** When provided (>0), shows "N template diterbitkan" as concrete proof. */
  templateCount?: number;
  className?: string;
};

/**
 * Compact maker-proof strip. With low review volume, the founder is the
 * strongest trust substitute — real name, real photo, direct contact.
 */
export function FounderCredibility({ templateCount, className = "" }: Props) {
  const publishedLabel =
    templateCount && templateCount > 0 ? `${templateCount} template diterbitkan · ` : "";
  return (
    <div
      className={`flex items-start gap-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 ${className}`}
    >
      <div className="relative w-12 h-12 shrink-0 rounded-full overflow-hidden border border-[var(--border)] bg-[var(--background)]">
        <Image
          src="/pas_foto.png"
          alt="Adam Mudianto"
          width={48}
          height={48}
          className="object-cover w-full h-full"
        />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">Adam Mudianto</p>
        <p className="text-xs text-[var(--muted)]">Founder · software developer 15+ tahun</p>
        <p className="mt-1 text-xs text-[var(--muted)] leading-relaxed">
          {publishedLabel}setiap template dibuat &amp; dirawat sendiri. Ada pertanyaan sebelum beli?{" "}
          <Link href="/contact" className="text-[var(--primary)] hover:underline font-medium">
            Hubungi langsung
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
