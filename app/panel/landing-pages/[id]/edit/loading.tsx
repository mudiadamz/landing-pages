export default function EditPageLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <div className="h-4 w-16 bg-[var(--border)] rounded" />
          <div className="h-7 w-48 bg-[var(--border)] rounded" />
          <div className="h-7 w-24 bg-[var(--border)] rounded" />
        </div>
        <div className="h-8 w-44 bg-[var(--border)] rounded-lg" />
      </div>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm sm:p-6 space-y-5">
        <div className="h-5 w-40 bg-[var(--border)] rounded" />
        <div className="h-10 w-full bg-[var(--border)] rounded-lg" />
        <div className="h-10 w-full bg-[var(--border)] rounded-lg" />
        <div className="h-64 w-full bg-[var(--border)] rounded-lg" />
        <div className="h-10 w-32 bg-[var(--border)] rounded-lg" />
      </div>
    </div>
  );
}
