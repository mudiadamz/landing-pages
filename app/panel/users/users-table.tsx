"use client";

import { PLANS, PLAN_LIST, normalizePlan } from "@/lib/plans";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/client";

type AccountType = "company" | "agent" | "customer";
type RoleFilter = "all" | AccountType;
type VerifyFilter = "all" | "unverified" | "verified";

type UserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  account_type: AccountType;
  is_active: boolean;
  exclude_from_stats?: boolean;
  /**
   * When they proved they own the address, null if never. Since signup stopped
   * waiting on confirmation, an account can be fully usable and still unproven —
   * so this is worth seeing here, next to the ban control.
   */
  email_verified_at?: string | null;
  /** Plan key as stored. `plan_expires_at` null means it does not lapse. */
  plan?: string | null;
  plan_expires_at?: string | null;
  /** Mengelola situs yang sedang dilihat. null = tampilan lintas situs. */
  is_agent?: boolean | null;
  /** Boleh menjual di situs yang sedang dilihat. */
  is_publisher?: boolean | null;
};

export function UsersTable({
  isAdmin = false,
  isSiteAdmin = false,
}: {
  /** Platform admin: role platform, paket, ban, hapus akun. */
  isAdmin?: boolean;
  /** Admin situs yang sedang dilihat: keanggotaan situs itu. */
  isSiteAdmin?: boolean;
}) {
  const t = useT();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  // "Semua situs" hanya ada untuk platform admin; API menolaknya untuk yang lain.
  const [allSites, setAllSites] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [verifyFilter, setVerifyFilter] = useState<VerifyFilter>("all");

  // Error kept apart from "empty": a failed fetch must not read as "no members",
  // which is exactly the bug that made an API 500 look like an empty site.
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    fetch(allSites ? "/api/admin/users?scope=all" : "/api/admin/users")
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (cancelled) return;
        if (r.ok && Array.isArray(data)) setUsers(data);
        else setLoadError(true);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [allSites, reloadKey]);

  /**
   * Dua saklar, bukan satu dropdown role.
   *
   * "Mengelola situs ini" dan "boleh menjual di situs ini" adalah dua fakta yang
   * disimpan di dua tabel, dan seseorang bisa keduanya sekaligus. Satu dropdown
   * memaksa keduanya jadi pilihan yang saling meniadakan, yang bukan modelnya.
   */
  async function toggleSiteFlag(user: UserRow, field: "isAgent" | "isPublisher", next: boolean) {
    const key = field === "isAgent" ? "is_agent" : "is_publisher";
    const prev = user[key];
    setUsers((list) => list.map((u) => (u.id === user.id ? { ...u, [key]: next } : u)));
    setUpdating(user.id);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, [field]: next }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? t("panel.roleChangeFailed"));
        setUsers((list) => list.map((u) => (u.id === user.id ? { ...u, [key]: prev } : u)));
      }
    } finally {
      setUpdating(null);
    }
  }

  async function removeFromSite(user: UserRow) {
    if (!confirm(t("panel.removeFromSiteConfirm", { name: user.full_name || user.email || "user" }))) {
      return;
    }
    setUpdating(user.id);
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, fromSite: true }),
      });
      const data = await res.json();
      if (res.ok) {
        setUsers((list) => list.filter((u) => u.id !== user.id));
      } else {
        alert(data.error ?? t("panel.removeFromSiteFailed"));
      }
    } finally {
      setUpdating(null);
    }
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    const email = inviteEmail.trim();
    if (!email) return;
    setUpdating("invite");
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        setInviteEmail("");
        // Dibaca ulang, bukan ditebak: barisnya butuh profil lengkap yang tidak
        // dipegang form ini.
        const rows = await fetch("/api/admin/users").then((r) => r.json());
        if (Array.isArray(rows)) setUsers(rows);
      } else {
        alert(data.error ?? t("panel.addMemberFailed"));
      }
    } finally {
      setUpdating(null);
    }
  }

  async function changeRole(user: UserRow, accountType: AccountType) {
    if (accountType === user.account_type) return;
    const prev = user.account_type;
    setUsers((list) => list.map((u) => (u.id === user.id ? { ...u, account_type: accountType } : u)));
    setUpdating(user.id);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, accountType }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? t("panel.roleChangeFailed"));
        setUsers((list) => list.map((u) => (u.id === user.id ? { ...u, account_type: prev } : u)));
      }
    } finally {
      setUpdating(null);
    }
  }

  async function changePlan(user: UserRow, plan: string) {
    if (plan === (user.plan ?? "free")) return;
    const prev = user.plan ?? "free";
    // Granting by hand clears the expiry, which is what the API does too — the
    // optimistic row has to say the same thing or it will flip back on reload.
    setUsers((list) =>
      list.map((u) => (u.id === user.id ? { ...u, plan, plan_expires_at: null } : u)),
    );
    setUpdating(user.id);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, plan }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? t("common.failed"));
        setUsers((list) => list.map((u) => (u.id === user.id ? { ...u, plan: prev } : u)));
      }
    } finally {
      setUpdating(null);
    }
  }

  async function toggleStats(user: UserRow) {
    const next = !user.exclude_from_stats;
    setUpdating(user.id);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, excludeFromStats: next }),
      });
      const data = await res.json();
      if (res.ok) {
        setUsers((list) =>
          list.map((u) => (u.id === user.id ? { ...u, exclude_from_stats: next } : u)),
        );
      } else {
        alert(data.error ?? t("panel.statsToggleFailed"));
      }
    } finally {
      setUpdating(null);
    }
  }

  async function toggleActive(user: UserRow) {
    const nextActive = !user.is_active;
    if (
      !nextActive &&
      !confirm(
        t("panel.banConfirm", { name: user.full_name || user.email || "user" }),
      )
    ) {
      return;
    }
    setUpdating(user.id);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, active: nextActive }),
      });
      const data = await res.json();
      if (res.ok) {
        setUsers((list) => list.map((u) => (u.id === user.id ? { ...u, is_active: nextActive } : u)));
      } else {
        alert(data.error ?? t("panel.statusChangeFailed"));
      }
    } finally {
      setUpdating(null);
    }
  }

  async function removeUser(user: UserRow) {
    if (!confirm(t("panel.deleteUserConfirm", { name: user.full_name || user.email || "user" }))) {
      return;
    }
    setUpdating(user.id);
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (res.ok) {
        // Dropped from the list rather than re-fetched: the row is gone at the
        // source, and a refetch would only redraw the same table more slowly.
        setUsers((list) => list.filter((u) => u.id !== user.id));
      } else {
        alert(data.error ?? t("panel.deleteUserFailed"));
      }
    } finally {
      setUpdating(null);
    }
  }

  const unverifiedCount = users.filter((u) => !u.email_verified_at).length;

  const filtered = users.filter((u) => {
    if (roleFilter !== "all" && u.account_type !== roleFilter) return false;
    if (verifyFilter === "unverified" && u.email_verified_at) return false;
    if (verifyFilter === "verified" && !u.email_verified_at) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.full_name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.account_type.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 text-center">
        <p className="text-sm text-[var(--muted)]">{t("panel.loadingUsers")}</p>
      </div>
    );
  }

  // Kolom role-situs ada selama daftarnya memang daftar anggota satu situs.
  // Dalam tampilan "semua situs" tidak ada satu role yang bisa ditampilkan.
  const showSiteRole = !allSites;

  return (
    <div className="space-y-4">
      {isAdmin || (isSiteAdmin && !allSites) ? (
        <div className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 sm:flex-row sm:items-center">
          {isAdmin && (
            <div className="flex shrink-0 rounded-lg border border-[var(--border)] p-0.5 text-xs font-medium">
              {[
                { key: false, label: t("panel.scopeThisSite") },
                { key: true, label: t("panel.scopeAllSites") },
              ].map((opt) => (
                <button
                  key={String(opt.key)}
                  type="button"
                  onClick={() => setAllSites(opt.key)}
                  className={`rounded-md px-3 py-1.5 transition-colors ${
                    allSites === opt.key
                      ? "bg-[var(--accent-subtle)] text-[var(--primary)]"
                      : "text-[var(--muted)] hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
          {isSiteAdmin && !allSites && (
            <form onSubmit={invite} className="flex flex-1 items-center gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder={t("panel.addMemberEmail")}
                autoComplete="off"
                className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-base sm:text-sm text-foreground placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
              />
              <button
                type="submit"
                disabled={updating === "invite" || !inviteEmail.trim()}
                className="shrink-0 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {t("panel.addMember")}
              </button>
            </form>
          )}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-sm">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("panel.searchUsers")}
            className="w-full pl-9 pr-3 py-2 border border-[var(--border)] rounded-lg bg-background text-foreground text-base sm:text-sm placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
          className="rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-base sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
          aria-label={t("panel.filterRole")}
        >
          <option value="all">{t("panel.allRoles")}</option>
          <option value="company">Company</option>
          <option value="publisher">Publisher</option>
          <option value="customer">Customer</option>
        </select>
        <select
          value={verifyFilter}
          onChange={(e) => setVerifyFilter(e.target.value as VerifyFilter)}
          className="rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-base sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
          aria-label={t("panel.filterVerified")}
        >
          <option value="all">{t("panel.allEmails")}</option>
          <option value="unverified">{t("panel.notVerified")}</option>
          <option value="verified">{t("panel.verified")}</option>
        </select>
        <span className="text-xs text-[var(--muted)]">
          {filtered.length} user
          {unverifiedCount > 0 && (
            <>
              {" · "}
              <button
                type="button"
                onClick={() => setVerifyFilter("unverified")}
                className="font-medium text-amber-700 underline-offset-2 hover:underline dark:text-amber-400"
              >
                {t("panel.unverifiedCount", { count: unverifiedCount })}
              </button>
            </>
          )}
        </span>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {filtered.map((u) => (
          <div key={u.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-foreground truncate">{u.full_name || "—"}</p>
                <p className="text-sm text-[var(--muted)] truncate">{u.email || "—"}</p>
              </div>
              <div className="flex items-center gap-2">
                <VerifyBadge verifiedAt={u.email_verified_at} />
                <StatusBadge active={u.is_active} />
                {isAdmin && (
                  <BanButton user={u} disabled={updating === u.id} onClick={() => toggleActive(u)} />
                )}
                {isAdmin && (
                  <DeleteUserButton user={u} disabled={updating === u.id} onClick={() => removeUser(u)} />
                )}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-start gap-2">
              <RoleControl user={u} canEdit={isAdmin} disabled={updating === u.id} onChange={changeRole} />
              <PlanControl user={u} canEdit={isAdmin} disabled={updating === u.id} onChange={changePlan} />
              {showSiteRole && (
                <SiteFlags
                  user={u}
                  canEdit={isSiteAdmin}
                  disabled={updating === u.id}
                  onToggle={toggleSiteFlag}
                />
              )}
              {showSiteRole && isSiteAdmin && (
                <button
                  type="button"
                  onClick={() => removeFromSite(u)}
                  disabled={updating === u.id}
                  className="rounded-lg px-2 py-1 text-xs text-[var(--muted)] hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-900/20"
                >
                  {t("panel.removeFromSite")}
                </button>
              )}
            </div>
          </div>
        ))}
        {loadError ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6 text-center text-sm">
            <p className="text-red-700 dark:text-red-400">{t("panel.usersLoadError")}</p>
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="mt-3 inline-flex min-h-[36px] items-center rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm font-medium text-foreground hover:border-[var(--primary)]"
            >
              {t("common.retry")}
            </button>
          </div>
        ) : (
          filtered.length === 0 && (
            <p className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 text-center text-sm text-[var(--muted)]">
              {t("panel.noUsers")}
            </p>
          )
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--background)]/50">
                <th className="text-left px-4 py-3 font-medium text-[var(--muted)]">{t("content.name")}</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--muted)]">{t("sales.email")}</th>
                <th className="text-center px-4 py-3 font-medium text-[var(--muted)]">{t("panel.role")}</th>
                {showSiteRole && (
                  <th className="text-center px-4 py-3 font-medium text-[var(--muted)]">
                    {t("panel.siteFlags")}
                  </th>
                )}
                <th className="text-center px-4 py-3 font-medium text-[var(--muted)]">{t("plan.colPlan")}</th>
                <th className="text-center px-4 py-3 font-medium text-[var(--muted)]">{t("panel.verification")}</th>
                <th className="text-center px-4 py-3 font-medium text-[var(--muted)]">{t("panel.status")}</th>
                <th
                  className="text-center px-4 py-3 font-medium text-[var(--muted)]"
                  title={t("panel.excludeStatsHint")}
                >
                  {t("panel.countStats")}
                </th>
                <th className="text-right px-4 py-3 font-medium text-[var(--muted)]">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--background)]/30 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-foreground">{u.full_name || "—"}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{u.email || "—"}</td>
                  <td className="px-4 py-3 text-center">
                    <RoleControl user={u} canEdit={isAdmin} disabled={updating === u.id} onChange={changeRole} />
                  </td>
                  {showSiteRole && (
                    <td className="px-4 py-3 text-center">
                      <SiteFlags
                        user={u}
                        canEdit={isSiteAdmin}
                        disabled={updating === u.id}
                        onToggle={toggleSiteFlag}
                      />
                    </td>
                  )}
                  <td className="px-4 py-3 text-center">
                    <PlanControl user={u} canEdit={isAdmin} disabled={updating === u.id} onChange={changePlan} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <VerifyBadge verifiedAt={u.email_verified_at} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge active={u.is_active} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => toggleStats(u)}
                      disabled={updating === u.id}
                      title={
                        u.exclude_from_stats
                          ? t("panel.statsExcludedHint")
                          : t("panel.statsCountedHint")
                      }
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                        u.exclude_from_stats
                          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25"
                          : "bg-[var(--background)] text-[var(--muted)] hover:text-foreground"
                      }`}
                    >
                      {u.exclude_from_stats ? t("panel.excluded") : t("panel.counted")}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      {showSiteRole && isSiteAdmin && (
                        <button
                          type="button"
                          onClick={() => removeFromSite(u)}
                          disabled={updating === u.id}
                          title={t("panel.removeFromSite")}
                          aria-label={t("panel.removeFromSite")}
                          className="rounded-lg p-2 text-[var(--muted)] transition-colors hover:bg-amber-50 hover:text-amber-700 disabled:opacity-40 dark:hover:bg-amber-900/20"
                        >
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H9m3-4l-3 4 3 4M5 4h6a2 2 0 012 2v1M5 4a2 2 0 00-2 2v12a2 2 0 002 2h6a2 2 0 002-2v-1" />
                          </svg>
                        </button>
                      )}
                      {isAdmin && (
                        <BanButton user={u} disabled={updating === u.id} onClick={() => toggleActive(u)} />
                      )}
                      {isAdmin && (
                        <DeleteUserButton user={u} disabled={updating === u.id} onClick={() => removeUser(u)} />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {loadError ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center">
                    <span className="text-red-700 dark:text-red-400">{t("panel.usersLoadError")}</span>
                    <button
                      type="button"
                      onClick={() => setReloadKey((k) => k + 1)}
                      className="ml-3 inline-flex min-h-[32px] items-center rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-sm font-medium text-foreground hover:border-[var(--primary)]"
                    >
                      {t("common.retry")}
                    </button>
                  </td>
                </tr>
              ) : (
                filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[var(--muted)]">
                      {t("panel.noUsers")}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/**
 * The plan a user is on, and the way an admin overrides it.
 *
 * Read-only for a delegate with the Users feature: changing what somebody may
 * spend is a full-admin decision, the same line the role control draws.
 */
function PlanControl({
  user,
  canEdit,
  disabled,
  onChange,
}: {
  user: UserRow;
  canEdit: boolean;
  disabled: boolean;
  onChange: (user: UserRow, plan: string) => void;
}) {
  const t = useT();
  const current = user.plan ?? "free";
  if (!canEdit) {
    return <span className="text-xs font-medium">{PLANS[normalizePlan(current)].label}</span>;
  }
  return (
    <>
      <select
        value={current}
        disabled={disabled}
        onChange={(e) => onChange(user, e.target.value)}
        className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-base sm:text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 disabled:opacity-50"
        aria-label={t("plan.colPlan")}
      >
        {PLAN_LIST.map((p) => (
          <option key={p.key} value={p.key}>
            {p.label}
          </option>
        ))}
      </select>
      {/* Only a bought plan has an end date; a granted one has none. */}
      {user.plan_expires_at && (
        <span className="mt-0.5 block text-[0.65rem] text-[var(--muted)]">
          {t("plan.activeUntil", { date: new Date(user.plan_expires_at).toLocaleDateString() })}
        </span>
      )}
    </>
  );
}

/**
 * Dua kotak centang, bukan satu dropdown.
 *
 * "Mengelola situs ini" (Agent) dan "boleh menjual di situs ini" (publisher)
 * disimpan di dua tabel dan bisa berlaku bersamaan. Satu dropdown memaksa
 * keduanya jadi pilihan yang saling meniadakan, dan itu bukan modelnya.
 */
function SiteFlags({
  user,
  canEdit,
  disabled,
  onToggle,
}: {
  user: UserRow;
  canEdit: boolean;
  disabled: boolean;
  onToggle: (user: UserRow, field: "isAgent" | "isPublisher", next: boolean) => void;
}) {
  const t = useT();
  if (user.is_agent === null || user.is_agent === undefined) {
    return <span className="text-xs text-[var(--muted)]">—</span>;
  }
  const box = (
    field: "isAgent" | "isPublisher",
    checked: boolean,
    label: string,
  ) => (
    <label className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)]">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled || !canEdit}
        onChange={(e) => onToggle(user, field, e.target.checked)}
        className="h-3.5 w-3.5 rounded border-[var(--border)] accent-[var(--primary)] disabled:opacity-50"
      />
      {label}
    </label>
  );
  return (
    <span className="inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
      {box("isAgent", !!user.is_agent, t("panel.roleAgent"))}
      {box("isPublisher", !!user.is_publisher, t("panel.rolePublisher"))}
    </span>
  );
}

function RoleControl({
  user,
  canEdit,
  disabled,
  onChange,
}: {
  user: UserRow;
  canEdit: boolean;
  disabled: boolean;
  onChange: (user: UserRow, accountType: AccountType) => void;
}) {
  const t = useT();
  if (!canEdit) return <RoleBadge role={user.account_type} />;
  return (
    <select
      value={user.account_type}
      disabled={disabled}
      onChange={(e) => onChange(user, e.target.value as AccountType)}
      className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-base sm:text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 disabled:opacity-50"
      aria-label={t("panel.changeRole")}
    >
      <option value="customer">customer</option>
      <option value="publisher">publisher</option>
      <option value="company">company</option>
    </select>
  );
}

function BanButton({ user, disabled, onClick }: { user: UserRow; disabled: boolean; onClick: () => void }) {
  const t = useT();
  const active = user.is_active;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={active ? t("panel.banUser") : t("panel.unbanUser")}
      aria-label={active ? t("panel.banUser") : t("panel.unbanUser")}
      className={`rounded-lg p-2 transition-colors disabled:opacity-40 ${
        active
          ? "text-[var(--muted)] hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
          : "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
      }`}
    >
      {active ? (
        // Ban (no-entry) icon
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636L5.636 18.364M12 21a9 9 0 100-18 9 9 0 000 18z" />
        </svg>
      ) : (
        // Unban (restore) icon
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )}
    </button>
  );
}

/**
 * Permanent delete, next to the reversible one.
 *
 * Disabled rather than hidden for an admin — which covers your own row, since
 * only a full admin sees this button at all. The server refuses both cases
 * anyway; a control that silently isn't there teaches nothing, so it stays
 * visible and the tooltip says what to do instead.
 */
function DeleteUserButton({
  user,
  disabled,
  onClick,
}: {
  user: UserRow;
  disabled: boolean;
  onClick: () => void;
}) {
  const t = useT();
  const blocked = user.account_type === "company";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || blocked}
      title={blocked ? t("panel.deleteUserAdminHint") : t("panel.deleteUser")}
      aria-label={t("panel.deleteUser")}
      className="rounded-lg p-2 text-[var(--muted)] transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[var(--muted)] dark:hover:bg-red-900/20"
    >
      {/* Trash */}
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
        />
      </svg>
    </button>
  );
}

function RoleBadge({ role }: { role: AccountType }) {
  const cls =
    role === "company"
      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
      : role === "agent"
        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
        : "bg-[var(--accent-subtle)] text-[var(--muted)]";
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{role}</span>;
}

/**
 * Whether the address was ever proven. Amber rather than red: an unverified
 * account is a loose end to chase, not a banned one — they can still buy and
 * download, and most simply haven't got round to clicking the link.
 */
function VerifyBadge({ verifiedAt }: { verifiedAt?: string | null }) {
  const t = useT();
  const done = !!verifiedAt;
  return (
    <span
      title={
        verifiedAt
          ? t("panel.verifiedOn", { date: new Date(verifiedAt).toLocaleDateString("id-ID") })
          : t("panel.neverVerified")
      }
      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
        done
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
          : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
      }`}
    >
      {done ? t("home.verified") : t("panel.notYet")}
    </span>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  const t = useT();
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
        active
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
          : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
      }`}
    >
      {active ? t("sites.active") : t("panel.banned")}
    </span>
  );
}
