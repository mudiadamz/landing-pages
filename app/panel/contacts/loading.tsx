export default function ContactsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        <div className="h-4 w-16 bg-[var(--border)] rounded" />
        <div className="h-7 w-44 bg-[var(--border)] rounded" />
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden shadow-sm">
        <div className="border-b border-[var(--border)] bg-[var(--background)]/50 px-4 py-3.5">
          <div className="h-4 w-full max-w-md bg-[var(--border)] rounded" />
        </div>
        <div className="divide-y divide-[var(--border)]">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex gap-4 px-4 py-3.5">
              <div className="h-4 w-1/4 bg-[var(--border)] rounded" />
              <div className="h-4 w-1/4 bg-[var(--border)] rounded" />
              <div className="h-4 flex-1 bg-[var(--border)] rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
