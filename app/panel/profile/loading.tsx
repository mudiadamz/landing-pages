export default function ProfileLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        <div className="h-4 w-16 bg-[var(--border)] rounded" />
        <div className="h-7 w-24 bg-[var(--border)] rounded" />
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden shadow-sm">
        <div className="p-4 sm:p-6 border-b border-[var(--border)] bg-[var(--background)]/50 space-y-2">
          <div className="h-5 w-32 bg-[var(--border)] rounded" />
          <div className="h-4 w-56 bg-[var(--border)] rounded" />
        </div>
        <div className="p-4 sm:p-6 space-y-6">
          <div className="space-y-2">
            <div className="h-3 w-16 bg-[var(--border)] rounded" />
            <div className="h-4 w-48 bg-[var(--border)] rounded" />
          </div>
          <div className="space-y-2">
            <div className="h-3 w-20 bg-[var(--border)] rounded" />
            <div className="h-7 w-24 bg-[var(--border)] rounded-md" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-20 bg-[var(--border)] rounded" />
            <div className="h-10 w-full bg-[var(--border)] rounded-lg" />
            <div className="h-10 w-28 bg-[var(--border)] rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
