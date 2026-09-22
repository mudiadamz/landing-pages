"use client";

import { useState, useTransition } from "react";
import { SaveBar } from "@/components/ui/save-bar";
import { updateRolePermissions } from "@/lib/actions/site-settings";
import { type FeatureKey } from "@/lib/features";
import type { ConfigurableRole, RolePermissions } from "@/lib/role-permissions";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n";

/**
 * Role × feature matrix for the whole panel — all 26 menus, not just the 10
 * delegatable ones (audit: the rest were invisible, so it was unclear whether
 * they were always-locked or always-open).
 *
 * kind decides how a row reads:
 *   everyone     every account has it (Dashboard, purchases, favourites)
 *   seller       anyone who can sell (Company, Agent, verified publisher)
 *   delegatable  Company & Agent always; Publisher/Customer are the toggles
 *   company      Company only, never delegated (the locked rows)
 */
type Kind = "everyone" | "seller" | "delegatable" | "company";
type Row = { labelKey: MessageKey; kind: Kind; feature?: FeatureKey };

const MATRIX: Row[] = [
  { labelKey: "panel.navDashboard", kind: "everyone" },
  { labelKey: "panel.navPurchases", kind: "everyone" },
  { labelKey: "panel.navFavorites", kind: "everyone" },
  { labelKey: "panel.navProducts", kind: "seller" },
  { labelKey: "panel.navAssets", kind: "seller" },
  { labelKey: "panel.navSales", kind: "delegatable", feature: "stats" },
  { labelKey: "panel.navUsers", kind: "delegatable", feature: "users" },
  { labelKey: "panel.navPlans", kind: "company" },
  { labelKey: "panel.navRoles", kind: "company" },
  { labelKey: "panel.navContacts", kind: "delegatable", feature: "contacts" },
  { labelKey: "panel.navInbox", kind: "delegatable", feature: "inbox" },
  { labelKey: "panel.navDomains", kind: "company" },
  { labelKey: "panel.navBranding", kind: "company" },
  { labelKey: "panel.navCategories", kind: "delegatable", feature: "categories" },
  { labelKey: "panel.navLinks", kind: "company" },
  { labelKey: "panel.navHero", kind: "delegatable", feature: "hero" },
  { labelKey: "panel.navContent", kind: "delegatable", feature: "content" },
  { labelKey: "panel.navLegal", kind: "delegatable", feature: "legal" },
  { labelKey: "panel.navHiring", kind: "delegatable", feature: "hiring" },
  { labelKey: "panel.navPages", kind: "company" },
  { labelKey: "panel.navAppearance", kind: "company" },
  { labelKey: "panel.navAnalytics", kind: "company" },
  { labelKey: "panel.navTracking", kind: "company" },
  { labelKey: "panel.navCustomJs", kind: "delegatable", feature: "custom-js" },
  { labelKey: "panel.navPopup", kind: "company" },
  { labelKey: "panel.navStorage", kind: "company" },
];

const CONFIGURABLE: ConfigurableRole[] = ["publisher", "customer"];

function FixedYes() {
  return (
    <span className="inline-flex text-[var(--primary)]" title="✓">
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
    </span>
  );
}
function FixedNo() {
  return <span className="text-[var(--muted)]/50" aria-hidden>—</span>;
}

export function RolesForm({ initial }: { initial: RolePermissions }) {
  const t = useT();
  const [perms, setPerms] = useState<RolePermissions>(initial);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok?: boolean; error?: string } | null>(null);
  const dirty = JSON.stringify(perms) !== JSON.stringify(initial);

  function toggle(role: ConfigurableRole, key: FeatureKey) {
    setPerms((p) => {
      const has = p[role].includes(key);
      return { ...p, [role]: has ? p[role].filter((k) => k !== key) : [...p[role], key] };
    });
    setStatus(null);
  }

  // What each column shows for a row. Only delegatable × {publisher,customer} is
  // an editable checkbox; everything else is a fixed ✓ / — that explains itself.
  function cell(row: Row, col: "company" | "agent" | "publisher" | "customer") {
    switch (row.kind) {
      case "everyone":
        return <FixedYes />;
      case "seller":
        return col === "customer" ? <FixedNo /> : <FixedYes />;
      case "company":
        return col === "company" ? <FixedYes /> : <FixedNo />;
      case "delegatable":
        if (col === "company" || col === "agent") return <FixedYes />;
        return (
          <input
            type="checkbox"
            checked={perms[col].includes(row.feature!)}
            onChange={() => toggle(col, row.feature!)}
            aria-label={`${t(row.labelKey)} — ${col}`}
            className="h-5 w-5 accent-[var(--primary)]"
          />
        );
    }
  }

  function reason(kind: Kind) {
    if (kind === "company")
      return { text: t("panel.roleReasonCompany"), locked: true };
    if (kind === "everyone") return { text: t("panel.roleReasonEveryone"), locked: false };
    if (kind === "seller") return { text: t("panel.roleReasonSeller"), locked: false };
    return null;
  }

  const cols: { key: "company" | "agent" | "publisher" | "customer"; label: string }[] = [
    { key: "company", label: "Company" },
    { key: "agent", label: "Agent" },
    { key: "publisher", label: "Publisher" },
    { key: "customer", label: "Customer" },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800/50 dark:bg-amber-900/15 dark:text-amber-200">
        {t("panel.roleLegend")}
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)]">
              <th className="px-4 py-3 font-medium">{t("panel.roleColFeature")}</th>
              {cols.map((c) => (
                <th key={c.key} className="px-3 py-3 text-center font-medium">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MATRIX.map((row) => {
              const r = reason(row.kind);
              return (
                <tr key={row.labelKey} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-1.5 text-foreground">
                      {r?.locked && (
                        <svg className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      )}
                      {t(row.labelKey)}
                      {r && (
                        <span className="ml-1 rounded bg-[var(--background)] px-1.5 py-0.5 text-[0.625rem] text-[var(--muted)]">
                          {r.text}
                        </span>
                      )}
                    </span>
                  </td>
                  {cols.map((c) => (
                    <td key={c.key} className="px-3 py-2.5 text-center">
                      <span className="inline-flex justify-center">{cell(row, c.key)}</span>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <SaveBar
        dirty={dirty}
        saving={pending}
        onSave={() => startTransition(async () => setStatus(await updateRolePermissions(perms)))}
        saveLabel={t("common.save")}
        savingLabel={t("common.saving")}
        unsavedLabel={t("common.unsavedChanges")}
        saved={!!status?.ok}
        savedLabel={t("common.saved")}
        error={status?.error ?? null}
      />
    </div>
  );
}
