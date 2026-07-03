// Neutral, universal fallback for public routes without a closer loading.tsx.
// Kept layout-agnostic (no header/footer assumptions) since it covers pages
// with and without the site chrome (home, legal, login, checkout, hiring…).
export default function RootLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div
        className="h-8 w-8 rounded-full border-2 border-[var(--border)] border-t-[var(--primary)] animate-spin"
        aria-label="Memuat"
        role="status"
      />
    </div>
  );
}
