export default function CategoryLoading() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header bar */}
      <div className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--card)]/95">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
          <div className="h-6 w-28 bg-[var(--border)] rounded animate-pulse" />
          <div className="h-8 w-24 bg-[var(--border)] rounded animate-pulse" />
        </div>
      </div>
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 animate-pulse">
        <div className="h-8 w-56 bg-[var(--border)] rounded mb-3" />
        <div className="h-4 w-72 bg-[var(--border)] rounded mb-8" />
        {/* Sort tabs */}
        <div className="flex gap-2 mb-6">
          <div className="h-8 w-20 bg-[var(--border)] rounded-full" />
          <div className="h-8 w-20 bg-[var(--border)] rounded-full" />
        </div>
        {/* Card grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
              <div className="aspect-video bg-[var(--border)]" />
              <div className="p-4 space-y-3">
                <div className="h-5 w-3/4 bg-[var(--border)] rounded" />
                <div className="h-4 w-1/2 bg-[var(--border)] rounded" />
                <div className="h-6 w-24 bg-[var(--border)] rounded" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
