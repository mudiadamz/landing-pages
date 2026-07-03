import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { DEFAULT_HERO, type HeroConfig, type HeroIcon } from "@/lib/hero-config";
import { BrandMark } from "@/components/brand-mark";

type HomeHeroProps = {
  /** Editable hero content (falls back to defaults). */
  hero?: HeroConfig;
  /** Number of templates currently listed — fills the `{count}` badge placeholder. */
  templateCount?: number;
};

/* Inline markup: `*text*` → brand-green highlight, `~text~` → handwritten accent. */
function renderMarkup(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const regex = /(\*[^*]+\*|~[^~]+~)/g;
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const token = m[0];
    const inner = token.slice(1, -1);
    if (token.startsWith("*")) {
      parts.push(
        <span key={key++} className="text-[var(--primary)]">
          {inner}
        </span>,
      );
    } else {
      parts.push(
        <span
          key={key++}
          className="italic text-[var(--primary)] underline decoration-[var(--accent-cool)] decoration-2 underline-offset-[6px]"
        >
          {inner}
        </span>,
      );
    }
    last = m.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

const ICONS: Record<HeroIcon, ReactNode> = {
  shield: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
  ),
  qr: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 3h3m0 0h3m-3 0v3m0-6v0" />
  ),
  infinity: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 8a4 4 0 000 8c2 0 3-2 5-4s3-4 5-4a4 4 0 010 8c-2 0-3-2-5-4S9 8 7 8z" />
  ),
  user: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 17v-1a4 4 0 00-8 0v1M12 11a3 3 0 100-6 3 3 0 000 6z" />
  ),
  star: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4l2.3 4.7 5.2.8-3.8 3.7.9 5.1L12 16.9 7.2 18.1l.9-5.1L4.3 9.3l5.2-.8L12 4z" />
  ),
  download: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4v10m0 0l-4-4m4 4l4-4M5 19h14" />
  ),
  clock: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 7v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  ),
  check: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 13l4 4L19 7" />
  ),
};

export function HomeHero({ hero = DEFAULT_HERO, templateCount }: HomeHeroProps = {}) {
  const badge =
    templateCount && templateCount > 0
      ? hero.badge.replace(/\{count\}/g, String(templateCount))
      : hero.badge.replace(/\{count\}\s*/g, "").trim();

  return (
    <section className="relative w-full max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16 lg:py-20 overflow-hidden">
      {/* Ornamen gradient blobs — static, no animation to reduce GPU cost */}
      <div
        className="absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-30 blur-2xl pointer-events-none"
        style={{ background: "radial-gradient(circle, var(--accent-warm) 0%, transparent 70%)" }}
        aria-hidden
      />
      <div
        className="absolute top-1/2 -left-16 w-48 h-48 rounded-full opacity-25 blur-2xl pointer-events-none"
        style={{ background: "radial-gradient(circle, var(--accent-cool) 0%, transparent 70%)" }}
        aria-hidden
      />

      <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-8 items-center">
        {/* Left: copy + CTAs + proof */}
        <div className="text-center lg:text-left max-w-xl mx-auto lg:mx-0 animate-fade-in-up">
          {badge && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] text-xs sm:text-sm text-[var(--muted)] mb-5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "var(--accent-cool)" }} />
              {badge}
            </div>
          )}

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight leading-[1.1] text-foreground">
            {renderMarkup(hero.heading)}
          </h1>

          <p className="mt-5 text-base sm:text-lg text-[var(--muted)] leading-relaxed">
            {renderMarkup(hero.subheading)}
          </p>

          <div className="mt-7 flex flex-wrap justify-center lg:justify-start gap-3">
            <Button
              size="lg"
              href={hero.primaryHref}
              rightIcon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              }
              className="gap-2 shadow-lg shadow-[var(--primary)]/25 hover:shadow-xl hover:shadow-[var(--primary)]/30 hover:scale-[1.01] active:scale-[0.99]"
            >
              {hero.primaryLabel}
            </Button>
            {hero.secondaryLabel && (
              <Button
                size="lg"
                variant="secondary"
                href={hero.secondaryHref}
                external={/^https?:\/\//.test(hero.secondaryHref)}
                rightIcon={
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[var(--accent-subtle)] text-[var(--primary)]">
                    <svg className="w-3 h-3 ml-0.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                }
                className="gap-2"
              >
                {hero.secondaryLabel}
              </Button>
            )}
          </div>

          <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-5 max-w-md mx-auto lg:mx-0">
            {hero.features.map((f, i) => (
              <div key={i} className="flex flex-col items-center lg:items-start text-center lg:text-left gap-1.5">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--accent-subtle)] text-[var(--primary)]">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    {ICONS[f.icon] ?? ICONS.check}
                  </svg>
                </span>
                <span className="text-xs font-semibold text-foreground leading-tight">{f.title}</span>
                <span className="text-xs text-[var(--muted)] leading-tight -mt-1">{f.subtitle}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: illustration or fallback device mockup */}
        <div className="relative animate-fade-in-up">
          {hero.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={hero.imageUrl}
              alt="Preview produk digital"
              className="w-full h-auto max-w-lg mx-auto drop-shadow-2xl"
              loading="eager"
            />
          ) : (
            <HeroFallbackMockup />
          )}
        </div>
      </div>
    </section>
  );
}

/* A tasteful default illustration shown until an admin uploads a hero image. */
function HeroFallbackMockup() {
  return (
    <div className="relative w-full max-w-lg mx-auto">
      <div className="rounded-2xl bg-gradient-to-br from-[#0f2a22] to-[#173d31] p-6 sm:p-8 shadow-2xl aspect-[4/3] flex flex-col justify-between overflow-hidden">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
          <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
          <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
        </div>
        <div>
          <div className="text-[var(--accent-gold)] text-xs font-medium mb-2">Template siap pakai</div>
          <div className="text-white text-2xl sm:text-3xl font-semibold leading-tight">
            Live hari ini,
            <br />
            tanpa ngoding.
          </div>
          <div className="mt-4 flex gap-2">
            <span className="h-2 w-16 rounded-full bg-white/20" />
            <span className="h-2 w-10 rounded-full bg-white/15" />
          </div>
        </div>
        <div className="flex items-center gap-2 text-white/70">
          <BrandMark className="h-5 w-auto opacity-80" />
        </div>
      </div>

      {/* Floating proof chips */}
      <div className="absolute -left-3 top-6 rounded-xl bg-[var(--card)] border border-[var(--border)] shadow-lg px-3 py-2 text-xs font-medium text-foreground flex items-center gap-1.5">
        <span className="text-[var(--accent-cool)]">QRIS</span> Scan &amp; Pay
      </div>
      <div className="absolute -right-2 bottom-8 rounded-xl bg-[var(--card)] border border-[var(--border)] shadow-lg px-3 py-2 text-xs font-medium text-foreground flex items-center gap-1.5">
        <span className="text-[var(--accent-gold)]">★</span> Download instan
      </div>
    </div>
  );
}
