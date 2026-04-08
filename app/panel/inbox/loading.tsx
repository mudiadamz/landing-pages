export default function InboxLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-7 w-64 bg-[var(--border)] rounded" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
          <div className="p-3 border-b border-[var(--border)]">
            <div className="h-3 w-16 bg-[var(--border)] rounded" />
          </div>
          <div className="divide-y divide-[var(--border)]">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="px-4 py-3 space-y-2">
                <div className="h-4 w-3/4 bg-[var(--border)] rounded" />
                <div className="h-3 w-1/2 bg-[var(--border)] rounded" />
              </div>
            ))}
          </div>
        </div>
        <div className="lg:col-span-2 rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 flex items-center justify-center">
          <div className="h-4 w-48 bg-[var(--border)] rounded" />
        </div>
      </div>
    </div>
  );
}
