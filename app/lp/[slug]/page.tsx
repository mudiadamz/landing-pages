import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getLandingPageBySlug } from "@/lib/actions/landing-pages";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await getLandingPageBySlug(slug);
  if (!page) return { title: "Not found" };
  return { title: page.title };
}

export default async function LandingPageView({
  params,
}: Props) {
  const { slug } = await params;
  const page = await getLandingPageBySlug(slug);
  if (!page) notFound();

  return (
    <iframe
      srcDoc={page.html_content}
      title={page.title}
      className="w-full h-full min-h-full border-0 block"
      sandbox="allow-scripts allow-same-origin allow-modals"
    />
  );
}
