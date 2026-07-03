export default function HeroSettingsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        <div className="h-4 w-16 bg-[var(--border)] rounded" />
        <div className="h-7 w-56 bg-[var(--border)] rounded" />
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm space-y-4">
        <div className="h-4 w-3/4 bg-[var(--border)] rounded" />
        <div className="h-10 w-full bg-[var(--border)] rounded-lg" />
        <div className="h-20 w-full bg-[var(--border)] rounded-lg" />
        <div className="h-10 w-28 bg-[var(--border)] rounded-lg" />
      </div>
    </div>
  );
}
