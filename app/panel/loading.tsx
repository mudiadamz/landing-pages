export default function PanelLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-7 w-48 bg-[var(--border)] rounded" />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm"
          >
            <div className="h-5 w-3/4 bg-[var(--border)] rounded mb-2" />
            <div className="h-4 w-1/2 bg-[var(--border)] rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
