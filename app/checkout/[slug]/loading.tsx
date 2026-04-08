export default function CheckoutLoading() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="h-14 border-b border-[var(--border)]" />
      <main className="flex-1 w-full max-w-xl mx-auto px-4 sm:px-6 py-8 sm:py-12 animate-pulse">
        <div className="h-4 w-32 bg-[var(--border)] rounded mb-6" />
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
          <div className="aspect-video bg-[var(--border)]" />
          <div className="p-5 sm:p-6 space-y-4">
            <div className="h-6 w-3/4 bg-[var(--border)] rounded" />
            <div className="h-8 w-32 bg-[var(--border)] rounded" />
            <div className="space-y-2">
              <div className="h-3 w-full bg-[var(--border)] rounded" />
              <div className="h-3 w-5/6 bg-[var(--border)] rounded" />
            </div>
            <div className="h-12 w-full bg-[var(--border)] rounded-xl" />
          </div>
        </div>
      </main>
    </div>
  );
}
