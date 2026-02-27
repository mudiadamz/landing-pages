import { notFound } from "next/navigation";
import Link from "next/link";
import { getLandingPageById } from "@/lib/actions/landing-pages";
import { Editor } from "./editor";

export default async function EditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const page = await getLandingPageById(id);
  if (!page) notFound();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Link
            href="/panel"
            className="text-foreground/70 hover:text-foreground text-sm"
          >
            ← Back
          </Link>
          <h1 className="text-xl font-semibold">Edit: {page.title}</h1>
          <span className="font-mono text-sm text-foreground/60">{page.slug}</span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/lp/${page.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-foreground/80 hover:underline"
          >
            Preview
          </a>
        </div>
      </div>
      <Editor id={id} slug={page.slug} initialHtml={page.html_content} />
    </div>
  );
}
