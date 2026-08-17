import { translator } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";

/* Brand marks: glyph and colour per network, keyed by the same id the settings
   use. Deliberately NOT data — the mark belongs to the network, so no storefront
   can point the Instagram icon at YouTube. Only the address is editable.
   `brand` is the network's colour; `brandDark` the value for dark mode, where
   the two black marks would otherwise disappear. */
export const SOCIAL_LINKS = [
  {
    key: "threads" as const,
    name: "Threads",
    brand: "#000000",
    brandDark: "#ffffff",
    label: "Threads",
    href: "https://www.threads.com/adm.uiux",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.362-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32L7.83 8.586c.977-1.454 2.564-2.256 4.478-2.256h.044c3.204.02 5.11 1.978 5.302 5.402.11.047.217.095.323.145 1.484.7 2.55 1.784 3.113 3.155.646 1.575.652 3.867-1.5 5.98C18.05 22.847 15.88 23.98 12.186 24Zm1.545-9.735c-.42 0-.849.012-1.284.037-1.043.06-1.87.334-2.457.815-.526.43-.79 1.014-.755 1.65.037.663.402 1.212 1.028 1.618.527.342 1.204.507 1.907.463 1.026-.056 1.827-.446 2.38-1.16.446-.577.744-1.36.888-2.33a11.53 11.53 0 0 0-1.707-.093Z" />
      </svg>
    ),
  },
  {
    key: "tiktok" as const,
    name: "TikTok",
    brand: "#000000",
    brandDark: "#ffffff",
    label: "TikTok",
    href: "https://tiktok.com/@adm.uiux",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
      </svg>
    ),
  },
  {
    key: "instagram" as const,
    name: "Instagram",
    brand: "#e4405f",
    brandDark: "#f56040",
    label: "Instagram",
    href: "https://instagram.com/adm.uiux",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
      </svg>
    ),
  },
  {
    key: "youtube" as const,
    name: "YouTube",
    brand: "#ff0000",
    brandDark: "#ff4444",
    label: "YouTube",
    href: "https://youtube.com/@admuiux",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
  },
] as const;

export type SocialLink = (typeof SOCIAL_LINKS)[number];

type Props = {
  className?: string;
  variant?: "row" | "stack";
  /** Per-network addresses from site settings; omitted = the shipped defaults. */
  urls?: Partial<Record<SocialLink["key"], string>>;
};

export async function SocialLinks({ className = "", variant = "row", urls }: Props) {
  const t = translator(await requestLocale());
  const isStack = variant === "stack";
  // A network with no address is not shown — that is how a storefront without a
  // TikTok stops displaying a TikTok icon.
  const shown = SOCIAL_LINKS.map((l) => ({ ...l, href: urls?.[l.key] ?? l.href })).filter(
    (l) => !!l.href,
  );
  return (
    <ul
      className={`flex flex-wrap gap-3 ${isStack ? "flex-col" : "flex-row"} ${className}`}
      aria-label={t("home.socialLinks")}
    >
      {shown.map(({ name, label, href, icon, brand, brandDark }) => (
        <li key={name}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 text-sm text-[var(--muted)] hover:text-[var(--primary)] active:scale-[0.98] active:opacity-80 transition-all duration-150"
            aria-label={`${name}: ${href}`}
          >
            <span
              style={{ "--sc": brand, "--sc-dark": brandDark } as React.CSSProperties}
              className="flex items-center justify-center w-9 h-9 rounded-lg bg-[var(--accent-subtle)] text-[var(--sc)] shrink-0 dark:text-[var(--sc-dark)]"
            >
              {icon}
            </span>
            <span className="truncate">{label}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
