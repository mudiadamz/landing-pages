export default function CheckoutDoneLoading() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="h-14 sm:h-16 border-b border-[var(--border)]" />
      <main className="flex-1 w-full max-w-xl mx-auto px-4 sm:px-6 py-12 sm:py-16 animate-pulse">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8 text-center space-y-4">
          <div className="mx-auto h-14 w-14 rounded-full bg-[var(--border)]" />
          <div className="mx-auto h-6 w-48 bg-[var(--border)] rounded" />
          <div className="mx-auto h-4 w-64 bg-[var(--border)] rounded" />
          <div className="mx-auto h-12 w-40 bg-[var(--border)] rounded-xl" />
        </div>
      </main>
    </div>
  );
}
