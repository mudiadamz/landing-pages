"use client";

import { useState, useCallback } from "react";

const testimonials = [
  {
    quote: "Murah dan langsung dibantu launching. Bisa tweak tampilan. Gercep.",
    name: "Ica",
    role: "Freelance copywriter",
  },
  {
    quote: "Yang gratis dipakai buat side project. Kode bersih, nggak berantakan. Ujung-ujungnya beli yang berbayar buat pitch client.",
    name: "Adrian K.",
    role: "Pendiri startup",
  },
  {
    quote: "Awalnya ragu, tapi fitur preview yang bikin mantap—bisa liat dulu sebelum beli. Jauh lebih enak ketimbang beli gak jelas di tempat lain.",
    name: "BimasaktiTech",
    role: "Digital marketer",
  },
  {
    quote: "Perlu cepet buat product launch. Pilih satu, ganti copy dan gambar. Live dalam 2 hari.",
    name: "Saf***",
    role: "Product manager",
  },
  {
    quote: "Bought two so far—one for my portfolio, one for a client. Both worked out. The HTML is clean and readable, hard to find that elsewhere.",
    name: "Jenny",
    role: "UI designer",
  },
];

export function Testimonials() {
  const [active, setActive] = useState(0);

  const goNext = useCallback(() => {
    setActive((prev) => (prev + 1) % testimonials.length);
  }, []);

  const goPrev = useCallback(() => {
    setActive((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  }, []);

  return (
    <section className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24 border-t border-[var(--border)]">
      <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground mb-8 sm:mb-10">
        Kata mereka
      </h2>
      <div className="relative">
        <div className="overflow-hidden">
          {testimonials.map((t, i) => (
            <blockquote
              key={i}
              className={`rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-8 text-sm sm:text-base text-[var(--muted)] leading-relaxed transition-all duration-300 ease-out ${
                i === active ? "opacity-100 block" : "opacity-0 hidden"
              }`}
            >
              <p className="mb-5 sm:mb-6">&ldquo;{t.quote}&rdquo;</p>
              <footer>
                <span className="font-medium text-foreground">{t.name}</span>
                <span className="text-[var(--muted)]"> · {t.role}</span>
              </footer>
            </blockquote>
          ))}
        </div>
        <div className="flex items-center justify-between mt-6 sm:mt-8">
          <div className="flex gap-2">
            {testimonials.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Testimoni ${i + 1}`}
                onClick={() => setActive(i)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === active ? "bg-[var(--primary)]" : "bg-[var(--border)] hover:bg-[var(--muted)]"
                }`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              aria-label="Sebelumnya"
              onClick={goPrev}
              className="p-2 rounded-lg border border-[var(--border)] text-[var(--muted)] hover:text-foreground hover:bg-[var(--accent-subtle)] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Selanjutnya"
              onClick={goNext}
              className="p-2 rounded-lg border border-[var(--border)] text-[var(--muted)] hover:text-foreground hover:bg-[var(--accent-subtle)] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
