"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/client";

const CUSTOM = "__custom__";

/**
 * A dropdown of ready-made phrases instead of a blank text box — quicker to
 * fill in and keeps CTA wording consistent across products. "Lainnya…" falls
 * back to a free-text input, so wording saved before the presets existed (or
 * anything one-off) still works.
 */
export function PresetTextField({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
  maxLength,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  /** Shown as the "default" choice — what the product uses when left empty. */
  placeholder?: string;
  maxLength?: number;
  hint?: string;
}) {
  const t = useT();
  // Set only by picking "Lainnya…" — it keeps the box open while it's still
  // empty, which is the one case the value alone can't tell us about.
  const [chose, setChose] = useState(false);

  const isPreset = options.includes(value);
  // Derived, not stored: `options` changes underneath us (the CTA presets swap
  // when a product is toggled free, or the action becomes a calendar event). If
  // this were state fixed at mount, wording saved as a preset would fall out of
  // the list and the dropdown would sit on "Bawaan" while a different value was
  // still queued to save — the box would be lying about what it would write.
  const custom = chose || (!!value && !isPreset);
  const selectValue = custom ? CUSTOM : isPreset ? value : "";

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <select
        id={id}
        value={selectValue}
        onChange={(e) => {
          const v = e.target.value;
          if (v === CUSTOM) {
            setChose(true);
            return;
          }
          setChose(false);
          onChange(v);
        }}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-base sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
      >
        <option value="">
          {placeholder ? t("product.presetDefaultWith", { value: placeholder }) : t("product.presetDefault")}
        </option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
        <option value={CUSTOM}>{t("product.presetCustom")}</option>
      </select>

      {custom && (
        <input
          type="text"
          value={value}
          maxLength={maxLength}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          // Only when they just asked for it. A product whose wording is already
          // custom opens this box on mount, and autofocusing there would yank
          // the page down to whichever field happened to be custom.
          autoFocus={chose}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-base sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
        />
      )}

      {hint && <p className="text-xs text-[var(--muted)]">{hint}</p>}
    </div>
  );
}
