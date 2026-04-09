import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/actions/profiles";
import { getAdminCategories } from "@/lib/actions/categories";
import { CategoriesTable } from "./categories-table";

export default async function CategoriesPage() {
  const isAdmin = await requireAdmin();
  if (!isAdmin) redirect("/panel");

  const categories = await getAdminCategories();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight">Kategori</h1>
      <CategoriesTable initialCategories={categories} />
    </div>
  );
}
