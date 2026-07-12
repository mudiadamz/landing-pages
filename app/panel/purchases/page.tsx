import dynamic from "next/dynamic";
import { getPurchasesForUser, getInvoicesForUser } from "@/lib/actions/purchases";
import { getReviewsByUser } from "@/lib/actions/reviews";

const CustomerTabs = dynamic(() => import("../customer-tabs").then((m) => m.CustomerTabs));

export default async function PurchasesPage() {
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
