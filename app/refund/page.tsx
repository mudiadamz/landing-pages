import type { Metadata } from "next";
import { LegalPageView, legalMetadata } from "@/components/legal-page-view";

/**
 * Refund policy. The copy is per-site data edited at /panel/legal; this route only
 * pins the URL, which the footer, the sitemap and the checkout guarantee link to.
 */
export async function generateMetadata(): Promise<Metadata> {
  return legalMetadata("refund");
}

export default async function RefundPage() {
  return <LegalPageView pageKey="refund" />;
}
