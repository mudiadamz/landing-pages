import { redirect } from "next/navigation";
import { canSellProducts } from "@/lib/actions/profiles";
import { listLibraryAssets } from "@/lib/actions/assets";
import { AssetsBrowser } from "./assets-browser";
import { PanelPageHeader } from "@/components/panel-page-header";

export default async function AssetsPage() {
  const canSell = await canSellProducts();
  if (!canSell) redirect("/panel");

  const assets = await listLibraryAssets();

  return (
    <div className="space-y-6">
      <PanelPageHeader backHref="/panel/products" title="Assets" />

      <AssetsBrowser initialAssets={assets} />
    </div>
  );
}
