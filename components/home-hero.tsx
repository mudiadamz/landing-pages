import { Button } from "@/components/ui/button";

type HomeHeroProps = {
  /** Number of templates currently listed — drives the honest proof chip. */
  templateCount?: number;
};

export function HomeHero({ templateCount }: HomeHeroProps = {}) {
  return (
    <section className="relative w-full max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-20 lg:py-24 overflow-hidden">
      {/* Ornamen gradient blobs — static, no animation to reduce GPU cost */}
      <div
        className="absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-30 blur-2xl"
        style={{ background: "radial-gradient(circle, var(--accent-warm) 0%, transparent 70%)" }}
        aria-hidden
      />
      <div
        className="absolute top-1/2 -left-16 w-48 h-48 rounded-full opacity-25 blur-2xl"
        style={{ background: "radial-gradient(circle, var(--accent-cool) 0%, transparent 70%)" }}
        aria-hidden
      />
      <div
        className="absolute -bottom-16 right-1/4 w-40 h-40 rounded-full opacity-20 blur-2xl"
        style={{ background: "radial-gradient(circle, var(--accent-gold) 0%, transparent 70%)" }}
        aria-hidden
      />

      {/* Hero content */}
      <div className="relative text-center max-w-2xl mx-auto space-y-4 animate-fade-in-up">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] text-xs sm:text-sm text-[var(--muted)] mb-4">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: "var(--accent-warm)" }}
          />
          {templateCount && templateCount > 0
            ? `${templateCount} template siap pakai · preview gratis`
            : "Preview gratis sebelum beli"}
        </div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight leading-tight text-foreground">
          Landing page siap pakai, live hari ini.
        </h1>
        <p className="text-base sm:text-lg text-[var(--muted)] leading-relaxed">
          Template HTML bersih untuk founder, marketer &amp; freelancer. Preview gratis, beli, edit, deploy.
        </p>
        <div className="pt-2">
          <Button
            size="lg"
            href="#templates"
            rightIcon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            }
            className="px-6 py-3 text-sm gap-2 shadow-lg shadow-[var(--primary)]/25 hover:shadow-xl hover:shadow-[var(--primary)]/30 hover:scale-[1.01] active:scale-[0.99]"
          >
            Lihat template
          </Button>
        </div>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <span
            className="px-3 py-1 rounded-lg text-xs font-medium transition-transform duration-200 hover:scale-105"
            style={{ backgroundColor: "var(--accent-subtle)", color: "var(--foreground)", border: "1px solid var(--border)" }}
          >
            HTML bersih
          </span>
          <span
            className="px-3 py-1 rounded-lg text-xs font-medium transition-transform duration-200 hover:scale-105"
            style={{ backgroundColor: "var(--accent-subtle)", color: "var(--foreground)", border: "1px solid var(--border)" }}
          >
            Support 1 bulan
          </span>
          <span
            className="px-3 py-1 rounded-lg text-xs font-medium transition-transform duration-200 hover:scale-105"
            style={{ backgroundColor: "var(--accent-subtle)", color: "var(--foreground)", border: "1px solid var(--border)" }}
          >
            Preview gratis
          </span>
        </div>
      </div>
    </section>
  );
}
