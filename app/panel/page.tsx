import { redirect } from "next/navigation";
import { canSellProducts } from "@/lib/actions/profiles";

export default async function PanelPage() {
  // Sellers land on their products; everyone else on their purchases.
  const canSell = await canSellProducts();
  redirect(canSell ? "/panel/products" : "/panel/purchases");
}
