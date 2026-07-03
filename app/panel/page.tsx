import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { getProfile } from "@/lib/actions/profiles";
import { getLandingPagesForUser } from "@/lib/actions/landing-pages";
import { getPurchasesForUser, getInvoicesForUser } from "@/lib/actions/purchases";
import { getReviewsByUser } from "@/lib/actions/reviews";
import { ProductList } from "./product-list";

const CustomerTabs = dynamic(() =>
  import("./customer-tabs").then((m) => m.CustomerTabs),
);

export default async function PanelPage() {
  const profile = await getProfile();
  const isAdmin = profile?.role === "admin";

  if (!isAdmin) {
    return <CustomerPanel />;
  }

  return <AdminPanel />;
}

async function CustomerPanel() {
  const [purchases, invoices, reviews] = await Promise.all([
    getPurchasesForUser(),
    getInvoicesForUser(),
    getReviewsByUser(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight">Pembelian saya</h1>
      <CustomerTabs purchases={purchases} invoices={invoices} reviews={reviews} />
    </div>
  );
}

async function AdminPanel() {
  const pages = await getLandingPagesForUser();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight">Produk digital</h1>
        <Button
          size="md"
          href="/panel/landing-pages/new"
          leftIcon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          }
          className="gap-2 hover:opacity-90"
        >
          Buat baru
        </Button>
      </div>

      {pages.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 sm:p-12 text-center shadow-sm">
          <p className="text-sm text-[var(--muted)]">Belum ada produk digital.</p>
          <div className="mt-4 flex justify-center">
            <Button size="md" href="/panel/landing-pages/new" className="gap-2 hover:opacity-90">
              Buat produk baru
            </Button>
          </div>
        </div>
      ) : (
        <ProductList pages={pages} />
      )}
    </div>
  );
}
