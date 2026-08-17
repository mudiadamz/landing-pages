import Image from "next/image";
import { translator } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";
import { Countdown } from "./countdown";

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "full",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

/**
 * "Coming soon" panel shown in place of the preview / checkout content while a
 * product is still in its scheduled-upcoming window. Shows the thumbnail, a live
 * countdown, and the release date. No read/buy affordances — those return once
 * the countdown reaches zero (Countdown refreshes the route).
 */
export async function ComingSoon({
  title,
  thumbnailUrl,
  target,
}: {
  title: string;
  thumbnailUrl?: string | null;
  target: string;
}) {
  const t = translator(await requestLocale());
  const when = formatWhen(target);

  return (
    <div className="mx-auto w-full max-w-md text-center">
      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
        <div className="relative aspect-video bg-[var(--background)]">
          {thumbnailUrl ? (
            <Image
              src={thumbnailUrl}
              alt={title}
              fill
              sizes="(max-width: 640px) 100vw, 448px"
              className="object-cover"
              priority
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-[var(--muted)]">
              {title}
            </div>
          )}
          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-md bg-[var(--primary)] px-2.5 py-1 text-xs font-semibold text-[var(--primary-foreground)] shadow-sm">
            <ClockIcon className="h-3.5 w-3.5" />
            {t("home.comingSoon")}
          </span>
        </div>

        <div className="space-y-5 p-6">
          <div className="space-y-1.5">
            <h1 className="text-lg font-semibold text-foreground">{title}</h1>
            <p className="text-sm text-[var(--muted)]">
              Produk ini akan tersedia untuk dibaca &amp; dibeli saat hitung mundur selesai.
            </p>
          </div>

          <Countdown target={target} />

          {when && (
            <p className="text-xs text-[var(--muted)]">
              Tayang <span className="font-medium text-foreground">{when}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
