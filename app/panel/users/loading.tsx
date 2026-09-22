import { Skeleton } from "@/components/ui/skeleton";

// Mirrors app/panel/users/page.tsx: site filter + header, then the user table.
export default function UsersLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-full sm:max-w-xs" />

      <div className="space-y-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
        <div className="flex items-center gap-4 border-b border-[var(--border)] bg-[var(--background)]/50 px-4 py-3">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="ml-auto h-4 w-16" />
        </div>
        <div className="divide-y divide-[var(--border)]">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3.5">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="ml-auto h-8 w-20 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
