export default function InvoiceLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-4 w-16 bg-[var(--border)] rounded" />
        <div className="h-9 w-24 bg-[var(--border)] rounded-lg" />
      </div>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:justify-between gap-4">
          <div className="space-y-2">
            <div className="h-6 w-28 bg-[var(--border)] rounded" />
            <div className="h-4 w-40 bg-[var(--border)] rounded" />
          </div>
          <div className="space-y-2 sm:items-end sm:flex sm:flex-col">
            <div className="h-4 w-24 bg-[var(--border)] rounded" />
            <div className="h-4 w-48 bg-[var(--border)] rounded" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="h-3 w-20 bg-[var(--border)] rounded" />
            <div className="h-4 w-32 bg-[var(--border)] rounded" />
            <div className="h-4 w-44 bg-[var(--border)] rounded" />
          </div>
          <div className="space-y-2 sm:items-end sm:flex sm:flex-col">
            <div className="h-3 w-16 bg-[var(--border)] rounded" />
            <div className="h-4 w-28 bg-[var(--border)] rounded" />
          </div>
        </div>
        <div className="h-24 w-full bg-[var(--border)] rounded-xl" />
      </div>
    </div>
  );
}
