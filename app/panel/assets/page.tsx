import { redirect } from "next/navigation";
import { deniedPath } from "@/lib/panel-view";
import { canSellProducts } from "@/lib/actions/profiles";
import { listLibraryAssets } from "@/lib/actions/assets";
import { AssetsBrowser } from "./assets-browser";
import { PanelPageHeader } from "@/components/panel-page-header";
import { translator } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";

export default async function AssetsPage() {
  const t = translator(await requestLocale());
  const canSell = await canSellProducts();
  if (!canSell) redirect(deniedPath("assets"));

  const assets = await listLibraryAssets();

  return (
    <div className="space-y-6">
      <PanelPageHeader backHref="/panel/products" title={t("panel.navAssets")} />

      <AssetsBrowser initialAssets={assets} />
    </div>
  );
}
