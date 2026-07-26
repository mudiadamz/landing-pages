"use client";

import { useState } from "react";

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
  const [custom, setCustom] = useState(() => !!value && !options.includes(value));

  const selectValue = custom ? CUSTOM : options.includes(value) ? value : "";

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
            setCustom(true);
            return;
          }
          setCustom(false);
          onChange(v);
        }}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
      >
        <option value="">
          {placeholder ? `Bawaan — ${placeholder}` : "Bawaan"}
        </option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
        <option value={CUSTOM}>Lainnya — tulis sendiri…</option>
      </select>

      {custom && (
        <input
          type="text"
          value={value}
          maxLength={maxLength}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
        />
      )}

      {hint && <p className="text-xs text-[var(--muted)]">{hint}</p>}
    </div>
  );
}
