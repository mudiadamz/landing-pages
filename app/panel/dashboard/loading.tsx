export default function DashboardLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="h-7 w-36 bg-[var(--border)] rounded" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6">
            <div className="h-4 w-24 bg-[var(--border)] rounded mb-2" />
            <div className="h-8 w-16 bg-[var(--border)] rounded" />
          </div>
        ))}
      </div>
      <div className="space-y-4">
        <div className="h-6 w-40 bg-[var(--border)] rounded" />
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-4 w-full bg-[var(--border)] rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}
