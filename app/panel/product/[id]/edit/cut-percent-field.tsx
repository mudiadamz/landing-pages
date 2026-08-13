"use client";

import { useEffect, useState } from "react";
import { MAX_CUT_PERCENT, MIN_CUT_PERCENT, clampCutPercent } from "@/lib/epub-cut";

const CUT_PRESETS = [30, 40, 50, 60, 70, 80];

/**
 * How much of the buyer's EPUB the preview shows.
 *
 * The number here is the share the visitor GETS; the column it saves to,
 * preview_cut_percent, stores the share withheld. The conversion happens on
 * save — this field never shows the inverted number, because "70% preview" is
 * what the person setting it means.
 */

export function CutPercentField({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  function handleDraft(raw: string) {
    setDraft(raw);
    const n = Number(raw.trim());
    if (
      raw.trim() !== "" &&
      Number.isInteger(n) &&
      n >= MIN_CUT_PERCENT &&
      n <= MAX_CUT_PERCENT
    ) {
      onChange(n);
    }
  }

  function commitDraft() {
    const n = Number(draft.trim());
    // An empty or nonsense box reverts rather than snapping to the minimum.
    if (draft.trim() === "" || !Number.isFinite(n)) setDraft(String(value));
    else onChange(clampCutPercent(n));
  }

  const step = (delta: number) => onChange(clampCutPercent(value + delta));

  return (
    <div className="space-y-2">
      <div>
        <span className="block text-sm font-medium text-foreground">Bagian yang disembunyikan</span>
        <span className="text-xs text-[var(--muted)]">
          Pembaca dapat <strong className="text-foreground">{100 - value}%</strong> awal buku.
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex flex-wrap gap-0.5 rounded-xl border border-[var(--border)] bg-[var(--background)] p-1">
          {CUT_PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              aria-pressed={value === p}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium tabular-nums transition-colors ${
                value === p
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "text-[var(--muted)] hover:text-foreground"
              }`}
            >
              {p}%
            </button>
          ))}
        </div>

        <div className="inline-flex items-center overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--background)]">
          <button
            type="button"
            onClick={() => step(-5)}
            disabled={value <= MIN_CUT_PERCENT}
            aria-label="Kurangi 5%"
            className="px-3 py-2 text-sm font-semibold text-[var(--muted)] transition-colors hover:bg-[var(--card)] hover:text-foreground disabled:opacity-40"
          >
            −
          </button>
          <input
            id="cut-percent"
            type="number"
            inputMode="numeric"
            min={MIN_CUT_PERCENT}
            max={MAX_CUT_PERCENT}
            value={draft}
            onChange={(e) => handleDraft(e.target.value)}
            onBlur={commitDraft}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitDraft();
              }
            }}
            aria-label="Persen yang disembunyikan"
            className="w-14 border-x border-[var(--border)] bg-transparent py-2 text-center text-base sm:text-sm font-semibold tabular-nums text-foreground focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--primary)]/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <button
            type="button"
            onClick={() => step(5)}
            disabled={value >= MAX_CUT_PERCENT}
            aria-label="Tambah 5%"
            className="px-3 py-2 text-sm font-semibold text-[var(--muted)] transition-colors hover:bg-[var(--card)] hover:text-foreground disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>

      <p className="text-xs text-[var(--muted)]">
        Dihitung dari panjang teks, lalu dibulatkan ke batas bab terdekat — preview tidak pernah
        berhenti di tengah kalimat. Bab terakhir selalu ditahan. Rentang {MIN_CUT_PERCENT}–
        {MAX_CUT_PERCENT}%.
      </p>
    </div>
  );
}
