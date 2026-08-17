import type { Metadata } from "next";
import { LegalPageView, legalMetadata } from "@/components/legal-page-view";

/**
 * Terms of service. The copy is per-site data edited at /panel/legal; this route only
 * pins the URL, which the footer, the sitemap and the publisher application link to.
 */
export async function generateMetadata(): Promise<Metadata> {
  return legalMetadata("terms");
}

export default async function TermsPage() {
  return <LegalPageView pageKey="terms" />;
}
