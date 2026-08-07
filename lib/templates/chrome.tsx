import { currentSite } from "@/lib/site-resolve";
import { resolveTemplate, type ChromeProps } from "./registry";

/**
 * Header and footer for whichever template this domain runs.
 *
 * Deliberately DROP-IN: same props as the shared SiteHeader/SiteFooter, so every
 * public page swaps two imports and nothing else. The alternative — a shell
 * component that owns each page's outer frame — would have meant rewriting the
 * wrapper markup of twelve pages at once, which is a lot of regression risk for
 * pages that are already correct.
 *
 * These are server components so the template lookup happens per request. The
 * template's own chrome may be a client component (the default one is); rendering
 * a client component from here is fine, the boundary just moves inward.
 *
 * Not used on /lp/[slug] or /panel: the product preview is deliberately chrome-free
 * fullscreen, and the panel has its own sidebar.
 */

export async function TemplateHeader(props: ChromeProps) {
  const site = await currentSite();
  const { Header } = resolveTemplate(site.template);
  return <Header {...props} />;
}

export async function TemplateFooter() {
  const site = await currentSite();
  const { Footer } = resolveTemplate(site.template);
  return <Footer />;
}
