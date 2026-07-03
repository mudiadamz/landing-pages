export default function UploadLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        <div className="h-4 w-16 bg-[var(--border)] rounded" />
        <div className="h-7 w-64 bg-[var(--border)] rounded" />
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6 shadow-sm space-y-4">
        <div className="h-32 w-full bg-[var(--border)] rounded-lg" />
        <div className="h-10 w-32 bg-[var(--border)] rounded-lg" />
      </div>
    </div>
  );
}
