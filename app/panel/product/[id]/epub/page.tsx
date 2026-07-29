import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { canSellProducts } from "@/lib/actions/profiles";
import { getLandingPageById } from "@/lib/actions/landing-pages";
import { EpubChapterEditor } from "./epub-chapter-editor";

export const metadata = { title: "Edit isi EPUB" };

export default async function EpubChaptersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await canSellProducts())) redirect("/panel");

  const { id } = await params;
  const page = await getLandingPageById(id);
  if (!page) notFound();

  const row = page as unknown as {
    title: string;
    slug: string;
    preview_type: string | null;
    preview_url: string | null;
    story_epub_url: string | null;
  };

  // A product can have a free sample, the full book, or both — and they are
  // separate files. Only offer the ones that exist.
  const hasPreview = row.preview_type === "epub" && !!row.preview_url;
  const hasDeliverable = !!row.story_epub_url;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <Link
          href={`/panel/product/${id}/edit`}
          className="text-sm text-[var(--muted)] transition-colors hover:text-foreground"
        >
          ← Kembali ke produk
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">Edit isi EPUB</h1>
        <span className="w-fit rounded bg-[var(--background)] px-2 py-1 font-mono text-sm text-[var(--muted)]">
          {row.slug}
        </span>
      </div>

      {!hasPreview && !hasDeliverable ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <p className="text-sm text-[var(--muted)]">
            Produk ini belum punya file EPUB. Upload dulu di{" "}
            <Link
              href={`/panel/product/${id}/edit`}
              className="font-medium text-[var(--primary)] hover:underline"
            >
              halaman produk
            </Link>
            , lalu kembali ke sini untuk mengedit per bab.
          </p>
        </div>
      ) : (
        <EpubChapterEditor
          pageId={id}
          title={row.title}
          hasPreview={hasPreview}
          hasDeliverable={hasDeliverable}
        />
      )}
    </div>
  );
}
