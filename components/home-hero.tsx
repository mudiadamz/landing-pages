"use client";

export function HomeHero() {
  return (
    <section className="relative w-full max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-20 lg:py-24 overflow-hidden">
      {/* Ornamen gradient blobs */}
      <div
        className="absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-30 blur-3xl animate-float"
        style={{ background: "radial-gradient(circle, var(--accent-warm) 0%, transparent 70%)" }}
        aria-hidden
      />
      <div
        className="absolute top-1/2 -left-16 w-48 h-48 rounded-full opacity-25 blur-3xl animate-float"
        style={{
          background: "radial-gradient(circle, var(--accent-cool) 0%, transparent 70%)",
          animationDelay: "-3s",
        }}
        aria-hidden
      />
      <div
        className="absolute -bottom-16 right-1/4 w-40 h-40 rounded-full opacity-20 blur-3xl animate-float"
        style={{
          background: "radial-gradient(circle, var(--accent-gold) 0%, transparent 70%)",
          animationDelay: "-1.5s",
        }}
        aria-hidden
      />

      {/* Hero content */}
      <div className="relative text-center max-w-2xl mx-auto space-y-4 animate-fade-in-up">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--card)]/80 backdrop-blur-sm text-xs sm:text-sm text-[var(--muted)] mb-4">
          <span
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: "var(--accent-warm)" }}
          />
          Landing page & digital assets
        </div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight leading-tight text-foreground">
          Temukan landing page & digital assets
        </h1>
        <p className="text-base sm:text-lg text-[var(--muted)] leading-relaxed">
          Jelajahi, lihat preview, dan beli landing page serta digital assets siap pakai. Template gratis dan berbayar.
        </p>
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
