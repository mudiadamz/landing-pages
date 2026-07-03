export default function NewPageLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <div className="h-4 w-16 bg-[var(--border)] rounded" />
        <div className="h-7 w-48 bg-[var(--border)] rounded" />
      </div>
      {/* Step indicator */}
      <div className="flex items-center gap-3 sm:gap-4">
        {[1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-8 w-8 shrink-0 rounded-full bg-[var(--border)]" />
            <div className="space-y-1.5">
              <div className="h-4 w-24 bg-[var(--border)] rounded" />
              <div className="h-3 w-16 bg-[var(--border)] rounded" />
            </div>
            {i === 1 && <div className="h-px w-10 bg-[var(--border)]" />}
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm sm:p-6 space-y-5">
        <div className="space-y-1.5">
          <div className="h-5 w-28 bg-[var(--border)] rounded" />
          <div className="h-4 w-3/4 bg-[var(--border)] rounded" />
        </div>
        <div className="h-10 w-full bg-[var(--border)] rounded-lg" />
        <div className="h-10 w-full bg-[var(--border)] rounded-lg" />
        <div className="h-10 w-32 bg-[var(--border)] rounded-lg" />
      </div>
    </div>
  );
}
