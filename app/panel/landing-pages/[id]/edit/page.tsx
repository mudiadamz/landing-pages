import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/actions/profiles";
import { getLandingPageById } from "@/lib/actions/landing-pages";
import { Editor } from "./editor";
import { PricingForm } from "./pricing-form";

export default async function EditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const isAdmin = await requireAdmin();
  if (!isAdmin) redirect("/panel");

  const { id } = await params;
  const page = await getLandingPageById(id);
  if (!page) notFound();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Link
            href="/panel"
            className="text-sm text-[var(--muted)] hover:text-foreground transition-colors"
          >
            ← Back
          </Link>
          <h1 className="text-xl font-semibold tracking-tight">
            Edit: {page.title}
          </h1>
          <span className="font-mono text-sm text-[var(--muted)] bg-[var(--background)] px-2 py-1 rounded">
            {page.slug}
          </span>
        </div>
        <a
          href={`/lp/${page.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-[var(--primary)] hover:underline"
        >
          Preview
        </a>
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
        <Editor id={id} slug={page.slug} initialHtml={page.html_content} />
      </div>
      <PricingForm
        pageId={id}
        initial={{
          price: page.price,
          price_discount: page.price_discount,
          is_free: page.is_free,
          purchase_link: page.purchase_link,
          featured: page.featured,
          thumbnail_url: page.thumbnail_url,
        }}
      />
    </div>
  );
}
