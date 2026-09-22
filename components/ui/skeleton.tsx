export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-[var(--muted)]/15 ${className}`} aria-hidden />;
}
