export default function CategoriesLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-7 w-32 bg-[var(--border)] rounded" />
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6 shadow-sm space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-5 w-5 bg-[var(--border)] rounded" />
            <div className="h-4 w-1/3 bg-[var(--border)] rounded" />
            <div className="ml-auto h-7 w-16 bg-[var(--border)] rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
