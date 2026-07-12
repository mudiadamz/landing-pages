"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { updateRolePermissions } from "@/lib/actions/site-settings";
import { ADMIN_FEATURES, type FeatureKey } from "@/lib/features";
import type { ConfigurableRole, RolePermissions } from "@/lib/role-permissions";

const ROLES: { key: ConfigurableRole; label: string; note: string }[] = [
  { key: "publisher", label: "Publisher", note: "Sudah otomatis: pembelian, produk sendiri, stats produknya." },
  { key: "customer", label: "Customer", note: "Sudah otomatis: daftar pembelian." },
];

export function RolesForm({ initial }: { initial: RolePermissions }) {
  const [perms, setPerms] = useState<RolePermissions>(initial);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok?: boolean; error?: string } | null>(null);

  function toggle(role: ConfigurableRole, key: FeatureKey) {
    setPerms((p) => {
      const has = p[role].includes(key);
      return { ...p, [role]: has ? p[role].filter((k) => k !== key) : [...p[role], key] };
    });
    setStatus(null);
  }

  function handleSave() {
    startTransition(async () => {
      setStatus(await updateRolePermissions(perms));
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800/50 dark:bg-amber-900/15 dark:text-amber-200">
        Admin selalu punya akses penuh ke semua fitur (tidak dapat diubah).
      </div>

      {ROLES.map((role) => (
        <section key={role.key} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">{role.label}</h2>
            <p className="mt-0.5 text-xs text-[var(--muted)]">{role.note}</p>
          </div>
          <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
            {ADMIN_FEATURES.map((f) => (
              <label key={f.key} className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={perms[role.key].includes(f.key)}
                  onChange={() => toggle(role.key, f.key)}
                  className="h-4 w-4 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                />
                {f.label}
              </label>
            ))}
          </div>
        </section>
      ))}

      <div className="sticky bottom-0 flex items-center gap-3 border-t border-[var(--border)] bg-[var(--background)] py-3">
        <Button size="md" onClick={handleSave} loading={pending} disabled={pending}>
          {pending ? "Menyimpan…" : "Simpan"}
        </Button>
        {status?.error && <span className="text-sm text-red-600">{status.error}</span>}
        {status?.ok && <span className="text-sm text-green-600">Tersimpan.</span>}
      </div>
    </div>
  );
}
