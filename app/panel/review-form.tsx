"use client";

import { useState } from "react";
import { submitReview } from "@/lib/actions/reviews";
import { useRouter } from "next/navigation";

type Props = {
  landingPageId: string;
  existingRating: number;
  existingText: string;
  onDone: () => void;
};

export function ReviewForm({
  landingPageId,
  existingRating,
  existingText,
  onDone,
}: Props) {
  const router = useRouter();
  const [rating, setRating] = useState(existingRating || 0);
  const [hovered, setHovered] = useState(0);
  const [text, setText] = useState(existingText);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1) {
      setError("Pilih rating minimal 1 bintang");
      return;
    }
    setError(null);
    setLoading(true);
    const result = await submitReview(landingPageId, rating, text);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Rating
        </label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              type="button"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(0)}
              onClick={() => setRating(i)}
              className="p-0.5 transition-transform hover:scale-110"
            >
              <svg
                className={`w-7 h-7 transition-colors ${
                  i <= (hovered || rating)
                    ? "text-amber-500"
                    : "text-[var(--border)]"
                }`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="review-text" className="block text-sm font-medium text-foreground mb-1.5">
          Review <span className="text-[var(--muted)] font-normal">(opsional)</span>
        </label>
        <textarea
          id="review-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Ceritakan pengalamanmu menggunakan landing page ini..."
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-foreground placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 resize-none"
        />
        <p className="mt-1 text-xs text-[var(--muted)] text-right">{text.length}/500</p>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={loading || rating < 1}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-95 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Menyimpan…" : existingRating > 0 ? "Update review" : "Kirim review"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] text-[var(--muted)] hover:text-foreground transition-colors"
        >
          Batal
        </button>
      </div>
    </form>
  );
}
