import { createElement } from "react";
import { currentSite } from "@/lib/site-resolve";
import {
  resolveTemplate,
  resolveCategory,
  resolveCategories,
  type ChromeProps,
  type TemplateProps,
  type CategoryTemplateProps,
  type CategoriesTemplateProps,
} from "./registry";

/**
 * Dispatchers: pick the component for whichever template this domain runs, and
 * render it.
 *
 * Every one of these exists so pages can render a STATICALLY IMPORTED component
 * instead of assigning one from a function call mid-render. The registry returns
 * stable references, so the assignment was harmless in practice — but it reads as
 * "new component identity each render" to both the linter and the next person, and
 * that pattern really does cause remounts when the reference isn't stable. Keeping
 * the lookup inside a component removes the question.
 *
 * The header/footer pair is DROP-IN with the shared SiteHeader/SiteFooter props, so
 * the twelve public pages swapped two imports and kept their own wrapper markup.
 *
 * Templates must not import this module: chrome -> registry -> template -> chrome
 * would be a runtime cycle. Each template imports its own chrome directly, which it
 * pairs with by construction anyway.
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

/** Homepage body + frame for this domain's template. */
export function TemplateHomeView(props: TemplateProps) {
  const { Home } = resolveTemplate(props.site.template);
  return <Home {...props} />;
}

/**
 * Category listing, falling back to the marketplace one when unslotted.
 *
 * createElement rather than `const C = resolve(...); <C/>`. That form reads as a
 * component created during render — React's lint rule flags it, and rightly so in
 * general, because a fresh identity each render remounts the subtree and drops its
 * state. Here the identity IS stable (resolveCategory returns the same object from
 * the module-level TEMPLATES registry), so the warning is a false positive — but
 * createElement states the intent directly instead of arguing with the rule.
 */
export function TemplateCategoryView(props: CategoryTemplateProps) {
  return createElement(resolveCategory(props.site.template), props);
}

/** Category index, falling back to the marketplace one when unslotted. */
export function TemplateCategoriesView(props: CategoriesTemplateProps) {
  return createElement(resolveCategories(props.site.template), props);
}
