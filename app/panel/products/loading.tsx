import { Skeleton } from "@/components/ui/skeleton";

// Mirrors app/panel/products/page.tsx: title + create button, then the product
// list (rendered here as a card of rows to avoid a layout jump).
export default function ProductsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-10 w-36" />
      </div>

      <Skeleton className="h-10 w-full sm:max-w-sm" />

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
        <div className="divide-y divide-[var(--border)]">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3.5">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="ml-auto h-8 w-8" />
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-8 w-8" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
