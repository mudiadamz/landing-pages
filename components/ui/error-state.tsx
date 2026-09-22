"use client";

/**
 * A failed load, told apart from an empty one (the audit's core "error shown as
 * empty data" finding). Red-tinted card with a retry action, so "it broke" never
 * reads as "there is nothing here".
 */
export function ErrorState({
  title,
  message,
  onRetry,
  retryLabel = "Coba lagi",
  className = "",
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={`rounded-xl border border-red-500/30 bg-red-500/5 p-8 text-center shadow-sm sm:p-12 ${className}`}
    >
      {title && (
        <p className="text-sm font-semibold text-red-700 dark:text-red-400">{title}</p>
      )}
      <p className="mx-auto mt-1 max-w-md text-sm text-red-700/90 dark:text-red-400/90">
        {message}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex min-h-[40px] items-center rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-[var(--primary)]"
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}
