"use client";

import { useState, useTransition } from "react";
import { SaveBar } from "@/components/ui/save-bar";
import { updateRolePermissions } from "@/lib/actions/site-settings";
import { updateBusinessRolePermissions } from "@/lib/actions/business-money";
import { type FeatureKey } from "@/lib/features";
import type {
  BusinessConfigurableRole,
  BusinessRolePermissions,
  ConfigurableRole,
  RolePermissions,
} from "@/lib/role-permissions";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n";

/**
 * Role × feature matrix for the whole panel — all 26 menus, not just the 10
 * delegatable ones (audit: the rest were invisible, so it was unclear whether
 * they were always-locked or always-open).
 *
 * Four columns — one per standing — on two axes saved to two different places:
 *
 *   Platform, Owner   fixed ✓ — neither can be locked out of what they operate
 *   Staff             per BUSINESS  → lp_businesses.role_permissions
 *   Customer          per SITE      → lp_site_settings "role_permissions"
 *
 * kind decides how a row reads:
 *   everyone     every account has it (Dashboard, purchases, favourites)
 *   seller       anyone who can sell (Platform and any business member)
 *   delegatable  Platform & Owner always; Staff and Customer are the toggles
 *   company      Platform only, never delegated (the locked rows)
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

type Col = "platform" | "owner" | BusinessConfigurableRole | ConfigurableRole;

const BUSINESS_COLS: Col[] = ["staff"];
const isBusinessCol = (c: Col): c is BusinessConfigurableRole =>
  (BUSINESS_COLS as string[]).includes(c);

export function RolesForm({
  initial,
  initialBusiness,
  hasBusiness,
}: {
  initial: RolePermissions;
  initialBusiness: BusinessRolePermissions;
  /** No business owns this storefront → the Admin/Staff columns have nowhere to save. */
  hasBusiness: boolean;
}) {
  const t = useT();
  const [perms, setPerms] = useState<RolePermissions>(initial);
  const [bizPerms, setBizPerms] = useState<BusinessRolePermissions>(initialBusiness);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok?: boolean; error?: string } | null>(null);
  const siteDirty = JSON.stringify(perms) !== JSON.stringify(initial);
  const bizDirty = JSON.stringify(bizPerms) !== JSON.stringify(initialBusiness);
  const dirty = siteDirty || bizDirty;

  function toggle(col: Col, key: FeatureKey) {
    setStatus(null);
    const flip = (list: FeatureKey[]) =>
      list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
    if (isBusinessCol(col)) setBizPerms((p) => ({ ...p, [col]: flip(p[col]) }));
    else setPerms((p) => ({ ...p, [col]: flip(p[col as ConfigurableRole]) }));
  }

  function checked(col: Col, key: FeatureKey): boolean {
    return isBusinessCol(col)
      ? bizPerms[col].includes(key)
      : perms[col as ConfigurableRole].includes(key);
  }

  /**
   * Save only what changed. Two actions because two stores — and sending an
   * unchanged business matrix from a storefront with no business would fail for
   * a change the user did not make.
   */
  function save() {
    startTransition(async () => {
      if (siteDirty) {
        const res = await updateRolePermissions(perms);
        if (!res.ok) return setStatus(res);
      }
      if (bizDirty) {
        const res = await updateBusinessRolePermissions(bizPerms);
        if (!res.ok) return setStatus(res);
      }
      setStatus({ ok: true });
    });
  }

  // What each column shows for a row. Only delegatable × the four editable
  // columns is a checkbox; everything else is a fixed ✓ / — that explains itself.
  function cell(row: Row, col: Col) {
    switch (row.kind) {
      case "everyone":
        return <FixedYes />;
      case "seller":
        return col === "customer" ? <FixedNo /> : <FixedYes />;
      case "company":
        return col === "platform" ? <FixedYes /> : <FixedNo />;
      case "delegatable":
        if (col === "platform" || col === "owner") return <FixedYes />;
        return (
          <input
            type="checkbox"
            checked={checked(col, row.feature!)}
            disabled={isBusinessCol(col) && !hasBusiness}
            onChange={() => toggle(col, row.feature!)}
            aria-label={`${t(row.labelKey)} — ${col}`}
            className="h-5 w-5 accent-[var(--primary)] disabled:opacity-40"
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

  const cols: { key: Col; label: string }[] = [
    { key: "platform", label: t("panel.rolePlatform") },
    { key: "owner", label: t("panel.roleOwner") },
    { key: "staff", label: t("panel.roleStaff") },
    { key: "customer", label: t("panel.roleCustomer") },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800/50 dark:bg-amber-900/15 dark:text-amber-200">
        {t("panel.roleLegend")}
        {!hasBusiness && <span className="block mt-1">{t("panel.roleNoBusiness")}</span>}
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
        onSave={save}
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
