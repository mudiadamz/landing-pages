import { Skeleton } from "@/components/ui/skeleton";

// Mirrors app/panel/roles/page.tsx: site filter + back/title header, an intro
// line, then the role/feature permission matrix.
export default function RolesLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-full sm:max-w-xs" />

      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-6 w-40" />
      </div>

      <Skeleton className="h-4 w-80 max-w-full" />

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
        <div className="flex items-center gap-4 border-b border-[var(--border)] bg-[var(--background)]/50 px-4 py-3.5">
          <Skeleton className="h-4 w-32" />
          <div className="ml-auto flex gap-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-4 w-16" />
            ))}
          </div>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {[0, 1, 2, 3, 4, 5].map((row) => (
            <div key={row} className="flex items-center gap-4 px-4 py-3.5">
              <Skeleton className="h-4 w-1/4" />
              <div className="ml-auto flex gap-3">
                {[0, 1, 2, 3].map((cell) => (
                  <Skeleton key={cell} className="h-6 w-10 rounded-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
