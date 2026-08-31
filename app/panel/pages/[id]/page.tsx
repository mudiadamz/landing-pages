import { notFound, redirect } from "next/navigation";
import { requireSiteAdmin } from "@/lib/actions/profiles";
import { getPageForEdit } from "@/lib/actions/pages";
import { PanelPageHeader } from "@/components/panel-page-header";
import { PageEditForm } from "./page-edit-form";

export default async function EditPagePage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await requireSiteAdmin())) redirect("/panel");
  const { id } = await params;
  const page = await getPageForEdit(id);
  if (!page) notFound();

  return (
    <div className="space-y-6">
      <PanelPageHeader backHref="/panel/pages" title={page.title} identifier={`/p/${page.slug}`} />
      <PageEditForm page={page} />
    </div>
  );
}
