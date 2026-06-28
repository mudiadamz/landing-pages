import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getLandingPageBySlug, getLandingPageForCheckout } from "@/lib/actions/landing-pages";
import { buildMetaDescription } from "@/lib/seo";
import { guardPreviewHtml } from "@/lib/preview-guard";
import { PreviewBar } from "../preview-bar";
import { PreviewGuardClient } from "../preview-guard-client";

const getPageBySlug = cache((slug: string) => getLandingPageBySlug(slug));
const getCheckoutData = cache((slug: string) => getLandingPageForCheckout(slug));

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [page, checkoutData] = await Promise.all([
    getPageBySlug(slug),
    getCheckoutData(slug),
  ]);
  if (!page) return { title: "Not found" };
  const description = buildMetaDescription(
    checkoutData?.long_description,
    `Preview ${page.title} — template landing page siap pakai. Lihat demo langsung sebelum beli.`,
  );
  const url = `/lp/${slug}`;
  const images = checkoutData?.thumbnail_url ? [checkoutData.thumbnail_url] : undefined;
  return {
    title: page.title,
    description,
    alternates: { canonical: url },
    openGraph: { title: page.title, description, url, images, type: "website" },
    twitter: { card: "summary_large_image", title: page.title, description, images },
  };
}

export default async function LandingPageView({ params }: Props) {
  const { slug } = await params;
  const page = await getPageBySlug(slug);
  if (!page) notFound();

  // Preview source: an uploaded PDF or external link is embedded directly;
  // otherwise the inline HTML is rendered (with anti-copy guards).
  const previewUrl = page.preview_url?.trim() || null;
  const embedPdf = page.preview_type === "pdf" && !!previewUrl;
  const embedLink = page.preview_type === "link" && !!previewUrl;

  return (
    <>
      <PreviewGuardClient />
      {embedPdf ? (
        <iframe
          src={`${previewUrl}#toolbar=0&navpanes=0`}
          title={page.title}
          className="w-full h-full min-h-full border-0 block"
        />
      ) : embedLink ? (
        <iframe
          src={previewUrl ?? undefined}
          title={page.title}
          className="w-full h-full min-h-full border-0 block"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals"
        />
      ) : (
        <iframe
          srcDoc={guardPreviewHtml(page.html_content)}
          title={page.title}
          className="w-full h-full min-h-full border-0 block"
          sandbox="allow-scripts allow-same-origin allow-modals"
        />
      )}
      <PreviewBar />
    </>
  );
}
