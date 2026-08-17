/**
 * The two review bits a CLIENT component also needs.
 *
 * They used to live in verified-reviews.tsx beside VerifiedReviews, which is an
 * async server component and therefore imports next/headers. Testimonials is a
 * client component and imports both of these, which dragged next/headers into
 * the browser bundle and failed the build. Splitting the module is the fix; the
 * server list keeps its own file.
 */
/**
 * `label` is a prop rather than a t() call: this badge is rendered from
 * Testimonials, a client component, so the module cannot reach next/headers.
 */
export function VerifiedBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--primary)]">
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      {label}
    </span>
  );
}

export function formatReviewMonth(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  return new Date(t).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}
