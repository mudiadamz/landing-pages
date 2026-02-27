"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full py-3 px-4 bg-[var(--primary)] text-[var(--primary-foreground)] font-medium rounded-lg shadow-sm
        transition-all duration-200 ease-out
        hover:scale-[1.02] hover:shadow-md
        active:scale-[0.98] active:shadow
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2
        disabled:scale-100 disabled:opacity-70 disabled:cursor-not-allowed"
    >
      {pending ? (
        <span className="inline-flex items-center justify-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Memproses…
        </span>
      ) : (
        "Daftar"
      )}
    </button>
  );
}
