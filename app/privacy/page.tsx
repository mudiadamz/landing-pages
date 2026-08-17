import type { Metadata } from "next";
import { LegalPageView, legalMetadata } from "@/components/legal-page-view";

/**
 * Privacy policy. The copy is per-site data edited at /panel/legal; this route only
 * pins the URL, which the footer, the sitemap and the signup form link to.
 */
export async function generateMetadata(): Promise<Metadata> {
  return legalMetadata("privacy");
}

export default async function PrivacyPage() {
  return <LegalPageView pageKey="privacy" />;
}
