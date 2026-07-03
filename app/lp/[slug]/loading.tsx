export default function LandingPreviewLoading() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Preview bar */}
      <div className="h-14 shrink-0 border-b border-[var(--border)] bg-[var(--card)] flex items-center justify-between px-4 animate-pulse">
        <div className="h-8 w-24 bg-[var(--border)] rounded-lg" />
        <div className="h-8 w-32 bg-[var(--border)] rounded-lg" />
      </div>
      {/* Preview surface */}
      <div className="flex-1 flex items-center justify-center bg-[var(--background)]">
        <div
          className="h-8 w-8 rounded-full border-2 border-[var(--border)] border-t-[var(--primary)] animate-spin"
          aria-label="Memuat preview"
          role="status"
        />
      </div>
    </div>
  );
}
