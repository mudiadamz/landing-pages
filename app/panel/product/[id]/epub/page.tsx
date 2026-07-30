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
  const hasPreview =
    (row.preview_type === "epub" || row.preview_type === "excerpt") && !!row.preview_url;
  const hasDeliverable = !!row.story_epub_url;

  // No EPUB yet: there's nothing for the editor to render, so keep a plain
  // header here. Otherwise the editor owns the header row, because the file
  // switcher lives on it and needs the editor's state.
  if (!hasPreview && !hasDeliverable) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <BackButton id={id} />
          <h1 className="text-lg font-semibold tracking-tight">Edit isi EPUB</h1>
        </div>
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
      </div>
    );
  }

  return (
    <EpubChapterEditor
      pageId={id}
      title={row.title}
      slug={row.slug}
      hasPreview={hasPreview}
      hasDeliverable={hasDeliverable}
    />
  );
}

function BackButton({ id }: { id: string }) {
  return (
    <Link
      href={`/panel/product/${id}/edit`}
      title="Kembali ke produk"
      aria-label="Kembali ke produk"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted)] transition-colors hover:bg-[var(--background)] hover:text-foreground"
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
    </Link>
  );
}
