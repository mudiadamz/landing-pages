import { Fragment } from "react";
import { redirect } from "next/navigation";
import { deniedPath } from "@/lib/panel-view";
import { canSellProducts } from "@/lib/actions/profiles";
import { getCategories } from "@/lib/actions/landing-pages";
import { editingSite } from "@/lib/site-resolve";
import { NewProductModeTabs } from "./mode-tabs";
import { PanelPageHeader } from "@/components/panel-page-header";
import { translator } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";

const STEPS = [
  { n: 1, titleKey: "panel.createProduct", descKey: "panel.step1Desc" },
  { n: 2, titleKey: "panel.step2Title", descKey: "panel.step2Desc" },
] as const;

export default async function NewPagePage() {
  const t = translator(await requestLocale());
  const canSell = await canSellProducts();
  if (!canSell) redirect(deniedPath("products"));

  const categories = await getCategories((await editingSite()).business_id);

  const current = 1; // this page is always step 1; step 2 is the edit page

  return (
    <div className="space-y-6">
      <PanelPageHeader backHref="/panel/products" title={t("panel.titleNewProduct")} />

      {/* Step indicator: step 1 (this page) → step 2 (the edit page) */}
      <ol className="flex items-center gap-3 sm:gap-4">
        {STEPS.map((step, i) => {
          const active = step.n === current;
          const done = step.n < current;
          return (
            <Fragment key={step.n}>
              <li className="flex min-w-0 items-center gap-3">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                    active
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                      : done
                        ? "bg-[var(--primary)]/15 text-[var(--primary)]"
                        : "border border-[var(--border)] text-[var(--muted)]"
                  }`}
                >
                  {step.n}
                </span>
                <div className="min-w-0">
                  <p
                    className={`text-sm font-medium ${
                      active ? "text-foreground" : "text-[var(--muted)]"
                    }`}
                  >
                    {t(step.titleKey)}
                  </p>
                  <p className="truncate text-xs text-[var(--muted)]">{t(step.descKey)}</p>
                </div>
              </li>
              {i < STEPS.length - 1 && (
                <span className="h-px flex-1 bg-[var(--border)]" aria-hidden />
              )}
            </Fragment>
          );
        })}
      </ol>

      <NewProductModeTabs categories={categories} />

    </div>
  );
}
