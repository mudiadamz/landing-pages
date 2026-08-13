"use client";

/**
 * A checkbox that reads as a card: title, one line of explanation, and the whole
 * block as the target.
 *
 * Lived inside product-edit-form until the schedule tab moved out and needed it
 * too. It is a general control — nothing about it knows what a product is — so
 * it belongs beside the other shared panel pieces rather than in the file that
 * happened to need it first.
 */
export function ToggleCard({
  checked,
  onChange,
  title,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  description: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
        checked
          ? "border-[var(--primary)] bg-[var(--primary)]/5 ring-1 ring-[var(--primary)]/30"
          : "border-[var(--border)] hover:bg-[var(--background)]"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-[var(--border)] accent-[var(--primary)]"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{title}</span>
        <span className="block text-xs text-[var(--muted)]">{description}</span>
      </span>
    </label>
  );
}
